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
