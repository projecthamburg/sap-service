# Verification — November 5, 2026

Current frontend build: `d144a24a4e4a`. The [website](https://projecthamburg.github.io/sap-service/), [Admin Maps](https://projecthamburg.github.io/sap-service/#/en/admin/maps), [standalone Maps app](https://projecthamburg.github.io/sap-service/?workspace=maps#/en/admin/maps) and [read-only demo](https://projecthamburg.github.io/sap-service/?demo=1#/en/admin) are published. [Pages deployment 42041078802](https://github.com/projecthamburg/sap-service/actions/runs/42041078802) and [private-service deployment 42041078683](https://github.com/projecthamburg/sap-service/actions/runs/42041078683) succeeded. The previous demo/intake releases remain in [verification history](verification-history.md).

## Audited location replacement

The owner's `audited_real_locations.txt`, compiled November 5, is the active inclusion list. Exactly **30 sites remain**, **37 preceding records were removed from the active register**, and all 30 retained coordinates were corrected. Ten corrections move a point by more than one kilometre. Names, addresses, cities and activity statuses follow the supplied file; listed finished sites remain included. The nearby UQO/Cégep records retain distinct IDs and points. Bundled projects use only their supplied main point, with no invented secondary pins.

The Saint-Joseph correction now uses 281 boul. Saint-Joseph, Gatineau and its supplied coordinates for both the pin and Drive destination. The private operational data is never bundled into Pages. The source SHA-256 is `8ae7a484e360a5666572adeaba4abbb03c600637d4d11833f85e39ef039ba6e5`; the saved dataset version is `6bd69a654a736253035a3983d6eff87a8443dc96575b14542404515710c2a250`.

Structured location provenance survives JSON/CSV exchange. Audited coordinates cannot be replaced by the optional Google address lookup. Location confidence and approximate areas remain distinct from commercial qualifications and surveyed boundaries; the supplied source describes non-commercial field/documentary research. The preceding 67-site and current 30-site encrypted private snapshots were both read back and their content hashes verified. The import used the expected live version and retained audit history. No operational field sites or visit history were deleted.

## Accepted checks

- 104 Node tests passed, including audited metadata/schema, prevention of Google-review coordinate replacement and a lossless CSV round trip.
- 103 public Chrome checks and eight public Domscan states passed in Pages Actions. A fresh local Domscan/Blueprint evidence join covers eight runtime states, 73 source files, 1,523 entities and 514 named ESM bindings.
- 57 live Chrome staff-admin checks passed: exact approved dataset, tier/filter counts, locked audited locations, map themes, fallback, private Inbox, import validation/version conflict, responsive layouts and logout.
- 55 additional Chrome demo/coordinate checks passed: all 30 real card addresses and driving destinations, all actual Google marker coordinates in both themes across normal portal/standalone phone, tablet and desktop sizes, French provenance text, retained demo restrictions and no privileged writes/runtime errors.
- 68 live field/PWA checks passed, including location permission, current-origin directions, one-/two-mile alerts, visit status transitions, explicit field-site capture, persistence, error recovery, geometry and test isolation. The synthetic field site was removed afterwards.
- 13 public PWA-shell checks passed: manifest/launcher, Chrome installability, worker scope, public-only cache, offline guidance and reconnect.
- **452 BrowserStack checks passed across all eleven configurations below**, against the same frontend build and audited dataset. Each compares the authenticated record set and all actual Google marker coordinates in light/dark modes with the independent source fixture, plus the corrected Saint-Joseph destination, sign-in/error paths, cards, fallback, Inbox, standalone themes/fullscreen/layers/install guidance and sign-out. The preliminary Windows smoke run is excluded from this total.

| BrowserStack configuration | Observed initial viewport | Passed checks |
|---|---|---:|
| iphone-safari | 393 × 659 (portrait) | 43 |
| iphone-safari-landscape | 734 × 343 (landscape) | 40 |
| android-chrome | 360 × 649 (portrait) | 43 |
| android-chrome-landscape | 705 × 280 (landscape) | 43 |
| ipad-safari | 1024 × 1292 (portrait) | 40 |
| ipad-safari-landscape | 1366 × 950 (landscape) | 40 |
| android-tablet | 753 × 1036 (portrait) | 43 |
| android-tablet-landscape | 1204 × 585 (landscape) | 40 |
| mac-safari | 1324 × 968 (landscape) | 40 |
| windows-chrome | 929 × 861 (landscape) | 40 |
| windows-firefox | 1280 × 842 (landscape) | 40 |

Phone, tablet and desktop screenshots were visually inspected, including corrected cards and standalone portrait/landscape states. All task-owned BrowserStack sessions were closed. The disposable QA account was revoked after testing; its already-issued token changed from HTTP 200 to 401. Owner, named staff and permanent demo accounts were left unchanged. No invitation emails, enquiries, applicant submissions or bookings were sent. Existing business-account AWS resources were reused, with no new always-on service.

Private source, before/after snapshots, coordinate comparisons, screenshots, DOM captures, device reports and governance evidence remain under ignored `.local/location-audit-2026-11-05/`. The reusable acceptance procedure and handover rules are recorded in [Admin Maps](admin-maps.md), the [audit protocol](audit-protocol.md) and [handover](handover.md).

The existing platform limits remain: Android installation was owner-confirmed; a physical Apple Home Screen installation remains unverified. Nearby alerts require an open app and connectivity, without guaranteed background/locked-screen tracking. Research locations are dated evidence, not guaranteed available contracts. Reopen/reload an already-open Maps app to request the current register.
