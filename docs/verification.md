# Verification — October 31, 2026

Website: https://projecthamburg.github.io/sap-service/. Current public build: `74f1f70d42b3`. The private API and isolated plan-review function are deployed in AWS Canada Central; public identifiers are recorded in `api/deployment.json`. Source is pushed to `main`, and both Pages and private-service Actions deployments completed successfully. Pages: [successful deployment](https://github.com/projecthamburg/sap-service/actions/runs/41175239246). Private services: [successful deployment](https://github.com/projecthamburg/sap-service/actions/runs/41174360633). The final documentation commit may create another Pages run with the same public build.

## Functional acceptance

- **76 Node tests pass**, covering estimation and conversions, input validation, saved-scope privacy, actual PDF documents, upload signatures/manifests, tokens, CORS, authenticated administration, server-side price calculation, durable email retries/idempotency, handover routing, plan geometry/reconciliation, scoped review proofs, source hash mismatch rejection and isolated service routes.
- **103 local Chrome checks pass**, including the supplied-logo silhouette (IoU0.9765), both languages/themes, responsive layouts, native interactions, every comparison/photograph decoding, full estimator progression, budget/discovery fields, private local-save boundaries, navigation focus, careers and eager calendar loading. The matching Actions audit passed before publication.
- Five owned synthetic clients completed actual estimate/upload/PDF journeys. Their embedded calculation data matched the server results. Three applicants submitted real synthetic résumés and availability; incomplete fields, missing availability, unsupported/missing files and a temporary submission failure were exercised.
- Client04 additionally reviewed a 4200×3180 office plan in 12 overlapping tiles. Every ownership-core pixel hash matched the reassembled decoded PNG tiles. Uncertain/repeated readings remained explicitly flagged; spatial coverage was not treated as proof of complete recognition.
- Client05 explicitly corrected an entered 1000 sq ft against a printed 1500 sq ft plan. The mismatch was shown, correction was manual, and the retained PDF/private record reflected the corrected inputs. Unit and missing/extra-zero classifications also have deterministic tests.
- All five subsequent real consultation bookings matched Monday Nov 2's selected local date/time: 09,10,11,13 and14h America/Toronto. Exact IDs 49–53 and the earlier regression 48 were deleted through supported admin UI; upcoming 0/archive 20 was preserved. No unrelated bookings were touched.
- Ten intake/application/revision emails and six scheduler notifications were independently reported delivered by Resend to owned operator addresses. This differs from the inbox's provider-accepted state. The scheduler does not currently send a guest email or create a video link.
- Signed private downloads of both reviewed plans and all three résumés matched original SHA-256 hashes; unsigned requests returned 403. Only recorded synthetic enquiries/applications and known review jobs were deleted after acceptance; private local evidence was retained.
- All 23 original brochure pages were rendered and visually reviewed. Office pagination was refined from 6 to 5 pages to keep the closing guidance/email together; the refreshed 22-page set is retained alongside original attempts. A fresh browser PDF download was also verified.

## Real-browser device audit

The final audit runs sequentially on the version-checked public build, including real phone/tablet devices, PDF.js worker rendering of a genuine selected PDF, padded preview, unselected AI consent, optional discovery/budget, both languages/themes, all comparison images, estimator cards, application input/availability and embedded scheduling. It does not create additional bookings, send emails or process page images through AI.

**607 checks passed, zero failed, across nine configurations, all on build `74f1f70d42b3`.**

| Configuration            | Passed |
| ------------------------ | -----: |
| iphone-safari            |     71 |
| android-chrome           |     69 |
| ipad-safari              |     67 |
| ipad-safari-landscape    |     67 |
| android-tablet           |     71 |
| android-tablet-landscape |     67 |
| mac-safari               |     65 |
| windows-edge             |     65 |
| windows-firefox          |     65 |

Real iPhone 16/iOS 18 Safari, Galaxy S23/Android 13 Chrome, iPad Air 13/iOS 18 in both orientations and Galaxy Tab S9/Android 13 in both orientations were included. Desktop configurations were macOS Sequoia Safari 18.4, Windows 11 Edge and Windows 11 Firefox. Each session was closed; no customer submissions or model calls were created by this device audit. A separate final Firefox inspection confirmed 31 calendar day controls with visible 48-pixel dimensions and selectable November dates, including Monday November 2; its next-month screenshot was reviewed.

## Findings fixed and evidence limits

Actual booking exposed a provider bug that displayed the previous day and UTC clock as local although storage was correct. A SAP-only adapter in the allowed schedule nginx site corrected that response display; shared application code, DB, other nginx sites, icon/status and notification settings were unchanged. See [scheduler integration](scheduler-integration.md) for provenance, limits and rollback.

The first new iPhone PDF test failed because the modern PDF.js distribution required a missing Map method in Safari 18. The published build now uses the library's legacy compatibility main/worker, with a worker cache version. The iPhone PDF preview then passed in English and French. Raw attempts and cleanup are retained separately; the failed run is not counted as final acceptance.

Fresh Blueprint and Domscan evidence joins 8 declared runtime states, 46 source files and 4 named brand consumers with hashes and explicit capture status. Static bindings do not prove execution, matching CSS does not establish the winning cascade, and pixel coverage does not establish complete OCR. Browser/device screenshots and independently rendered PDFs supplement the source/runtime evidence. Earlier releases and their resolved failures are in [verification history](verification-history.md).

Private screenshots, inbox records, model responses, source fixtures and signed upload URLs remain under ignored `.local/`. Public Actions artifacts contain only non-sensitive public-page evidence. Calendar seasonal business hours, guest receipts, cancellation/rescheduling, approved rates and production account/channel choices remain explicit SAP handover decisions, not capabilities inferred from a green browser score.
