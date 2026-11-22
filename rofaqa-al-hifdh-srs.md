# Rofaqa al-Hifdh | رفقاء الحفظ
## Software Requirements Specification

**Version:** 0.1 · **Status:** Initial Codex handoff, ready for review  
**Deliverable:** Requirements only. No implementation or hosting provider has been selected.  
**Language:** This specification is in English. The application must be entirely Arabic and right-to-left.

### 1. Product purpose and scope

Rofaqa al-Hifdh helps two people who have already chosen to memorize the Qur’an together turn weekly intentions into a daily routine. Each person plans and records new memorization and revision, the partners check in daily, and their assigned supervisor reviews progress and meets with them weekly. The supervisor can also share material relevant to their current or upcoming work.

**Pilot success:** A self-registered supervisor can onboard an existing pair without waiting for an admin; both members can plan a full week, track their own work, and record partner meetings; the supervisor can run the weekly review and share a resource; none of that requires a paid service.

**In scope:** Authentication and profiles, supervisor-led invitations, pair workspace, individual or shared weekly targets, daily plans and actual progress, two types of meetings, private pair resources, and basic account administration.

**Out of scope for v1:** Finding or matching partners, video calls hosted by the app, automated recitation grading, realtime chat, public profiles, public resource galleries, paid services, native mobile apps, leaderboards, or full Qur’an content hosting. A supplied visual reference will guide the look and feel; do not invent a separate branding or design system.

Throughout this document, **Required** denotes confirmed product behavior or a minimum safeguard. **Proposed default** denotes a reversible choice for the first version, not a user decision. The decision log identifies what deserves review before public launch.

### 2. Actors and access

- **Hafidh / member (عضو):** One of the Huffadh. Joins an offline-formed pair by invitation. Owns and records their own activity.
- **Supervisor (مشرف):** Signs up, creates a profile, and gains supervisor access immediately. No manual approval, verification badge, or admin review workflow. Authentication checks such as validating ownership of an email address, if selected, are distinct from supervisor approval.
- **Admin (مسؤول النظام):** An independently granted permission. Can manage and disable accounts. An admin who is also a supervisor has normal supervisory access for their own pairs only.
- **Visitor:** Can reach the Arabic sign-in and relevant onboarding screens, but cannot browse users, pairs, progress, meetings, or resources.

#### 2.1 Authorization matrix

Read/write rules apply on the server, including direct API calls, deep links, and file access. UI visibility does not grant permission.

| Operation | Hafidh | Assigned supervisor | Admin permission alone |
|---|---|---|---|
| Create pending pair / issue or revoke invite | No | Own pair only | No |
| Accept an invite | Only intended recipient | Not on a member’s behalf | No |
| Read active pair details and member progress | Own pair only | Own pairs only | No |
| Set individual target / daily plan / actuals | Own records only | Read only | No |
| Set a shared weekly target | Own pair, see rule below | Read only by default | No |
| Read both meeting types | Own pair only | Own pairs only | No |
| Schedule/update daily partner meeting | Either member, proposed | Read only by default | No |
| Schedule/update weekly supervisor meeting | Read only by default | Assigned supervisor, proposed | No |
| Read or download resources | Own pair only | Own pairs only | No |
| Publish, edit, or withdraw resources | No | Own pairs only | No |
| List accounts, disable or re-enable a user | No | No | Yes |
| Read private progress or meeting notes | Own pair only | Own pairs only | No |

An unrelated supervisor has no pair access, even if they know an ID or URL. An admin cannot use account management to join or impersonate a user. Admin assignment must not be exposed via self-registration, editable role fields, or ordinary profile requests.

### 3. Functional requirements

#### 3.1 Accounts, invitations, and pair lifecycle

