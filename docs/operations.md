# Operations

## Hosting and release

Website: https://projecthamburg.github.io/sap-service/. Repository: https://github.com/projecthamburg/sap-service.

GitHub Pages serves only `dist/`, built from `index.html`, `src/` and `public/`. Hash routes work at the repository subpath. Every browser module, stylesheet and configuration receives a release version; the active public configuration is also embedded safely in the built HTML to avoid an email-fallback flash during startup.

`pages.yml` tests and deploys pushes to `main`. `service.yml` is a manual private-service deployment followed by a Pages publication. Private-service dependencies are installed from `api/package-lock.json`.

## Private infrastructure

The dedicated AWS resources are recorded in `api/deployment.json`:

- Region: `ca-central-1` (Canada Central).
- Lambda: `sap-service-api`, Node.js 22, 256 MB, 30-second timeout.
- DynamoDB: `sap-service-submissions`, on-demand billing and expiry through TTL.
- S3: the dedicated `sap-service-private-…-ca-central-1` bucket, encrypted with public access blocked.
- A resource-scoped runtime role and a separate GitHub deployment role.

No other application resources are modified. The GitHub role can update only this function and pass only its execution role. OIDC trust is restricted to the immutable identity `repo:projecthamburg@79866271/sap-service@1440106954:environment:production-api`, including GitHub's owner and repository IDs. No broad AWS access keys are held in the repository or its secrets.

Encrypted GitHub secrets are `SAP_ADMIN_TOKEN`, `SAP_RATE_SALT` and `RESEND_API_KEY`. Variables are `SAP_AWS_DEPLOY_ROLE` and `SAP_NOTIFICATION_FROM`. Initial local provisioning prefers the supplied business AWS credentials and saves the generated application secrets with restrictive permissions in ignored `.local/aws-service-secrets.json`. Do not commit or share that file publicly.

## Requests, applications and files

1. The visitor consents and submits a quote request or application.
2. `POST /v1/{quote|application}/prepare` validates the payload and file manifest, applies the public request limit and issues an individual signed S3 form for each attachment.
3. The browser uploads directly to private storage. Signed forms restrict key, type, size and expiry.
4. `POST /v1/{quote|application}/complete` verifies the completion token, object metadata and file signatures, then changes the pending record to received and returns a reference. Repeated completion is idempotent.
5. A Resend notification to servicesapinc@gmail.com includes contact and scope/application details, with a link to the authenticated inbox. Attachments remain private.

Project files: PDF/JPEG/PNG/WEBP, up to six files, 10 MB each and 25 MB total. Résumés: one PDF or DOCX, up to 5 MB. Large uploads do not pass through the Lambda request-body limit. Uploaded plans are not automatically measured, and photographs are not silently transformed.

Signature/type validation is not a malware-scanning service. Treat downloaded files as untrusted and use an appropriate operational scanner before opening them.

Public preparations are limited to eight per 15-minute period per hashed IP identifier. Limiter records expire. Log retention is 14 days; payloads and attachments are not intentionally logged.

## Private inbox

Open `https://projecthamburg.github.io/sap-service/#/en/inbox` (or `#/fr/inbox`). Obtain the operator's private access key from the ignored local secret file, then sign in. The key remains only in that tab's memory and is cleared by Sign out or closing the tab. It is not embedded in the public website, localStorage, a URL or notification messages.

The inbox lists received submissions and provides private downloads. `GET /admin/submissions` requires the admin bearer token. `POST /admin/file-url` issues a 60-second signed download URL only for a file attached to the requested received record. Files download as attachments. `DELETE /admin/submissions/<reference>` removes the selected record and its private objects for an authorized deletion request.

S3 lifecycle expiry is configured at 90 days. DynamoDB TTL marks records for automatic deletion at 90 days; provider deletion is asynchronous. Earlier deletion requests should be handled through the authenticated API. SAP’s contact for access, correction and deletion is servicesapinc@gmail.com. Never put private applicant data or floor plans into a public issue.

## Notifications and testing

The configured sender is `SAP Service <sap-service@projecthamburg.com>`, on the verified projecthamburg.com Resend domain. The business recipient is the supplied servicesapinc@gmail.com address. Email notification processing can occur outside Canada; the privacy notice identifies this. Receipt in storage is not dependent on notification delivery.

Synthetic end-to-end tests authenticate preparations with the admin token and `X-SAP-Test: true`. Those records are marked as tests, bypass public rate quotas and suppress notifications. The test credential is never sent to any host other than this API. Remove every synthetic record after verification. A `testMode` flag confirms suppression before browser tests allow completion.

## Estimates and booking

`src/pricing.js` contains illustrative assumptions, not SAP-approved commercial rates. The private service recomputes planning totals from the submitted scope. A written quotation remains necessary.

The supplied Project Hamburg calendar is embedded inline, with an external fallback and real contact details. Verify its live provider state without submitting an appointment during automated QA.

## Maintenance

For a new checkout, run `npm --prefix api ci`. The frontend itself requires no framework installation. `npm test`, `npm run build` and `npm run check` cover the maintained source and public output. For a full local browser pass, keep `npm run dev` running and launch `npm run test:browser`. Use Google Chrome for native screenshot and deployed-form checks.

Update only the dedicated resources. Preserve the runtime role's limited permissions, bucket public-access blocks, signed-upload constraints, expiry settings and exclusion of all private material from Git and public artifacts.
