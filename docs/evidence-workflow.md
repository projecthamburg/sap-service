# Source, browser and reference evidence

The website uses three independent kinds of evidence. Blueprint explains source structure and potential change impact. Domscan-style captures record what the browser actually rendered in a declared state. Supplied artwork provides an independent reference for brand fidelity. Passing one layer does not imply that the others pass.

## Reproduce the website workflow

```sh
npm run dev
npm run test:audit
npm run domscan
npm run blueprint -- /path/to/blueprint-engine
npm run evidence:map
```

Google Chrome is required for browser captures. `SAP_CHROME_PATH` can override its executable. Blueprint is an optional, separately installed engine with its own Python dependencies; set `SAP_BLUEPRINT_ROOT` instead of passing the path if preferred. Its internal implementation is not copied into this public repository.

`domscan` captures the header, main content and footer in eight English/French, light/dark, 390/1440-pixel states. Each capture records geometry, computed styles, active matching CSS rules, SVG paths, image dimensions and control state. A declared comparison selection is followed by a specific state check and image decoding, then a second capture and structural diff. Both the supplied-artwork comparison and complete scoped coverage must pass. A zero-change interaction is rejected. Paired viewport screenshots and a full-page overview accompany the machine-readable records. Public photographs are decoded before the baseline, and both application and capture-tool hashes are retained.

Transparent controls remain in the evidence. The comparison range input has zero opacity but receives pointer input. Its rendered visibility, geometry, focus state and center-point hit test are separate fields; the actual hit target, stacking order and overflow styles help explain an obstruction; discarding it as invisible would erase the very control under test. The capture never treats a hit test as authorization to click arbitrary elements.

`blueprint` stages an allowlist of source files, records their hashes and runs Xray, Manifest, Registry, Sonar, Synapse and Cortex with Cortex in dry-run mode. It checks nonzero, complete file coverage, errors and unchanged originals rather than trusting a success message. `.env`, dependencies, uploads and private local state are excluded before the engine sees the input. The adapter reconciles explicit named ESM imports and re-exports without changing the engine's raw output.

`evidence:map` joins those runs only while their source hashes still match the checkout. Its output associates changed browser nodes with matching responsive CSS rules and candidate source locations, and records the source import chains for brand consumers. This makes a screenshot finding actionable: the same record carries the state, observed result, applicable CSS and source impact. It does not claim that every matching CSS rule wins the cascade or that a static call was executed.

## What this combination found and protected

- A source-only control test missed the comparison backgrounds returning 404. Browser image decoding identifies the actual rendered resource; the source change resolves it against the document rather than the stylesheet directory. Deployment now gates on decoded backgrounds as well as ordinary images.
- The previous logo was internally consistent yet differed from the supplied mark. Independent raster comparison catches this; source tracing connects the canonical geometry through `icons.js` to the header, footer, approach stamp and estimate print output. Header/footer use the original stacked wordmark. The favicon and downloadable SVG also derive from the canonical geometry. The import chain also identifies its critical loading dependency; a version-matched preload starts it earlier, and a browser network check confirms one reused request.
- Captured active media rules distinguish desktop styles from the overrides affecting a phone. Runtime geometry and native device screenshots remain necessary: a source graph cannot demonstrate that a navigation menu, room card or scheduling frame fits a real tablet.
- The original artwork is retained as an unmodified test fixture with its SHA-256. The silhouette comparison normalizes color and permits a small rasterization tolerance. It is supplemented by human review of color, scale, clear space and legibility.

## Refurbishment value in the upstream tools

The research Domscan prototype's explicit capture statuses, bounded coverage and action–wait–rescan contract are particularly useful. Its Node/Python bridges and structural diffs need semantic parity tests before interchangeability is assumed. The older visual scanner contributes geometry, CSS and typography observations, but opacity-zero controls and image-backed backgrounds need richer interaction and compositing treatment. A geometric proportion or guessed contrast score should not become a design-quality verdict.

Blueprint's six working analysis domains are valuable independently of its planned domains. The highest-value improvements would be an enforced configuration/discovery contract, nonzero coverage validation, and language-aware import/re-export resolution. In the inspected engine, the adoption YAML is not consumed by the CLI, discovery can include ignored sensitive files, and a success message can accompany an empty selection. Explicit staging and coverage checks address those issues here. Sonar's unused-code suggestions remain review leads: callbacks, re-exports and dynamic uses require more evidence before deletion.

Together, a stable source manifest, explicit runtime state, responsive CSS provenance, actual interaction results and independent visual references offer more useful evidence than a single aggregate score. Raw reports stay intact so an interpretation can be challenged or reproduced.

## Artifacts and limits

Browser reports are in ignored `.local/browser-audit/`; capture runs in `.local/domscan/`; static runs in `.local/blueprint/`; the combined report is `.local/evidence-map.json`. Both deployment workflows retain only the public browser reports and Domscan captures in their `browser-audit` artifact. Private local directories are never uploaded wholesale.

Captures are sequential, bounded and scoped. Structural selectors are identities within a capture, not durable component IDs. Cross-origin frames, closed shadow roots and canvas internals are not traversed. Input values, cookies, storage and raw HTML are excluded. Real-device tests separately exercise phone/tablet browser input, layout, photos, estimator cards, application availability and the embedded calendar. iOS scheduling screenshots require visual review because its driver cannot inspect the provider's cross-origin document.
