# Proposal operations and eventual SAP handover

Until Mordecai authorizes a cutover, **Project Hamburg operates this proposal**. Public contact, enquiries, recruitment and notifications route through info@projecthamburg.com. Frank's future email, phone, domain, accounts and booking responsibilities are not assumed. The designer/creator credit remains Project Hamburg with the approved website link.

## Configuration and ownership map

| Concern | Current source / owner | Handover action |
|---|---|---|
| Public contact and operator | `config/operations.json`, Project Hamburg | Confirm SAP contact, phone, operator and stage; change centrally |
| Site hosting and release | Project Hamburg GitHub, Pages Actions | Confirm domain/repository ownership and suitable production hosting |
| Private intake | `api/deployment.json`; dedicated Canadian AWS resources | Keep a managed service or provision a separate SAP account; choose explicitly |
| Plans/résumés | Private encrypted S3; 90-day expiry | Confirm retention, storage country, deletion owner and backup policy |
| Anonymous plan-review tiles | Private S3 and DynamoDB; 7-day expiry | Confirm processor consent, policy, AI budget and deletion process |
| Enquiry email | Resend; verified Project Hamburg sender, info@ recipient | Verify SAP sending domain and destination before switching |
| Operator access | Invited Cognito SAPAdmins accounts; emergency script token | Invite approved SAP operators, test access, revoke proposal-only accounts and rotate emergency credentials securely |
| Scheduler | SAP template 6 on shared Patron Booking Pro | Confirm timezone, hours, duration, fields, operator notifications and support owner |
| Estimate rates | `src/pricing.js`, explicitly illustrative | Frank completes `frank-rate-review.csv`; approve and version the rates |
| Brand and visuals | Canonical supplied SAP geometry; illustrative imagery | Preserve approved mark; obtain real project photography if desired |
| Evidence | `docs/audit-protocol.md`, private captures, versioned fixtures | Repeat acceptance journeys after channel/rate changes |

The calendar's current field specification is in `config/scheduler-template.json`. Its transport conventions are separate from business intent: the inspected provider converts UTC slot strings to visitor time. Winter Montréal 09:00–17:00 therefore maps to 14:00–22:00 UTC. Verify the actual rendered slots when seasons change; the current shared provider does not establish automatic business-timezone/DST conversion from that configuration. Confirm holidays, buffers, cancellation/rescheduling and who actually attends before SAP production use. Do not change other tenants, template status or the pending icon without the owner's direction.

## Operational truth

A successful website receipt means the private record and validated attachments were stored. Enquiry emails use a durable outbox with conditional leases, stable Resend idempotency and bounded retries; the inbox distinguishes provider acceptance from actual delivery. Operator staff still have to review and respond. The scheduler is a separate system; its notification and guest-confirmation behavior must be verified independently. An estimate reference lets staff connect a booking with the enquiry; it is not a single shared CRM or automatic crew dispatch.

The PDF is a genuine downloadable document generated in the visitor's browser. It contains the selected scope, exact calculation data, budget/discovery information and reviewed plan evidence where used. Downloading a PDF does not submit a request. Original uploads are transmitted only with the relevant consent. Plan review has its own explicit consent because selected-page images are sent before a quotation request, and processing may occur outside Canada. The original file hash is checked again if a reviewed plan is attached to a received quotation.

The two Lambdas separate long vision review from normal enquiry/résumé traffic. Both use dedicated resource-scoped permissions. No Dropbox/GitHub fallback stores private applicant documents. Browser modules/configuration contain endpoints, not credentials. The supplied environment has many unrelated keys; using every key is neither required nor desirable. Only dependencies actually used by this site are tested.

## Cutover preparation

Complete `frank-channel-review.csv`. Use `config/handover.example.json` as a worksheet; it deliberately contains invalid placeholders and must not be deployed unfilled. Keep the current operations profile and last successful release as rollback evidence. No migration is triggered merely by adding this example.

Before a cutover, confirm the receiving legal/operator identity, data ownership, verified sender domain, recipient mailbox, account access, scheduling owner, privacy copy and approved rates. If the repository moves, update GitHub OIDC's owner/repository identities in provisioning; the current trust is intentionally restricted to Project Hamburg's immutable repository identity. Provision receiving private resources separately and transfer sensitive data through private authenticated channels. Do not copy credentials, floor plans or CVs into the public repository or issue tracker.

Drain or account for outstanding email jobs before changing routing: an existing job keeps its frozen original recipient/body and idempotency key. Changing a config does not retroactively redirect already-queued notifications. Rotate transferred credentials only after the new operator has tested access, and keep the prior channels available during an agreed overlap. Cutover must not orphan old enquiries, lose scheduling references or create duplicate notifications.

Update the central operations profile, infrastructure/API origins, public URLs, privacy/retention wording and calendar configuration together. Run a labelled estimate/upload/PDF/booking and a résumé application against the new channels; verify actual delivery, private downloads, denied anonymous access and exact calculation consistency. Remove only those synthetic references. Publish through Actions, verify the live build and record the approved transition. If a gate fails, restore the prior config/release and routing; preserve received records and job state rather than deleting real submissions.

## Backups and maintenance decisions

Expiry is a retention control, not a backup. The read-only scheduler inventory found a shared t3.small with one 40 GiB gp3 disk, no disk encryption and zero self-owned snapshots returned for that volume. This does not prove whether database dumps or other backups exist. No shared host configuration was changed. A dedicated SAP deployment should define encrypted storage, scheduled database backups, retention, restore testing and incident ownership before being represented as fully managed production hosting.

Decide separately whether to enable DynamoDB point-in-time recovery and S3 versioning/backup; align them with deletion commitments and costs. The current implementation does not claim that these optional backup services or a 24-hour operational response contract have been purchased. Native PDF/browser tests and optional BrowserStack regression runs form part of maintenance, not an always-on monitoring service.


## Admin Maps handover

Transfer the original research and current lossless snapshot, dataset versions/audit, explicitly saved field sites and visit activity. Use the separate fieldwork export as a migration input; automatic restore is not implemented. Reconcile record IDs and test status changes/reopening in the destination before cutover. These operational records contain intentionally saved locations and operator notes and require a separate agreed retention/deletion policy; the public submission expiry is not their backup policy.

Include the Cognito pool/client/group, API issuer/client settings, dedicated Google Maps key and referrer restrictions, encrypted GitHub deployment secrets/OIDC role, service worker scope and PWA manifest/start URL. If the domain changes, update allowed origins, Maps referrers, public URLs and installed-app instructions together. Existing installed clients can retain old public shells until they reconnect; keep a transition/rollback window. Keep the old private data read-only until the verified destination and approved migration are complete. Do not transfer shared unrelated AWS, Google or scheduler tenants.

The current deployments use the business AWS account in Canada Central, verified by STS and the deployed Lambda ARN. Research-account credentials are excluded. The map has no always-on tracking backend, no automatic new-lead discovery feed and no guaranteed background GPS; maintain those limits in training and proposals.
