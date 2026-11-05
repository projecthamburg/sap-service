// Authorized demo credentials and authenticated evidence must stay outside Git.
import puppeteer from "puppeteer-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { mapExpectations, researchMatchesAudit } from "./evidence/map-expectations.mjs";
import { captureDOM } from "./evidence/dom-capture.mjs";
const staged = process.argv.includes("--staged");
const base = "https://projecthamburg.github.io/sap-service/";
const account = JSON.parse(await readFile(process.env.SAP_DEMO_ACCOUNT || ".local/admin-demo/credentials.json", "utf8"));
if (account.cognitoUsername !== "demo@sap-service.invalid") throw Error("Use the reserved read-only demo account.");
const expected = await mapExpectations();
const output = resolve(process.env.SAP_DEMO_AUDIT_OUTPUT || ".local/admin-demo/login-audit");
await mkdir(output, { recursive: true, mode: 0o700 });
const browser = await puppeteer.launch({ executablePath: process.env.SAP_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage(), checks = [], errors = [];
const pause = ms => new Promise(r => setTimeout(r, ms));
const check = (name, passed) => { checks.push({ name, passed: !!passed }); console.log(`${passed ? "PASS" : "FAIL"} ${name}`); if (!passed) throw Error(name); };
page.on("pageerror", e => errors.push(e.message));
if (staged) {
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url()), site = new URL(base);
    if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) return request.continue();
    const path = decodeURIComponent(url.pathname.slice(site.pathname.length)) || "index.html";
    if (path.split("/").includes("..")) return request.abort();
    try {
      const body = await readFile(resolve("dist", path)), contentType = ({ ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp" })[extname(path)] || "application/octet-stream";
      await request.respond({ status: 200, contentType, body });
    } catch { await request.respond({ status: 404, body: "Not found" }); }
  });
}
const entry = (lang, app, demo) => { const url = new URL(base); if (app) url.searchParams.set("workspace", "maps"); if (demo) url.searchParams.set("demo", "1"); url.hash = `/${lang}/admin${app ? "/maps" : ""}`; return url.href; };
async function open(url) { await page.goto(url, { waitUntil: "domcontentloaded" }); await page.waitForSelector(".admin-login"); await page.evaluate(() => document.fonts.ready); }
try {
  await page.setViewport({ width: 1440, height: 1000 });
  for (const [lang, app, demo] of [["en", false, false], ["fr", true, false], ["en", false, true], ["fr", true, true]]) {
    const name = `${lang}-${app ? "app" : "portal"}-${demo ? "shared" : "ordinary"}`;
    await open(entry(lang, app, demo));
    if (!demo) {
      check(name + " accepts demo and rejects an invalid identifier", await page.$eval("[name=email]", e => { e.value = "not-an-email"; e.dispatchEvent(new Event("input", {bubbles:true})); const invalid = !e.checkValidity(); e.value = "demo"; e.dispatchEvent(new Event("input", {bubbles:true})); return invalid && e.checkValidity(); }));
      check(name + " retains invited-email access", await page.$eval("[name=email]", e => { e.value = "staff@example.com"; e.dispatchEvent(new Event("input", {bubbles:true})); const valid = e.checkValidity(); e.value = ""; e.dispatchEvent(new Event("input", {bubbles:true})); return valid; }));
      check(name + " exposes a demo shortcut preserving language/app", await page.$eval("[data-demo-entry]", (e, args) => { const u = new URL(e.href); return u.searchParams.get("demo") === "1" && u.hash.includes(`/${args.lang}/`) && (u.searchParams.get("workspace") === "maps") === args.app; }, {lang, app}));
      await page.type("[name=email]", "DEMO");
    } else {
      check(name + " prefills demo without email or recovery", await page.$eval("[name=email]", e => e.type === "text" && e.value === "demo" && e.readOnly) && !(await page.$("[data-forgot]")));
    }
    if (!app && !demo) {
      await page.type("[name=password]", "Intentional-Wrong-Demo-Password-2026!");
      await page.click("[type=submit]");
      await page.waitForFunction(() => /incorrect|invalid|failed/i.test(document.querySelector(".admin-status")?.textContent || ""));
      check(name + " wrong-password error allows correction without email/reset", await page.$eval("[name=email]", e => e.value === "DEMO" && e.checkValidity()) && !(await page.$(".lead-row")));
      await page.$eval("[name=password]", e => { e.value = ""; });
    }
    await page.type("[name=password]", account.password);
    await page.click("[type=submit]");
    await page.waitForFunction(n => document.querySelectorAll(".lead-row").length === n, { timeout: 45000 }, expected.count);
    await page.waitForSelector(".gm-style", { timeout: 45000 });
    check(name + " signs in and keeps canonical demo entry", await page.evaluate(() => document.body.classList.contains("demo-session") && new URLSearchParams(location.search).get("demo") === "1"));
    const data = await page.evaluate(async () => { const c = await (await fetch("./site-config.json")).json(), key = Object.keys(sessionStorage).find(k => k.endsWith(".accessToken")); return (await fetch(c.apiUrl + "/admin/maps/dataset", { headers: { Authorization: "Bearer " + sessionStorage.getItem(key) } })).json(); });
    check(name + " retains exact audited research and excludes live notes", researchMatchesAudit(data.records, expected) && !data.fieldSites.length && !Object.keys(data.activity).length);
    check(name + " cannot import or save field sites", await page.evaluate(() => document.querySelector("[data-import]").disabled && document.querySelector("[data-add-site]").disabled));
    const denied = await page.evaluate(async () => { const c = await (await fetch("./site-config.json")).json(), key = Object.keys(sessionStorage).find(k => k.endsWith(".accessToken")), headers = { Authorization: "Bearer " + sessionStorage.getItem(key), "Content-Type": "application/json" }; return Promise.all([fetch(c.apiUrl + "/admin/submissions", { headers }).then(r => r.status), fetch(c.apiUrl + "/admin/maps/dataset", { method: "POST", headers, body: JSON.stringify({ expectedVersion: "deliberately-wrong-demo-version", records: [] }) }).then(r => r.status)]); });
    check(name + " server denies private reads and replacement", denied.every(status => status === 403));
    await page.screenshot({ path: resolve(output, name + ".png") });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lead-row", { timeout: 45000 });
    check(name + " reload retains the demo session", await page.evaluate(() => document.body.classList.contains("demo-session")));
    await page.$eval("[data-logout]", e => e.click());
    await page.waitForSelector(".admin-login");
    check(name + " sign-out returns to prefilled demo without email/reset", await page.$eval("[name=email]", e => e.value === "demo" && e.readOnly) && !(await page.$("[data-forgot]")));
    await page.click("[data-team-entry]");
    await page.waitForSelector("[data-demo-entry]");
    check(name + " team link returns to the regular form", await page.$eval("[name=email]", e => !e.readOnly && !new URLSearchParams(location.search).has("demo")));
  }
  for (const demo of [false, true]) for (const [width, height] of [[1440,1000],[390,844],[844,390],[768,1024],[1024,768]]) {
    await page.setViewport({ width, height });
    await open(entry("en", false, demo));
    for (const theme of ["light", "dark"]) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; scrollTo(0,0); }, theme); await pause(100);
      check(`${demo ? "demo" : "regular"} form ${width}×${height} ${theme} fits and stays centered`, await page.evaluate(() => { const r = document.querySelector(".admin-login").getBoundingClientRect(), h = document.querySelector(".site-header").getBoundingClientRect(), fits = r.height + 48 < innerHeight - h.bottom; return document.documentElement.scrollWidth <= innerWidth + 1 && Math.abs((r.left+r.right)/2-document.documentElement.clientWidth/2)<2 && r.top >= h.bottom-1 && (!fits || Math.abs((r.top+r.bottom)/2-(h.bottom+innerHeight)/2)<4); }));
      await page.screenshot({ path: resolve(output, `${demo ? "demo" : "regular"}-${width}-${height}-${theme}.png`), fullPage: true });
      const dom = await page.evaluate(captureDOM, { scopes: [".site-header", ".admin-portal"], maxElements: 400, maxCharacters: 160000 });
      await writeFile(resolve(output, `${demo ? "demo" : "regular"}-${width}-${height}-${theme}.dom.json`), JSON.stringify(dom), {mode:0o600});
    }
  }
  check("No application runtime errors", errors.length === 0);
} catch (e) { checks.push({name:e.message,passed:false}); console.log("FAIL " + e.message); process.exitCode = 1; await page.screenshot({path:resolve(output,"failure.png")}).catch(()=>{}); }
finally { await writeFile(resolve(output,"report.json"), JSON.stringify({at:new Date().toISOString(),staged,checks,errors},null,2), {mode:0o600}); await browser.close(); }
