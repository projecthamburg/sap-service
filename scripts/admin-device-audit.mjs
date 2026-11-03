// Run only with an authorized disposable SAP admin account. Evidence stays private.
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
  key = process.env.BROWSERSTACK_ACCESS_KEY || local.accessKey;
if (!username || !key) throw Error("BrowserStack credentials are required.");
const account = JSON.parse(
  await readFile(
    process.env.SAP_ADMIN_AUDIT_ACCOUNT || ".local/admin-map/test-account.json",
    "utf8"
  )
);
const site =
  process.env.SAP_ADMIN_AUDIT_URL ||
  "https://projecthamburg.github.io/sap-service/";
const output = resolve(".local/admin-map/devices");
const expectedRelease =
  process.env.SAP_EXPECT_BUILD ||
  (await readFile("dist/index.html", "utf8")).match(
    /name="sap-build" content="([^"]+)"/
  )?.[1];
if (!expectedRelease) throw Error("Build the release before its device audit.");
await mkdir(output, { recursive: true, mode: 0o700 });
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
    name: "windows-chrome",
    browserName: "Chrome",
    browserVersion: "latest",
    options: { os: "Windows", osVersion: "11" },
  },
  {
    name: "windows-firefox",
    browserName: "Firefox",
    browserVersion: "latest",
    options: { os: "Windows", osVersion: "11" },
  },
].filter((d) => !process.argv[2] || d.name === process.argv[2]);
const headers = {
  Authorization:
    "Basic " + Buffer.from(username + ":" + key).toString("base64"),
  "Content-Type": "application/json",
  Connection: "close",
};
const clean = (s) =>
  String(s)
    .replaceAll(key, "[redacted]")
    .replaceAll(username, "[account]")
    .replaceAll(account.password, "[redacted]");
