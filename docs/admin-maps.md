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

GPS requires Start GPS radar and browser permission. Denial shows guidance and offers a manual map or selected-lead anchor. A radius filter uses unrounded Haversine calculations; formatting does not affect membership. Approaching alerts require movement and a matching heading, and entering alerts are deduplicated during the radar session. GPS and alerts are foreground tools, not background navigation or push notifications. User coordinates are not uploaded or persisted. The audit may supply test GPS through Chrome's automation interface; no simulation is embedded in the operational interface.

## Imports, storage and audit

JSON is the lossless research exchange format. CSV preserves research arrays as JSON cells, uses proper quoting and protects spreadsheet formula prefixes. JSON/CSV imports validate the same schema in browser and API: IDs, required text, all supplied fields, priority/stage enums, evidence arrays, score bounds and valid paired coordinates. Unsupported fields, including permanent Google-review flags, are rejected. Imports are limited to 2,000 records and 4 MB in the interface. Validation errors are shown before replacement can be confirmed.

An import is a complete replacement, not an implicit merge. Exports include all records, regardless of active filters. The API uses an expected version and transactional metadata write so another administrator's changes cannot be silently overwritten. S3 snapshots are content-addressed under `admin/maps/datasets/`; metadata and audit records use `MAPS#` keys in the existing SAP private DynamoDB table. They do not enter the received-submissions index or notification outbox. Dataset history is private operational storage and does not inherit the enquiry upload expiry. Retention/deletion is the operator's responsibility.

## Verification and handover

`npm test` includes schema, CSV, geometry, heading, negative contractor references, location mismatch, HTML escaping, JWT claims and optimistic-write tests. `npm run test:audit` checks the public website and invitation-only inbox gate. `node scripts/admin-audit.mjs --staged` exercises authenticated real research in a disposable Chrome browser using locally staged public assets under the approved Pages origin; omit `--staged` for the live release. It requires a private, authorized audit account JSON at `.local/admin-map/test-account.json` (email/password), or a path in `SAP_ADMIN_AUDIT_ACCOUNT`. Never use or publish owner passwords.

Authenticated screenshots and Domscan-style DOM/style captures stay under ignored `.local/admin-map/authenticated-audit`, with private permissions. They contain real business research and must not be attached to public CI artifacts. Public Domscan continues to audit both languages, both themes and phone/desktop states; Blueprint now includes the admin modules and private API source, without credentials or operational datasets.

For a future SAP-owned handover: provision a destination Cognito pool/client, invite approved SAP operators, update `public/admin-auth.json` and the API environment, migrate private dataset snapshots and DynamoDB version/audit records with verified hashes, and replace `SAP_MAPS_BROWSER_KEY` with a SAP-owned restricted key. Re-run authentication, denied-access, import-conflict and device audits before switching channels. Passwords are not exported; users establish their own new credentials. The public operator/contact configuration, notification recipients, scheduler tenancy and intake storage retain their existing separate handover procedures. Maps changes do not modify other scheduler tenants or unapproved artwork.
