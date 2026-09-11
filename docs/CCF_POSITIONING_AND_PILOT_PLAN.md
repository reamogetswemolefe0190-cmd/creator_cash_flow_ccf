# CCF positioning and pilot plan

Working recommendation · 10 September 2026

This is a proposed commercial and product direction based on the current repository and a review of public competitor product pages. Customer demand, pricing and outcomes still need validation through the pilot. This document does not change the application or deployment.

## The decision

Position Creator Cash Flow as the campaign workspace for agencies managing creator work with brand clients.

Start with smaller South African agencies that already have creator relationships, run recurring brand campaigns and spend substantial time coordinating approvals and assembling client updates. Select partners by that behaviour, rather than assuming every agency of a certain size has the same problem.

The agency is the initial buyer and daily operator. Brands join to approve work and see results. Creators join to receive a specific brief, submit their work and understand their fee and payment status. Capital partners are an audience for the business case, not another product role.

**Proposed positioning:** Creator Cash Flow helps agencies run creator campaigns from the agreed brief to the final client report, with a clear record of approvals and payment milestones.

**Value proposition to test:** Spend less time chasing updates and rebuilding reports, while giving clients and creators a clear next step.

Keep the Creator Cash Flow name and approved identity. Add the plain-language descriptor "Campaign workspace for agencies" wherever the name alone could suggest lending or personal accounting.

## What the market check changes

CreatorIQ already offers agency content review, client views and exportable campaign reports. Modash covers creator relationships, tracking and payments. Humanz offers campaign execution, review and payments, and has documented work in South Africa. A shared dashboard, African geography or report export alone would therefore be a weak differentiation claim.

The proposed opportunity is a specific combination to validate: fast setup for an existing agency roster, a clear client approval experience, evidence attached to payment milestones, and practical support for a small campaign team. We have not established that competitors cannot serve those needs.

CCF must earn its position through an easier workflow and repeat use. Phyllo supplies data infrastructure; using it is not exclusive differentiation. Over time, permissioned campaign history could make repeat work easier, but the pilot must prove that benefit before we describe a durable advantage.

## Suggested homepage copy

Audience label: **For agencies running creator campaigns**

Headline: **Keep creator campaigns moving.**

Supporting copy: **Bring your creators, brand approvals and payment milestones into one campaign workspace. Know what needs attention and keep your client informed.**

Primary action: **Apply for the agency pilot**

Secondary action: **See a campaign in action**

Creator entry: **Invited to a campaign? Sign in**

Keep a separate creator account entry for people using the existing ledger. The campaign invitation should take an invited creator directly to the assignment, with account creation only where required.

Pilot availability should sit next to the relevant action in clear language. The public copy must describe the pilot invitation accurately until the persistent campaign journey is connected to customer accounts. Once report generation works with customer records, extend the supporting copy with "Build your client report from the work already recorded."

Homepage sequence: agency problem, a single campaign walkthrough, brand approval view, creator experience, sample report marked as a concept until built, then the pilot invitation.

## The demonstration story

Use one clearly labelled fictional campaign throughout. For example, an agency runs a R30,000 campaign for a skincare brand with three creators. This amount is illustrative, not a pricing suggestion or customer result.

1. The manager records the brief, dates, deliverables, usage terms and fees, then invites the brand and creators.
2. Each creator accepts their assignment, sees their own fee, and supplies relevant social data with consent when the connection is available.
3. Creators submit content. The manager requests revisions or sends a specific version for brand approval.
4. The brand approves that version. Everyone can see who owns the next action.
5. Published content and performance evidence are linked to the campaign. Imported figures carry their source, reporting period and last update.
6. An agreed payment milestone becomes ready for review. The authorised person reviews the evidence and records the decision. Invoice and payment status remain distinct from content approval.
7. The manager generates a client report from the same campaign record, reviews it and shares it.

This sequence is the intended pilot experience. It is not a claim that all seven steps currently operate in production.

## What needs to change in the product

The current customer UI explicitly says live campaigns are not connected to customer accounts (`customer.js`, `campaignsContent`). The backend provides organisation, campaign, creator assignment and consent foundations (`routes/collaborationRoutes.js`). Invitation creation returns `pending_email_integration` (`controllers/collaborationController.js`). These are concrete gaps between the demo and an operational pilot.

### 1. Complete one persistent campaign journey

Connect the existing campaign foundation to the customer interface. Add secure invitation acceptance for both new and existing participants, deliverable submission, versioned review and brand approval. A manager must be able to complete one real campaign with separate creator and brand accounts, and see the same authorised state after a refresh or on another device.

Agency-owned roster entries may exist before a creator joins, but importing a person must not create an authenticated account or grant consent on their behalf. The creator claims their invitation and chooses any data access.

### 2. Make each dashboard answer a decision

Agency opening view: overdue deliverables, items awaiting agency review, brand decisions outstanding and campaign deadlines.

Brand opening view: what needs approval, campaign progress, spend visible to that client and the latest results.

