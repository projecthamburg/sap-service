# SAP Service Inc.

A rebuilt bilingual construction-cleaning website for Montréal, Québec and Ontario. The homepage includes the full estimate questionnaire and embedded scheduling calendar. Careers, privacy and estimate terms use hash routes that work on GitHub Pages.

## Run and verify

Requires Node.js 22 or later. No dependency installation is needed.

```sh
npm run dev       # http://127.0.0.1:4173
npm test         # calculations, conversions, uploads, privacy and service checks
npm run test:browser # with dev server running: real-control tests in Chrome
npm run build    # explicit public-file allowlist -> dist/
npm run check    # syntax and public-artifact credential checks
```

## Included

- Responsive architectural design, Canadian EN/FR, light/dark preferences, reduced-motion support.
- Cleaning phases, service sectors, company approach, FAQ and supplied business contact details.
- Inline six-step estimator: project/room modes, metric/imperial units, site modifiers, attachments, editable sample rooms and a matching 1,500 sq ft sample plan.
- Configurable **illustrative** pricing in `src/pricing.js`, with transparent assumptions, local saving, JSON export and printable PDF output.
- Photorealistic illustrative cleaning comparison, never presented as a completed SAP contract or a transformed visitor upload.
- Careers page with résumé validation, qualifications and seven-day/four-shift availability.
- Cloudflare Worker companion: D1 records, private R2 attachments, consent and file-signature validation, rate limits, authenticated administration and 90-day deletion.
- GitHub Actions: tests, public build, credential checks and Pages deployment.

## Forms and private files

`public/site-config.json` contains public endpoints only. While `apiUrl` is empty, forms prepare an email draft; the visitor must attach files and send the draft in their own mail application. A prepared draft is never described as received.

Enable direct submissions with `node scripts/provision-api.mjs`, or configure the secrets in [operations](docs/operations.md) and run the **Deploy private form service** workflow. The endpoint is health-checked before its public configuration is updated. Rebuild and publish afterward.

Contact details and file bytes are not stored in localStorage. Plans, photos and résumés transmit only after explicit submission with consent. There is no automatic floor-plan extraction or live image-editing service.

## GitHub Pages

`npm run deploy` verifies the site, creates `sap-service` under the authenticated account if needed, stages only the intended source files, pushes `main`, enables the Pages Actions source and dispatches the workflow. It reads `GITHUB_TOKEN` from the ignored `.env` when needed and never adds that file to Git.

Expected URL: `https://<owner>.github.io/sap-service/`. Confirm a successful deployment and live browser review before treating this as published.

## Structure

```text
src/                     UI, Canadian EN/FR content, estimation and form modules
public/                  Public imagery, brand icon, sample plan and endpoint config
api/                     Private Worker service and database schema
scripts/                 Preview, build, checks and deployment helpers
tests/                  Node test suite
.github/workflows/       Pages and private-service workflows
docs/                   Asset provenance and operations
appednix/                Original local materials and Claude export (ignored)
```

The original design is preserved under `appednix/legacy/`. Planning material, `.env`, browser state, private admin tokens and build output are ignored. The build copies only `index.html`, `src/` and `public/`.

## Content

Supplied details: founded in 2020, Montréal, Frank Sungwa, 514-294-3063, servicesapinc@gmail.com. Unverified hospital/contractor relationships, fictional testimonials, certifications and performance claims are not published as facts. Architectural imagery is labelled representative. See [asset provenance](docs/assets.md).
