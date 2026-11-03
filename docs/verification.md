# Verification — November 3, 2026

Current build: `a7fc48499a9c`. The [website](https://projecthamburg.github.io/sap-service/) and [demo entry](https://projecthamburg.github.io/sap-service/?demo=1#/en/admin) are published. [Pages deployment 41656397995](https://github.com/projecthamburg/sap-service/actions/runs/41656397995) and [private-service deployment 41656397868](https://github.com/projecthamburg/sap-service/actions/runs/41656397868) succeeded. The earlier public intake, field/PWA and eleven-configuration device matrix remain recorded in [verification history](verification-history.md).

## Shared demo access

The demo displays username `demo`, uses a permanent password, sends no invitation email and requires no first-login password change. Its reserved internal identifier has no verified delivery/recovery mailbox. Credentials remain outside the repository and URLs. Both `SAPAdmins` and `SAPDemo` membership are required when provisioning this account.

The signed demo role allows only GET session, map configuration and the researched register. Live saved field sites and visit notes are omitted. Private submissions/files and every privileged mutation are denied server-side, even with the test header. Demo UI saving/import controls are disabled and Inbox explains that private files are unavailable. The map uses the existing real research rather than invented opportunities. Display preferences, search, directions, map layers and location remain available.

The demo link does not render a previously signed-in staff workspace: it returns to the demo sign-in without requesting staff maps or Inbox data. The demo Maps manifest retains its own demo start URL. Public customer/application forms remain actual forms; this is a read-only admin demonstration, not a sandbox for submitting public forms.

## Accepted checks

- 101 Node tests passed, including signed demo-role claims, a strict method/path allowlist, no field-index queries for demo data, and prevention of private reads or mutations. Existing estimator, PDF, upload, authorization and concurrency tests remain.
- 103 public Chrome checks and eight public Domscan states passed in Pages Actions.
- 13 live API checks passed: permanent-password sign-in without email/reset/MFA, signed demo identification, all 67 research records with empty field/activity data, direct private/write-route rejection, test-header isolation, unchanged dataset version and confirmed/no-verified-mailbox status.
- 29 Chrome demo checks passed: literal username/no recovery action, no password-change challenge, real Google map, read-only cards, private Inbox placeholder with no submissions fetch, separate installable demo manifest, desktop/phone/tablet portrait/landscape in both themes, no privileged UI writes, sign-out and no runtime errors.
- A separate Chrome check passed for a signed-in staff session opening the shared demo link, without private data requests or rendering.
- 57 normal staff-admin regression checks passed, including full Inbox access and normal imports/conflicts. The disposable staff audit fixture was revoked afterwards; its existing token changed from HTTP 200 to 401. Owner and named staff accounts were unchanged. The permanent demo remains enabled for sharing.

Authenticated evidence stays privately under `.local/admin-demo/`. No emails, application submissions or bookings were generated during this demo setup. Existing business AWS resources were reused; no new always-on infrastructure was introduced.

The existing platform limits remain: the owner confirmed Android installation; a physical Apple Home Screen installation is unverified. Nearby alerts require the app open and connectivity, without guaranteed background/locked-screen tracking. Research records are dated prospects, not guaranteed contracts. See [Admin Maps](admin-maps.md), [handover](handover.md) and the [audit protocol](audit-protocol.md).
