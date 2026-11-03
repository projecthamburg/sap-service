// Public-shell audit: no account credentials, operational records or model calls.
import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const base = new URL(process.argv[2] || "http://127.0.0.1:4173/");
const output = resolve(".local/admin-map/pwa-shell-audit");
await mkdir(output, { recursive: true, mode: 0o700 });
const browser = await puppeteer.launch({
  executablePath:
    process.env.SAP_CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const checks = [],
  errors = [];
const check = (name, passed) => {
  checks.push({ name, passed: !!passed });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
};
let release, page;
try {
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844 });
  const url = new URL(base);
  url.searchParams.set("workspace", "maps");
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".admin-login");
  release = await page.$eval('meta[name="sap-build"]', (e) => e.content);
  check(
    "Standalone entry opens the private sign-in gate",
    await page.evaluate(
      () =>
        document.body.classList.contains("maps-app") &&
        location.hash.endsWith("/admin/maps") &&
        !document.querySelector(".lead-row"),
    ),
  );
  const cdp = await page.createCDPSession();
  const manifest = await cdp.send("Page.getAppManifest");
  const app = JSON.parse(manifest.data);
  check("Manifest parses without browser errors", manifest.errors.length === 0);
  check(
    "App has its own map start URL and standalone display",
    app.display === "standalone" &&
      app.start_url.includes("workspace=maps") &&
      app.id.includes("workspace=maps"),
  );
  for (const icon of app.icons) {
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, new URL(icon.src, manifest.url).href);
    check(
      `Launcher ${icon.sizes} (${icon.purpose}) decodes`,
      icon.sizes === `${size[0]}x${size[1]}`,
    );
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  check(
    "Service worker controls the app in the repository scope",
    await page.evaluate(() =>
      navigator.serviceWorker.controller.scriptURL.endsWith("/sw.js"),
    ),
  );
  const install = await cdp.send("Page.getInstallabilityErrors");
  check(
    "Chrome reports no installability errors",
    install.installabilityErrors.length === 0,
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".admin-login");
  const cached = await page.evaluate(async () => {
    const entries = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        entries.push(request.url);
    return entries;
  });
  check(
    "Cache contains public shell assets",
    cached.some((u) => u.includes("/admin/portal.js")) &&
      cached.some((u) => u.includes("/src/app.js")),
  );
  check(
    "Cache excludes APIs, identity requests and private records",
    cached.every((u) => {
      const parsed = new URL(u);
      return (
        parsed.origin === base.origin &&
        !/admin-auth|submissions|field-sites|dataset|cognito|lambda-url/.test(u)
      );
    }),
  );
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-retry-offline]");
  check(
    "Offline launch explains that private data needs internet",
    await page.$eval(
      ".admin-login",
      (e) =>
        e.textContent.includes("Connect to continue") &&
        !document.querySelector(".lead-row"),
    ),
  );
  await page.screenshot({ path: resolve(output, "offline-phone.png") });
  await page.setOfflineMode(false);
  await page.click("[data-retry-offline]");
  await page.waitForSelector(".admin-login [name=password]");
  check("Reconnect restores the invited-account login", true);
  check("No application runtime errors", errors.length === 0);
} catch (e) {
  check("PWA shell audit completed", false);
  console.log(e.message);
  console.log(JSON.stringify(errors));
  if (page) {
    console.log((await page.$eval("body", (e) => e.innerText)).slice(0, 600));
    await page.screenshot({ path: resolve(output, "failure.png") });
  }
} finally {
  await browser.close();
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base: base.href,
        release,
        checks,
        errors,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}
if (checks.some((c) => !c.passed)) process.exitCode = 1;
