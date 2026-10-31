import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const dom = await json(".local/domscan/latest.json"),
  blueprint = await json(".local/blueprint/latest.json");
if (dom.status !== "complete" || blueprint.status !== "complete")
  throw Error("Both evidence runs must be complete.");
const runtime = await json(resolve(dom.run, "run_manifest.json")),
  source = await json(resolve(blueprint.run, "run_manifest.json"));
const xray = await json(resolve(blueprint.run, "analysis/xray_result.json")),
  links = await json(resolve(blueprint.run, "esm-links.json"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const input of [...runtime.source, ...source.inputs]) {
  if (hash(await readFile(input.path)) !== input.sha256)
    throw Error("Stale evidence for " + input.path + "; rerun its capture.");
}
const files = new Map(
  xray.entities
    .filter((e) => e.type === "file")
    .map((e) => [e.location.file, e])
);
const css = await readFile("src/styles.css", "utf8");
const normalize = (s) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .trim();
const rules = [...css.matchAll(/([^{}]+)\{/g)].map((m) => ({
  selector: normalize(m[1].replace(/\/\*[\s\S]*?\*\//g, "")),
  line: css.slice(0, m.index).split("\n").length,
}));
const captures = [];
for (const capture of runtime.captures) {
  const before = await json(resolve(dom.run, capture.name + "-before.json")),
    after = await json(resolve(dom.run, capture.name + "-after.json"));
  const diff = await json(resolve(dom.run, capture.name + "-diff.json"));
  const previous = new Map(before.elements.map((e) => [e.selector, e]));
  const important = after.elements.filter(
    (e) =>
      diff.changed.includes(e.selector) ||
      (e.tag === "svg" && e.svg?.brand) ||
      (e.tag === "input" && e.interaction.pointerHitAtCenter)
  );
  captures.push({
    name: capture.name,
    viewport: after.viewport,
    coverage: after.coverage,
    brand: capture.brand,
    observations: important.map((e) => ({
      selector: e.selector,
      rendered: e.rendered,
      interaction: e.interaction,
      geometry: e.geometry,
      changed: diff.changed.includes(e.selector),
      previous: previous.get(e.selector)
        ? {
            style: previous.get(e.selector).style,
            state: previous.get(e.selector).state,
          }
        : null,
      current: { style: e.style, state: e.state },
      sourceRules: e.matchedRules.map((rule) => ({
        selector: rule.selector,
        conditions: rule.conditions,
        declarations: rule.declarations,
        fileEntity: files.get("src/styles.css")?.id,
        candidateLocations: rules
          .filter((r) => r.selector === normalize(rule.selector))
          .map((r) => ({ file: "src/styles.css", line: r.line })),
      })),
    })),
  });
}
const report = {
  schemaVersion: 1,
  at: new Date().toISOString(),
  runtimeRun: dom.run,
  blueprintRun: blueprint.run,
  sourceFiles: source.inputs.length,
  captures,
  brandConsumers: links.resolvedCalls.filter(
    (e) => e.resolvedTarget === "FUNC::src/brand.js::logo"
  ),
  limitations: [
    "CSS source locations are candidates for exact normalized selectors, not computed cascade winners.",
    "Runtime changes correlate with a declared action; source bindings describe potential impact, not runtime call traces.",
    "Opacity-zero hit-tested controls are retained; visual visibility and interactivity are separate observations.",
    "Brand similarity uses independent supplied artwork. Geometry and source graphs alone cannot establish fidelity.",
  ],
};
const output = resolve(".local/evidence-map.json");
await writeFile(output, JSON.stringify(report, null, 2));
console.log(
  `Evidence map: ${captures.length} runtime states, ${source.inputs.length} source files, ${report.brandConsumers.length} brand consumers. ${output}`
);
