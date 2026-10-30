import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { access } from "node:fs/promises";
if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN)
  try {
    process.loadEnvFile(".env");
  } catch {}
const env = {
  ...process.env,
  GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
};
function run(command, args, { capture = false, input } = {}) {
  const result = spawnSync(command, args, {
    env,
    encoding: "utf8",
    stdio: capture ? ["pipe", "pipe", "pipe"] : ["pipe", "inherit", "inherit"],
    input,
  });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args[0]} failed. ${capture ? result.stderr : ""}`
    );
  return result.stdout?.trim();
}
try {
  await access("api/node_modules/@aws-sdk/client-s3/package.json");
} catch {
  run("npm", ["--prefix", "api", "ci"]);
}
run("npm", ["test"]);
run("npm", ["run", "build"]);
run("npm", ["run", "check"]);
const owner = run("gh", ["api", "user", "--jq", ".login"], { capture: true });
const repo = `${owner}/sap-service`;
env.SAP_SITE_URL = `https://${owner}.github.io/sap-service/`;
const existing = spawnSync("gh", ["repo", "view", repo, "--json", "name"], {
  env,
  encoding: "utf8",
});
if (existing.status !== 0)
  run("gh", [
    "repo",
    "create",
    repo,
    "--public",
    "--description",
    "SAP Service Inc. — Construction cleaning · Montréal, Québec & Ontario",
  ]);
if (env.AWS_BUSINESS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID) {
  run("npm", ["--prefix", "api", "ci"]);
  run("node", ["api/provision-aws.mjs"]);
  run("npm", ["run", "build"]);
  run("npm", ["run", "check"]);
}
const hasGit =
  spawnSync("git", ["rev-parse", "--git-dir"], { encoding: "utf8" }).status ===
  0;
if (!hasGit) run("git", ["init", "-b", "main"]);
const remotes = run("git", ["remote"], { capture: true });
if (!remotes.split("\n").includes("origin"))
  run("git", ["remote", "add", "origin", `https://github.com/${repo}.git`]);
else if (
  run("git", ["remote", "get-url", "origin"], { capture: true }) !==
  `https://github.com/${repo}.git`
)
  throw new Error(
    "The origin remote points to a different repository. Verify it before deployment."
  );
// A strict staging allowlist prevents private source material and .env from entering history.
run("git", [
  "add",
  ".gitignore",
  ".env.example",
  "package.json",
  "index.html",
  "src",
  "public",
  "scripts",
  "tests",
  "api",
  "docs",
  ".github",
  "README.md",
]);
const staged = run("git", ["diff", "--cached", "--name-only"], {
  capture: true,
});
if (
  staged
    .split("\n")
    .some((p) => /(^|\/)\.env(?!\.example$)|^appednix\/|^\.local\//.test(p))
)
  throw new Error("A private file is staged. Deployment stopped.");
if (staged)
  run("git", [
    "commit",
    "-m",
    "Build bilingual SAP construction cleaning website and Pages deployment",
  ]);
run("gh", ["auth", "setup-git"]);
run("git", ["push", "-u", "origin", "main"]);
const pages = spawnSync("gh", ["api", `repos/${repo}/pages`], {
  env,
  encoding: "utf8",
});
if (pages.status !== 0)
  run("gh", [
    "api",
    "--method",
    "POST",
    `repos/${repo}/pages`,
    "-f",
    "build_type=workflow",
  ]);
else
  run("gh", [
    "api",
    "--method",
    "PUT",
    `repos/${repo}/pages`,
    "-f",
    "build_type=workflow",
  ]);
run("gh", ["workflow", "run", "pages.yml", "--repo", repo]);
const commit = run("git", ["rev-parse", "HEAD"], { capture: true });
let workflow;
for (let attempt = 0; attempt < 18; attempt++) {
  const runs = JSON.parse(
    run(
      "gh",
      [
        "run",
        "list",
        "--repo",
        repo,
        "--workflow",
        "pages.yml",
        "--event",
        "workflow_dispatch",
        "--limit",
        "5",
        "--json",
        "databaseId,headSha,status,conclusion",
      ],
      { capture: true }
    )
  );
  workflow = runs.find((item) => item.headSha === commit);
  if (workflow) break;
  await delay(5000);
}
if (!workflow)
  throw new Error(
    `The workflow was dispatched but its run is not visible yet. Inspect https://github.com/${repo}/actions before retrying.`
  );
run("gh", [
  "run",
  "watch",
  String(workflow.databaseId),
  "--repo",
  repo,
  "--exit-status",
  "--interval",
  "10",
]);
const pagesInfo = JSON.parse(
  run("gh", ["api", `repos/${repo}/pages`], { capture: true })
);
const url = pagesInfo.html_url;
if (!url) throw new Error("The Pages API did not return a deployed URL.");
let live = false;
for (let attempt = 0; attempt < 12; attempt++) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (response.ok && (await response.text()).includes("SAP Service")) {
    live = true;
    break;
  }
  await delay(5000);
}
if (!live)
  throw new Error(
    `Actions succeeded but the public website could not be verified yet: ${url}`
  );
console.log(
  `Repository: https://github.com/${repo}\nSuccessful Actions run: https://github.com/${repo}/actions/runs/${workflow.databaseId}\nVerified live website: ${url}`
);