async function wd(path, body, method = body ? "POST" : "GET") {
  await new Promise((r) => setTimeout(r, 200));
  const r = await fetch("https://hub-cloud.browserstack.com/wd/hub" + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  const d = await r.json();
  if (!r.ok || d.value?.error)
    throw Error(
      clean(d.value?.message || d.message || "WebDriver request failed.")
    );
  return d.value;
}
const report = [],
  pause = (ms) => new Promise((r) => setTimeout(r, ms));
for (const device of matrix) {
  let id;
  const entry = {
    device: device.name,
    at: new Date().toISOString(),
    checks: [],
  };
  report.push(entry);
  const check = (name, passed) => {
    entry.checks.push({ name, passed: !!passed });
    console.log(`${passed ? "PASS" : "FAIL"} ${device.name}: ${name}`);
  };
  try {
    const session = await wd("/session", {
      capabilities: {
        alwaysMatch: {
          browserName: device.browserName,
          ...(device.browserVersion
            ? { browserVersion: device.browserVersion }
            : {}),
          "bstack:options": {
            ...device.options,
            projectName: "SAP Service",
            buildName: "SAP Maps field PWA " + expectedRelease,
            sessionName: device.name,
            debug: false,
            video: false,
            networkLogs: false,
            consoleLogs: "disable",
            idleTimeout: 120,
          },
        },
      },
    });
    id = session.sessionId;
    entry.sessionId = id;
    if (!id) throw Error("No session ID.");
    const exec = async (script, args = []) =>
      wd(`/session/${id}/execute/sync`, { script, args });
    const wait = async (script, seconds = 45) => {
      for (let n = 0; n < seconds; n++) {
        if (await exec(script)) return;
        await pause(1000);
      }
      throw Error("Timed out: " + script.slice(0, 120));
    };
    const click = async (selector) => {
      if (
        device.options.realMobile &&
        device.browserName.toLowerCase() === "chrome" &&
        (await exec(
          "return !!visualViewport && visualViewport.height < innerHeight - 80 && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)"
        ))
      ) {
        await exec("document.activeElement.blur();");
        await pause(700);
        entry.keyboardDismissals = (entry.keyboardDismissals || 0) + 1;
      }
      await exec(
        'document.querySelector(arguments[0]).scrollIntoView({block:"center",behavior:"instant"});',
        [selector]
      );
      await pause(200);
      const e = await wd(`/session/${id}/element`, {
          using: "css selector",
          value: selector,
        }),
        element = e["element-6066-11e4-a52e-4f735466cecf"] || e.ELEMENT;
      await wd(`/session/${id}/element/${element}/click`, {});
    };
    const capture = async (name) => {
      const b64 = await wd(`/session/${id}/screenshot`);
      await writeFile(
        resolve(output, device.name + "-" + name + ".png"),
        Buffer.from(b64, "base64"),
        { mode: 0o600 }
      );
    };
    await wd(`/session/${id}/timeouts`, {
      pageLoad: 60000,
      script: 45000,
      implicit: 0,
    });
    await wd(`/session/${id}/url`, { url: new URL("#/en/admin", site).href });
    await wait('return !!document.querySelector(".admin-login")');
    await wait('return document.fonts.status === "loaded"');
    entry.release = await exec(
      "return document.querySelector('meta[name=\"sap-build\"]').content"
    );
    entry.viewport = await exec(
      'return {width:innerWidth,height:innerHeight,orientation:innerWidth>innerHeight?"landscape":"portrait"}'
    );
    check("Expected deployed release", entry.release === expectedRelease);
    if (entry.release !== expectedRelease)
      throw Error("Deployed build does not match this audit.");
    check(
      "Invited-account sign-in gate",
      await exec(
        'return !document.querySelector(".lead-row,.inbox-record") && !!document.querySelector(".admin-login [name=password]")'
      )
    );
    check(
      "Sign-in card is centered and clear of the header",
      await exec(
        'const r=document.querySelector(".admin-login").getBoundingClientRect(),h=document.querySelector(".site-header").getBoundingClientRect();const fits=r.height+48<innerHeight-h.bottom;return Math.abs((r.left+r.right)/2-document.documentElement.clientWidth/2)<2 && r.top>=h.bottom && (!fits || Math.abs((r.top+r.bottom)/2-(h.bottom+innerHeight)/2)<4)'
      )
    );
    await click(".admin-login [type=submit]");
    check(
      "Empty sign-in guides the required email",
      await exec(
        'return document.querySelector(".admin-login [name=email]").validity.valueMissing && !document.querySelector(".lead-row")'
      )
    );
    await exec(
      'const e=document.querySelector(".admin-login [name=email]");e.value="not-an-email";document.querySelector(".admin-login").requestSubmit();'
    );
    check(
      "Invalid email stays at the sign-in gate",
      await exec(
        'return document.querySelector(".admin-login [name=email]").validity.typeMismatch && !document.querySelector(".lead-row")'
      )
    );
    await click("[data-forgot]");
    await wait('return !!document.querySelector("[data-back]")');
    await click("[data-back]");
    check(
      "Password recovery can be cancelled without sending a code",
      await exec(
        'return !!document.querySelector(".admin-login [name=password]")'
      )
    );
    await exec(
      'document.querySelector("[name=email]").value=arguments[0];document.querySelector("[name=password]").value="SAP-Audit-Wrong-Password-Only-2026!";document.querySelector(".admin-login").requestSubmit();',
      [account.email]
    );
    await wait(
      'return document.querySelector(".admin-login [role=status]").textContent.trim() && !document.querySelector(".admin-login [type=submit]").disabled'
    );
    check(
      "Incorrect password shows an error and permits retry",
      await exec(
        'return !document.querySelector(".lead-row") && !!document.querySelector(".admin-login [role=status]").textContent.trim()'
      )
    );
    await exec(
      'document.querySelector("[name=password]").value=arguments[0];document.querySelector(".admin-login").requestSubmit();',
      [account.password]
    );
    await wait('return document.querySelectorAll(".lead-row").length===67', 60);
    check("Real 67-record register loads", true);
    await wait('return !!document.querySelector(".gm-style")', 45);
    await pause(2500);
    check(
      "Google primary map renders",
      await exec(
        'return !document.querySelector(".map-canvas").textContent.includes("Oops!") && !document.querySelector(".map-status").textContent.includes("authorization failed")'
      )
    );
    for (const theme of ["light", "dark"]) {
      await exec("document.documentElement.dataset.theme=arguments[0];", [
        theme,
      ]);
      await pause(700);
      check(
        theme + " fits viewport",
        await exec(
          "return document.documentElement.scrollWidth <= innerWidth+1"
        )
      );
      await exec(
        'document.querySelector(".map-layout").scrollIntoView({block:"start",behavior:"instant"});scrollBy(0,-110);'
      );
      await capture("map-" + theme);
    }
    await click("[data-quick=frecon]");
    check(
      "Frecon filter shows six researched bid relationships",
      await exec('return document.querySelectorAll(".lead-row").length===6')
    );
    await click("[data-clear]");
    await click("[data-quick=pomerleau]");
    check(
      "Pomerleau filter excludes negative references",
      await exec('return document.querySelectorAll(".lead-row").length===7')
    );
    await click("[data-clear]");
    await click(".lead-row");
    await wait('return !!document.querySelector("dialog[open]")');
    check(
      "Dossier keeps evidence and sources",
      await exec(
        'return !!document.querySelector("dialog details") && document.querySelectorAll("dialog details li").length>0'
      )
    );
    check(
      "Dossier fits viewport",
      await exec(
        'const d=document.querySelector("dialog").getBoundingClientRect();return d.left>=0&&d.right<=innerWidth+1'
      )
    );
    await capture("dossier");
    await click("dialog [data-close]");
    await click("[data-settings]");
    check(
      "Settings opens",
      await exec('return !!document.querySelector("dialog [data-apply]")')
    );
    await click("dialog [data-close]");
    await click("[data-import]");
    check(
      "Import requires reviewed file before confirmation",
      await exec('return document.querySelector("dialog [data-save]").disabled')
    );
    await click("dialog [data-close]");
    await exec(
      'const s=document.querySelector("[data-engine]");s.value="leaflet";s.dispatchEvent(new Event("change",{bubbles:true}));'
    );
    await wait('return !!document.querySelector(".leaflet-pane")');
    check(
      "Fallback keeps real data",
      await exec(
        'return document.querySelectorAll(".lead-row").length===67 && document.querySelector(".leaflet-control-attribution").textContent.includes("OpenStreetMap")'
      )
    );
    await click("[data-tool=inbox]");
    await wait('return !!document.querySelector("[data-inbox=refresh]")');
    check(
      "Existing private inbox uses account session",
      await exec('return !document.querySelector(".inbox-login")')
    );
    const appURL = new URL(site);
    appURL.searchParams.set("workspace", "maps");
    appURL.hash = "/en/admin/maps";
    await wd(`/session/${id}/url`, { url: appURL.href });
    await wait('return document.querySelectorAll(".lead-row").length===67', 60);
    check(
      "Standalone map preserves the authenticated account",
      await exec(
        'return document.body.classList.contains("maps-app") && getComputedStyle(document.querySelector(".map-layout")).position==="fixed"'
      )
    );
    check(
      "Location and layers have large tap targets",
      await exec(
        'return ["[data-my-location]","[data-layers]"].every(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.width>=44&&r.height>=44})'
      )
    );
    check(
      "Location remains permission driven",
      await exec(
        'return document.querySelector("[data-radar-status]").textContent.includes("GPS off")'
      )
    );
    if (await exec("return innerWidth<=760"))
      check(
        "Map status stays clear of nearby controls",
        await exec(
          'const s=document.querySelector(".map-status").getBoundingClientRect(),r=document.querySelector(".map-app-nearby").getBoundingClientRect();return s.bottom<=r.top||s.top>=r.bottom||s.right<=r.left||s.left>=r.right'
        )
      );
    for (const theme of ["light", "dark"]) {
      await exec("document.documentElement.dataset.theme=arguments[0]", [
        theme,
      ]);
      await wait(
        'return document.querySelector(".map-canvas").dataset.scheme==="' +
          theme +
          '"'
      );
      await pause(1300);
      check(
        "Standalone " + theme + " fits viewport",
        await exec("return document.documentElement.scrollWidth<=innerWidth+1")
      );
      check(
        "Standalone " + theme + " Google map renders",
        await exec(
          'return !!document.querySelector(".gm-style")&&!document.querySelector(".map-canvas").textContent.includes("Oops!")'
        )
      );
      await capture("pwa-" + theme);
    }
    if (await exec("return innerWidth<=760")) {
      await click("[data-sheet-toggle]");
      check(
        "Mobile site sheet expands accessibly",
        await exec(
          'return document.querySelector("[data-sheet-toggle]").getAttribute("aria-expanded")==="true" && getComputedStyle(document.querySelector(".lead-list")).display!=="none"'
        )
      );
      await click("[data-sheet-toggle]");
      check(
        "Mobile sheet collapses to reveal the map",
        await exec(
          'return getComputedStyle(document.querySelector(".lead-list")).display==="none"'
        )
      );
    }
    await click("[data-layers]");
    check(
      "Satellite layer toggles",
      await exec(
        'return document.querySelector("[data-layers]").getAttribute("aria-pressed")==="true"'
      )
    );
    await click("[data-layers]");
    if (await exec("return !!window.sapMapsInstallPrompt")) {
      check("Chrome makes the native install prompt available", true);
    } else {
      await click("[data-install-app]");
      check(
        "Install action offers platform guidance",
        await exec(
          'return !!document.querySelector("dialog[open]") && document.querySelector("dialog").textContent.includes("Home Screen")'
        )
      );
      await click("dialog button");
    }
    await click("[data-logout]");
    await wait('return !!document.querySelector(".admin-login")');
    check(
      "Sign-out clears private interface and tokens",
      await exec(
        'return !document.querySelector(".lead-row,.inbox-record") && !Object.keys(sessionStorage).some(k=>/accessToken|idToken|refreshToken/.test(k)&&sessionStorage[k])'
      )
    );
    await wd(`/session/${id}/url`, { url: new URL("#/fr/admin", site).href });
    await wait('return !!document.querySelector(".admin-login")');
    check(
      "French sign-in is localized",
      await exec(
        'return document.documentElement.lang==="fr-CA" && document.querySelector(".admin-login").textContent.includes("Connexion administrateur")'
      )
    );
    await capture("signin-fr");
  } catch (e) {
    check("Audit completed", false);
    entry.error = clean(e.message);
    console.log(entry.error);
    if (id)
      try {
        const b64 = await wd(`/session/${id}/screenshot`);
        await writeFile(
          resolve(output, device.name + "-failure.png"),
          Buffer.from(b64, "base64"),
          { mode: 0o600 }
        );
      } catch {}
  } finally {
    if (id)
      try {
        await wd(`/session/${id}`, undefined, "DELETE");
        entry.closed = true;
      } catch (e) {
        entry.closeError = clean(e.message);
      }
    await writeFile(
      resolve(
        output,
        "report" + (process.argv[2] ? "-" + process.argv[2] : "") + ".json"
      ),
      JSON.stringify(report, null, 2),
      { mode: 0o600 }
    );
  }
}
if (report.some((r) => r.checks.some((c) => !c.passed) || !r.closed))
  process.exitCode = 1;
