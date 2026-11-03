# Admin workspace and opportunity map

The Admin link opens `#/en/admin` or `#/fr/admin`. Maps is the initial tool; Submissions inbox retains quotation requests, applications and their private files. Existing `#/en/inbox` and `#/fr/inbox` links now require the same account sign-in.

## Accounts and authorization

Authentication uses the SAP-only Amazon Cognito user pool in Canada Central. There is no public registration. The browser uses SRP; passwords are not sent to the SAP API. Access tokens last 15 minutes and can refresh within a one-day session. The SDK stores tokens in sessionStorage for the browser tab. Sign out clears the tokens and private interface, stops GPS and releases map resources.

The API verifies the Cognito signature, issuer, client ID, access-token type and SAPAdmins group. A signed-in account outside that group has no admin access. Public client IDs in `public/admin-auth.json` are identifiers, not credentials. All members of SAPAdmins have both Maps and Inbox access; this release does not create a separate field-only permission level.

An authorized operator with business AWS credentials can run:

```sh
node api/provision-admin.mjs
node api/admin-account.mjs invite approved-email@example.com
node api/admin-account.mjs revoke approved-email@example.com
```

Invite sends Cognito's transactional invitation and requires a new password at first sign-in. Existing accounts keep their passwords. Recovery is available from the sign-in form. Revoke first writes a private API deny record, then disables Cognito sign-in and refresh sessions; the API checks this record on every admin request. The existing long random ADMIN_TOKEN remains for emergency operator scripts, not the website's login form. Protect and rotate that credential separately.

## Real research, not sample leads

The AI Studio ZIP contains synthetic records. Those records, its invented satellite coordinates, simulated GPS fallback, and substitute logo were excluded from the operational implementation.

The owner supplied a separate 67-record research register through Dynamos on November 2, 2026: Immediate 15, Near-term 16, Strategic 15, Monitor 21. Its original file SHA256 is `617f7dae70c6a21c623376c23adc98b69505feff00aa9c059bde685dd51a5346`. The original remains in ignored private local storage. The operational copy is in private S3, outside the public repository, build and website assets. It is a dated research register, not an automatic live lead-discovery feed or confirmation of contract availability.

All 34 supplied fields are retained. Dossiers distinguish opportunity score, evidence confidence, procurement relationships, deadlines, next actions, conflicts and citations. No contact, award, insurance, registration, staffing or equipment claim is invented. Confirm suitability and current opportunity status before outreach or quoting. No emails, calls, bids or calendar bookings are sent automatically by Maps.

