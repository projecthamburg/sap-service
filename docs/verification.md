# Verification

Verified release: `6d5d9427ba4c`, October 30, 2026 (Toronto).

The website is published at https://projecthamburg.github.io/sap-service/ through GitHub Actions. The private API is deployed in AWS Canada Central; its identifiers are in `api/deployment.json`.

## Latest website audit

- **32 Node tests passed.** These cover estimation, units, room and common-area accounting, modifiers, minimums, saved-scope privacy, upload validation, private API contracts, consent, signed manifests, file signatures, completion tokens, idempotency, server-side price recalculation, CORS and authenticated administration.
- **96 native Google Chrome checks passed**, including the live embedded calendar. Both deployment workflows run the 95 checks that do not depend on the external scheduling provider. Coverage includes English/French, photographs and all five comparison backgrounds, native slider drag and keyboard input, themes, public routes, validation, navigation focus and nonblocking status messages. Responsive checks cover 360, 390, 768, 1024 and 1440 pixels.
- **517 BrowserStack checks passed across nine configurations**, all explicitly verified against the same release identifier. These use browser input for navigation, estimator advancement, application typing and shift selection; decode all photographs and comparison choices; check all estimator cards, dropdown tap areas, themes, layouts and scheduling. Tablet orientation is checked from the actual viewport, rather than inferred from requested capabilities.

| BrowserStack configuration                              | Passed checks |
| ------------------------------------------------------- | ------------: |
| Real iPhone 16, iOS 18 Safari                           |            61 |
| Real Samsung Galaxy S23, Android 13 Chrome              |            59 |
| Real iPad Air 13 (2025), iOS 18 Safari, portrait        |            57 |
| Same iPad, landscape                                    |            57 |
| Real Samsung Galaxy Tab S9, Android 13 Chrome, portrait |            61 |
| Same Galaxy Tab, landscape                              |            57 |
| macOS Sequoia, Safari 18.4                              |            55 |
| Windows 11, latest Edge                                 |            55 |
| Windows 11, latest Firefox                              |            55 |

The device screenshots supplement the automated results. iOS's remote debugger cannot inspect the cross-origin calendar document, so its loaded calendar and dates were reviewed visually using the main and lower-calendar screenshots. Its driver also did not expose `visualViewport.scale`; the focused-input screenshots were reviewed without claiming an automated zoom measurement. Actual typing and 16-pixel phone input text were verified. No appointments were created and these device runs did not submit applications or quotation requests.

The first Firefox run passed its functional checks but hit a cross-origin error while capturing a screenshot from inside the scheduling frame. The audit now returns to the main page before capture. A fresh Firefox run passed all 55 checks and retained the calendar screenshot with normal browser security settings.

## Findings fixed

- The comparison-image defect reported after the first release was reproduced: relative URLs in CSS custom properties resolved under `/src/images/` and returned 404. They now resolve against the document URL, including the GitHub Pages repository subpath. Deployment gates on actual image decoding, including backgrounds.
- Android browser input exposed a temporary “sample loaded” status message intercepting the estimator's Next button. Status messages now pass pointer input through; the regression check verifies that the control underneath receives the hit.
- Opening the mobile navigation previously allowed keyboard users to skip its links. Opening now moves focus into navigation; Escape closes it and restores focus to the menu control.
- Safari's compact native dropdown rendering differed from the surrounding form controls. Dropdowns now have a consistent appearance and 48-pixel height; real-device measurements verify usable tap areas. Phone form text is 16 pixels.
- The earlier logo approximation differed from the supplied artwork. The canonical trace preserves its connected S/A, separate P and original stacked wordmark. An independent, hash-verified artwork fixture guards the actual header silhouette. Header, footer, approach stamp, print output, favicon and public SVG share the canonical source. Color, scale and legibility were also reviewed visually.
- The source import graph identified an extra dependency hop for the shared brand module. It is now preloaded with the same release version as its imports. A published-site network check confirmed one reused request, rather than duplicate downloads.

## Runtime and source evidence

