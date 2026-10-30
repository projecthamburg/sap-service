import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
try {
  process.loadEnvFile(".env");
} catch {}
let local = {};
try {
  local = JSON.parse(
    await readFile(".local/browserstack-secrets.json", "utf8")
  );
} catch {}
const username = process.env.BROWSERSTACK_USERNAME || local.username,
  accessKey = process.env.BROWSERSTACK_ACCESS_KEY || local.accessKey;
if (!username || !accessKey)
  throw Error(
    "BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY are required."
  );
const headers = {
  Authorization:
    "Basic " + Buffer.from(username + ":" + accessKey).toString("base64"),
  "Content-Type": "application/json",
};
const site =
  process.env.SAP_AUDIT_URL || "https://projecthamburg.github.io/sap-service/";
const output = resolve(".local/device-audit");
await mkdir(output, { recursive: true });
const matrix = [
  {
    name: "iphone-safari",
    browserName: "safari",
    options: { deviceName: "iPhone 16", osVersion: "18", realMobile: true },
  },
  {
    name: "android-chrome",
    browserName: "chrome",
    options: {
      deviceName: "Samsung Galaxy S23",
      osVersion: "13.0",
      realMobile: true,
    },
  },
  {
    name: "mac-safari",
    browserName: "safari",
    browserVersion: "18.4",
    options: { os: "OS X", osVersion: "Sequoia" },
  },
  {
    name: "windows-edge",
    browserName: "Edge",
    browserVersion: "latest",
    options: { os: "Windows", osVersion: "11" },
  },
].filter((x) => !process.argv[2] || process.argv[2] === x.name);
const report = [];
const clean = (message) =>
  String(message)
    .replaceAll(accessKey, "[redacted]")
    .replaceAll(username, "[account]");
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(path, body, method = body ? "POST" : "GET") {
  const response = await fetch(
    "https://hub-cloud.browserstack.com/wd/hub" + path,
    {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(180000),
    }
  );
  const data = await response.json();
  if (!response.ok || data.value?.error)
    throw Error(
      clean(data.value?.message || data.message || JSON.stringify(data))
    );
  return data;
}
for (const device of matrix) {
  const results = [],
    entry = { device: device.name, results };
  report.push(entry);
  let id;
  const check = (name, passed, detail = "") => {
    results.push({ name, passed: Boolean(passed), detail });
    console.log(
      `${passed ? "PASS" : "FAIL"} ${device.name}: ${name}${
        detail ? " — " + clean(detail) : ""
      }`
    );
  };
  try {
    console.log("Starting BrowserStack:", device.name);
    const session = await request("/session", {
      capabilities: {
        alwaysMatch: {
          browserName: device.browserName,
          ...(device.browserVersion
            ? { browserVersion: device.browserVersion }
            : {}),
          "bstack:options": {
            ...device.options,
            projectName: "SAP Service",
            buildName: "SAP deployed image audit",
            sessionName: "SAP " + device.name,
            debug: true,
            networkLogs: true,
            consoleLogs: "errors",
            idleTimeout: 120,
          },
        },
      },
    });
    id = session.value?.sessionId || session.sessionId;
    if (!id) throw Error("BrowserStack did not return a session ID.");
    entry.sessionId = id;
    await request(`/session/${id}/timeouts`, {
      pageLoad: 60000,
      script: 60000,
      implicit: 0,
    });
    const execute = async (script, args = []) =>
      (await request(`/session/${id}/execute/sync`, { script, args })).value;
    const asyncExecute = async (script, args = []) =>
      (
        await request(`/session/${id}/execute/async`, {
          script:
            "const done=arguments[arguments.length-1];(async()=>{" +
            script +
            "})().then(done,error=>done({error:String(error)}));",
          args,
        })
      ).value;
    const until = async (script) => {
      for (let i = 0; i < 60; i++) {
        if (await execute(script)) return;
        await pause(500);
      }
      throw Error("Page state did not become ready.");
    };
    const capture = async (name) => {
      const image = (await request(`/session/${id}/screenshot`)).value;
      await writeFile(
        resolve(output, device.name + "-" + name + ".png"),
        Buffer.from(image, "base64")
      );
    };
    for (const language of ["en", "fr"]) {
      await request(`/session/${id}/url`, {
        url: site + "#/" + language + "/",
      });
      await until('return Boolean(document.querySelector(".hero h1"));');
      await execute(
        'document.documentElement.dataset.theme="light";localStorage.setItem("sap:theme","light");document.documentElement.style.scrollBehavior="auto";'
      );
      check(
        language + " homepage renders",
        await execute(
          'return document.documentElement.lang===arguments[0]+"-CA";',
          [language]
        )
      );
      check(
        language + " page fits viewport",
        await execute(
          "return document.documentElement.scrollWidth<=innerWidth+2;"
        )
      );
      await capture(language + "-hero");
      await execute(
        'document.querySelector(".comparison-view").scrollIntoView({block:"center",behavior:"instant"});'
      );
      const initial = await asyncExecute(
        'await new Promise(r=>setTimeout(r,600));const e=document.querySelector(".comparison-after"),url=getComputedStyle(e).backgroundImage.match(/^url\\(["\x27]?(.*?)["\x27]?\\)$/)?.[1];if(!url)return {loaded:false};const image=new Image();image.src=url;await image.decode();return {loaded:image.naturalWidth>1000,url};'
      );
      check(
        language + " initial comparison image decodes",
        initial?.loaded === true,
        initial?.error || ""
      );
      for (const key of [
        "condo",
        "fitness",
        "restaurant",
        "healthcare",
        "office",
      ]) {
        const image = await asyncExecute(
          'const key=arguments[0];document.querySelector(`[data-comparison="${key}"]`).click();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const expected=key==="condo"?"cleaning-comparison.webp":`cleaning-${key}.webp`;const values=await Promise.all([...document.querySelectorAll(".comparison-image")].map(async e=>{const url=getComputedStyle(e).backgroundImage.match(/^url\\(["\x27]?(.*?)["\x27]?\\)$/)?.[1];if(!url)return false;const image=new Image();image.src=url;await image.decode();return image.naturalWidth>1000&&url.endsWith("/"+expected);}));return {loaded:values.length===2&&values.every(Boolean)};',
          [key]
        );
        check(
          language + " " + key + " images decode",
          image?.loaded === true,
          image?.error || ""
        );
      }
      await execute(
        'document.querySelector("[data-comparison=condo]").click();const slider=document.querySelector(".comparison-slider");slider.value=25;slider.dispatchEvent(new Event("input",{bubbles:true}));'
      );
      check(
        language + " range control updates the clipping position",
        await execute(
          'return document.querySelector(".comparison-view").style.getPropertyValue("--position")==="25%";'
        )
      );
      const sliderElement = (
        await request(`/session/${id}/element`, {
          using: "css selector",
          value: ".comparison-slider",
        })
      ).value;
      const sliderId =
        sliderElement["element-6066-11e4-a52e-4f735466cecf"] ||
        sliderElement.ELEMENT;
      await request(`/session/${id}/element/${sliderId}/click`, {});
      check(
        language + " slider responds to browser input",
        await execute(
          'return Number(document.querySelector(".comparison-slider").value)>=40&&Number(document.querySelector(".comparison-slider").value)<=60;'
        )
      );
      await pause(300);
      await capture(language + "-comparison");
      await execute('document.querySelector("[data-action=theme]").click();');
      check(
        language + " dark theme switches",
        await execute('return document.documentElement.dataset.theme==="dark";')
      );
      await capture(language + "-comparison-dark");
      await execute(
        'document.querySelector("[data-action=theme]").click();document.querySelector("[data-est=sample]").click();'
      );
      for (let i = 0; i < 5; i++)
        await execute(
          'document.querySelector("#estimate-form button[type=submit]").click();'
        );
      check(
        language + " sample estimate completes",
        await execute(
          'return Boolean(document.querySelector(".result-range strong"));'
        )
      );
      await execute(
        'document.querySelector(".result-range").scrollIntoView({block:"center",behavior:"instant"});'
      );
      await capture(language + "-estimate");
      await execute('document.querySelector("[data-est=quote]").click();');
      check(
        language + " quotation dialog opens",
        await execute(
          'return document.querySelector("#request-dialog").open&&Boolean(document.querySelector("#quote-form [name=consent]"));'
        )
      );
      await execute('document.querySelector("#request-dialog").close();');
      await request(`/session/${id}/url`, {
        url: site + "#/" + language + "/careers",
      });
      await until('return Boolean(document.querySelector("#career-form"));');
      check(
        language + " career availability and résumé fields render",
        await execute(
          'return document.querySelectorAll("[name=availability]").length===28&&Boolean(document.querySelector("[name=resume]"));'
        )
      );
      check(
        language + " career page fits viewport",
        await execute(
          "return document.documentElement.scrollWidth<=innerWidth+2;"
        )
      );
      const photo = await asyncExecute(
        'const image=document.querySelector(".careers-hero img");await image.decode();return image.naturalWidth>0;'
      );
      check(language + " career photograph decodes", photo === true);
    }
    await request(`/session/${id}/url`, { url: site + "#consultation" });
    await until(
      'return Boolean(document.querySelector("#booking-frame")?.getAttribute("src"));'
    );
    const frameElement = (
      await request(`/session/${id}/element`, {
        using: "css selector",
        value: "#booking-frame",
      })
    ).value;
    await request(`/session/${id}/frame`, { id: frameElement });
    await until("return document.body.innerText.length>80;");
    check(
      "Embedded calendar renders",
      await execute(
        'return document.body.innerText.includes("SAP Service Inc.");'
      )
    );
    await capture("calendar");
    await request(`/session/${id}/frame`, { id: null });
    const passed = results.every((x) => x.passed);
    await execute(
      "browserstack_executor: " +
        JSON.stringify({
          action: "setSessionStatus",
          arguments: {
            status: passed ? "passed" : "failed",
            reason: passed
              ? "All deployed image, language, layout and estimator checks passed."
              : "See SAP device audit report.",
          },
        })
    );
  } catch (error) {
    entry.error = clean(error.message);
    check("Device audit completed", false, entry.error);
  } finally {
    if (id)
      try {
        await request(`/session/${id}`, null, "DELETE");
      } catch (error) {
        entry.cleanupError = clean(error.message);
      }
    await writeFile(
      resolve(output, device.name + ".json"),
      JSON.stringify(entry, null, 2)
    );
    await writeFile(
      resolve(output, "report.json"),
      JSON.stringify(report, null, 2)
    );
  }
}
console.log(
  "BrowserStack checks:",
  report.reduce((n, r) => n + r.results.filter((x) => x.passed).length, 0),
  "passed;",
  report.reduce((n, r) => n + r.results.filter((x) => !x.passed).length, 0),
  "failed."
);
if (report.some((r) => r.results.some((x) => !x.passed))) process.exitCode = 1;
