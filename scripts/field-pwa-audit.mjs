// Real browser field-work tests use a server-side isolated test namespace.
import puppeteer from "puppeteer-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
const base = "https://projecthamburg.github.io/sap-service/",
  staged = process.argv.includes("--staged"),
  account = JSON.parse(
    await readFile(".local/admin-map/test-account.json", "utf8")
  ),
  api = JSON.parse(await readFile("api/deployment.json", "utf8")).apiUrl,
  output = resolve(".local/admin-map/field-pwa-audit");
await mkdir(output, { recursive: true, mode: 0o700 });
const browser = await puppeteer.launch({
  executablePath:
    process.env.SAP_CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  protocolTimeout: 60000,
});
const checks = [],
  errors = [],
  failedRequests = [];
let bearer, siteId;
const check = (name, passed) => {
  checks.push({ name, passed: !!passed });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function pageFor(app) {
  const p = await browser.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("requestfailed", (r) => {
    const u = new URL(r.url());
    failedRequests.push({
      url: u.origin + u.pathname,
      error: r.failure()?.errorText,
    });
  });
  p.on("request", (r) => {
    if (r.url().startsWith(api) && r.headers().authorization)
      bearer = r.headers().authorization;
  });
  await p.evaluateOnNewDocument((api) => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.startsWith(api + "/admin/maps/")) {
        const headers = new Headers(init.headers || {});
        headers.set("X-SAP-Test", "true");
        return original(input, { ...init, headers });
      }
      return original(input, init);
    };
  }, api);
  if (staged) {
    await p.setRequestInterception(true);
    p.on("request", async (r) => {
      const u = new URL(r.url());
      if (
        u.origin === new URL(base).origin &&
        u.pathname.startsWith("/sap-service/")
      ) {
        const path =
          decodeURIComponent(u.pathname.slice("/sap-service/".length)) ||
          "index.html";
        if (path.includes("..")) return r.abort();
        try {
          return r.respond({
            status: 200,
            contentType:
              {
                ".html": "text/html",
                ".js": "application/javascript",
                ".css": "text/css",
                ".json": "application/json",
                ".webmanifest": "application/manifest+json",
                ".png": "image/png",
                ".svg": "image/svg+xml",
                ".woff2": "font/woff2",
              }[extname(path)] || "application/octet-stream",
            body: await readFile(resolve("dist", path)),
          });
        } catch {
          return r.respond({ status: 404, body: "Not found" });
        }
      }
      r.continue();
    });
  }
  await p.setViewport({ width: 390, height: 844 });
  const url = new URL(base);
  if (app) url.searchParams.set("workspace", "maps");
  url.hash = "/en/admin/maps";
  await p.goto(url.href, { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForSelector(".admin-login");
  await p.type("[name=email]", account.email);
  await p.type("[name=password]", account.password);
  await p.$eval(".admin-login", (f) => f.requestSubmit());
  await p.waitForSelector(".lead-row", { timeout: 30000 });
  await p.waitForSelector(".gm-style", { timeout: 30000 });
  await pause(1500);
  return p;
}
async function click(p, s) {
  await p.$eval(s, (e) => {
    const d = e.closest("details");
    if (d && !d.open) d.open = true;
    e.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await pause(100);
  await p.click(s);
}
try {
  const p = await pageFor(true);
  check(
    "Standalone app uses a map-first layout",
    await p.evaluate(
      () =>
        document.body.classList.contains("maps-app") &&
        getComputedStyle(document.querySelector(".map-layout")).position ===
          "fixed"
    )
  );
  check(
    "Floating search and current-location control are visible",
    await p.evaluate(
      () =>
        document.querySelector(".map-app-search").getBoundingClientRect()
          .width > 200 &&
        document.querySelector("[data-my-location]").getBoundingClientRect()
          .height >= 44
    )
  );
  await p.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await p.waitForFunction(
    () => document.querySelector(".map-canvas").dataset.scheme === "dark"
  );
  await pause(1500);
  check(
    "Native Google dark scheme is used",
    await p.evaluate(
      () =>
        document.querySelector(".map-canvas").dataset.scheme === "dark" &&
        !document.querySelector(".map-canvas").textContent.includes("Oops!")
    )
  );
  await p.screenshot({ path: resolve(output, "pwa-phone-night.png") });
  await browser
    .defaultBrowserContext()
    .overridePermissions(new URL(base).origin, []);
  await click(p, "[data-my-location]");
  await p.waitForFunction(() =>
    document
      .querySelector(".map-status")
      .textContent.includes("permission denied")
  );
  check(
    "Location denial is explained without an invented position",
    await p.$eval("[data-radar-status]", (e) =>
      e.textContent.includes("GPS off")
    )
  );
  await browser
    .defaultBrowserContext()
    .overridePermissions(new URL(base).origin, ["geolocation"]);
  await p.setGeolocation({ latitude: 45.55, longitude: -73.55, accuracy: 8 });
  await click(p, "[data-my-location]");
  await p.waitForFunction(() =>
    document
      .querySelector("[data-radar-status]")
      .textContent.includes("GPS active")
  );
  check("My location activates live follow and nearby alerts", true);
  await p.select("[data-radius]", "1609.344");
  check(
    "One-mile alert radius is available",
    await p.$eval("[data-radius]", (e) => e.value === "1609.344")
  );
  await p.select("[data-radius]", "3218.688");
  check(
    "Two-mile alert radius is available",
    await p.$eval("[data-radius]", (e) => e.value === "3218.688")
  );
  await p.$eval("[data-add-site]", (e) => e.click());
  await p.waitForSelector("dialog [data-record-location]");
  await click(p, "dialog [data-record-location]");
  await p.waitForSelector("dialog [data-new-site]");
  await click(p, "dialog [type=submit]");
  check(
    "Incomplete site capture requests a required name",
    await p.$eval("dialog [name=name]", (e) => !e.validity.valid)
  );
  const name = "QA field capture " + Date.now();
  await p.type("dialog [name=name]", name);
  await p.type(
    "dialog [name=notes]",
    "Synthetic browser audit only. Isolated from the operational register."
  );
  await click(p, "dialog [type=submit]");
  await p.waitForFunction(
    () =>
      document
        .querySelector("dialog")
        ?.textContent.includes("QA field capture") &&
      !document.querySelector("dialog [data-new-site]"),
    { timeout: 30000 }
  );
  siteId = await p.$eval(
    "dialog .eyebrow",
    (e) => e.textContent.match(/SAP-F-[A-F0-9]+/)?.[0]
  );
  check("GPS site is saved privately and opens its dossier", !!siteId);
  for (const state of ["visited", "return", "open"]) {
    await click(p, `dialog [data-set-visit=${state}]`);
    await p.waitForFunction(() => !document.querySelector("dialog[open]"));
    await p.$eval(
      "[data-search]",
      (e, v) => {
        e.value = v;
        e.dispatchEvent(new Event("input", { bubbles: true }));
      },
      siteId
    );
    if (await p.$("[data-sheet-toggle]"))
      await p.$eval(".lead-sidebar", (e) => e.classList.add("sheet-expanded"));
    await click(p, ".lead-row");
    await p.waitForSelector("dialog [data-set-visit]");
    const expected = {
      visited: "Visited",
      return: "Will return",
      open: "Open",
    }[state];
    check(
      "Saved site status " + expected,
      await p.$eval(
        "dialog .field-workflow strong",
        (e, v) => e.textContent === v,
        expected
      )
    );
  }
  const href = await p.$eval("dialog [data-route]", (e) => e.href),
    route = new URL(href);
  check(
    "Driving directions use GPS origin and car navigation",
    route.searchParams.get("origin") === "45.55,-73.55" &&
      route.searchParams.get("travelmode") === "driving" &&
      route.searchParams.get("dir_action") === "navigate"
  );
  await click(p, "dialog [data-close]");
  await p.$eval("[data-search]", (e) => {
    e.value = "";
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.$eval(".lead-sidebar", (e) => e.classList.remove("sheet-expanded"));
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [667, 375],
    [390, 390],
    [390, 300],
    [768, 1024],
    [1024, 1366],
    [1440, 1000],
  ]) {
    await p.setViewport({ width, height });
    await pause(300);
    check(
      `Standalone ${width} has no horizontal overflow`,
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    );
    const overlaps = await p.evaluate(() => {
      const selectors = [
        ".map-app-search",
        ".map-app-chips",
        ".map-app-controls",
        ".map-app-nearby",
        ".lead-sidebar",
        ".map-status",
      ];
      const rects = selectors
        .map((s) => [s, document.querySelector(s).getBoundingClientRect()])
        .filter(([, r]) => r.width && r.height);
      const collisions = [];
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const [a, r] = rects[i],
            [b, s] = rects[j];
          if (
            Math.min(r.right, s.right) - Math.max(r.left, s.left) > 1 &&
            Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top) > 1
          )
            collisions.push(a + " / " + b);
        }
      return collisions;
    });
    check(
      `Standalone ${width}×${height} controls do not overlap: ${overlaps.join(", ") || "clear"}`,
      overlaps.length === 0
    );
    await p.screenshot({
      path: resolve(output, `pwa-${width}-${height}-night.png`),
    });
  }
  await p.setViewport({ width: 390, height: 844 });
  await click(p, ".map-app-search .map-app-icon:last-child");
  await p.waitForSelector("dialog [data-open-import]");
  await click(p, "dialog [data-open-import]");
  await p.waitForSelector("dialog [data-save]");
  check(
    "Phone app exposes research import and fieldwork backup through options",
    true
  );
  check(
    "Phone import remains disabled until a reviewed file is supplied",
    await p.$eval("dialog [data-save]", (e) => e.disabled)
  );
  await click(p, "dialog [data-close]");
  await p.reload({ waitUntil: "networkidle2" });
  await p.waitForSelector(".lead-row");
  await p.$eval(
    "[data-search]",
    (e, v) => {
      e.value = v;
      e.dispatchEvent(new Event("input", { bubbles: true }));
    },
    siteId
  );
  check(
    "Saved field site survives a page reload",
    await p.$$eval(".lead-row", (e) => e.length === 1)
  );
  const plain = await fetch(api + "/admin/maps/dataset", {
      headers: { Authorization: bearer },
    }),
    normal = await plain.json();
  check(
    "Synthetic browser test site stays out of operational map",
    !normal.fieldSites.some((s) => s.id === siteId)
  );
  await p.select("[data-radius]", "1609.344");
  await p.setGeolocation({ latitude: 45.5717, longitude: -73.55, accuracy: 8 });
  await click(p, "[data-my-location]");
  await p.waitForFunction(() =>
    document
      .querySelector("[data-radar-status]")
      .textContent.includes("GPS active")
  );
  await pause(500);
  check(
    "A site 1.5 miles away does not alert within one mile",
    await p.$eval(".radar-alert", (e) => e.hidden)
  );
  await pause(16000);
  await p.select("[data-radius]", "3218.688");
  await p.waitForFunction(() => !document.querySelector(".radar-alert").hidden);
  check(
    "The same site alerts within two miles",
    await p.$eval(
      ".radar-alert",
      (e, name) => e.textContent.includes(name),
      name
    )
  );
  await click(p, ".radar-alert [data-dismiss]");
  check(
    "Nearby alert can be dismissed",
    await p.$eval(".radar-alert", (e) => e.hidden)
  );
  await p.setViewport({ width: 390, height: 844 });
  await p.$eval(".lead-sidebar", (e) => e.classList.add("sheet-expanded"));
  check(
    "Expanded mobile list hides map status overlay",
    await p.$eval(
      ".map-status",
      (e) => getComputedStyle(e).visibility === "hidden"
    )
  );
  await p.$eval(".lead-sidebar", (e) => e.classList.remove("sheet-expanded"));
  await click(p, "[data-layers]");
  await pause(1500);
  check(
    "Satellite layer remains an interactive Google map",
    await p.$eval(".gm-style", (e) => e.getBoundingClientRect().height > 100)
  );
  await click(p, "[data-layers]");
  const desktop = await pageFor(false);
  await desktop.setViewport({ width: 1440, height: 1000 });
  check(
    "Website admin retains the SAP site layout",
    await desktop.evaluate(
      () =>
        !document.body.classList.contains("maps-app") &&
        getComputedStyle(document.querySelector(".site-footer")).display !==
          "none"
    )
  );
  await desktop.screenshot({
    path: resolve(output, "admin-desktop.png"),
    fullPage: true,
  });
  check("No runtime errors", errors.length === 0);
} catch (e) {
  check("Field/PWA audit completed", false);
  console.log(e.message);
  for (const p of await browser.pages())
    if (p.url().startsWith(base)) {
      try {
        console.log(
          (await p.$eval("#admin-body", (e) => e.innerText)).slice(0, 1400)
        );
        await p.screenshot({ path: resolve(output, "failure.png") });
      } catch {}
    }
} finally {
  if (siteId && bearer) {
    const r = await fetch(api + "/admin/maps/field-sites/" + siteId, {
      method: "DELETE",
      headers: { Authorization: bearer, "X-SAP-Test": "true" },
    });
    check("Isolated browser test field site removed", r.ok);
  }
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      { checks, errors, failedRequests, at: new Date().toISOString() },
      null,
      2
    ),
    { mode: 0o600 }
  );
  await browser.close();
}
if (checks.some((c) => !c.passed)) process.exitCode = 1;
