import { readFile, writeFile, mkdir, copyFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve, dirname, posix } from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd(),
  engine = process.argv[2] || process.env.SAP_BLUEPRINT_ROOT;
if (!engine || !existsSync(resolve(engine, "src/cli.py")))
  throw Error("Pass the Blueprint engine root, or set SAP_BLUEPRINT_ROOT.");
const stamp = new Date().toISOString().replace(/[:.]/g, "-"),
  run = resolve(".local/blueprint/runs", stamp),
  stage = resolve(run, "source"),
  output = resolve(run, "analysis");
await mkdir(stage, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const names = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" }
).split("\0");
const selected = [...new Set(names)]
  .filter(
    (name) =>
      /^(?:src|scripts)\/.+\.(?:m?js|css)$/.test(name) ||
      /^api\/[^/]+\.mjs$/.test(name) ||
      /^\.github\/workflows\/[^/]+\.ya?ml$/.test(name) ||
      ["index.html", "package.json", "config/operations.json", "public/site-config.json"].includes(name)
  )
  .sort();
if (!selected.length)
  throw Error("Refusing an empty Blueprint source selection.");
const inputs = [];
for (const name of selected) {
  const file = resolve(root, name),
    target = resolve(stage, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
  await chmod(target, 0o444);
  inputs.push({ path: name, sha256: hash(await readFile(file)) });
}
const manifest = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  sourceRoot: root,
  stagedRoot: stage,
  engineRoot: resolve(engine),
  engineCLIHash: hash(await readFile(resolve(engine, "src/cli.py"))),
  inputs,
  scope: "Selected source files only; not the entire filesystem checkout.",
  excluded: [
    ".env",
    ".local",
    "appednix",
    "dependencies",
    "build output",
    "lockfiles",
    "private uploads",
    "documentation prose",
  ],
  cortex: "dry-run",
  status: "running",
};
try {
  const python =
    process.env.SAP_BLUEPRINT_PYTHON ||
    (existsSync(resolve(engine, ".venv/bin/python"))
      ? resolve(engine, ".venv/bin/python")
      : "python3");
  const result = spawnSync(
    python,
    [
      "-m",
      "src.cli",
      "scan",
      "--root",
      stage,
      "--output",
      output,
      "--preset",
      "standard",
      "--format",
      "json",
    ],
    {
      cwd: resolve(engine),
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  await writeFile(
    resolve(run, "engine.log"),
    (result.stdout || "") + (result.stderr || "")
  );
  if (result.error || result.status !== 0)
    throw Error("Blueprint engine failed. See the private engine.log.");
  const xray = JSON.parse(
    await readFile(resolve(output, "xray_result.json"), "utf8")
  );
  const indexed = new Set(
    xray.entities
      .filter((e) => e.type === "file")
      .map((e) => e.location?.file || e.qualified_name)
  );
  const missing = selected.filter((name) => !indexed.has(name));
  if (
    xray.errors.length ||
    xray.stats.files_scanned !== selected.length ||
    missing.length
  )
    throw Error(
      "Blueprint source coverage is incomplete: " +
        JSON.stringify({
          expected: selected.length,
          scanned: xray.stats.files_scanned,
          missing,
          errors: xray.errors.length,
        })
    );
  for (const input of inputs)
    if (hash(await readFile(resolve(root, input.path))) !== input.sha256)
      throw Error("Source changed during analysis: " + input.path);
  const modules = new Map();
  for (const name of selected.filter((name) => /\.(?:js|mjs)$/.test(name))) {
    const code = await readFile(resolve(stage, name), "utf8"),
      imports = {},
      exports = {};
    const target = (specifier) => {
      if (!specifier.startsWith(".")) return null;
      const path = posix.normalize(posix.join(posix.dirname(name), specifier));
      return selected.includes(path) ? path : null;
    };
    for (const match of code.matchAll(
      /\bimport\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g
    ))
      for (const part of match[1].split(",")) {
        const [original, alias] = part.trim().split(/\s+as\s+/);
        if (original)
          imports[alias || original] = {
            name: original,
            module: target(match[2]),
          };
      }
    for (const match of code.matchAll(
      /\bexport\s+(?:async\s+)?(?:function|const|class)\s+([\w$]+)/g
    ))
      exports[match[1]] = { name: match[1], module: name };
    for (const match of code.matchAll(
      /\bexport\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g
    ))
      for (const part of match[1].split(",")) {
        const [original, alias] = part.trim().split(/\s+as\s+/);
        if (original)
          exports[alias || original] = {
            name: original,
            module: target(match[2]),
          };
      }
    modules.set(name, { imports, exports });
  }
  const callable = new Map(
    xray.entities
      .filter((e) => ["function", "method", "class"].includes(e.type))
      .map((e) => [(e.location?.file || "") + "#" + e.name, e.id])
  );
  function exported(module, name, trail = []) {
    if (!module || trail.length > 15 || trail.includes(module + "#" + name))
      return null;
    const binding = modules.get(module)?.exports[name];
    if (!binding) return null;
    if (binding.module === module) {
      const id = callable.get(module + "#" + binding.name);
      return id ? { id, trail: [...trail, module + "#" + name] } : null;
    }
    return exported(binding.module, binding.name, [
      ...trail,
      module + "#" + name,
    ]);
  }
  const resolved = [];
  for (const edge of xray.edges.filter((e) => e.relation === "calls")) {
    const [kind, file, name] = edge.target.split("::");
    if (!file || !name) continue;
    const binding = modules.get(file)?.imports[name];
    if (!binding?.module) continue;
    const match = exported(binding.module, binding.name);
    if (match)
      resolved.push({
        source: edge.source,
        originalTarget: edge.target,
        resolvedTarget: match.id,
        importTrail: [file + "#" + name, ...match.trail],
        basis:
          "Explicit named ESM import/re-export chain plus a parsed callable entity. This is static binding evidence, not proof of runtime execution.",
      });
  }
  const links = {
    modules: Object.fromEntries(modules),
    resolvedCalls: resolved,
    limitations: [
      "Named literal ESM imports and re-exports only. Dynamic imports, namespace/default imports and external packages are not resolved.",
      "Raw Blueprint outputs remain unmodified. Sonar findings still require review before edits.",
    ],
  };
  await writeFile(
    resolve(run, "esm-links.json"),
    JSON.stringify(links, null, 2)
  );
  manifest.stats = xray.stats;
  manifest.resolvedESMCalls = resolved.length;
  manifest.status = "complete";
  manifest.limitations = [
    "Blueprint analyzes an allowlisted, hash-recorded source copy.",
    "The engine CLI success message alone is insufficient: file coverage and error counts are checked.",
    "Static relationships do not establish visual fidelity or runtime behavior.",
  ];
  console.log(
    "Blueprint:",
    selected.length,
    "files,",
    xray.stats.entity_count,
    "entities,",
    resolved.length,
    "named ESM call bindings reconciled."
  );
} catch (error) {
  manifest.status = "failed";
  manifest.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  manifest.finishedAt = new Date().toISOString();
  await writeFile(
    resolve(run, "run_manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  await mkdir(".local/blueprint", { recursive: true });
  await writeFile(
    ".local/blueprint/latest.json",
    JSON.stringify({ run, status: manifest.status }, null, 2)
  );
}
console.log("Blueprint evidence:", run);
