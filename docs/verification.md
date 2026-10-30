# Verification

Current release: October 30, 2026.

The website is published at https://projecthamburg.github.io/sap-service/ through GitHub Actions. The private API is deployed in AWS Canada Central; its identifiers are in `api/deployment.json`.

Completed checks:

- Estimation, units, common-area accounting, room totals, visits, condition modifiers, minimums, saved-scope privacy and upload validation.
- Private API contracts, consent, signed upload manifests, pending/received separation, file signature and metadata rejection, completion tokens, idempotency, server-side price recalculation, CORS and authenticated administration.
- 31 live cloud checks, including a genuine 7 MB synthetic PDF, a site photograph and a résumé; signed uploads, validated receipt, byte-for-byte downloads, blocked raw object URLs, invalid-file rejection and deletion of every synthetic record. Notifications were suppressed for these tests.
- A local Chrome harness exercised the inline estimator, phase keyboard navigation, sector filters, sample rooms, conversion, additions/removals, upload rejection/retention, price generation, quote dialog, comparisons, themes, careers, language switching and French/English horizontal overflow at 360, 390, 768, 1024 and 1440 pixels.
- Syntax, referenced assets, a public-file allowlist and credential-pattern scans. `.env`, browser state, private admin keys, original planning material and installed dependencies are excluded from publication.

Final native screenshot review, connected browser submissions, live calendar interaction and the OIDC service-deployment workflow are being verified for the connected release. Detailed local reports and screenshots are retained in `.local/` and are not public artifacts.

To reproduce: `npm --prefix api ci`, `npm test`, `npm run build`, `npm run check`. Run `npm run dev`, then `npm run test:browser` for the local Chrome harness. See `docs/operations.md` for the private service and administrative workflow.