Creator opening view: current assignment, fee, deadline, feedback and payment status. Personal bookkeeping remains accessible alongside campaign work.

A permissioned client view should show only the relevant campaign. Agency margins and a creator's unrelated income should not enter the brand view or report. Agency branding can begin with a name and logo; a custom-domain system can wait.

### 3. Make campaign reporting a core deliverable

Build the first report with deterministic figures and editable commentary. Include objectives, agreed deliverables, approved/published content, target versus actual performance, the reporting period, data sources and freshness, and the payment information the recipient is allowed to see.

Start with a reviewed PDF export. Add revocable sharing when permissions and report versioning are ready. Store a dated report snapshot so later metric changes do not silently rewrite something already sent to a client.

Let the pilot use authorised CSV uploads or manually supplied evidence while production social-data access is unavailable. Label these accurately as uploaded or self-reported. Missing data should remain missing. Do not call all figures verified, treat views as sales, or sum platform reach into a claimed unique audience.

AI could draft the narrative later, grounded in report data and reviewed by a person. It is not required for a useful first report.

### 4. Connect reminders to agreed obligations

Record the amount, payer, payee, due date or triggering condition, required evidence and person responsible for approval. Support ordinary fixed-fee arrangements before adding performance bonuses.

For a performance condition, define the platform, metric, included content, measurement window and source before evaluating the target. Sandbox metrics cannot trigger a real payment obligation.

Separate target reached, payment approved, invoice sent and payment confirmed. When a target is reached, prompt the decision owner to review it. Automatic movement of money is a later integration with a payment partner.

Begin with reliable invitation emails and action reminders. Record delivery attempts and prevent duplicate reminders. User-initiated sharing can support pilot coordination before automated messaging integrations are justified.

### 5. Make the next campaign easier

After the first flow works, add campaign duplication and templates, reusable rosters, and usage-rights expiry reminders. Consider tracking links and attributable sales later where the campaign objective and integrations support them. These additions should follow repeated partner requests and observed use.

Pause a broad creator marketplace, open agency directory, general AI assistant and lending proposition during this pilot. Each adds a different adoption or operating problem. The pilot's success depends on agencies completing campaigns and returning for the next one.

## Commercial model to test

Test an agency workspace subscription with transparent campaign or usage allowances. Include invited brand viewers and creator participation so inviting the people needed to finish a campaign does not create another buying decision. Creator accounts remain free during the current release as already communicated.

Do not publish a price until we understand the cost of connected social accounts, data refreshes, storage and support. Explore willingness to pay in the pilot alongside those costs. Avoid a transaction-fee claim while CCF does not execute payments.

For capital partners, the proposed story is: CCF starts with agencies, and each useful campaign introduces brand clients and creators to the workflow. That may create an efficient adoption path; it is not yet a proven growth loop.

Build the funding case around repeat agencies, paid conversion, time saved, operating cost per campaign and a scoped production plan. A large creator-economy estimate provides context but does not establish CCF's addressable software market.

## Pilot validation

Recruit two or three suitable agencies as a starting target, not a current traction claim. Review how each handled its last campaign and agree which part CCF should improve. Run one appropriately scoped campaign per partner once the persistent workflow is ready.

Record baseline and pilot results for setup time, approval turnaround, follow-up volume, time to prepare a client report, and the proportion of participants completing their part of the workflow. Track support time and data costs as well.

The strongest early evidence would be an agency voluntarily starting a second campaign and agreeing to pay. A positive reaction to the demo is useful feedback, but it does not establish ongoing demand.

## Pitch language by audience

**Agency:** "CCF gives your team one place to manage creator work, collect client approvals and prepare campaign reports. Bring a campaign you already have and help shape the pilot around your workflow."

**Brand:** "See what is ready for approval, how the campaign is progressing and the evidence behind the results your agency reports."

**Creator:** "Your brief, agreed fee, feedback and payment status, together in your campaign workspace."

**Capital partner:** "We are building campaign software for agencies, starting with a pilot that tests repeat usage, reporting value and willingness to pay. Funding would support the delivery gaps and production infrastructure that the pilot validates."

## Sources and inspection scope

Competitor descriptions are vendor claims, reviewed on 10 September 2026, not independent performance tests:

- [CreatorIQ for agencies](https://www.creatoriq.com/best-influencer-marketing-solution/for-agencies): content review, client views and reporting.
- [Modash product overview](https://help.modash.io/en/articles/13714522-what-is-modash-and-how-does-it-work): creator relationships, campaign tracking and payments.
- [Humanz platform](https://www.humanz.com/platform/): campaign execution, content review and payments.
- [Humanz campaign examples](https://www.humanz.com/how-it-works/): documented South African campaign examples.

Local evidence: `customer.js`, `controllers/collaborationController.js`, `routes/collaborationRoutes.js`, `controllers/integrationController.js`, and the current marketing copy. This was a read-only product inspection, not a fresh production login or security audit.