- **ACC-01 | Sign-up.** On completed supervisor profile creation, route the supervisor straight to the dashboard with the ability to invite. A new account sees no existing member data. Member onboarding begins from an invite; public account creation must not grant member access to any pair.
- **ACC-02 | Account administration.** Admins can find an account using only identity and account-management metadata, see its status, disable it and re-enable it. Log administrative actions (actor, target, timestamp, action; optional reason). Disable must block subsequent authenticated access, including by already signed-in users; an admin flag never overrides a disabled account. Proposed: prevent disabling the last active admin and require confirmation before any disable.
- **PAIR-01 | Create.** A supervisor creates a pending pair for two distinct, previously chosen individuals. No matching flow. An active pair has exactly two distinct members and one assigned supervisor. A supervisor may manage multiple pairs. A supervisor must not occupy a member slot in the same pair. Create and activation enforce invariants on the backend.
- **PAIR-02 | Invite.** Proposed: each seat has its own one-time, time-limited link, bound to the intended recipient’s authenticated email. The supervisor can copy and send each link outside the app, with Arabic copy and no required email API. Tokens should be opaque, stored as hashes, not logged, and consumed atomically; rotating/revoking an invite invalidates the older link. The invitation view discloses only what is needed to accept and no partner’s private details.
- **PAIR-03 | Activate.** Proposed: stay pending after the first acceptance; activate only after both distinct recipients accept, the supervisor is enabled, and both seats are valid. Acceptance retries by the same user return the existing outcome, and simultaneous acceptance must not create duplicate membership. Expired, revoked, wrong-account, and already-used links give safe Arabic guidance. Proposed: only one current active pair per Huffadh at a time; do not silently transfer a member.
- **PAIR-04 | End and restore.** Proposed: supervisor can archive a pair rather than replace members in place. It becomes read-only to enabled, previously authorized users and accepts no invitations or new uploads. To pair different people, open a new workspace. If a member or supervisor is disabled, freeze new writes for that pair until all required participants are enabled or an authorized closure is arranged; do not automatically assign another supervisor or give an admin access to notes. Define permanent deletion, retention, and any reassignment separately before launch.

#### 3.2 Weekly targets and daily planning

- **PLAN-01 | Week workspace.** Present a pair’s current week plus navigation to past weeks and, by default, the next week. Show both members’ targets, planned days and completion summaries to the pair and assigned supervisor. Empty weeks say no plan exists; they are not marked as failed. Proposed calendar baseline: Sunday–Saturday using the pair’s IANA time zone, initially Africa/Algiers; store local calendar dates with the week’s start date, and store actual meeting timestamps as instants.
- **PLAN-02 | Two modes.** Default: each member sets their own weekly target. Alternative: one shared weekly target applies to both; completion and daily records remain separately attributed. Proposed: use a simple propose-and-confirm flow for a shared target. Either member may propose; the other must confirm before a shared target becomes effective. An unanswered or rejected proposal does not replace current targets. Do not overwrite individual records on mode change; retain a record of previous targets or prevent replacing the active target after actuals have been logged.
- **PLAN-03 | Targets.** Support planned new memorization (حفظ جديد) and revision (مراجعة). Proposed structured entry: activity type, Arabic surah selection, inclusive start/end ayah and optional Arabic note. Permit several entries where a target crosses surahs; reject reversed or out-of-range intervals. Select an authoritative surah metadata source and document provenance before implementing structured validation. Do not require a full Qur’an text dataset to ship the pilot.
- **PLAN-04 | Daily schedule.** Both Hifdh and Muraja’a fields must be present on every daily plan. Each member sets their own activities even when the weekly target is shared. Proposed: an explicit “لا يوجد هدف لهذا النشاط اليوم” option permits a rest/adjustment day without silently omitting either activity. Distinguish draft/incomplete plans from saved plans, and distinguish an explicit no-target choice from missing data. Shared targets may inform daily planning but do not automatically split work between members.

#### 3.3 Daily progress and supervision

- **PROG-01 | Record actuals.** Each member independently records actual work for both activities, with an Arabic note optional. Proposed states per activity: not logged, not done, partly done, completed. Record what was done when partially or fully complete (e.g. planned ayahs 1–10, actual 1–7). A late or off-plan entry should be identified as such, not rejected solely because it differs from the plan. Do not infer that missing progress means nothing was completed.
- **PROG-02 | Ownership and corrections.** Partners and the assigned supervisor can read results but cannot change another person’s records. Own-entry corrections preserve update timestamps and cannot change owner, pair, date, or activity by editing identifiers. Proposed: allow corrections to past entries while the pair is active; show an “edited” indicator. Keep plans separate from actuals; changing a plan must not rewrite what was logged.
- **PROG-03 | Review.** The supervisor dashboard shows each own pair’s week, each member’s Hifdh and Muraja’a planned vs actual, unlogged days, status of the upcoming/last weekly meeting, and shared resources. Do not combine the two activities or the two people into one opaque score. When a shared target exists, use it as the common reference but show separate results. If progress percentages are added, count unique ayahs and only compare like activity/units; show the denominator, and use “not applicable” for an empty target.

