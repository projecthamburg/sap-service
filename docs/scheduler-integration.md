# SAP consultation integration

Template 6, slug `sap-service-cleanup`, remains Active with its existing icon. Business intent is recorded in `config/scheduler-template.json`: 30-minute remote scope consultation, Monday–Friday, Montréal 09:00–17:00, site visits arranged separately. Contact fields are required; the quote reference, scope/dates, target budget, referral, expectations and concerns are optional. A reference joins the booking to the private enquiry operationally; this is not an automatic CRM merge.

## Provider findings and scoped correction

The provider creates a confirmed booking and stores its clock time in UTC. Its calendar treats configured slot strings as UTC and converts them to the visitor timezone. Winter slots 14:00–21:30 UTC therefore show Montréal 09:00–16:30 starts. Review the mapping on March 8, 2027; the provider configuration does not implement a permanent business-timezone/DST schedule.

The first synthetic booking exposed two confirmation display errors: a date-only midnight UTC value rendered as the previous local day, and stored UTC time displayed without conversion. Storage was correct. `src/scheduler-bridge.js` fixes only the guest confirmation response consumed on the exact SAP booking route. It preserves the request, provider record, booking ID and administrative UTC display. Tests cover winter/summer conversion, another visitor timezone and isolation from other routes/templates.

The allowed `schedule.projecthamburg.com` nginx site has one additional exact-match location for `/booking/sap-service-cleanup`, with the same upstream/proxy behavior and a `sub_filter` insertion before `</head>`. The script is minified from that source and inlined before the app loads. Upstream compression is disabled only for that exact page so substitution is reliable. No shared Next.js source/build/process, other nginx site, icon, status, database or notification setting was modified. Other booking/admin responses were checked for absence of the adapter.

This is a compatibility layer, not a provider source fix. A provider upgrade that changes response date/time semantics requires retesting or removing it. Keep the original nginx file backed up outside `sites-enabled`; validate `nginx -t` before a reload. Rollback restores the original site file, validates, reloads and rechecks the SAP and other booking routes. Never leave backup files inside `sites-enabled`. The private evidence retains before/after configurations and deployment checks; it contains no published credentials.

## Notification behavior

The inspected provider sends a business notification with the submitted local date/time and labelled form details. This is separate from the website enquiry outbox. Its current implementation does not send a guest email or create a video-conference link. The guest receives an on-screen booking confirmation; staff must arrange the remote meeting method and any follow-up. Do not promise an automatic guest email, self-service cancellation/rescheduling or crew reservation. The supported admin cleanup currently exposes bulk Delete Selected, so synthetic records are removed by exact ID/identity through that UI rather than direct database edits.

At SAP handover, decide the recipient/sender, guest receipt, remote meeting method, holidays/buffers, seasonal review owner, backup/restore and cancellation workflow. Shared provider settings must not be changed for SAP in a way that alters other tenants.
