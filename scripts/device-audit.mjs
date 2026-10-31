import { PDFDocument, StandardFonts } from "pdf-lib";
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
const useLocal = process.env.BROWSERSTACK_LOCAL === "true";
const output = resolve(
  process.env.SAP_DEVICE_AUDIT_OUTPUT || ".local/device-audit"
);
await mkdir(output, { recursive: true });
const previewDocument = await PDFDocument.create();
const previewFont = await previewDocument.embedFont(StandardFonts.Helvetica);
const previewPage = previewDocument.addPage([792, 600]);
previewPage.drawText("Synthetic device plan - no AI processing", {
  x: 40,
  y: 550,
  size: 20,
  font: previewFont,
});
previewPage.drawRectangle({
  x: 40,
  y: 70,
  width: 710,
  height: 430,
  borderWidth: 2,
});
const previewPDFBase64 = Buffer.from(await previewDocument.save()).toString(
  "base64"
);
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
    name: "ipad-safari",
    browserName: "safari",
    options: {
      deviceName: "iPad Air 13 2025",
      osVersion: "18",
      realMobile: true,
      deviceOrientation: "portrait",
    },
  },
  {
    name: "ipad-safari-landscape",
    browserName: "safari",
    options: {
      deviceName: "iPad Air 13 2025",
      osVersion: "18",
      realMobile: true,
      deviceOrientation: "landscape",
    },
  },
  {
    name: "android-tablet",
    browserName: "chrome",
    options: {
      deviceName: "Samsung Galaxy Tab S9",
      osVersion: "13.0",
      realMobile: true,
      deviceOrientation: "portrait",
    },
  },
  {
    name: "android-tablet-landscape",
    browserName: "chrome",
    options: {
      deviceName: "Samsung Galaxy Tab S9",
      osVersion: "13.0",
      realMobile: true,
      deviceOrientation: "landscape",
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
  {
    name: "windows-firefox",
    browserName: "Firefox",
    browserVersion: "latest",
    options: { os: "Windows", osVersion: "11" },
  },
].filter((x) => !process.argv[2] || process.argv[2] === x.name);
const report = [];
const clean = (message) =>
  String(message)
    .replaceAll(
      Buffer.from(username + ":" + accessKey).toString("base64"),
      "[redacted]"
    )
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
    entry = {
      device: device.name,
      url: site,
      localTunnel: useLocal,
      startedAt: new Date().toISOString(),
      results,
    };
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
            ...(useLocal
              ? {
                  local: true,
                  ...(process.env.BROWSERSTACK_LOCAL_IDENTIFIER
                    ? {
                        localIdentifier:
                          process.env.BROWSERSTACK_LOCAL_IDENTIFIER,
                      }
                    : {}),
                }
              : {}),
            projectName: "SAP Service",
            buildName: useLocal
              ? "SAP local preview audit"
              : "SAP deployed image audit",
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
    const execute = async (script, args = []) => {
      if (!script.startsWith("browserstack_executor:")) new Function(script);
      return (await request(`/session/${id}/execute/sync`, { script, args }))
        .value;
    };
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
      throw Error("Page state did not become ready: " + script.slice(0, 150));
    };
    const capture = async (name) => {
      const image = (await request(`/session/${id}/screenshot`)).value;
      await writeFile(
        resolve(output, device.name + "-" + name + ".png"),
        Buffer.from(image, "base64")
      );
    };
    const click = async (selector) => {
      await execute(
        'document.querySelector(arguments[0]).scrollIntoView({block:"center",behavior:"instant"});',
        [selector]
      );
      const element = (
        await request(`/session/${id}/element`, {
          using: "css selector",
          value: selector,
        })
      ).value;
      const elementId =
        element["element-6066-11e4-a52e-4f735466cecf"] || element.ELEMENT;
      await request(`/session/${id}/element/${elementId}/click`, {});
    };
    for (const language of ["en", "fr"]) {
      await request(`/session/${id}/url`, {
        url: site + "#/" + language + "/",
      });
      await until('return Boolean(document.querySelector(".hero h1"));');
      const environment = await execute(
        'return {release:document.querySelector("meta[name=sap-build]")?.content,viewport:{width:innerWidth,height:innerHeight},screen:{width:screen.width,height:screen.height},dpr:devicePixelRatio,userAgent:navigator.userAgent};'
      );
      entry.environment = environment;
      if (process.env.SAP_EXPECTED_RELEASE)
        check(
          language + " expected release is loaded",
          environment.release === process.env.SAP_EXPECTED_RELEASE,
          environment.release || "missing build identifier"
        );
      if (device.options.deviceOrientation)
        check(
          language + " tablet orientation is correct",
          device.options.deviceOrientation === "portrait"
            ? environment.viewport.height > environment.viewport.width
            : environment.viewport.width > environment.viewport.height,
          JSON.stringify(environment.viewport)
        );
      await execute(
        'document.documentElement.dataset.theme="light";localStorage.setItem("sap:theme","light");document.documentElement.style.scrollBehavior="auto";scrollTo({top:0,behavior:"instant"});'
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
      const mobileMenu = await execute(
        'const e=document.querySelector("[data-action=menu]");return getComputedStyle(e).display!=="none";'
      );
      if (mobileMenu) {
        await click('[data-action="menu"]');
        check(
          language + " navigation opens with browser input",
          await execute(
            'return document.querySelector("#main-nav").classList.contains("is-open");'
          )
        );
        await capture(language + "-navigation");
        await click('#main-nav a[href="#services"]');
        check(
          language + " navigation follows section and closes",
          await execute(
            'return !document.querySelector("#main-nav").classList.contains("is-open")&&document.querySelector("[data-action=menu]").getAttribute("aria-expanded")==="false";'
          )
        );
      }
      const photographs = await asyncExecute(
        'const images=[...document.querySelectorAll("main img")];return Promise.all(images.map(async image=>{image.loading="eager";try{await image.decode();return image.naturalWidth>0;}catch{return false;}}));'
      );
      check(
        language + " all homepage photographs decode",
        Array.isArray(photographs) &&
          photographs.length > 5 &&
          photographs.every(Boolean)
      );
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
      await execute('document.querySelector("[data-action=theme]").click();');
      await click('[data-est="sample"]');
      await execute(
        'for(const [name,value]of Object.entries({budget:"200",referredBy:"Synthetic device audit"})){const e=document.querySelector("[name="+name+"]");e.value=value;e.dispatchEvent(new Event("input",{bubbles:true}));}'
      );
      const selectHeights = [];
      for (let i = 0; i < 5; i++) {
        selectHeights.push(
          ...(await execute(
            'return [...document.querySelectorAll("#estimate-form select")].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height);'
          ))
        );
        check(
          language + " estimator card " + (i + 1) + " fits viewport",
          await execute(
            "return document.documentElement.scrollWidth<=innerWidth+2;"
          )
        );
        if (i === 2) await capture(language + "-room-card");
        if (i === 4) {
          check(
            language + " consultation discovery fields render",
            await execute(
              'return document.querySelectorAll(".discovery-fields textarea").length===3;'
            )
          );
          await execute(
            'const e=document.querySelector("[name=expectations]");e.value="Inspection-ready handover";e.dispatchEvent(new Event("input",{bubbles:true}));'
          );
          check(
            language + " optional plan review available",
            await execute(
              'return Boolean(document.querySelector("[data-est=plan-review]"));'
            )
          );
          await capture(language + "-discovery");
          await execute(
            'const bytes=Uint8Array.from(atob(arguments[0]),c=>c.charCodeAt(0));const files=new DataTransfer();files.items.add(new File([bytes],"device-preview.pdf",{type:"application/pdf"}));const e=document.querySelector("[name=projectFiles]");e.files=files.files;e.dispatchEvent(new Event("change",{bubbles:true}));',
            [previewPDFBase64]
          );
          await click('[data-est="plan-review"]');
          await until(
            'return Boolean(document.querySelector("[data-plan=preview]"));'
          );
          await click('[data-plan="preview"]');
          await until('return Boolean(document.querySelector(".plan-map"));');
          check(
            language + " padded plan preview renders on device",
            await execute(
              'return document.querySelectorAll("[data-tile]").length===3&&document.querySelector(".plan-map img").naturalWidth>0;'
            )
          );
          check(
            language + " AI page processing starts unconsented",
            await execute(
              'return !document.getElementsByName("plan.consent")[0].checked;'
            )
          );
          await capture(language + "-plan-preview");
          await click('[data-plan="discard"]');
          await execute(
            'document.querySelector("[data-remove-file]").click();'
          );
        }

        await click('#estimate-form button[type="submit"]');
      }
      check(
        language + " estimator selects have comfortable tap areas",
        selectHeights.length > 0 && Math.min(...selectHeights) >= 44,
        "minimum height " + Math.min(...selectHeights)
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
      check(
        language + " budget-fit guidance renders",
        await execute('return Boolean(document.querySelector(".budget-fit"));')
      );

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
      const nameElement = (
        await request(`/session/${id}/element`, {
          using: "css selector",
          value: '#career-form [name="name"]',
        })
      ).value;
      const nameId =
        nameElement["element-6066-11e4-a52e-4f735466cecf"] ||
        nameElement.ELEMENT;
      await click('#career-form [name="name"]');
      await request(`/session/${id}/element/${nameId}/value`, {
        text: "SAP QA Example",
      });
      check(
        language + " application text field accepts browser input",
        await execute(
          'return document.querySelector("#career-form [name=name]").value==="SAP QA Example";'
        )
      );
      if (
        device.options.realMobile &&
        device.browserName === "safari" &&
        device.options.deviceName.startsWith("iPhone")
      ) {
        await pause(600);
        const inputView = await execute(
          'return {scale:visualViewport.scale,fontSize:getComputedStyle(document.querySelector("#career-form [name=name]")).fontSize};'
        );
        check(
          language + " phone input uses readable text",
          parseFloat(inputView.fontSize) >= 16,
          JSON.stringify(inputView)
        );
        if (typeof inputView.scale === "number")
          check(
            language + " input focus preserves viewport scale",
            inputView.scale <= 1.05,
            String(inputView.scale)
          );
        else {
          entry.manualReviewRequired ||= [];
          entry.manualReviewRequired.push(
            language +
              " focused-input screenshot: the iOS driver did not expose visualViewport.scale; inspect the retained image for unwanted zoom."
          );
        }
      }
      await capture(language + "-input-focused");
      await request(`/session/${id}/element/${nameId}/clear`, {});
      await execute("document.activeElement.blur();");
      await click(".availability-cell");
      check(
        language + " career shift responds to browser input",
        await execute(
          'return document.querySelector("[name=availability]").checked;'
        )
      );
      await capture(language + "-availability");
      check(
        language + " incomplete application is invalid",
        await execute(
          'return !document.querySelector("#career-form").checkValidity();'
        )
      );
      const photo = await asyncExecute(
        'const image=document.querySelector(".careers-hero img");await image.decode();return image.naturalWidth>0;'
      );
      check(language + " career photograph decodes", photo === true);
    }
    await request(`/session/${id}/url`, { url: site + "#consultation" });
    await until('return Boolean(document.querySelector("#booking-frame"));');
    await execute(
      'document.querySelector("#booking-frame").scrollIntoView({block:"center",behavior:"instant"});'
    );
    await until(
      'return Boolean(document.querySelector("#booking-frame")?.getAttribute("src"));'
    );
    if (device.options.realMobile && device.browserName === "safari") {
      // iOS's remote debugger rejects inspection of cross-origin frames. Keep
      // normal browser security and retain a device screenshot for visual review.
      await pause(10000);
      check(
        "Embedded calendar frame is visible",
        await execute(
          'const e=document.querySelector("#booking-frame"),r=e.getBoundingClientRect();return e.src.startsWith("https://schedule.projecthamburg.com/")&&r.width>200&&r.bottom>0&&r.top<innerHeight;'
        )
      );
      entry.manualReviewRequired = [
        ...(entry.manualReviewRequired || []),
        "Review the iOS calendar screenshot: cross-origin frame contents cannot be inspected by its remote debugger.",
      ];
      await capture("calendar");
      await execute(
        'document.querySelector("#booking-frame").scrollIntoView({block:"end",behavior:"instant"});'
      );
      await capture("calendar-bottom");
    } else {
      const frameElement = (
        await request(`/session/${id}/element`, {
          using: "css selector",
          value: "#booking-frame",
        })
      ).value;
      await request(`/session/${id}/frame`, { id: frameElement });
      try {
        await until("return document.body.innerText.length>80;");
        check(
          "Embedded calendar renders",
          await execute(
            'return document.body.innerText.includes("SAP Service Inc.");'
          )
        );
      } finally {
        await request(`/session/${id}/frame`, { id: null });
      }
      // Firefox's screenshot driver cannot inspect a cross-origin parent's
      // scroll offsets from frame context. Capture from the top-level page.
      await capture("calendar");
    }
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
    if (id)
      try {
        const image = (await request(`/session/${id}/screenshot`)).value;
        await writeFile(
          resolve(output, device.name + "-failure.png"),
          Buffer.from(image, "base64")
        );
      } catch {}
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