#### 3.4 Meetings view (اللقاءات)

- **MEET-01 | Categories.** Dedicated view separate from individual progress, with daily partner check-ins (لقاء يومي بين الرفيقين) and weekly check-ins with both members and the supervisor (لقاء أسبوعي مع المشرف). Proposed: one record per pair/local date for daily check-ins and one per pair/week for weekly check-ins. No placeholder rows required for unplanned sessions.
- **MEET-02 | Schedule.** Authorized scheduler selects a local date and time and may add an external HTTPS meeting link. Store an unambiguous timestamp and display the time zone. The link is visible only to the authorized pair and supervisor; it takes users to the external meeting provider, not to embedded conferencing. Proposed: the daily meeting may be scheduled/edited by either member, and the weekly meeting by the assigned supervisor. Show each type separately and sort forthcoming meetings by date/time.
- **MEET-03 | Outcome.** States: planned (مجدول), held (تمّ اللقاء), missed (لم يتمّ اللقاء). A meeting past its scheduled time that has not been updated remains planned with a cue to record the outcome, not automatically missed. Proposed: scheduler-side actors can record the outcome and one optional note; daily updates show the author and last-edited time to both partners and the supervisor. Rescheduling a planned meeting updates the same record; retain recorded outcomes on corrections rather than silently duplicating meetings.
- **MEET-04 | Independence.** A held meeting never completes either member’s Hifdh or Muraja’a. Logging progress never marks attendance. No individual attendance, recording, or meeting reminders unless asked for later.

#### 3.5 Supplementary resources (الموارد)

- **RES-01 | Publish.** Assigned supervisor can share an external link or upload a private file to one own pair, with title and optional Arabic description. Proposed: allow an optional week or surah label so a resource can be associated with a current or upcoming plan (e.g. an explanation of سورة النور). Do not require a resource for every week.
- **RES-02 | Access and downloads.** A pair sees a list of its published resources. File downloads must check membership/supervision and use private storage, via an authenticated endpoint or a short-lived, scoped URL with its revocation window documented. No public buckets or permanent public object URLs. Withdrawn resources no longer issue download access. Previously downloaded copies cannot be remotely revoked.
- **RES-03 | Validation and quotas.** Proposed initial allowlist: PDF, PNG, JPEG; up to 5 MiB per file and 50 MiB per pair, configurable and reduced if the hosting budget requires. Validate type and size server-side, enforce limits on successful writes, and never execute or render active file content in the app. Reject unsafe URLs (only HTTPS); do not fetch supplied URLs server-side. Failed uploads do not create visible resources; clean abandoned uploads. If quota is reached, explain it in Arabic and still allow sharing links.
- **RES-04 | Manage.** Supervisor can edit resource metadata or withdraw the item. Members cannot modify resources or publish them to another pair. A file replacement, if supported, must retain authorization and clean the unused file.

### 4. Proposed data model and invariants

A relational database is a sensible starting point, not a mandated service. Data below is conceptual. Use foreign keys, constraints, authorization checks, and transactions; never rely on disabled UI controls.

| Entity | Core fields and constraints |
|---|---|
| Account / role grants | Account ID, auth subject, minimal contact/profile fields, status, timestamps. Independent supervisor/admin permissions; no self-granted admin. |
| Pair | Pair ID, supervisor ID, status (pending/active/archived), time-zone ID, timestamps. Exactly one supervisor reference. Operational freeze may be derived from disabled participants. |
| Member seat | Pair ID, slot 1 or 2, accepted user ID, acceptance timestamp. Unique pair/slot; same user cannot occupy both slots. Enforce proposed active-membership limit on activation in one transaction. |
| Invitation | Pair/slot, recipient binding, token hash, expiry, accepted/revoked timestamp. At most one valid invite per unfilled seat. |
| Week plan / target | Pair + local week-start unique; mode, member owner (individual) or pair scope (shared), draft/confirmed status and timestamps. One active target per defined scope and week. Activity entries may hold several surah/ayah ranges. |
| Daily plan / activity log | Pair, member and local date. One plan and one actual per member/date/activity (Hifdh or Muraja’a), with optional child ranges. Verify that the owner belongs to that pair. Independently store planned and actual values. |
| Meeting | Pair, type, local calendar key, scheduled instant, optional link, status, optional notes, creator/editor. Enforce type-specific period uniqueness; keep outcome separate from progress. |
| Resource | Pair, uploader, type (link/file), URL or object key (exclusive), title, optional description/week/surah, status, size/type if file. |
| Admin audit | Actor, target, operation, timestamp, reason if supplied; no progress content, notes, credentials, or invite secrets. |

