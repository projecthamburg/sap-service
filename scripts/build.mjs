import {
  mkdir,
  rm,
  cp,
  copyFile,
  writeFile,
  readFile,
  readdir,
} from "node:fs/promises";
import { resolve } from "node:path";
import { buildAdmin } from "./build-admin.mjs";
import { buildPlan } from "./build-plan.mjs";
import { buildPDF } from "./build-pdf.mjs";
import { createHash } from "node:crypto";
import {
  loadPublicConfiguration,
  loadOperations,
  configureDocument,
} from "./configuration.mjs";
const publicConfig =
  JSON.stringify(await loadPublicConfiguration(), null, 2) + "\n";
const operations = await loadOperations();
const out = resolve("dist");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp("public", out, { recursive: true });
await writeFile(resolve(out, "site-config.json"), publicConfig);
await cp("src", resolve(out, "src"), { recursive: true });
await copyFile("index.html", resolve(out, "index.html"));
await buildPDF();
await buildPlan();
await buildAdmin();
// Version every browser module and the public configuration together. This prevents
// an older cached form module from being mixed with a newly deployed service API.
const browserFiles = (await readdir("src"))
  .filter((name) => /\.(?:js|css)$/.test(name))
  .sort();
const releaseHash = createHash("sha256");
for (const name of browserFiles)
  releaseHash.update(await readFile(resolve("src", name)));
for (const name of (await readdir("admin")).sort())
  releaseHash.update(await readFile(resolve("admin", name)));
releaseHash.update(await readFile("public/admin-auth.json"));
releaseHash.update(await readFile("public/manifest.webmanifest"));
releaseHash.update(await readFile("public/sw.js"));
releaseHash.update(publicConfig);
releaseHash.update(await readFile("index.html"));
releaseHash.update(await readFile("package-lock.json"));
const release = releaseHash.digest("hex").slice(0, 12);
for (const name of browserFiles.filter((name) => name.endsWith(".js"))) {
  let code = await readFile(resolve(out, "src", name), "utf8");
  code = code.replace(
    /from\s+(["'])(\.\/[^"']+\.js)\1/g,
    (_, quote, specifier) => `from ${quote}${specifier}?v=${release}${quote}`
  );
  code = code.replace(
    /import\((["'])(\.\/[^"']+\.js)\1\)/g,
    (_, quote, specifier) => `import(${quote}${specifier}?v=${release}${quote})`
  );
  code = code
    .replaceAll("../admin/portal.js", `../admin/portal.js?v=${release}`)
    .replaceAll("./admin/portal.css", `./admin/portal.css?v=${release}`);
  code = code.replace(
    'fetch("./site-config.json")',
    `fetch("./site-config.json?v=${release}")`
  );
  await writeFile(resolve(out, "src", name), code);
}
let index = configureDocument(
  await readFile(resolve(out, "index.html"), "utf8"),
  operations
);
index = index
  .replace('./src/styles.css"', `./src/styles.css?v=${release}"`)
  .replace('./src/app.js"', `./src/app.js?v=${release}"`)
  .replace('href="./src/brand.js"', `href="./src/brand.js?v=${release}"`)
  .replace(
    "</head>",
    `<script type="application/json" id="site-config">${publicConfig.replaceAll(
      "<",
      "\\u003c"
    )}</script><meta name="sap-build" content="${release}"></head>`
  );
await writeFile(resolve(out, "index.html"), index);
await writeFile(resolve(out, ".nojekyll"), "");
// Hash routes work both at a domain root and a GitHub Pages repository subpath.
await copyFile(resolve(out, "index.html"), resolve(out, "404.html"));
const base = process.env.SAP_SITE_URL || operations.siteUrl;
await writeFile(
  resolve(out, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`
);
await writeFile(
  resolve(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}</loc></url></urlset>`
);
let bytes = 0,
  files = 0;
async function count(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) await count(p);
    else {
      bytes += (await readFile(p)).length;
      files++;
    }
  }
}
await count(out);
console.log(
  `Built ${files} public files (${(bytes / 1024 / 1024).toFixed(
    2
  )} MB). Private material and credentials are excluded.`
);
