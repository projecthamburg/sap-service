# Verification — November 5, 2026: demo sign-in

Current frontend build: `8446770afbda`, source commit `15e5bac`. [Pages deployment 42057191642](https://github.com/projecthamburg/sap-service/actions/runs/42057191642) succeeded. The [demo sign-in](https://projecthamburg.github.io/sap-service/?demo=1#/en/admin), regular Admin entry and standalone Maps app are published. The private API and account configuration were unchanged.

## Resolved behavior

The regular Admin form previously required an email and rejected the literal username `demo`. The dedicated demo link worked, but someone reaching the ordinary form could not use that username. The regular form now accepts an invited email or `demo`, with localized guidance and a visible **Use demo login** link. The dedicated form prefills `demo`, has no recovery-email action and offers **Team sign-in**. Both links preserve language and app mode.

Successful demo authentication retains `demo=1` in the URL, including when starting from the ordinary form. Reload, sign-out and the separate demo manifest keep that entry. The existing permanent demo password was preserved; no invitation, email verification or password reset was generated. Server authorization continues to derive demo permissions from signed group membership. A URL flag or displayed username does not grant staff access.

## Accepted checks for this release

- 104 Node tests passed, including signed demo-role restrictions and audited-coordinate safeguards.
- 113 public Chrome checks passed locally and in Pages Actions. Ten new checks cover ordinary-form demo/email validation, the localized dedicated entry and team/demo links without credentials or authentication attempts.
- 58 authenticated live Chrome demo checks passed: ordinary/shared entries, English/French, uppercase username, incorrect-password correction, actual sign-in, the exact audited research, disabled editing, HTTP 403 for private reads and dataset replacement, reload/sign-out, phone/tablet/desktop portrait/landscape layouts and both themes. The staged run passed the same 58 checks separately.
- 57 live staff-admin checks passed, retaining invited email sign-in, Inbox, map/filter behavior, import/version protection and logout.
- Six cached-staff/demo isolation checks passed: the shared demo link displays the demo form without reading staff research or Inbox, and the team link restores the existing staff session.
- Sixteen native Chrome link-navigation checks passed across English/French, desktop/phone and normal/standalone entry modes.
- **69 BrowserStack checks passed**: 23 each on iPhone 16 Safari 18, Samsung Galaxy S23 Android Chrome and Windows 11 Chrome. Each used the existing permanent password through the ordinary English portal and dedicated French Maps app, with both themes, real Google maps, demo manifest/read-only controls, reload, sign-out and return to team sign-in. Initial harness attempts were archived separately and excluded from this total; the final app checks use its visible map-only workflow.
- Fresh Domscan captured eight public runtime states; Blueprint reconciled 74 source files, 1,548 entities and 518 named ESM bindings. Their source/runtime evidence join passed. Anonymous form screenshots, private authenticated screens and real-device screenshots were visually inspected.

The previous complete 452-check, eleven-configuration location matrix remains in [verification history](verification-history.md), tied to its earlier build. It is not counted as a rerun of this sign-in fix. The active private register still contains exactly the 30 owner-audited sites; its version remains `6bd69a654a736253035a3983d6eff87a8443dc96575b14542404515710c2a250`. The prior 37 removed records remain excluded from the active map.

All task-owned cloud sessions were closed, with zero running or queued sessions afterwards. The disposable staff QA fixture was revoked, and its issued token changed from HTTP 200 to 401. Owner, named staff and permanent demo accounts were preserved. No invitation emails, customer/applicant submissions or bookings were generated. No AWS infrastructure or paid model calls were added.

Private captures, reports and failed attempts remain under ignored `.local/demo-login-fix-2026-11-05/`. Reusable procedures are in [Admin Maps](admin-maps.md) and the [audit protocol](audit-protocol.md). Existing platform limits remain: a physical Apple Home Screen installation is unverified, and nearby alerts require an open app/connectivity without guaranteed background tracking. The demo is a read-only administrative view; public customer/application forms remain actual forms.
