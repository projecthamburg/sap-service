# Verification record

Checked locally on October 30, 2026.

- **26 Node tests pass:** estimate reconciliation, units, sample-plan totals, minimums, site modifiers, visits, upload validation, consent, rate limits, private storage success and rollback, and protected retrieval.
- **Public build and syntax checks pass.** Public artifacts are copied from an explicit allowlist and scanned for credential patterns. `.env`, planning materials, browser state and local admin credentials are excluded.
- **43 browser checks passed in Google Chrome:** inline estimate and calendar presence; phase tabs and keyboard navigation; sector filters; ten editable sample rooms totaling 1,500 square feet; metric conversion; room creation/removal; attachment rejection and retention; result generation; save privacy; quotation dialog; five comparison selections; slider interaction; mobile menu; theme switching; careers fields, availability and résumé handling; Canadian French switching; preservation of application data across language changes; privacy navigation; and horizontal overflow checks at 360, 390, 768, 1024 and 1440 pixels in English and French.
- **Five generated image pairs were visually inspected.** They are labelled illustrative and do not claim visitor-image transformation or completed SAP contracts.

The temporary local browser test page is ignored and excluded from the public build. Its detailed JSON report is retained locally under `.local/browser-qa-report.json`. Reproduce the browser checks with `npm run dev`, then `npm run test:browser` in another terminal. The harness source is `tests/browser-qa.html`; its DOM rasterization helper loads only in this local test page, not in the published website.

Four DOM rasterizations of Chrome’s computed layout were reviewed: English desktop, French desktop, English mobile light, and English mobile dark. They are retained under `.local/` and do not verify cross-origin calendar content.

Still unverified: third-party calendar slot selection and framing, live Cloudflare credentials/provisioning, GitHub repository creation/push, and a completed Pages deployment. This session's outbound command execution is restricted, escalation was rejected by the approval policy, and the OpenChrome connection closed. Git also refused to write `.git/index.lock` during the final commit attempt. The initial rebuild commit exists; later source improvements remain in the working directory and the packaged source archive. No deployed URL is asserted without a successful deployment result.

`npm run deploy` is prepared to use the local ignored `.env`, create the GitHub repository, attempt the private form-service deployment, push the source, enable Pages Actions, wait for the workflow and verify the returned live URL when run in an environment with the required access. If private service provisioning fails, the published form flow remains explicitly email-based.