Primary-source spot checks on November 2 confirmed the existence and published tender dates for CHEO Accessibility, St-Albert renovations, RMC R13, and Deep River Spiritual Space. These checks do not verify every record or establish cleaning subcontract availability. The official Frecon welding tender has conflicting dates: its [list](https://www.frecon.ca/tenders/) says November 5; its [detail](https://www.frecon.ca/tender/csdceo-welding-shop-refection/) says November 6, with an addendum dated November 2. Both citations and the conflict were added to the private record; the original November 5 conservative planning cutoff was preserved pending confirmation. The original source document remains unchanged, and the private dataset change is audited.

Contractor filters distinguish participation from mere text references. Pomerleau's bundle includes seven participating projects and excludes research notes about an unrelated project or lost bid. Frecon's six-record bid relationship view includes the explicitly unverified historical gymnasium record; it does not claim Frecon won that contract. Full source qualifications remain in each dossier.

## Maps, geolocation and evidence

The dedicated, referrer- and API-restricted SAP Google Maps browser key is delivered through authenticated `/admin/maps/config`. It is necessarily visible to a signed-in browser when loading Google's SDK. Server AWS, email and AI credentials never enter the public bundle. The shared MailOps key is not used. GitHub's encrypted production-api secret is `SAP_MAPS_BROWSER_KEY`.

Google Maps is primary, with an explicitly selected OpenStreetMap/Leaflet fallback. Both preserve the same research pins, tiers, search, dossiers and contractor highlights. Overlapping coordinates open a project picker; pins are not displaced to invented locations. Street View is nearby dated imagery, not proof of current project conditions. Missing imagery has an explicit empty state.

Source coordinates render immediately and retain their original provenance. An operator can request a Google address review. Partial matches, wrong country/province, broad-area matches and drift over 24 km require manual review. Ontario and Québec are handled independently; Ottawa-Gatineau does not automatically become Ontario. Address lookup never verifies the commercial lead. Google lookup coordinates remain in memory for the current tool session, are used only on the Google map, and are excluded from stored research and exports. There is no permanent geocoding cache or fabricated multi-site fallback. Explicit satellite fields, if imported, must contain valid supplied addresses and coordinates; this release presents the main research point and full multi-site notes rather than inventing secondary map points.

GPS requires My location / Nearby alerts and browser permission. Denial shows guidance and offers a manual map or selected-lead anchor. A radius filter uses unrounded Haversine calculations; formatting does not affect membership. Approaching alerts require movement and a matching heading, and entering alerts are deduplicated during the radar session. GPS and alerts require foreground use for reliability. Optional device notifications are issued by the open app when position updates arrive; there is no background location or remote push service. The continuous GPS stream and travel history are not uploaded or persisted. An explicitly saved field site does retain its chosen coordinates, accuracy and capture time privately. The audit may supply test GPS through Chrome's automation interface; no simulation is embedded in the operational interface.

## Imports, storage and audit

JSON is the lossless research exchange format. CSV exports preserve research arrays as JSON cells, use proper quoting and protect spreadsheet formula prefixes. The owner’s legacy CSV is also accepted: semicolon-delimited emails, telephones and source IDs are split, while source/conflict cells are preserved whole because their internal semicolons cannot safely reconstruct original array boundaries. JSON remains the lossless format. JSON/CSV imports validate the same schema in browser and API: IDs, required text, all supplied fields, priority/stage enums, evidence arrays, score bounds and valid paired coordinates. Unsupported fields, including permanent Google-review flags, are rejected. Imports are limited to 2,000 records and 4 MB in the interface. Validation errors are shown before replacement can be confirmed.

An import is a complete replacement, not an implicit merge. Exports include all records, regardless of active filters. The API uses an expected version and transactional metadata write so another administrator's changes cannot be silently overwritten. S3 snapshots are content-addressed under `admin/maps/datasets/`; metadata and audit records use `MAPS#` keys in the existing SAP private DynamoDB table. They do not enter the received-submissions index or notification outbox. Dataset history is private operational storage and does not inherit the enquiry upload expiry. Retention/deletion is the operator's responsibility.

## Verification and handover

`npm test` includes schema, CSV, geometry, heading, negative contractor references, location mismatch, HTML escaping, JWT claims and optimistic-write tests. `npm run test:audit` checks the public website and invitation-only inbox gate. `node scripts/admin-audit.mjs --staged` exercises authenticated real research in a disposable Chrome browser using locally staged public assets under the approved Pages origin; omit `--staged` for the live release. It requires a private, authorized audit account JSON at `.local/admin-map/test-account.json` (email/password), or a path in `SAP_ADMIN_AUDIT_ACCOUNT`. Never use or publish owner passwords.

Authenticated screenshots and Domscan-style DOM/style captures stay under ignored `.local/admin-map/authenticated-audit`, with private permissions. They contain real business research and must not be attached to public CI artifacts. Public Domscan continues to audit both languages, both themes and phone/desktop states; Blueprint now includes the admin modules and private API source, without credentials or operational datasets.

For a future SAP-owned handover: provision a destination Cognito pool/client, invite approved SAP operators, update `public/admin-auth.json` and the API environment, migrate private dataset snapshots and DynamoDB version/audit records with verified hashes, and replace `SAP_MAPS_BROWSER_KEY` with a SAP-owned restricted key. Re-run authentication, denied-access, import-conflict and device audits before switching channels. Passwords are not exported; users establish their own new credentials. The public operator/contact configuration, notification recipients, scheduler tenancy and intake storage retain their existing separate handover procedures. Maps changes do not modify other scheduler tenants or unapproved artwork.

The dedicated `scripts/admin-device-audit.mjs` runs the authenticated portal on BrowserStack phones, tablets in both orientations, and desktop engines. Use an authorized disposable account only. Video, visual command logging and network capture are disabled; BrowserStack text command logs still exist. Revoke and delete the audit account after all sessions are closed. Screenshots remain in ignored private local storage.


## Maps app and field visits

Use **Open Maps app** for a separate map-first window, or **Install Maps app** for a standalone launcher. The direct entry is https://projecthamburg.github.io/sap-service/?workspace=maps#/en/admin/maps. The normal website Admin portal keeps the public navigation and Inbox. The app uses the same invited account; a separately launched installed app may need its own sign-in. Safari installation uses Share → Add to Home Screen. Chrome uses its install prompt/menu. Installation does not grant location permission automatically.

The map uses Google's native light/dark colour schemes, with visible roads, boundaries and water. Satellite is a separate layer. Construction marker options are building, hard hat and crane; Visited and Will return add distinct badges. Search, contractor chips, filters, layers and current-location controls float above the map; the phone site list expands from a bottom sheet.

The Maps app toolbar offers **Full screen** where the browser supports the native API. It expands the whole workspace, including site cards, location and layer controls, with a visible exit button. Escape also exits on desktop. On browsers without that API, **Expand map** hides the app's header and toolbar within the available screen; it cannot hide Safari's own browser controls. Install to the Home Screen for a standalone window. iPhone/iPad Safari uses Share → Add to Home Screen → Open as Web App (if offered) → Add. Installation and location permission are separate. Real browser/device tests do not certify a physical Apple Home Screen installation; that lifecycle needs an owner/device acceptance check. The owner has confirmed installation on their Android phone.

Site cards open in a compact field view: project name, address, driving/contact actions, visit status, company, stage and follow-up date. Notes and **Project details** expand when needed. The nested **Original research record** retains complete source fields, identifiers, scores, qualifications and citations. No research is deleted by this presentation change. Settings can open project details by default; legacy research-view preferences do not force the new compact view open on first use. A failed initial dataset read offers an explicit retry rather than presenting an empty register as success. Forms and mutations are not automatically resubmitted.

My location explicitly requests permission, shows a blue position marker and follows movement until a manual map drag. Tap it again to recenter. Radius options include exactly one mile (1,609.344 m) and two miles (3,218.688 m), with metric equivalents. Distances and alert membership are calculated in the browser using the unrounded coordinates. GPS ticks do not create AWS writes. Alerts deduplicate within a radar session, clear when a site leaves the active results or is marked Visited, and can be dismissed. Keep the app open for reliable alerts; mobile operating systems can suspend a minimized or locked PWA. Driving directions open Google Maps in car mode, including the actual shared position as origin when available.

Tap the blue location point and choose **Add a site here**. Review nearby existing sites before recording a duplicate. The form requires a name and records explicit capture time/accuracy; poor accuracy requires confirmation. A field observation remains commercially unqualified, with no invented opportunity score. Operational saved sites are shared among invited administrators. They are separate from the reviewed research snapshot.

Every dossier supports **Open / Visited / Will return**, visit notes and reopening. Version checks prevent silently overwriting another operator's changes. Field creation is idempotent for the same request identifier. Site/status writes and audit entries are transactional. The existing private DynamoDB table stores these records and visit activity; no new always-on server or database was added. Research replacement/import does not delete field sites or their visit histories. The fieldwork backup export includes saved sites and visit activity separately from the lossless research JSON. It is an export for migration/recovery, not an implemented automatic restore/import tool.

The service worker caches only the public HTML/code/styles/fonts/icons. It bypasses cross-origin services, authenticated requests, identity responses, research datasets and submitted files. Offline launch gives reconnect guidance; private records and map tiles require connectivity. Tokens remain in sessionStorage, not the service-worker cache. Clearing or uninstalling the app does not delete the server's saved field sites.

## Field verification and isolation

Run `node scripts/field-pwa-audit.mjs` against the deployed release, or add `--staged` for local assets under the approved Google referrer. It uses only the dedicated disposable admin fixture and `X-SAP-Test: true`. The server places synthetic sites/activity in a separate namespace, excludes them from operational queries, gives them seven-day expiry, and allows deleting only the test creator's synthetic site. Cleanup runs even after failed checks. Normal users cannot accidentally enable this namespace through the UI.

`node scripts/pwa-shell-audit.mjs <base-url>` checks the public manifest, launcher images, browser installability, worker scope, cache exclusions, offline guidance and reconnection without credentials. `node scripts/admin-device-audit.mjs <configuration>` runs one authenticated BrowserStack configuration at a time, verifies the exact public build, and covers the normal portal and standalone map in both themes. Authenticated evidence stays in ignored `.local/admin-map/`; it is never uploaded as a public Pages artifact. Use the current verification report for actual accepted counts and any infrastructure failures.


`node scripts/login-layout-audit.mjs <base-url>` continuously resizes Chrome's own window with an unpinned viewport, records the actual window/viewport dimensions, checks centering against the measured header and safe scrolling in short windows, and captures Domscan evidence for the normal and standalone sign-in. Separate responsive captures cover phone-sized viewports and both themes. Header sizing is observed dynamically, including changes caused by responsive navigation and fonts.