Use stable IDs and safe database migrations. A pair-scoped write must establish the actor’s authorization and valid parent state within the same logical operation. An invitation or upload retry must not create duplicate visible records. Avoid silent lost updates in co-edited meeting and shared-plan forms (e.g. compare row revision/update timestamp and return a localized reload prompt).

### 5. Screens and main journeys

| Screen | Minimum content and main action |
|---|---|
| Sign-in / supervisor onboarding | Arabic instructions, profile setup and direct supervisor dashboard access. |
| Invite acceptance | Arabic status and sign-in/accept path; clear error and way to request a fresh invite from supervisor. |
| Supervisor dashboard | Own pending/active pairs, invite state, weekly summaries; actions to create pair and open a workspace. |
| Pair workspace | Week switcher, individual/shared targets, sections for each member, daily plans and separate actuals. |
| Meetings | Type filters, date/time, link, status and notes; actions as allowed. |
| Resources | Pair resources; supervisor upload/link form with quota errors and appropriate empty state. |
| Account administration | Account search, status, confirmation for disable/re-enable, no pair detail views. |

**Walkthrough:** A supervisor signs up and invites two pre-matched partners. The first acceptance does not expose a usable workspace; the second activates it. Both opt into a shared goal of ayahs 1–10 of سورة النور, then individually plan both Hifdh and Muraja’a. At the end of a day, one logs ayahs 1–7 and the other 1–4; each also records their revision. They mark their partner meeting held separately. The supervisor sees separate results, publishes an explanation of the surah for the pair, and schedules the weekly meeting for all three.

### 6. Nonfunctional requirements

- **NFR-01 | Arabic and RTL.** Set document language to Arabic and direction to RTL from first load. Localize authentication, labels, links/buttons, empty/loading states, errors, accessible names, notifications and invitation copy. Avoid provider-generated English-only screens in the core flow. Use locale-aware dates, times and numbers; isolate mixed-direction values such as email addresses, URLs, and ayah ranges so punctuation and order remain legible. User-authored text need not be machine-translated.
- **NFR-02 | Responsive and accessible.** Make plan and progress entry usable on a small phone and keyboard. Proposed target: no horizontal page scrolling at 360 px, visible focus, meaningful labels and headings, contrasted text, and error/status meaning that does not depend on color. Test actual Arabic text on mobile and desktop; do not mirror icons whose meaning depends on fixed direction.
- **NFR-03 | Privacy and authorization.** Treat membership, religious study activity, and notes as private pair data. Use TLS, least-privilege access, nonpublic storage, no public member directory, no analytics requiring unnecessary personal data, and no private details in logs or URL parameters. Use synthetic fixtures. Define a privacy notice, retention/deletion procedure, and whether minors may join before inviting pilot users; default to a restricted adult pilot until eligibility and safeguards are decided. Rate-limit sign-up and invitation endpoints and avoid account enumeration.
- **NFR-04 | Zero-cost deployment.** Initial frontend, backend/auth if needed, database, and private file storage must operate at no monetary cost. No paid email, dedicated domain, paid database tier, or auto-billing fallback is required. Use a free provider subdomain and manually shared invitation links if necessary. Before selecting a stack, verify official plan terms, region availability, auth limits, persistence, storage/bandwidth, inactive-project behavior, and what happens at quota exhaustion. Document quota thresholds and a small pilot cap before launch. A free tier is not an indefinite guarantee; fail gracefully rather than enabling paid usage. Do not substitute link-only resources for required uploads without approval.
- **NFR-05 | Reliability and maintainability.** Use a simple deployable architecture, version-controlled schema migrations, separate local/test/prod configuration, secrets outside source control, structured errors without secrets, and synthetic test data. Document deploy, pause, export and restore. Verify a backup and restore path for both database data and resource files before relying on the live pilot; if no safe free path is available, keep it a test deployment.
- **NFR-06 | Integrations.** No dependency on a meeting vendor, payment provider, automated email service, or file conversion service for the core workflow. External links may fail independently; local records remain readable and editable.

### 7. Acceptance and regression checklist

