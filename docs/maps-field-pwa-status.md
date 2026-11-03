# Maps and field app — November 2, 2026

The owner authorized resumption after the saved pause. The Admin/Maps release is published at https://projecthamburg.github.io/sap-service/#/en/admin. The standalone entry is https://projecthamburg.github.io/sap-service/?workspace=maps#/en/admin/maps. The current build is `a7fc48499a9c`, adding a separate read-only demo login; use [verification](verification.md) for the exact accepted Actions/device results. The previous paused frontend checkpoint has been integrated and superseded.

## Delivered

- Google's native detailed light/dark maps and building/hard-hat/crane construction pins.
- Explicit location permission, blue GPS point/follow, exact one-/two-mile radius alerts and current-origin Google Maps driving links.
- Intentional private GPS field-site capture, shared Open / Visited / Will return states, notes, reopening, concurrency protection and audit.
- A map-first installable PWA, mobile site sheet, floating search/filters/layers/location controls and canonical SAP launcher icons.
- Public-shell-only caching, clear offline guidance, sign-in/session protection and logout cleanup.
- Compact field cards with quick driving/contact/visit actions and complete research retained behind expandable details.
- Full-screen / expanded-map controls with an accessible exit, cutout-aware portrait/landscape layouts and one-finger standalone map movement.
- Visible location-denied guidance and explicit session/data connection retries that retain valid credentials.
- Adaptive sign-in centering that follows actual header/window changes, safe short-window scrolling and phone control spacing.

The existing 67-record owner-supplied private research register is preserved. Synthetic ZIP data was excluded. Field observations remain commercially unqualified. Tests use an isolated server namespace and remove their synthetic sites. All infrastructure remains in the business AWS account in Canada Central; the existing on-demand table, S3 and Lambda are reused, with no added always-on field-tracking server. The dedicated SAP Google key remains restricted and delivered through authenticated configuration.

## Operational limits

The owner confirmed Android installation. Real iPhone/iPad browser checks cover the standalone entry; a physical Apple Home Screen installation remains unverified. Unsupported native full-screen browsers use an expanded-map fallback. Keep the app open for reliable GPS/nearby alerts. Installing a PWA does not guarantee background or locked-screen updates. External Google Maps handles car navigation. Radius membership is straight-line, not road distance. GPS travel history is not stored; explicitly saved locations/capture metadata and visit notes are private operational records. Private data and map services need internet. Research is dated evidence, not an automatic discovery feed or guarantee of available contracts.

See [Admin Maps](admin-maps.md) for operation/account controls, [handover](handover.md) for migration and retention decisions, and [costs](cost-estimate.md) for usage assumptions. Authenticated evidence and credentials remain private. BrowserStack's one slot is used sequentially; incomplete cloud attempts are kept separate from final acceptance. The owner account and unrelated scheduler tenants/logo/statuses are unchanged.
