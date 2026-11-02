// Authenticated audit evidence is private. Never publish this directory as a Pages/Actions artifact.
import puppeteer from "puppeteer-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { createHash } from "node:crypto";
import { captureDOM } from "./evidence/dom-capture.mjs";
import { importErrors, quickMatch } from "../admin/model.js";
const staged = process.argv.includes("--staged");
const base =
  process.env.SAP_ADMIN_AUDIT_URL ||
  "https://projecthamburg.github.io/sap-service/";
const output = resolve(".local/admin-map/authenticated-audit");
await mkdir(output, { recursive: true, mode: 0o700 });
const account = JSON.parse(
  await readFile(
    process.env.SAP_ADMIN_AUDIT_ACCOUNT || ".local/admin-map/test-account.json",
    "utf8"
  )
);
const browser = await puppeteer.launch({
  executablePath:
    process.env.SAP_CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage(),
  checks = [],
  errors = [];
let research, bearer;
const check = (name, passed) => {
  checks.push({ name, passed: !!passed });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("/admin/session")) bearer = r.headers().authorization;
});
page.on("response", async (r) => {
  if (
    r.url().endsWith("/admin/maps/dataset") &&
    r.request().method() === "GET" &&
    r.ok()
  )
    try {
      research = await r.json();
    } catch {}
});
if (staged) {
  await page.setRequestInterception(true);
  page.on("request", async (r) => {
    const url = new URL(r.url()),
      site = new URL(base);
    if (url.origin === site.origin && url.pathname.startsWith(site.pathname)) {
      const path =
        decodeURIComponent(url.pathname.slice(site.pathname.length)) ||
        "index.html";
      if (path.split("/").includes("..")) return r.abort();
      try {
        const body = await readFile(resolve("dist", path)),
          contentType =
            {
              ".html": "text/html",
              ".js": "application/javascript",
              ".css": "text/css",
              ".json": "application/json",
              ".svg": "image/svg+xml",
              ".woff2": "font/woff2",
              ".webp": "image/webp",
            }[extname(path)] || "application/octet-stream";
        return r.respond({ status: 200, contentType, body });
      } catch {
        return r.respond({ status: 404, body: "Not found" });
      }
    }
    return r.continue();
  });
}
async function save(name) {
  await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({
    path: resolve(output, name + ".png"),
    fullPage: true,
  });
  const dom = await page.evaluate(captureDOM, {
    scopes: [".site-header", ".admin-portal"],
    maxElements: 2000,
    maxCharacters: 400000,
  });
  await writeFile(resolve(output, name + ".dom.json"), JSON.stringify(dom), {
    mode: 0o600,
  });
  check(name + " DOM coverage", !dom.coverage.truncated);
}
async function count() {
  return page.$$eval(".lead-row", (v) => v.length);
}
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(new URL("#/en/admin", base).href, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await page.waitForSelector(".admin-login");
  check("Main menu has Admin", await page.$('nav a[href="#/en/admin"]'));
  check(
    "No leads or inbox exposed before sign-in",
    !(await page.$(".lead-row,.inbox-record"))
  );
  await page.click(".admin-login [type=submit]");
  check(
    "Incomplete login is blocked",
    await page.$eval("[name=email]", (e) => !e.validity.valid)
  );
  await page.type("[name=email]", account.email);
  await page.type("[name=password]", account.password);
  await page.click(".admin-login [type=submit]");
  await page.waitForSelector(".lead-results", { timeout: 45000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".lead-row").length > 0,
    { timeout: 30000 }
  );
  check(
    "Authenticated real register loaded",
    research?.records?.length === 67 && (await count()) === 67
  );
  check(
    "Real tier counts",
    await page
      .$$eval("[data-count]", (nodes) =>
        Object.fromEntries(
          nodes.map((n) => [n.dataset.count, Number(n.textContent)])
        )
      )
      .then(
        (c) =>
          c.Immediate === 15 &&
          c["Near-term"] === 16 &&
          c.Strategic === 15 &&
          c.Monitor === 21
      )
  );
  await page.waitForSelector(".gm-style", { timeout: 30000 });
  await pause(4000);
  check(
    "Google Maps renders with dedicated key",
    await page.evaluate(
      () =>
        !document.querySelector(".map-canvas").textContent.includes("Oops!") &&
        !document
          .querySelector(".map-status")
          .textContent.includes("authorization failed")
    )
  );
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewport({ width, height: 1000 });
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme
      );
      await pause(600);
      await save(`google-${width}-${theme}`);
    }
  const api = await page.evaluate(
    () => JSON.parse(document.querySelector("#site-config").textContent).apiUrl
  );
  for (const path of [
    "/admin/session",
    "/admin/maps/config",
    "/admin/maps/dataset",
    "/admin/submissions",
  ])
    check(
      "Anonymous rejected: " + path,
      (await fetch(api + path)).status === 401
    );
  const stale = await fetch(api + "/admin/maps/dataset", {
    method: "POST",
    headers: { Authorization: bearer, "Content-Type": "application/json" },
    body: JSON.stringify({
      records: research.records,
      expectedVersion: "audit-stale-version",
      source: "Should never be saved",
    }),
  });
  check(
    "Stale import rejected without overwriting research",
    stale.status === 409
  );
  await page.click(".tier-controls input[value=Monitor]");
  check("Monitor toggle leaves 46 leads", (await count()) === 46);
  await page.click(".tier-controls input[value=Monitor]");
  for (const key of ["frecon", "axor", "pomerleau", "healthcare"]) {
    await page.click(`[data-quick=${key}]`);
    check(
      key + " uses source-aware counts",
      (await count()) ===
        research.records.filter((r) => quickMatch(r, key)).length
    );
    if (key === "frecon")
      check(
        "Bid dates distinguish published tender closes",
        await page.$eval(".map-deadline-note", (e) =>
          /published tender close/.test(e.textContent)
        )
      );
    await page.click("[data-clear]");
  }
  await page.type("[data-search]", "definitely-no-matching-project");
  check(
    "Empty search is explained",
    (await count()) === 0 && !!(await page.$(".map-empty"))
  );
  await page.click("[data-clear]");
  await page.click(".lead-row");
  await page.waitForSelector("dialog[open]");
  check(
    "Dossier retains citations and conflicts",
    await page.$eval(
      "dialog",
      (e) =>
        e.innerText.includes("Sources & conflicts") &&
        e.querySelectorAll("details li").length > 0
    )
  );
  await page.click("dialog [data-pin-anchor]");
  check(
    "Selected lead anchors radar",
    await page.$eval("[data-radar-status]", (e) =>
      e.textContent.includes("Map anchor active")
    )
  );
  await page.click("[data-inside]");
  check(
    "Radius filter narrows real coordinates",
    (await count()) > 0 && (await count()) < 67
  );
  await page.click("[data-clear]");
  await page.select("[data-engine]", "leaflet");
  await page.waitForSelector(".leaflet-pane");
  await pause(1500);
  check("Fallback retains all real leads", (await count()) === 67);
  check(
    "Fallback includes map attribution",
    await page.$eval(".leaflet-control-attribution", (e) =>
      e.textContent.includes("OpenStreetMap")
    )
  );
  await browser
    .defaultBrowserContext()
    .overridePermissions(new URL(base).origin, []);
  await page.click("[data-gps]");
  await page.waitForFunction(
    () =>
      document
        .querySelector(".map-status")
        .textContent.includes("permission denied"),
    { timeout: 10000 }
  );
  check(
    "GPS denial does not fabricate a location",
    await page.$eval("[data-radar-status]", (e) =>
      e.textContent.includes("GPS off")
    )
  );
  await browser
    .defaultBrowserContext()
    .overridePermissions(new URL(base).origin, ["geolocation"]);
  const source = research.records.find((r) =>
    Number.isFinite(r.latitude_estimate)
  );
  await page.setGeolocation({
    latitude: source.latitude_estimate,
    longitude: source.longitude_estimate,
    accuracy: 8,
  });
  await page.click("[data-gps]");
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-radar-status]")
        .textContent.includes("GPS active"),
    { timeout: 10000 }
  );
  check(
    "Browser-supplied test GPS activates real radar logic",
    await page.$eval("[data-radar-status]", (e) =>
      e.textContent.includes("±8 m")
    )
  );
  await page.click("[data-gps]");
  await page.click("[data-import]");
  const bad = resolve(output, "invalid-import.json");
  await writeFile(bad, '[{"lead_id":"INVALID"}]', { mode: 0o600 });
  await (await page.$("dialog [data-file]")).uploadFile(bad);
  await page.waitForFunction(
    () => document.querySelector("dialog [data-preview]").textContent.length > 0
  );
  check(
    "Incomplete import stays disabled with guidance",
    await page.$eval("dialog [data-save]", (e) => e.disabled)
  );
  check(
    "Incomplete import reports required fields",
    await page.$eval("dialog [data-preview]", (e) =>
      e.textContent.includes("project_name")
    )
  );
  await page.click("dialog [data-close]");
  await page.click("[data-settings]");
  await page.click("dialog [data-analyst]");
  await page.click("dialog [data-close]");
  await page.click(".lead-row");
  check(
    "Cancelled settings do not change evidence view",
    await page.$eval("dialog details", (e) => e.open)
  );
  await page.click("dialog [data-close]");
  for (const width of [1440, 1024, 768, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewport({ width, height: 1000 });
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme
      );
      await pause(400);
      check(
        `${width} ${theme}: no overflow`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        )
      );
      await save(`maps-${width}-${theme}`);
    }
  check(
    "No research or GPS persisted in localStorage",
    await page.evaluate(
      () =>
        !Object.keys(localStorage).some((k) =>
          /SAP-C00|latitude_estimate|longitude_estimate/.test(localStorage[k])
        )
    )
  );
  await page.click("[data-tool=inbox]");
  await page.waitForSelector(".inbox-container");
  await page.waitForFunction(
    () =>
      document.querySelector("#inbox-content").textContent.includes("Refresh"),
    { timeout: 30000 }
  );
  check(
    "Existing inbox uses authenticated session",
    !(await page.$(".inbox-login"))
  );
  await page.click("[data-logout]");
  await page.waitForSelector(".admin-login");
  check(
    "Logout removes private UI",
    !(await page.$(".lead-row,.inbox-record"))
  );
  check(
    "Logout removes cached JWT tokens",
    await page.evaluate(
      () =>
        !Object.keys(sessionStorage).some(
          (k) => /accessToken|idToken|refreshToken/.test(k) && sessionStorage[k]
        )
    )
  );
  check("No runtime errors", errors.length === 0);
} catch (e) {
  check("Audit completed", false);
  console.error(e.message);
  try {
    await page.screenshot({
      path: resolve(output, "failure.png"),
      fullPage: true,
    });
  } catch {}
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      {
        staged,
        at: new Date().toISOString(),
        checks,
        errors,
        datasetVersion: research?.version,
        sourceCount: research?.records?.length,
        sourceHash: research?.records
          ? createHash("sha256")
              .update(JSON.stringify(research.records))
              .digest("hex")
          : null,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  await browser.close();
}
if (checks.some((c) => !c.passed)) process.exitCode = 1;