| ID | Given / When / Then |
|---|---|
| AT-01 / ACC-01 | Given a new supervisor, when they finish signup/profile, they can create their first pending pair without any admin event. A web request cannot self-grant admin. |
| AT-02 / PAIR-01–03 | Given distinct invitees, after one accepts the pair remains pending; after both valid acceptances the pair becomes active once. Duplicate, expired, revoked, wrong-recipient and concurrent requests do not corrupt membership. |
| AT-03 / ACC-02, NFR-03 | Given an admin who is also a supervisor, they can disable accounts and see their own pair records, but a direct request for another pair’s notes or resources is denied. A disabled user’s already-open session cannot read or write after disable. |
| AT-04 / PLAN-01–04 | Two members can set different weekly targets or agree to one shared target. A daily plan always represents both activities, even for an explicitly skipped activity. An invalid ayah range is rejected in Arabic. Test the transition across a local week boundary. |
| AT-05 / PROG-01–03 | Given a shared target of ayahs 1–10, logs of 1–7 and 1–4 display separately and keep independent revision records. Neither a partner nor a supervisor can write the other member’s actuals. Missing and explicitly not-done are distinguishable. |
| AT-06 / MEET-01–04 | A member schedules a daily partner check-in and a supervisor schedules the weekly check-in. Date/time, link, status and optional note round-trip. Marking either meeting held leaves progress unchanged. Unrelated users cannot access its link or notes. |
| AT-07 / RES-01–04 | Supervisor publishes a PDF and a link for pair A. A sees both; pair B and an admin without pair access cannot get metadata or download the PDF. Invalid type, over-quota and withdrawn cases fail safely; link sharing still works when file quota is full. |
| AT-08 / NFR-01–02 | With Arabic long labels, numbers, ayah ranges, URLs and emails, all screens remain legible in RTL on mobile and desktop. Signup, invite rejection, upload error and empty dashboard are readable in Arabic and operable by keyboard. |
| AT-09 / NFR-04–05 | A pilot environment proves auth, persistence, permissions and private downloads at no cost. Exhaustion produces a clear warning and no paid upgrade. Restoration into a test environment produces accessible authorized records and files. |
| AT-10 / PAIR-04 | An archived or frozen pair rejects writes and new invites, and no automatic access grants occur. Historical records remain accessible only as permitted by lifecycle rules. |

Test authorization not just in visible UI but by direct API requests from an unrelated pair, unrelated supervisor, admin-only account, invitee, and disabled account. Include tenant isolation checks for file URLs and invite rotation, not just page navigation.

### 8. Open decisions and recommended implementation order

| Decision | v1 recommendation pending review |
|---|---|
| Visual style | Apply Aya’s reference when supplied. Build only neutral, Arabic RTL layouts until then. |
| Authentication and invitation delivery | Use verified identity and supervisor-copied invite links first; test link expiry and sign-in recovery in Arabic. Automated emails can be added later. |
| Scheduling and edit rights | Africa/Algiers; Sunday start; either member records daily meetings, assigned supervisor records weekly ones; no automated outcome or reminders. Confirm whether the team wants a different first weekday, allowed late-edit window, or partner confirmation. |
| Plan changes | Either member proposes a shared target and the other confirms. Preserve individual histories on changes; seek confirmation before choosing more complex versioning. |
| Member lifecycle | One concurrent active pair per member; close and recreate rather than silently transferring; decide whether pair archiving should be supervisor-only and how to handle a departed supervisor. |
| Required profile fields and eligibility | Collect only display name and required login identity. Confirm age scope, consent, deletion, and retention before onboarding real users. |
| Resource constraints | Start with PDF/JPEG/PNG and modest verified quotas; consider audio only if explicitly requested and compatible with zero-cost storage/bandwidth. |
| Host selection and operations | Verify current offers before implementing against one. Confirm region, deployment/restore plan, number of pilot pairs, and any limits before launch. |

**Codex sequence:**  
1. Review this file, flag departures from the confirmed requirements, and isolate unresolved decisions. Do not push or deploy yet.  
2. Design the schema and build a thin Arabic RTL flow covering authentication, pair invitations and permission tests.  
3. Add weekly and daily planning with actuals and a supervisor read view. Complete the end-to-end fixture with two users and both activities.  
4. Add the dedicated meetings view, private resources, and account administration. Test cross-pair access and admin boundaries with a second pair.  
5. Apply the supplied visual reference, run mobile/RTL checks, verify quota and restore behavior, then prepare a zero-cost deployment runbook. Do not claim production readiness until the relevant open decisions and acceptance checks are resolved.
