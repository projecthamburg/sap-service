# Paused checkpoint — November 2, 2026 (Montréal)

Paused at the owner's explicit request while more usage is arranged. Resume only when the owner requests it.

## Live release

The website and invitation-only admin portal are live at https://projecthamburg.github.io/sap-service/#/en/admin. Public build `a0382d1fd33c` is deployed from `main`. Both Actions runs succeeded: Pages `41542593667` and private services `41542595255`. The owner confirmed that sign-in works. The owner's admin account is `mordecai@projecthamburg.com`.

The operational register contains the real owner-supplied research dataset: 67 records, priority counts 15/16/15/21. Synthetic ZIP records were not installed. The original source file remains privately archived. Frecon C015 retains an explicit conflict between the November 5 list date and November 6 detail-page date, with both official citations.

AWS deployments use the business credentials, account `536955747256`, IAM principal `mordecaimachazire`, region Canada Central. The Google Maps key is the dedicated SAP key in the business owner's Google project. Research-account credentials were not used.

## New work saved on the feature branch

Branch: `feature/maps-field-pwa-2026-11-02`. These frontend additions are not yet published to Pages:

- Google's native dark map colour scheme, preserving roads, boundaries and water instead of flattening geometry to navy.
- Construction building/hard-hat/crane pins, with visit-state badges.
- Explicit My location, GPS follow, one-/two-mile nearby alerts and driving navigation from the shared current position.
- Saving a field site from the GPS marker, with accuracy and explicit capture metadata.
- Shared Open / Visited / Will return statuses, notes, optimistic concurrency and audit history.
- Map-first standalone layout, mobile site sheet, install manifest, canonical SAP launcher icons and public-shell-only service worker.

The private API has already been updated to support field operations. Those operations use the existing table and storage. A live isolated test successfully created a site and changed Visited → Will return → Open. Test rows are separate from operational rows, have expiry, and the created test sites were deleted. The 67-record operational research register was preserved.

## Verification and remaining work

The new checkpoint passed 94 Node tests and the 56-check staged admin audit. The full field/PWA browser test progressed through location denial, permitted GPS, both alert radii, required-name validation, saving a site, and marking it Visited. It then exposed a UX issue: an older nearby-alert toast can cover the expanded mobile site list and remain after the search excludes its site. Fix that before publishing; also make the notification compact and dismiss/reconcile it on filter or visit-state changes.

Continue complete field/PWA end-to-end testing: return/open, reload persistence, current-origin car navigation, both themes at street level, floating controls/layers, marker choices, installation and public-only offline caching. Current PWA screenshots and reports are private under `.local/admin-map/field-pwa-audit/`.

BrowserStack has one parallel slot. Do not run suites concurrently. Five initial admin device configurations passed all 15 checks each; later sessions hit infrastructure/transport failures and need sequential retries. The newer Google-like/PWA work still needs its full desktop/phone/tablet matrix. The attempted full public regression was incomplete due to BrowserStack transport failures; do not call its partial results a full pass. Use the localhost BrowserStack Local helper the owner connected, and the business Chrome profile; leave the owner's helper/tunnel running.

Update privacy/handover/verification/cost documentation consistently before release. Live GPS is not stored as travel history; explicitly saved site coordinates and visit notes are private persistent records. PWA installation does not guarantee GPS while minimized/locked: nearby alerts require the app to remain open for reliability. Driving navigation opens Google Maps.

Re-run appropriate checks, Blueprint and Domscan against stable source, push the final changes, merge only when ready, deploy via Actions and verify the live build. Keep all authenticated screenshots, test credentials, private research and billing details out of public artifacts.

## Cost check

The existing table uses on-demand billing; AWS's latest table statistics at the check reported 1,594 bytes / five items. The API uses 256 MB Lambda memory. No always-on server or database cluster was added for this work. The available estimated business-account report for November 1–2 showed approximately USD 0.000160875 DynamoDB, USD 0 Lambda and USD 0.4336421379 S3 account-wide. These are delayed account-level figures, not a final SAP-specific invoice. The billing query itself was one Cost Explorer API request; the API is billed at USD 0.01/request. GPS/radius processing runs in the browser rather than writing continuously to AWS. Google Maps has separate usage billing.
