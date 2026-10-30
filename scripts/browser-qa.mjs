import { copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

// A temporary local test document drives the site's real controls in Chrome.
// The build allowlist never copies it into the published website.
await copyFile("tests/browser-qa.html", "qa-local.html");
const url = "http://127.0.0.1:4173/qa-local.html?run=" + Date.now();
console.log("Keep npm run dev running before starting browser checks.");
console.log("Browser report and layout captures: " + url);
if (process.platform === "darwin") {
  const result = spawnSync("open", ["-a", "Google Chrome", url], {
    stdio: "inherit",
  });
  if (result.status !== 0)
    console.log("Open the report URL in Google Chrome manually.");
}
