# Build and monthly operating estimate

Prepared 2026-10-31. These are planning allowances, not vendor invoices or an accepted commercial quotation. Vendor prices are USD before tax. CAD examples use a **budgeting assumption of USD1 = CAD1.40**, not a claimed live exchange rate. Existing account credits, free allowances and shared-service allocations have not been assumed available exclusively to SAP.

## One-time work

A comparable bilingual site with the supplied brand, redesigned responsive experience, estimator and real PDF brochures, private uploads/résumés/inbox, notification retries, consultation integration, opt-in plan review, scenario/device verification and documented handover is reasonably budgeted at **CAD9,000–15,000**. This is a Project Hamburg project-fee estimate based on roughly90–120 professional hours at CAD100–125/hour; it is not a claim about measured hours already billed. Existing supplied assets reduce discovery/content effort. New photography, extensive copywriting, legal review, an entirely new scheduling product or a custom CRM are separate scope.

Frank should receive a fixed scope and acceptance criteria: approved rates, channels, guest receipts, booking rules, backup/restore responsibilities and support response times. Do not sell an illustrative calculator as an approved SAP quotation engine or imply that a shared scheduler has features not verified in its live build.

## Monthly usage assumptions

Each tier counts completed potential-client enquiries, not signed construction contracts. Allow20 site visits per enquiry, one optional selected-page plan review per enquiry, average10 MB of original uploads,90-day retention, and one1 MB résumé per five enquiries. PDFs are generated locally, so downloading them does not incur an AI-generation charge. Before/after comparisons are prepared illustrations, not live transformations of uploaded photos.

The plan-review allowance is **US$0.05–0.30 per selected page** for ordinary tiled pages, including room for retries; unusually dense/large pages can exceed this. This is an engineering budget based on token usage and the configured model, not a fixed vendor price per plan. Optional manual-only use avoids these model charges. The implementation limits daily detail tiles and retries; that is a request allowance, not a guaranteed dollar cap. Refresh this estimate using actual input/output usage and page-size distribution after the first month.

| Component, USD/month | Baseline: no enquiries | Tier1:5 clients | Tier2:100 clients | Tier3:500 clients |
|---|---:|---:|---:|---:|
| Private intake/storage/logs and retry schedule allowance |1–2|1–3|2–5|3–10|
| Optional AI plan review allowance |0|0.25–1.50|5–30|25–150|
| Shared scheduler cost allocation, if agreed |5–15|5–15|5–15|5–15|
| Email sending |0–20|0–20|0–20|0–20|
| Domain allowance, annual bill spread monthly |1–3|1–3|1–3|1–3|
| Basic backup/monitoring allowance, if implemented |3–8|3–8|3–8|5–15|
| **Indicative vendor total** |**10–48**|**10.25–50.50**|**16–81**|**39–213**|
| **Approximate CAD at the stated assumption** |**14–67**|**14–71**|**22–113**|**55–298**|

These totals use a shared-host allocation, not an assertion that adding SAP creates a new EC2 bill of that amount. If the current scheduler remains shared, marginal compute cost may be small, but someone still pays for, patches and supports the host. Replace the allocation with the actual managed-service agreement. Email's lower end assumes sufficient shared free quota; it is not guaranteed. Human follow-up on leads and hiring is not included in vendor totals.

For an independent scheduler, the verified US-East t3.small price ofUS$0.0208/hour ×730 hours isUS$15.18/month. A40 GiB gp3 disk atUS$0.08/GiB-month addsUS$3.20; one public IPv4 atUS$0.005/hour addsUS$3.65. The basic total is about**US$22.03/month** before backups, logs, transfer and burst CPU credits. Allow **US$25–35/month** for a small dedicated arrangement and **US$35–60** at the500-client tier if additional operational headroom is needed. This is an infrastructure estimate, not a proven capacity benchmark;500 per month is not the same as500 simultaneous visitors. A shared production deployment must not be load-tested indiscriminately.

The proposal remains on GitHub Pages as requested. GitHub documents a100 GB/month soft bandwidth limit and restrictions on using Pages to run a commercial business. Choose suitable commercial hosting at SAP acceptance rather than promising unlimited production business hosting under the proposal arrangement. Static hosting and TLS can remain inexpensive; domain, DNS, provider terms and traffic assumptions need confirmation. No hosting migration is performed by this estimate. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

## Optional maintenance agreement

Vendor charges and maintenance are different purchases. Suggested **CAD/month** service allowances are baseline150–250,5-client tier200–350,100-client tier350–650, and500-client tier650–1,200, **plus vendor charges**. Define the included hours and response window—for example1–2,2–3,3–5 and5–8 hours respectively. Include dependency/security updates, delivery and upload checks, rate/content changes within the allowance, backup/restore checks where contracted and periodic responsive regression. Major redesigns, new integrations,24-hour support and sales/recruitment staffing are excluded unless explicitly priced.

A practical small-business proposal could start at **CAD250/month maintenance plus actual vendor costs**, reviewed after30 days of usage. This is a proposed Project Hamburg service level, not a mandatory bill from the technology providers.

## Pricing evidence and calculation notes

The AWS Price List API was queried for the documented scheduler instance type and Canada Central storage/database region; sanitized snapshots are retained privately with the inventory. Canada Central S3 Standard wasUS$0.025/GB-month; on-demand DynamoDB wasUS$0.6875/million write request units andUS$0.1375/million reads. At500 enquiries, the stated original-file assumption gives about15.3 GB at steady-state90-day retention, before transient tiles/backups. Transaction sizes, retries, log volume and downloads also matter. The base retry schedule invokes approximately43,800 times per730-hour month even when idle. [AWS S3 pricing](https://aws.amazon.com/s3/pricing/), [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/), [Lambda pricing](https://aws.amazon.com/lambda/pricing/)

GPT-5.4 Mini listsUS$0.75/million input tokens andUS$4.50/million output tokens. Image inputs contribute tokens, so the number/resolution of tiles matters. The provider model is pinned in code; a model change requires a new fidelity and cost evaluation. [Official model pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

Resend lists a free transactional allowance of3,000 emails/month with a100/day limit; Pro starts atUS$20/month for50,000. The scheduler can send multiple messages per booking and shares resources with other Project Hamburg activity, so count all recipients and account-wide traffic. Mailbox hosting, such as an existing Google Workspace subscription, is a separate cost; confirm whether SAP already has it. [Resend pricing](https://resend.com/pricing)

EC2 storage and public-address components are separate from compute. Backups, spare capacity and excess transfer are not included in the rawUS$22.03 subtotal. No free-tier entitlement or savings commitment is assumed. [EC2 on-demand pricing](https://aws.amazon.com/ec2/pricing/on-demand/), [EBS pricing](https://aws.amazon.com/ebs/pricing/), [public IPv4 pricing](https://aws.amazon.com/vpc/pricing/)
