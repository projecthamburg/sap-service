# Archived verification records

These are historical releases and intermediate checkpoints. Use [current verification](verification.md) for the accepted public build and final results.

# Verification — November 3, 2026

Current build: `a7fc48499a9c`. The [website](https://projecthamburg.github.io/sap-service/) and [demo entry](https://projecthamburg.github.io/sap-service/?demo=1#/en/admin) are published. [Pages deployment 41656397995](https://github.com/projecthamburg/sap-service/actions/runs/41656397995) and [private-service deployment 41656397868](https://github.com/projecthamburg/sap-service/actions/runs/41656397868) succeeded. The earlier public intake, field/PWA and eleven-configuration device matrix remain recorded in [verification history](verification-history.md).

## Shared demo access

The demo displays username `demo`, uses a permanent password, sends no invitation email and requires no first-login password change. Its reserved internal identifier has no verified delivery/recovery mailbox. Credentials remain outside the repository and URLs. Both `SAPAdmins` and `SAPDemo` membership are required when provisioning this account.

The signed demo role allows only GET session, map configuration and the researched register. Live saved field sites and visit notes are omitted. Private submissions/files and every privileged mutation are denied server-side, even with the test header. Demo UI saving/import controls are disabled and Inbox explains that private files are unavailable. The map uses the existing real research rather than invented opportunities. Display preferences, search, directions, map layers and location remain available.

The demo link does not render a previously signed-in staff workspace: it returns to the demo sign-in without requesting staff maps or Inbox data. The demo Maps manifest retains its own demo start URL. Public customer/application forms remain actual forms; this is a read-only admin demonstration, not a sandbox for submitting public forms.

## Accepted checks

- 101 Node tests passed, including signed demo-role claims, a strict method/path allowlist, no field-index queries for demo data, and prevention of private reads or mutations. Existing estimator, PDF, upload, authorization and concurrency tests remain.
- 103 public Chrome checks and eight public Domscan states passed in Pages Actions.
- 13 live API checks passed: permanent-password sign-in without email/reset/MFA, signed demo identification, all 67 research records with empty field/activity data, direct private/write-route rejection, test-header isolation, unchanged dataset version and confirmed/no-verified-mailbox status.
- 29 Chrome demo checks passed: literal username/no recovery action, no password-change challenge, real Google map, read-only cards, private Inbox placeholder with no submissions fetch, separate installable demo manifest, desktop/phone/tablet portrait/landscape in both themes, no privileged UI writes, sign-out and no runtime errors.
- A separate Chrome check passed for a signed-in staff session opening the shared demo link, without private data requests or rendering.
- 57 normal staff-admin regression checks passed, including full Inbox access and normal imports/conflicts. The disposable staff audit fixture was revoked afterwards; its existing token changed from HTTP 200 to 401. Owner and named staff accounts were unchanged. The permanent demo remains enabled for sharing.

Authenticated evidence stays privately under `.local/admin-demo/`. No emails, application submissions or bookings were generated during this demo setup. Existing business AWS resources were reused; no new always-on infrastructure was introduced.

The existing platform limits remain: the owner confirmed Android installation; a physical Apple Home Screen installation is unverified. Nearby alerts require the app open and connectivity, without guaranteed background/locked-screen tracking. Research records are dated prospects, not guaranteed contracts. See [Admin Maps](admin-maps.md), [handover](handover.md) and the [audit protocol](audit-protocol.md).


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

The plan-review/discovery candidate has 76 passing Node tests and 103 passing local Chrome checks. Tests now cover current-scope review proofs, source-file hash mismatch rejection and cascading deletion, isolated service routes, database geometry key reordering, repeated-label ambiguity, non-integer quantities, private discovery storage boundaries and handover placeholder rejection. Real selected-page model calls were exercised; results and failed attempts remain private.

Five base client estimate/upload/brochure journeys and three résumé/availability journeys reached the private inbox. Each PDF's embedded calculation matched the server calculation. Two client extensions added a 12-tile 4200 × 3180 office plan (ownership-core hashes all match), and an explicit printed-plan 1500 versus entered 1000 correction. Ambiguous overlapping readings remain flagged for the call; spatial coverage is not an OCR-completeness guarantee. Ten enquiry/application/revision notifications were independently reported delivered by Resend to the owned operator address.

The first real booking test exposed a provider confirmation bug: the stored UTC appointment was correct, but the guest confirmation displayed UTC time as local and converted a date-only UTC timestamp to the previous day. A correction confined to the SAP booking route in the allowed scheduler nginx site was installed and verified; all five subsequent bookings matched the selected local day/time. Their exact IDs49–53 and regression48 were removed through supported admin deletion, preserving upcoming0/archive20. The shared app and other tenant configuration were not changed. See `scheduler-integration.md`. New mobile/tablet publication coverage is recorded separately when completed; the earlier 517 checks do not cover these new features.


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


---

# Verification — November 2, 2026

Public website: https://projecthamburg.github.io/sap-service/. Maps app entry: https://projecthamburg.github.io/sap-service/?workspace=maps#/en/admin/maps. Release `059aebeceb53` contains the field/PWA additions and responsive sign-in. The private-service deployment succeeded through Actions [41557697655](https://github.com/projecthamburg/sap-service/actions/runs/41557697655). Pages deployment [41560565360](https://github.com/projecthamburg/sap-service/actions/runs/41560565360) succeeded. BrowserStack acceptance for this baseline is complete. The owner has separately requested a subsequent field-card copy/interface cleanup. Earlier public intake, PDF, booking and applicant acceptance is preserved in [verification history](verification-history.md).

## Native and service checks

- 95 Node tests pass, including account authorization/revocation, research validation, field persistence/status concurrency, isolated test namespaces and concurrent creation idempotency, alongside existing calculator, upload, PDF, plan geometry and service contracts.
- 103 public Chrome checks pass: both languages/themes, all comparison images/slider behavior, responsive layouts, estimator, discovery fields, applications, logo fidelity and eager scheduling. Actions repeat this public audit before publication.
- 56 authenticated admin checks pass: invitation gate, real 67-record register/tier counts, contractor participation filters, source conflicts, address-review restrictions, Google/fallback maps, GPS permission, invalid imports, settings, both themes across desktop/tablet/phone widths, Inbox reuse and sign-out/token removal.
- 41 field/PWA checks pass: denied/allowed GPS, exact mile options, incomplete capture, private save, Visited → Will return → Open, current-origin car navigation, eight standalone size/height layouts with explicit panel-intersection assertions, phone import/backup access, reload persistence, one-mile exclusion/two-mile alert for a site about 1.5 miles away, dismissal, layers and isolated-site cleanup. Tests use synthetic observations in a separate authenticated server namespace; the 67 operational research records remain unchanged.
- 13 public-shell PWA checks pass, including Chrome installability, manifest/start URL, all launcher sizes/maskable icon, worker scope, cache exclusions, offline guidance and reconnection. No account credentials or private records are needed for this audit.
- 16 continuous Chrome-window resize cases pass across normal/standalone entries, recording actual window and viewport sizes, horizontal/vertical centering against the measured header, safe scroll behavior in short windows, and captured Domscan evidence. A separate 16-state capture covers four viewport sizes and both themes. Native desktop windows enforce a minimum width; the smaller phone viewports are exercised separately and on real devices.

## Real-device acceptance

The authenticated BrowserStack matrix runs sequentially in the existing one-slot account, with exact public-build verification. It covers account gating, real research, contractor filters, dossiers, incomplete import, settings, Google/fallback, Inbox, both themes, standalone map controls, mobile sheets, satellite, install guidance, sign-out and French sign-in. **279 checks passed, zero failed, across nine configurations on build `059aebeceb53`.** iPhone Safari 33; Android Chrome 33; iPad Safari portrait/landscape 30 each; Android tablet portrait 33 / landscape 30; Mac Safari 30; Windows Chrome 30; Windows Firefox 30. Actual tablet viewports/orientations were recorded. All task-owned sessions closed and the disposable audit account was revoked; its valid access token changed from HTTP 200 to 401 immediately. The owner account was unchanged.

An earlier pass on `f0e85fde039c` completed 27 checks each on iPhone and Android. Screenshot inspection then found that the mobile status message could overlap the nearby-control area. That spacing is corrected in `680a3406c689` and now has an explicit intersection assertion. The interrupted tablet session was closed; the earlier partial run is retained privately and is not counted as final acceptance.

## Evidence, fixes and limits

Blueprint reconciles 70 selected source files, 1,455 entities and 462 named ES-module call bindings, with source hashes and explicit coverage. Public Domscan captures eight language/theme/width states; the canonical supplied-logo comparison remains IoU 0.9765. Authenticated Domscan captures and visual screenshots cover portal/map/sign-in states privately. Blueprint traces structure; Domscan records rendered state and applicable styles; behavioral assertions and screenshot inspection provide separate evidence. A passing count alone does not establish visual or business correctness.

The owner identified sign-in positioning during live window adjustment. The layout now observes the actual header height, centers within the available viewport and keeps short-window form controls scrollable. Other resolved findings include an old nearby toast covering a mobile list, incorrect persistence after a filter change, and unhelpful offline error text when the browser reports online but the request fails.

The 67 records are real owner-supplied dated research, not guaranteed open contracts or an automatic discovery feed. Explicit field observations remain unqualified. Source-coordinate accuracy and commercial confidence remain distinct. Only explicit saved site locations/accuracy/capture times and visit notes persist; continuous GPS/travel history does not. Mile membership is straight-line radius, not road-route length.

The PWA caches public code/icons only; private data/map services require internet. Native installability and platform guidance are checked; browser testing of the standalone entry does not by itself certify every operating system's installed-app lifecycle. Keep the app open for reliable nearby GPS/notifications; no guaranteed locked-screen or background tracking is claimed. Driving navigation opens Google Maps. Tests do not send outreach or create extra scheduler bookings.

Authenticated screenshots, source research, test credentials and billing evidence stay in ignored private storage. Public Actions artifacts contain only public-page evidence. AWS remains the business account in Canada Central, using the existing on-demand table, S3 and Lambda; no always-on field-tracking infrastructure was added. See [operations](operations.md), [handover](handover.md), [Admin Maps](admin-maps.md) and [cost assumptions](cost-estimate.md).


The initial Android negative-flow attempt was not counted: trusted-event/viewport tracing showed the automated tap landing on background when its keyboard closed. Recovery opened when the actual button received the tap. The harness now dismisses the keyboard before navigation and retains native WebDriver clicks. The Windows center assertion now excludes classic scrollbar space. All four affected configurations were rerun completely and the accepted matrix combines only passing results on the same public build. Raw failures and diagnostic traces remain privately archived.


---

# Verification — November 2, 2026

The website is published at https://projecthamburg.github.io/sap-service/. The map app is https://projecthamburg.github.io/sap-service/?workspace=maps#/en/admin/maps. Current build: `6b2d5a9e9066`. Pages [41578092980](https://github.com/projecthamburg/sap-service/actions/runs/41578092980) succeeded. The existing private-service deployment [41557697655](https://github.com/projecthamburg/sap-service/actions/runs/41557697655) remains in use; this cleanup/full-screen release changes no API infrastructure. Earlier accepted releases, including the nine-configuration baseline, are retained in [verification history](verification-history.md).

## Delivered and checked

- Compact field cards put driving/contact links and visit actions first. Notes and project details expand on demand; the nested original record retains all research, qualifications, identifiers and sources. No underlying research was deleted. Legacy research-view preferences no longer force cards open on first use.
- The map app offers native full screen where supported, an expanded-map fallback, a visible exit, and responsive portrait/landscape layouts with cutout insets. The map fills the area above the phone site sheet. Standalone maps accept one-finger movement; overlapping extra Google camera/Street View controls are removed there. Street View remains available in project details.
- Permission-denied location opens visible guidance and sets a concise unavailable state. Temporary session/data read failures offer explicit Retry controls; a connection failure does not discard an otherwise valid session. Mutations and forms are never automatically resubmitted.
- 99 Node tests pass, including four presentation tests alongside existing estimator, uploads, PDF, authentication, research, idempotency and field concurrency coverage. Pages repeats tests, build validation and public-credential checks.
- 103 public Chrome checks pass. Pages also repeats public Domscan across eight language/theme/width states.
- 57 authenticated Chrome checks pass, including real research counts, filters, full records, invalid imports, settings cancellation, both themes, responsive layouts, fallback, Inbox and sign-out. A separate visual audit passed 49 checks across three real cards at phone/desktop widths in both themes, including retained records and sticky driving actions.
- 68 field/PWA checks pass on the final staged assets under the approved Pages origin, using the actual private service and isolated synthetic field observations. Coverage includes denied/allowed GPS, visible help, exact mile options, incomplete capture, private save, Visited → Will return → Open, current-origin driving, eight layouts, full-screen entry/exit/fallback, six full-screen size/inset cases, actual canvas bounds, both session/data retry paths, persistence, one-/two-mile boundary behavior, layers and deletion of the synthetic site.
- 13 public-shell PWA checks pass on live build `6b2d5a9e9066`: installability, manifest/icons, worker scope, public-only cache, offline guidance and reconnect. The earlier 16 native Chrome-window resize cases remain applicable to the unchanged sign-in layout; they record actual window/viewport dimensions, measured-header centering and short-window scrolling.

## Real-device acceptance

The complete BrowserStack matrix passed **408 checks, zero failed, across eleven configurations on build `24c985ed9e8b`**. Each session verified that public build and closed successfully. The existing one-slot plan was used sequentially. Coverage includes both themes, compact cards, account/error flows, real research, normal admin and standalone maps, full-screen/fallback/exit, canvas bounds, location/layers, install guidance, sign-out and French sign-in.

| Configuration | Passed checks |
| --- | ---: |
| iPhone Safari portrait | 39 |
| iPhone Safari landscape | 36 |
| Android Chrome portrait | 39 |
| Android Chrome landscape | 39 |
| iPad Safari portrait | 36 |
| iPad Safari landscape | 36 |
| Android tablet portrait | 39 |
| Android tablet landscape | 36 |
| Mac Safari | 36 |
| Windows Chrome | 36 |
| Windows Firefox | 36 |

The follow-up `6b2d5a9e9066` changes two CSS rules limited to short, wide map workspaces: inset the site list and constrain wide dialogs around device cutouts. With zero horizontal insets, positions/widths are unchanged; these rules are inactive on tall/portrait layouts. **36 additional live iPhone landscape checks passed on this follow-up**, including explicit list and install-dialog inset bounds. The full 68-check staged field suite also passed on the current assets. The 408-check matrix and targeted follow-up remain distinct; they are not represented as eleven new runs on the follow-up build.

All task-owned cloud sessions closed. The disposable audit account was revoked after testing: a valid access token changed from HTTP 200 to 401 immediately. The owner account/password were unchanged.

## Evidence and limits

Blueprint reconciles 72 selected source files, 1,499 entities and 503 named ES-module call bindings. The source/runtime evidence join covers eight public Domscan states and four brand consumers, with source hashes. Canonical logo comparison remains IoU 0.9765. Authenticated DOM captures, screenshots, research and credentials remain private; public Actions artifacts contain only public-page evidence.

Screenshot inspection found a blank portrait-map band caused by an inherited `max-height: 60dvh`, plus covered SDK controls. Geometry tests now check the actual map canvas, alongside panel intersections. Review also caught location help present only in a clipped live region, and a transient session connection failure that incorrectly returned to raw-error sign-in. Both have visible recovery flows. Transport-abort attempts and their subsequent network failures are retained privately; deterministic read-failure tests inject a one-shot fetch rejection at the browser boundary, then recover through the actual UI and real service. No research response is fabricated for acceptance.

The owner confirmed installation on their Android phone. Real Safari/device browser testing of the standalone entry does **not** certify a physical iPhone/iPad Home Screen installation. Native full-screen support differs by platform; unsupported browsers expand the map within available space. Apple Home Screen installation remains a separate physical-device acceptance item. Simulated safe-area insets are geometry evidence, not that installation test.

Keep the app open for reliable GPS/nearby alerts. No guaranteed locked-screen/background tracking is claimed. External Google Maps handles car navigation. Radius membership uses straight-line distance, not road-route length. GPS travel history is not stored; only explicitly saved locations/capture metadata and visit notes persist. The 67 records remain dated owner-supplied research, not guaranteed open contracts or an automatic discovery feed. Field observations remain commercially unqualified. Private data and map services need connectivity.

The existing business AWS account in Canada Central continues to use the on-demand table, S3 and Lambda. No always-on field-tracking infrastructure was added. No scheduler tenants, statuses or unapproved artwork were changed. See [Admin Maps](admin-maps.md), [audit protocol](audit-protocol.md), [handover](handover.md) and [cost assumptions](cost-estimate.md).
