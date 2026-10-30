# Verification

Current release: October 30, 2026.

The website is published at https://projecthamburg.github.io/sap-service/ through GitHub Actions. The private API is deployed in AWS Canada Central; its identifiers are in `api/deployment.json`.

Completed checks:

- 32 automated tests covering estimation, units, common-area accounting, room totals, visits, condition modifiers, minimums, saved-scope privacy, upload validation, private API contracts, consent, signed upload manifests, pending/received separation, file signature and metadata rejection, completion tokens, idempotency, server-side price recalculation, CORS and authenticated administration.
- 31 live cloud checks, including a genuine 7 MB synthetic PDF, a site photograph and a résumé; signed uploads, validated receipt, byte-for-byte downloads, blocked raw object URLs, invalid-file rejection and deletion of every synthetic record. Notifications were suppressed for these tests.
- 43 local Chrome harness checks exercised the inline estimator, phase keyboard navigation, sector filters, sample rooms, conversion, additions/removals, upload rejection/retention, price generation, quote dialog, comparisons, themes, careers, language switching and French/English horizontal overflow at 360, 390, 768, 1024 and 1440 pixels.
- 24 native Google Chrome checks against the deployed website passed. These include actual quote and French application submissions, a 7 MB plan, private résumé downloads, inbox sign-out, the embedded calendar, brand font loading, themes and responsive layouts. Synthetic records were removed and notifications suppressed.
- The live calendar was exercised through date selection and available-time display without creating an appointment.
- Six export and presentation checks passed: print room schedule, a real PDF artifact, print cleanup, structured JSON download, French browser validation messages and career imagery.
- Native screenshots were reviewed in English and French, on desktop and mobile, in light and dark themes. Responsive WebP imagery, self-hosted fonts and deferred comparison images reduce unnecessary downloads.
- A mobile Lighthouse run against the live site recorded **92 performance, 100 accessibility, 100 best practices and 100 SEO**, with zero measured layout shift. These are laboratory results from this release, not a guarantee of every visitor's network performance.
- Both the Pages workflow and the private-service workflow succeeded. The latter was verified using temporary OIDC credentials restricted to this repository's immutable identity and production environment.
- Syntax, referenced assets, a public-file allowlist and credential-pattern scans. `.env`, browser state, private admin keys, original planning material and installed dependencies are excluded from publication.

Detailed local reports, native screenshots and a sample estimate PDF are retained in ignored `.local/`; they are not public artifacts. Email notifications are configured on a verified sending domain. Test notifications were deliberately suppressed, so these checks do not claim delivery to the business recipient's mailbox. Estimate assumptions remain illustrative until SAP supplies approved commercial rates.

To reproduce: `npm --prefix api ci`, `npm test`, `npm run build`, `npm run check`. Run `npm run dev`, then `npm run test:browser` for the local Chrome harness. See `docs/operations.md` for the private service and administrative workflow.
