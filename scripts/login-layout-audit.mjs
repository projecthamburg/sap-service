// Public sign-in resize audit; no account credentials or operational records.
import puppeteer from "puppeteer-core";
import { writeFile, mkdir } from "node:fs/promises";
import { captureDOM } from "./evidence/dom-capture.mjs";
const base = new URL(process.argv[2] || "http://127.0.0.1:4173/");
const b = await puppeteer.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  defaultViewport: null,
  args: ["--window-position=100,100", "--window-size=1200,900"],
});
const p = await b.newPage();
const cdp = await p.createCDPSession();
const { windowId } = await cdp.send("Browser.getWindowForTarget");
const results = [];
await mkdir(".local/admin-map/native-resize", { recursive: true });
try {
  for (const app of [false, true]) {
    const url = new URL(base);
    if (app) url.searchParams.set("workspace", "maps");
    url.hash = "/en/admin/maps";
    await p.goto(url.href, { waitUntil: "networkidle2" });
    await p.waitForSelector(".admin-login");
    for (const [width, height] of [
      [1800, 1000],
      [1200, 900],
      [820, 1000],
      [620, 840],
      [420, 820],
      [1000, 640],
      [700, 450],
      [1600, 1000],
    ]) {
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width, height, windowState: "normal" },
      });
      await new Promise((r) => setTimeout(r, 300));
      await p.evaluate(() => scrollTo(0, 0));
      const r = await p.evaluate(() => {
        const r = document
            .querySelector(".admin-login")
            .getBoundingClientRect(),
          h = document.querySelector(".site-header").getBoundingClientRect();
        const fits = r.height + 48 < innerHeight - h.bottom;
        return {
          inner: [innerWidth, innerHeight],
          outer: [outerWidth, outerHeight],
          horizontal: Math.abs((r.left + r.right) / 2 - document.documentElement.clientWidth / 2) < 2,
          vertical:
            !fits ||
            Math.abs((r.top + r.bottom) / 2 - (h.bottom + innerHeight) / 2) < 2,
          belowHeader: r.top >= h.bottom,
          withinViewport: r.right <= innerWidth && r.left >= 0,
          header: h.toJSON(),
          rect: r.toJSON(),
        };
      });
      results.push({ app, width, height, ...r });
      console.log(
        app,
        width,
        height,
        r.horizontal && r.vertical && r.belowHeader && r.withinViewport
          ? "PASS"
          : "FAIL",
        JSON.stringify(r)
      );
      await p.screenshot({
        path: `.local/admin-map/native-resize/${app ? "pwa" : "admin"}-${width}-${height}.png`,
      });
      if ([420, 1200].includes(width))
        await writeFile(
          `.local/admin-map/native-resize/${app ? "pwa" : "admin"}-${width}.dom.json`,
          JSON.stringify(
            await p.evaluate(captureDOM, {
              scopes: [".admin-portal"],
              maxElements: 300,
            }),
            null,
            2
          ),
          { mode: 0o600 }
        );
    }
  }
} finally {
  await b.close();
  await writeFile(
    ".local/admin-map/native-resize/report.json",
    JSON.stringify(results, null, 2),
    { mode: 0o600 }
  );
}
if (
  results.some(
    (r) => !r.horizontal || !r.vertical || !r.belowHeader || !r.withinViewport
  )
)
  process.exitCode = 1;
