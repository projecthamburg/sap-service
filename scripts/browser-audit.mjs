import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compareBrandReference } from "./evidence/brand-reference.mjs";
import { captureDOM } from "./evidence/dom-capture.mjs";

// Exercise rendered public assets in Chrome, including CSS backgrounds. This does
// not submit forms, send notifications or create calendar appointments.
const base = new URL(process.argv[2] || "http://127.0.0.1:4173/");
const output = resolve(".local/browser-audit");
await mkdir(output, { recursive: true });
const executablePath =
  process.env.SAP_CHROME_PATH ||
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
  ].find(existsSync);
if (!executablePath)
  throw new Error(
    "Google Chrome is required. Set SAP_CHROME_PATH to its executable."
  );
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: process.env.CI ? ["--no-sandbox"] : [],
  defaultViewport: { width: 1440, height: 1000 },
});
const results = [],
  pageErrors = [],
  assetErrors = [];
const check = (name, passed, detail = "") => {
  results.push({ name, passed: Boolean(passed), detail });
  console.log(
    `${passed ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`
  );
};
const page = await browser.newPage();
await page.setCacheEnabled(false);
await page.emulateMediaFeatures([
  { name: "prefers-reduced-motion", value: "reduce" },
]);
await page.evaluateOnNewDocument(() =>
  localStorage.setItem("sap:theme", "light")
);
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  if (
    response.url().startsWith(base.origin + base.pathname) &&
    response.status() >= 400
  )
    assetErrors.push({ status: response.status(), url: response.url() });
});
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function goto(hash) {
  await page.goto(new URL(hash, base).href, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await page.evaluate(() => document.fonts.ready);
}
async function decodeBackgrounds() {
  return page.$$eval(".comparison-image", async (elements) =>
    Promise.all(
      elements.map(async (element) => {
        const background = getComputedStyle(element).backgroundImage;
        const url = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
        if (!url) return { loaded: false, background };
        const image = new Image();
        image.src = url;
        try {
          await image.decode();
          return {
            loaded: image.naturalWidth > 1000 && image.naturalHeight > 300,
            url,
            width: image.naturalWidth,
            height: image.naturalHeight,
          };
        } catch {
          return { loaded: false, url };
        }
      })
    )
  );
}
async function capture(name, selector) {
  await page.evaluate(() => document.activeElement?.blur());
  await page.$eval(selector, (e) =>
    e.scrollIntoView({ behavior: "instant", block: "center" })
  );
  await pause(150);
  await page.screenshot({ path: resolve(output, name + ".png") });
}
try {
  for (const language of ["en", "fr"]) {
    await goto("#/" + language + "/");
    check(
      `${language}: calendar starts loading before scrolling`,
      await page.$eval(
        "#booking-frame",
        (e) => e.loading === "eager" && e.getAttribute("src") === e.dataset.src
      )
    );
    check(
      `${language}: homepage language`,
      await page.evaluate(
        (lang) => document.documentElement.lang === lang + "-CA",
        language
      )
    );
    check(
      `${language}: brand font loaded`,
      await page.evaluate(() => document.fonts.check("500 24px Figtree"))
    );
    const brand = await compareBrandReference(page);
    check(
      `${language}: logo matches the supplied artwork`,
      brand.passed,
      `silhouette IoU ${brand.intersectionOverUnion.toFixed(4)}`
    );
    await writeFile(
      resolve(output, `brand-${language}.json`),
      JSON.stringify(brand, null, 2)
    );
    await writeFile(
      resolve(output, `domscan-${language}.json`),
      JSON.stringify(await page.evaluate(captureDOM, {}), null, 2)
    );
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 1000 });
      check(
        `${language}: page fits ${width}px`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2
        )
      );
    }
    // Visit every section to trigger real lazy image and iframe loading.
    for (const selector of [
      "#services",
      "#projects",
      "#approach",
      "#estimate",
      ".comparison-section",
      "#consultation",
      ".faq-section",
    ]) {
      await page.$eval(selector, (e) =>
        e.scrollIntoView({ behavior: "instant" })
      );
      await pause(100);
    }
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 20000 })
      .catch(() => {});
    const images = await page.$$eval("main img", async (elements) =>
      Promise.all(
        elements.map(async (image) => {
          try {
            await image.decode();
            return { loaded: image.naturalWidth > 0, src: image.currentSrc };
          } catch {
            return { loaded: false, src: image.currentSrc || image.src };
          }
        })
      )
    );
    check(
      `${language}: every photograph decodes`,
      images.every((image) => image.loaded),
      JSON.stringify(images.filter((image) => !image.loaded))
    );
    const initialComparison = await decodeBackgrounds();
    check(
      `${language}: comparison images load before any selector is clicked`,
      initialComparison.length === 2 &&
        initialComparison.every(
          (image) =>
            image.loaded && image.url.endsWith("/cleaning-comparison.webp")
        )
    );
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      await page.$eval(".comparison-section", (e) =>
        e.scrollIntoView({ behavior: "instant" })
      );
      for (const key of [
        "condo",
        "fitness",
        "restaurant",
        "healthcare",
        "office",
      ]) {
        await page.$eval(`[data-comparison="${key}"]`, (e) => e.click());
        const filename =
          key === "condo" ? "cleaning-comparison.webp" : `cleaning-${key}.webp`;
        await page.waitForFunction(
          (filename) =>
            [...document.querySelectorAll(".comparison-image")].every((e) =>
              getComputedStyle(e).backgroundImage.includes("/" + filename)
            ),
          {},
          filename
        );
        const images = await decodeBackgrounds();
        check(
          `${language}/${width}: ${key} before and after pictures decode`,
          images.length === 2 &&
            images.every(
              (image) => image.loaded && image.url.endsWith("/" + filename)
            ),
          JSON.stringify(images)
        );
      }
      await page.$eval('[data-comparison="condo"]', (e) => e.click());
      await page.waitForFunction(() =>
        getComputedStyle(
          document.querySelector(".comparison-after")
        ).backgroundImage.includes("/cleaning-comparison.webp")
      );
      await decodeBackgrounds();
      const slider = await page.$(".comparison-slider");
      await slider.evaluate((e) =>
        e.scrollIntoView({ behavior: "instant", block: "center" })
      );
      const box = await slider.boundingBox();
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, {
        steps: 5,
      });
      await page.mouse.up();
      check(
        `${language}/${width}: slider responds to dragging`,
        await slider.evaluate((e) => Number(e.value) > 60)
      );
      await slider.focus();
      await page.keyboard.press("Home");
      check(
        `${language}/${width}: slider reveals the after image`,
        await page.$eval(
          ".comparison-view",
          (e) => e.style.getPropertyValue("--position") === "0%"
        )
      );
      await page.keyboard.press("End");
      check(
        `${language}/${width}: slider reveals the before image`,
        await page.$eval(
          ".comparison-view",
          (e) => e.style.getPropertyValue("--position") === "100%"
        )
      );
      await page.$eval(".comparison-slider", (e) => {
        e.value = 50;
        e.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await capture(
        `comparison-${language}-${width}-light`,
        ".comparison-view"
      );
      await page.$eval('[data-action="theme"]', (e) => e.click());
      await decodeBackgrounds();
      check(
        `${language}/${width}: dark theme keeps both images`,
        (await decodeBackgrounds()).every((image) => image.loaded)
      );
      await capture(`comparison-${language}-${width}-dark`, ".comparison-view");
      await page.$eval('[data-action="theme"]', (e) => e.click());
    }
    await page.setViewport({ width: 390, height: 1000 });
    await page.focus('[data-action="menu"]');
    await page.$eval('[data-action="menu"]', (e) => e.click());
    check(
      `${language}: mobile navigation opens`,
      await page.$eval("#main-nav", (e) => e.classList.contains("is-open"))
    );
    check(
      `${language}: opened navigation receives keyboard focus`,
      await page.$eval("#main-nav", (e) => e.contains(document.activeElement))
    );
    await page.keyboard.press("Escape");
    check(
      `${language}: Escape closes mobile navigation`,
      await page.$eval(
        '[data-action="menu"]',
        (e) => e.getAttribute("aria-expanded") === "false"
      )
    );
    check(
      `${language}: Escape returns focus to the menu control`,
      await page.$eval(
        '[data-action="menu"]',
        (e) => e === document.activeElement
      )
    );
    // Place a temporary, noninteractive status message over a real control.
    // Pointer hit testing must still reach the button beneath it.
    const toastPassesInput = await page.evaluate(() => {
      const button = document.querySelector('[data-action="theme"]'),
        box = button.getBoundingClientRect();
      const message = document.createElement("div");
      message.className = "toast";
      message.textContent = "Audit status";
      Object.assign(message.style, {
        left: box.x + "px",
        top: box.y + "px",
        bottom: "auto",
        transform: "none",
        width: box.width + "px",
        height: box.height + "px",
        padding: "0",
      });
      document.body.append(message);
      const hit = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2
        ),
        passes = Boolean(hit && button.contains(hit));
      message.remove();
      return passes;
    });
    check(
      `${language}: status messages do not intercept controls`,
      toastPassesInput
    );
    // Exercise all six actual estimator cards, including optional discovery.
    await page.$eval('[data-est="sample"]', (e) => e.click());
    await page.$eval('[name="budget"]', (e) => {
      e.value = "200";
      e.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.$eval('[name="referredBy"]', (e) => {
      e.value = "Synthetic audit referral";
      e.dispatchEvent(new Event("input", { bubbles: true }));
    });
    for (let card = 0; card < 5; card++) {
      if (card === 4) {
        check(
          `${language}: optional consultation discovery fields render`,
          await page.$$eval(".discovery-fields textarea", (a) => a.length === 3)
        );
        await page.$eval('[name="expectations"]', (e) => {
          e.value = "Inspection-ready handover";
          e.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      await page.$eval('#estimate-form button[type="submit"]', (e) =>
        e.click()
      );
    }
    check(
      `${language}: estimator completes with optional budget and discovery`,
      Boolean(await page.$(".result-range strong")) &&
        Boolean(await page.$(".budget-fit"))
    );
    await page.$eval('[data-est="save"]', (e) => e.click());
    check(
      `${language}: saved scopes exclude private discovery text`,
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("sap:estimate")).scope;
        return (
          !s.referredBy && !s.expectations && !s.concerns && !s.additionalInfo
        );
      })
    );
    for (const route of ["careers", "privacy", "terms", "inbox"]) {
      await goto("#/" + language + "/" + route);
      check(
        `${language}: ${route} route renders`,
        await page.$eval("main", (e) =>
          Boolean(e.querySelector("h1")?.textContent.trim())
        )
      );
      check(
        `${language}: ${route} fits mobile`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2
        )
      );
      if (route === "careers") {
        check(
          `${language}: availability has 28 selectable shifts`,
          await page.$$eval('[name="availability"]', (e) => e.length === 28)
        );
        check(
          `${language}: résumé upload is present`,
          Boolean(await page.$('[name="resume"]'))
        );
        await page.$eval("#career-form", (e) => e.requestSubmit());
        const message = await page.$eval(
          '[name="name"]',
          (e) => e.validationMessage
        );
        check(
          `${language}: required fields prevent submission`,
          message.length > 0
        );
        if (language === "fr")
          check(
            "French validation is localized",
            /Veuillez|champ|requis/i.test(message)
          );
        check(
          `${language}: career photo decodes`,
          await page.$eval(".careers-hero img", async (e) => {
            try {
              await e.decode();
              return e.naturalWidth > 0;
            } catch {
              return false;
            }
          })
        );
      }
      if (route === "inbox") {
        await page.waitForSelector('.admin-login input[type="password"]');
        check(
          `${language}: inbox requires an invited account`,
          Boolean(await page.$('.admin-login input[type="password"]')) &&
            !(await page.$(".inbox-record"))
        );
      }
    }
  }
  await goto("#consultation");
  await page.waitForSelector("#booking-frame[src]");
  if (process.env.SAP_AUDIT_CALENDAR === "true") {
    let frame;
    for (let i = 0; i < 100; i++) {
      frame = page
        .frames()
        .find((f) =>
          f.url().startsWith("https://schedule.projecthamburg.com/booking/")
        );
      if (frame) break;
      await pause(200);
    }
    if (!frame)
      throw new Error(
        "The scheduling iframe did not navigate to the booking provider."
      );
    await frame.waitForFunction(() => document.body.innerText.length > 80, {
      timeout: 45000,
    });
    check(
      "Live scheduling form renders inside the section",
      await frame.$eval("body", (e) => /SAP Service Inc/.test(e.innerText))
    );
  }
  check(
    "No uncaught page errors",
    pageErrors.length === 0,
    JSON.stringify(pageErrors)
  );
  check(
    "No public assets return errors",
    assetErrors.length === 0,
    JSON.stringify(assetErrors)
  );
} catch (error) {
  check("Browser audit completed", false, error.stack || error.message);
  await page
    .screenshot({ path: resolve(output, "failure.png") })
    .catch(() => {});
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      { base: base.href, results, pageErrors, assetErrors },
      null,
      2
    )
  );
  await browser.close();
}
console.log(
  `Browser audit: ${results.filter((r) => r.passed).length} passed, ${
    results.filter((r) => !r.passed).length
  } failed.`
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
