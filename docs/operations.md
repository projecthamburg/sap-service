# Operations

## Website deployment

GitHub Pages serves only `dist/`, built from an explicit allowlist. The Pages workflow uses Node 22, built-in tests and official Pages actions. Enable **Settings → Pages → Source → GitHub Actions** before the first run, or use `npm run deploy`.

Relative assets and hash routes support the repository subpath. Routes include `#/en/careers`, `#/fr/careers`, `#/en/privacy`, `#/fr/terms`. Homepage anchors include `#services`, `#projects`, `#approach`, `#estimate`, `#consultation`.

## Private form service

Worker: `sap-service-api`. D1: `sap-service-requests`. Private R2 bucket: `sap-service-private-files`. Provisioning is idempotent by name. R2 must be available in the account; provisioning does not make files public.

Secrets for the manual **Deploy private form service** workflow:

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Dedicated Worker, D1 and R2 provisioning |
| `CLOUDFLARE_ACCOUNT_ID` | Target account |
| `SAP_ADMIN_TOKEN` | Random value of at least 32 characters for private retrieval |
| `SAP_RATE_SALT` | Separate random value for hashed rate-limit identifiers |
| `RESEND_API_KEY` | Optional notifications |
| `TURNSTILE_SECRET_KEY` | Optional bot verification |

Variables: `SAP_NOTIFICATION_FROM` must use a verified Resend sender domain. Notifications stay disabled unless sender, recipient and provider are configured. `TURNSTILE_SITE_KEY` is the public key associated with the verification secret, when enabled.

Local provisioning reads `.env`; a generated local admin token is saved with restrictive permissions in ignored `.local/api-admin-token`. CI requires a durable admin secret. No service secret is placed in a browser file.

Provisioning health-checks the endpoint before updating `public/site-config.json`. The workflow rebuilds and publishes the site with that verified endpoint.

## Submission handling

`POST /v1/quote` and `POST /v1/application` accept multipart JSON `payload` and `files`. Success returns a reference. Quotation inputs are preliminary and require a scope review before a commercial commitment.

Files receive extension, MIME, signature and size validation. Résumés must be PDF or DOCX packages. Project attachments accept PDF/JPEG/PNG/WEBP: six files, 10 MB each, **25 MB total**. Résumés: one file, 5 MB. Signature checking is not malware scanning; treat downloads as untrusted and use an appropriate operational scanner before opening them.

Authenticated `GET /admin/submissions` lists records. `GET /admin/files/<encoded-object-key>` retrieves an attachment. Both require the private admin bearer token. Files download as attachments and are never rendered inline. Do not embed the token in public code or a query string.

Submissions and attachments expire after 90 days. A daily 05:00 UTC Worker removes up to 100 expired records and their files. Requests are limited to eight per 15-minute window per hashed IP identifier; expired counters are cleaned daily. Payloads and attachments are not intentionally logged.

SAP’s contact for access, correction or deletion is servicesapinc@gmail.com. Earlier deletion is performed through authenticated Cloudflare administration, including both the record and its private files. Never share applicant data in public issues.

## Estimates

Assumptions in `src/pricing.js` are illustrative, not approved SAP pricing. The model uses phase production, site/surface factors, fixture quantities, visits, travel, allowances, overhead, markup and a planning range. Common areas are included in total area once. Cost components and phase allocations reconcile to the midpoint. The lower bound respects the illustrative minimum charge.

## Calendar

The inline homepage calendar embeds `https://schedule.projecthamburg.com/booking/sap-service-cleanup`, with external fallback and contact details. It loads near the viewport. An iframe load event alone cannot prove booking works. Verify provider framing and actual slot selection before marking this integration tested.

## Browser verification

Review 360, 390, 768, 1024 and 1440 px widths, both languages and themes. Exercise room/project calculation, sample data, saving/restoring, PDF printing, file rejection, careers availability, validation, booking, mobile navigation, keyboard focus and reduced motion. Node checks do not replace a rendered browser review.
