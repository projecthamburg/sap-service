import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { captureDOM, diffCaptures } from "./evidence/dom-capture.mjs";
import { compareBrandReference } from "./evidence/brand-reference.mjs";
const base = new URL(process.argv[2] || "http://127.0.0.1:4173/");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = resolve(".local/domscan/runs", stamp);
await mkdir(output, { recursive: true });
const executablePath =
  process.env.SAP_CHROME_PATH ||
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ].find(existsSync);
if (!executablePath)
  throw Error("Google Chrome is required. Set SAP_CHROME_PATH.");
const manifest = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  base: base.href,
  captures: [],
  source: [],
  status: "running",
  scopes: [".site-header", "main", ".site-footer"],
  limitations: [
    "Captures cover the declared public scopes, not every application state.",
    "Static analysis, runtime observation and brand fidelity are separate evidence layers.",
  ],
};
for (const file of [
  "src/brand.js",
  "src/icons.js",
  "src/app.js",
  "src/styles.css",
  "src/estimator.js",
  "public/brand/favicon.svg",
  "public/brand/sap-service.svg",
])
  manifest.source.push({
    path: file,
    sha256: createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  });
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: process.env.CI ? ["--no-sandbox"] : [],
  defaultViewport: { width: 1440, height: 1000 },
});
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  for (const language of ["en", "fr"])
    for (const theme of ["light", "dark"])
      for (const width of [390, 1440]) {
        await page.setViewport({ width, height: 1000 });
        await page.goto(new URL("#/" + language + "/", base).href, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme;
        }, theme);
        await page.evaluate(() => document.fonts.ready);
        const photographs = await page.$$eval("main img", async (images) =>
          Promise.all(
            images.map(async (image) => {
              image.loading = "eager";
              await image.decode();
              return {
                src: image.currentSrc,
                width: image.naturalWidth,
                height: image.naturalHeight,
              };
            })
          )
        );
        if (!photographs.length || photographs.some((image) => !image.width))
          throw Error("A public photograph failed to decode before capture.");
        const name = `${language}-${theme}-${width}`;
        await page.$eval(".comparison-view", (e) =>
          e.scrollIntoView({ behavior: "instant", block: "center" })
        );
        await page.$eval('[data-comparison="condo"]', (e) => e.click());
        await page.waitForFunction(() =>
          getComputedStyle(
            document.querySelector(".comparison-after")
          ).backgroundImage.includes("/cleaning-comparison.webp")
        );
        await page.$eval(".comparison-after", async (e) => {
          const url = getComputedStyle(e).backgroundImage.match(
            /^url\(["']?(.*?)["']?\)$/
          )?.[1];
          const image = new Image();
          image.src = url;
          await image.decode();
        });
        const before = await page.evaluate(captureDOM, {
          scopes: manifest.scopes,
        });
        await writeFile(
          resolve(output, name + "-before.json"),
          JSON.stringify(before, null, 2)
        );
        await page.screenshot({ path: resolve(output, name + "-before.png") });
        const selector = '[data-comparison="fitness"]';
        if ((await page.$$eval(selector, (e) => e.length)) !== 1)
          throw Error("Missing or ambiguous comparison control.");
        await page.click(selector);
        await page.waitForFunction(
          () =>
            document
              .querySelector('[data-comparison="fitness"]')
              .getAttribute("aria-pressed") === "true" &&
            getComputedStyle(
              document.querySelector(".comparison-after")
            ).backgroundImage.includes("/cleaning-fitness.webp")
        );
        await page.$eval(".comparison-after", async (e) => {
          const image = new Image();
          image.src = getComputedStyle(e).backgroundImage.match(
            /^url\(["']?(.*?)["']?\)$/
          )[1];
          await image.decode();
        });
        const after = await page.evaluate(captureDOM, {
          scopes: manifest.scopes,
        });
        const diff = diffCaptures(before, after);
        await writeFile(
          resolve(output, name + "-after.json"),
          JSON.stringify(after, null, 2)
        );
        await writeFile(
          resolve(output, name + "-diff.json"),
          JSON.stringify(diff, null, 2)
        );
        await page.screenshot({ path: resolve(output, name + "-after.png") });
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        const brand = await compareBrandReference(page);
        await page.screenshot({ path: resolve(output, name + "-brand.png") });
        if (
          before.coverage.truncated ||
          after.coverage.truncated ||
          before.scopes.some((s) => s.status !== "captured") ||
          after.scopes.some((s) => s.status !== "captured") ||
          !brand.passed ||
          diff.changed.length === 0
        )
          throw Error("Incomplete DOM coverage or brand-reference mismatch.");
        manifest.captures.push({
          name,
          brand,
          photographs,
          coverage: after.coverage,
          changed: diff.changed.length,
          files: [
            name + "-before.json",
            name + "-after.json",
            name + "-diff.json",
            name + "-before.png",
            name + "-after.png",
            name + "-brand.png",
          ],
        });
        console.log(
          "Captured",
          name,
          "brand IoU",
          brand.intersectionOverUnion.toFixed(4),
          "changed nodes",
          diff.changed.length
        );
      }
  manifest.status = "complete";
} catch (error) {
  manifest.status = "failed";
  manifest.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  manifest.finishedAt = new Date().toISOString();
  await writeFile(
    resolve(output, "run_manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  await mkdir(".local/domscan", { recursive: true });
  await writeFile(
    ".local/domscan/latest.json",
    JSON.stringify({ run: output, status: manifest.status }, null, 2)
  );
  await browser.close();
}
console.log("Domscan evidence:", output);