Eight Domscan states cover English/French, light/dark and 390/1440-pixel widths. Each captures the header, main content and footer, decoded photographs, actual styles, active responsive CSS rules, geometry, SVG paths, control state and pointer hit targets. A declared comparison action has paired captures and a nonzero diff. Full-page overviews accompany the viewport screenshots. Coverage and application/capture-tool hashes are recorded; input values, cookies and storage are excluded.

The latest Blueprint run analyzed 31 allowlisted source files, 819 entities and 2,931 edges without parse errors. An explicit ESM reconciliation layer resolved 260 named call bindings, including four brand consumers. Cortex ran in dry-run mode and original files remained unchanged. A combined evidence map joins fresh source hashes, runtime changes and candidate CSS source locations. See [the evidence workflow](evidence-workflow.md) for the upstream study, practical combinations and limits.

Both deployment workflows gate publication on the Chrome audit and eight-state Domscan run, retaining public reports and screenshots in the `browser-audit` Actions artifact. Private local directories are never uploaded wholesale.

BrowserStack Local's visible control console at `http://localhost:45454/` was inspected in Chrome. Its old debug target was changed to the current preview at `http://127.0.0.1:4173/`, which returned HTTP 200. A separate automation tunnel failed with `CONN_FAIL:4002`; the existing user connection was preserved. The real-device matrix therefore used the version-checked published site.

## Performance and service

The latest mobile Lighthouse run on this release recorded **88 performance, 100 accessibility, 100 best practices and 100 SEO**, with LCP 2.7 seconds, total blocking time 350 milliseconds and zero measured layout shift. Earlier measurements varied with machine load; the earlier release's score of 92 is not presented as the current result. The archived/current local comparison also varied with CPU conditions. These are laboratory measurements rather than field performance guarantees.

The private service health check returned HTTP 200, `status: ok`, forms enabled and region `ca-central-1`.

Previously completed integration evidence remains available locally: 31 live cloud checks covering a genuine 7 MB synthetic PDF, a photograph, résumé uploads, receipts, byte-for-byte private downloads, raw-object denial, invalid-file rejection and cleanup; 24 native Chrome integration checks covering actual quote/application submission and inbox downloads; and six export/presentation checks covering print, a real PDF, JSON download and French validation. Synthetic notifications were suppressed and records removed. These integrations were not resubmitted during this presentation audit. Email notifications are configured; testing does not claim delivery to the business recipient's mailbox. Estimator rates remain explicitly illustrative until SAP supplies approved commercial rates.

## Reproduce

Run `npm ci`, `npm --prefix api ci`, `npm test`, `npm run build`, `npm run check`. Start `npm run dev`, then run `npm run test:audit` or `npm run domscan`. Set `SAP_AUDIT_CALENDAR=true` to inspect the live scheduling provider. `npm run test:devices` uses optional BrowserStack credentials and closes remote sessions after each configuration. Reports and screenshots are retained in ignored `.local/`. See [operations](operations.md) for private service administration.

## October 31 candidate audit (supersedes the earlier feature counts)

The plan-review/discovery candidate has 72 passing Node tests and 103 passing local Chrome checks. Tests now cover current-scope review proofs, source-file hash mismatch rejection and cascading deletion, isolated service routes, database geometry key reordering, repeated-label ambiguity, non-integer quantities, private discovery storage boundaries and handover placeholder rejection. Real selected-page model calls were exercised; results and failed attempts remain private.

Five base client estimate/upload/brochure journeys and three résumé/availability journeys reached the private inbox. Each PDF's embedded calculation matched the server calculation. Two client extensions added a 12-tile 4200 × 3180 office plan (ownership-core hashes all match), and an explicit printed-plan 1500 versus entered 1000 correction. Ambiguous overlapping readings remain flagged for the call; spatial coverage is not an OCR-completeness guarantee. Ten enquiry/application/revision notifications were independently reported delivered by Resend to the owned operator address.

The first real booking test exposed a provider confirmation bug: the stored UTC appointment was correct, but the guest confirmation displayed UTC time as local and converted a date-only UTC timestamp to the previous day. Remaining booking tests were stopped pending correction. This is a candidate finding, not a claim of final scheduler acceptance. New mobile/tablet publication coverage is recorded separately when completed; the earlier 517 checks do not cover these new features.
