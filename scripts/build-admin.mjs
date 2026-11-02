import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
export async function buildAdmin({ development = false } = {}) {
  const dir = development ? ".local/frontend/admin" : "dist/admin";
  await mkdir(dir, { recursive: true });
  await build({
    entryPoints: ["admin/main.js"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["chrome120", "safari17.4", "firefox115"],
    outfile: dir + "/portal.js",
    minify: true,
    legalComments: "inline",
    loader: { ".png": "dataurl" },
    define: { global: "globalThis" },
  });
}
if (process.argv[1]?.endsWith("build-admin.mjs"))
  await buildAdmin({ development: process.argv.includes("--dev") });
