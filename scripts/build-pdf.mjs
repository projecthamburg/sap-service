import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
export async function buildPDF({ development = false } = {}) {
  const directory = development ? ".local/frontend" : "dist/src";
  await mkdir(directory, { recursive: true });
  await build({
    entryPoints: ["src/pdf-export.js"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["chrome110", "safari16", "firefox115"],
    outfile: directory + "/pdf-export.js",
    minify: true,
    legalComments: "inline",
  });
}
if (process.argv[1]?.endsWith("build-pdf.mjs"))
  await buildPDF({ development: process.argv.includes("--dev") });
