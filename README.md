# SAP Service Inc.

A bilingual construction-cleaning website for Montréal, Québec and Ontario, with an inline estimate questionnaire, an embedded consultation calendar, careers applications and a private administrative inbox.

**Website:** https://projecthamburg.github.io/sap-service/

## Develop and verify

The frontend uses standard browser modules and needs no dependency installation to serve or build. Node.js 22.12 or later is required for the development tools. Install the root development dependencies for the automated Chrome audit, and the separate private-service dependencies for its tests or deployment.

```sh
npm --prefix api ci
npm ci               # Chrome audit tools; does not download another browser
npm run dev           # http://127.0.0.1:4173
npm test              # estimation, validation and private-service contracts
npm run test:browser  # with dev server running: real controls in Google Chrome
npm run test:audit    # with dev server running: decoded images, routes and controls
npm run test:devices  # optional BrowserStack credentials; audits the deployed site
npm run domscan       # eight scoped browser states, paired captures and artwork checks
npm run blueprint -- /path/to/blueprint-engine # optional external static analysis
npm run evidence:map  # join fresh static and runtime evidence
npm run build         # only index.html, src/ and public/ -> dist/
npm run check         # syntax, asset references and public credential scan
```

## Experience

- Architectural photography, the supplied SAP brand, locally hosted Figtree, Canadian English/French and light/dark themes.
- Construction cleaning phases, service sectors, operational approach, FAQ and supplied business contact details.
- Six-step, inline project/room estimator with metric/imperial units, modifiers, optional plans/photos, editable sample rooms and a matching fictional 1,500-square-foot floor plan.
- Transparent **illustrative** planning assumptions in `src/pricing.js`, local scope saving, JSON export, print/Save as PDF and formal quotation requests.
- Five photorealistic illustrative comparisons. They are not presented as completed SAP contracts or transformations of visitor uploads.
- Careers form with résumé validation, qualifications, consent and a seven-day/four-shift availability grid. Switching languages preserves the application in memory.
- Real private submissions, direct-to-storage uploads and an authenticated administrative inbox at `#/en/inbox` or `#/fr/inbox`.

## Private service

AWS Lambda, DynamoDB and a private S3 bucket operate in **Canada Central**. Plans and résumés upload using short-lived, size-restricted signed forms. File signatures and object metadata are checked before a receipt reference is issued. Records expire after 90 days and an S3 lifecycle policy expires the files. Notifications to SAP are configured through Resend; private files stay in storage.

`public/site-config.json` contains only public endpoints. API credentials never enter the browser bundle. Inbox access uses a private key held only in the tab's memory. The operator's key is stored locally in ignored `.local/aws-service-secrets.json`; GitHub holds an encrypted copy for service deployment.

No contact details or file bytes are saved in localStorage. Attachments transmit only after explicit submission with consent. The site does not silently extract plan dimensions or transform uploaded photographs.

## Deployment

Pushes to `main` run `.github/workflows/pages.yml`: dependency installation, tests, public build, credential checks, a native Chrome audit, eight-state Domscan capture and GitHub Pages deployment. The audit verifies decoded CSS comparison images as well as ordinary photographs, both languages, mobile/desktop layouts, slider controls, themes and public routes. Reports and screenshots are retained as the `browser-audit` Actions artifact.

The manual **Deploy private form service** workflow uses GitHub OIDC to assume a dedicated, limited AWS deployment role. Broad AWS access keys are not stored in GitHub. It deploys the service, checks its health, then publishes the website with the verified endpoint.

The optional BrowserStack audit runs iPhone Safari, Android Chrome, iPad Safari and Galaxy Tab Chrome in both tablet orientations, macOS Safari, Windows Edge and Windows Firefox sequentially. It reads `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` (or the ignored local credential file), saves device screenshots and reports under `.local/device-audit/`, and closes each remote session. Set `BROWSERSTACK_LOCAL=true`, `BROWSERSTACK_LOCAL_IDENTIFIER` and `SAP_AUDIT_URL` to use an already connected Local tunnel. It exercises public sample data without sending quotation requests, applications or appointments. See [the evidence workflow](docs/evidence-workflow.md) for the source/runtime/reference analysis.

`npm run deploy` can provision the service using local authorized AWS credentials, push source, configure Pages, wait for Actions and verify the live URL. It reads the ignored `.env` when needed. See [operations](docs/operations.md).

## Structure

```text
src/                  UI, bilingual content, estimation, forms and inbox
public/               Public imagery, brand, fonts, sample plan and endpoint config
api/                  Private API, validation, AWS provisioning and dependency lock
scripts/              Preview, build, checks and deployment helpers
tests/                Node tests and local Chrome harness
.github/workflows/    Pages and OIDC service deployment
docs/                 Operations, verification and asset provenance
appednix/             Original local material and archived prototypes (ignored)
```

The original Claude design is preserved under `appednix/legacy/`. Planning material, `.env`, browser state, private admin keys, installed dependencies and build output are ignored. The build uses an explicit public allowlist and versions browser modules together to avoid stale deployment combinations.

Business details come from the supplied materials: founded in 2020, Montréal, Frank Sungwa, 514-294-3063 and servicesapinc@gmail.com. Unverified hospital/contractor relationships, fictional testimonials, certifications and performance claims are not published as facts. See [asset provenance](docs/assets.md) and [verification](docs/verification.md).
