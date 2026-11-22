# Acceptance and launch checklist

This checklist tracks SRS v0.1. A local demonstration is useful for interface review, but it does not prove live authentication, authorization, private storage, quotas, or restoration. Do not push or deploy until Aya requests it. Run database tests after applying the migration to an isolated Supabase test project; do not use real member data as fixtures.

## Test identities

- Pair A: Aya Benali Khodja (`آية بن علي خوجة`) and fictional rafiqa Maryam (`مريم`), supervised by fictional Sumayya (`سمية`).
- Pair B: two different synthetic members and a different supervisor.
- Independent actors: signed-out visitor, unaccepted invitee, admin-only account, admin who supervises Pair B, disabled member, and disabled supervisor.
- Use reserved test email domains and accounts controlled by the tester. The demo fixture must remain separate from live Supabase data.

## Required product behavior

| SRS             | Acceptance check                                                                                                                                                                                                                            | Evidence needed                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ACC-01 / AT-01  | A new supervisor completes an Arabic signup/profile and can create a pair immediately. Empty dashboard exposes no existing user data. A forged profile/metadata request cannot grant admin access.                                          | Live auth journey; direct role-escalation request rejected.                                       |
| ACC-02 / AT-03  | Admin can search identity/status metadata only; confirmation precedes disabling. Disable/re-enable actions record actor, target, action and time. Disabling the final active admin is rejected.                                             | Admin UI journey and database assertions.                                                         |
| ACC-02 / NFR-03 | After disable, the user's existing JWT cannot read or write pair data or download files. Disabled admin has no privilege override.                                                                                                          | Repeat authenticated API and download calls using a session issued before disable.                |
| PAIR-01         | Only assigned supervisor creates pending pairs; two intended recipients are distinct and neither is supervisor. Supervisor may own several pairs.                                                                                           | Direct invalid create calls rejected; valid create creates two seats once.                        |
| PAIR-02         | Seat-specific opaque invitation tokens are hashed at rest, expire, can be copied manually, and rotate/revoke without exposing partner details.                                                                                              | Inspect stored hash; old/revoked/expired link fails with safe Arabic guidance.                    |
| PAIR-03 / AT-02 | First acceptance leaves pair pending; second valid distinct acceptance activates once. Wrong email and same-user second seat are rejected; retries and simultaneous requests do not duplicate membership.                                   | Live invitation journey and concurrent RPC test.                                                  |
| PAIR-03         | A member cannot join a second active pair, including simultaneous acceptance into two pairs.                                                                                                                                                | Concurrent acceptance test across pairs.                                                          |
| PAIR-04 / AT-10 | Archive retains authorized historical read access but prevents invitations, plans, logs, meeting writes and uploads. Disabled participant freezes all new pair writes.                                                                      | Existing and direct API writes fail in archived/frozen states; no automatic reassignment.         |
| PLAN-01 / AT-04 | Sunday-Saturday weeks use Africa/Algiers local dates; previous/current/next navigation works. Empty week says no plan rather than failure.                                                                                                  | Date tests around Saturday/Sunday and year transition; UI review.                                 |
| PLAN-02         | Individual targets are independent. A shared proposal is effective only after the other member confirms; reject/unanswered does not replace targets. Previous targets or immutable logged target history is retained.                       | Two-member journey plus direct own-confirm/overwrite rejection.                                   |
| PLAN-03         | Both activity types support several inclusive surah/ayah ranges; reversed, unknown-surah and out-of-range entries are rejected in Arabic. Metadata provenance is recorded.                                                                  | Unit validation tests and database invalid writes.                                                |
| PLAN-04         | Daily plan explicitly represents both Hifdh and Muraja'a, differentiating missing/draft, saved target and no-target/rest. Shared targets do not automatically split individual daily work.                                                  | Save both activities; rest day; incomplete form; independent partner schedule.                    |
| PROG-01 / AT-05 | Missing, not done, partial and completed are distinct per activity. Partial/completed retain actual ranges. Late and off-plan logs are allowed and identified.                                                                              | Shared An-Nur 1-10 fixture: Aya 1-7, Maryam 1-4; independent revision results.                    |
| PROG-02         | Only owner edits own records. Editing plan never changes actuals. Corrections retain ownership/date/activity and show edited timestamp.                                                                                                     | Partner/supervisor mutation attempts rejected; plan/actual separation test.                       |
| PROG-03         | Supervisor sees own pairs only, with each member's Hifdh/revision plan versus actual, unlogged days, meeting status and resources. Any percentage counts unique comparable ayahs and shows a denominator; empty targets use not applicable. | Supervisor review against fixture; overlap and empty-target calculations.                         |
| MEET-01 / AT-06 | Dedicated daily/weekly views contain actual scheduled records; one daily record per pair/date and one weekly record per pair/week.                                                                                                          | Type filter and duplicate-period test.                                                            |
| MEET-02         | Either member schedules daily sessions; only assigned supervisor schedules weekly ones. Local date/time round-trips to an unambiguous instant; time zone shown. Only HTTPS external links accepted.                                         | Live scheduling and unauthorized/unsafe-link requests.                                            |
| MEET-03         | Planned, held and missed outcomes round-trip with note, author and edited time. Past planned meeting remains planned with outcome cue. Rescheduling updates same record and stale edits prompt reload.                                      | Outcome/reschedule/conflict tests.                                                                |
| MEET-04         | Holding meeting never marks progress complete; logging progress never records attendance.                                                                                                                                                   | Snapshot actuals before/after meeting outcome; meetings before/after progress update.             |
| RES-01 / AT-07  | Assigned supervisor publishes private PDF and HTTPS link to one own pair; optional description/week/surah labels round-trip.                                                                                                                | Live file and link publication.                                                                   |
| RES-02          | Only enabled pair members/assigned supervisor access file metadata and authenticated downloads. No public bucket/object URL. Withdrawal prevents new download authorizations. Existing signed URL lifetime is documented.                   | Pair B, admin-only and signed-out metadata/download calls denied; withdrawal test.                |
| RES-03          | PDF/PNG/JPEG only, maximum 5 MiB/file and 50 MiB/pair enforced server-side. Failed uploads create no visible resource; abandoned objects have cleanup. No active file content rendered. Links remain available at file quota.               | Invalid MIME, oversized, concurrent quota race, interrupted upload, withdrawal and cleanup tests. |
| RES-04          | Supervisor edits metadata/withdraws own pair resources; members cannot publish/edit or transfer resource to another pair.                                                                                                                   | Direct unauthorized and parent-ID tampering requests denied.                                      |

## Cross-cutting verification

| SRS            | Acceptance check                                                                                                                                                                     | Evidence needed                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| NFR-01 / AT-08 | `lang="ar"`, `dir="rtl"` from first load. Arabic auth/forms/errors/empty/loading/invite/upload statuses. Email, URL and ayah sequences remain readable in mixed direction.           | Browser review of every view; no untranslated provider core screens.                                      |
| NFR-02 / AT-08 | Usable at 360 px with no horizontal page overflow; keyboard entry/focus, named controls, contrasted text, text labels independent of color.                                          | Desktop/mobile browser checks; keyboard dialog/form journey.                                              |
| NFR-03         | Visitor/unrelated member/unrelated supervisor/admin-only cannot read pair records, notes, links or files even with known IDs. No credentials/invite tokens or private notes in logs. | Direct API authorization matrix, including storage; source/log review.                                    |
| NFR-03         | Restricted adult pilot, minimal profile fields, privacy notice and consent; sign-up/invite abuse limits and account enumeration safeguards.                                          | Approved policy text, configured auth limits, tested error responses.                                     |
| NFR-04 / AT-09 | Frontend/auth/database/private uploads operate at zero monetary cost; no auto-billing dependency; free provider subdomain and manual invite sharing.                                 | Current official provider terms, selected region availability, dashboard limits and documented pilot cap. |
| NFR-04         | Auth, storage/bandwidth and persistence/inactivity limits are documented; exhausted quota fails in Arabic without paid upgrade.                                                      | Staging exhaustion cases and operations runbook.                                                          |
| NFR-05         | Migrations versioned; test/demo/production separated; only publishable key in browser; server secrets absent from repository.                                                        | Build inspection, configuration and migration review.                                                     |
| NFR-05 / AT-09 | Database plus private resource backup restored into isolated test environment, preserving access and files.                                                                          | Actual export/restore exercise with signed-in authorized download after restore.                          |
| NFR-06         | No meeting/email/payment/conversion provider required. A failed external URL does not affect stored records.                                                                         | Link failure journey; dependency review.                                                                  |

## Repeatable end-to-end fixture

1. Register Sumayya as supervisor and create Pair A for two controlled test emails.
2. Copy both invitation links. Accept Aya's link; verify workspace remains unavailable. Accept Maryam's link; verify active pair with exactly two members.
3. Aya proposes shared Hifdh target An-Nur 1-10. Maryam confirms. Each enters independent Hifdh and revision daily plans for a complete Sunday-Saturday week, including one explicit rest day.
4. Aya logs Hifdh 1-7, Maryam logs 1-4. Each logs different revision ranges. Confirm missing progress differs from explicitly not done.
5. Aya schedules today's daily meeting. Maryam marks it held with a note. Confirm both progress records are unchanged.
6. Sumayya reviews both results separately, schedules weekly meeting and publishes explanation link plus a small synthetic PDF.
7. Attempt all pair reads/writes/downloads using Pair B, unrelated supervisor, admin-only and signed-out actors. All unauthorized operations must be denied on the server.
8. Disable Aya while her session stays open. Confirm read/write/download denied for Aya and new pair writes frozen for remaining actors. Re-enable and verify access restores without automatic grants.
9. Archive Pair A. Verify authorized historical reads remain and all new writes/invitations/uploads fail.
10. Export database records and private file objects, restore into isolated test project, and verify authorized resource downloads.

## Decisions before inviting real users

- Confirm adult-only pilot eligibility, consent, privacy notice, retention periods, deletion requests and who handles them.
- Confirm selected Supabase region, free-tier limits, inactive-project behavior and a modest pair/member/storage cap. A supplied publishable key cannot apply schema migrations or establish these dashboard settings.
- Confirm first weekday, late edit policy and supervisor-only archive behavior; current recommended defaults are Sunday, corrections while active and supervisor archive.
- Establish departed-supervisor closure/reassignment process; do not silently transfer pair access.
- Configure verified email ownership, allowed redirect URLs and recovery flow in Arabic. Distinguish email verification from supervisor approval.
- Verify backup/restore for both database and storage. Keep the deployment a test environment until the restoration exercise passes.

## Verification status

Local verification on 2026-11-22:

- `npm run typecheck`: passed after the shared provider and UI integration.
- Final `npm test`: **25 tests passed across 5 files**, including localized native form errors, ayah validation, week boundaries, separate plan/actual corrections, shared confirmation, authorization in the demo, and ambiguous upload-response recovery. Test fixtures use deterministic timestamps.
- Final `npm run build`: TypeScript and production Vite build passed, with separate React and Supabase chunks.
- The locally served application and original SVG favicon each returned **HTTP 200**. The favicon was rasterized and visually inspected; PNG fallback and Apple touch icon are included.
- `npx vitest run tests/app.test.tsx`: three integration tests passed using the actual React application and demo provider, with the Supabase boundary mocked to prevent network access. They cover explicit demo entry/restoration, meeting outcomes independent from progress, member/supervisor meeting permissions, admin-only privacy, and confirmation of a shared target by the second member without altering the previously logged week.
- Ten rendered reference pages across lectures 01, 04 and 08 were visually inspected.

These checks prove local demonstration behavior. Live Supabase authorization, invitation concurrency, file quota enforcement, email ownership/recovery, provider account settings and restoration are **not yet verified**. Update this section with exact commands, dates and outcomes as checks are run; do not infer a server authorization pass from a rendered UI or a successful TypeScript build.

The browser-control tool reported **No browser is available** in this session. Desktop/mobile layout inspection, keyboard navigation in an actual browser, and the 360 px overflow check therefore remain pending. Responsive CSS, native modal focus handling and mobile navigation focus management are implemented, but a DOM test is not visual evidence.

## Local backend verification

Conventional PostgreSQL 18.6 verification on 2026-11-22 completed with **72
regression checks and 6 two-client concurrency checks passing** (exit 0):

```bash
psql -h /tmp -p 55432 -U aya -d rofaqa_check2 -v ON_ERROR_STOP=1 \
  -f supabase/tests/bootstrap.sql \
  -f supabase/migrations/202611220001_initial.sql \
  -f supabase/tests/regression.sql
PGHOST=/tmp PGPORT=55432 PGUSER=aya PGDATABASE=rofaqa_check2 \
  python3 supabase/tests/concurrency.py
```

These checks execute actual PostgreSQL roles, row-level policies, triggers and
RPCs against minimal Supabase Auth/Storage schema contracts. They cover
supervisor onboarding without admin approval, forged admin metadata rejection,
email-bound hashed invitation activation/rotation/revocation, concurrent seat
acceptance and one-active-pair membership, 40 failed invitation attempts/hour,
independent member actuals, shared confirmation, stale edits, meeting permissions
and progress independence, 5 MiB/file and 50 MiB/pair quotas, authenticated file
read policies including signed-URL denial, withdrawn-file cleanup, admin privacy,
disabled existing-session reads/writes, and archived/frozen pair behavior.

The tests do not contact the supplied Supabase project and do not establish
live email ownership/recovery, actual Storage HTTP operation markers/CDN cache
behavior, public endpoint abuse limits, provider quotas, or backup/file restore.
Those remain release gates. No remote migration, real account onboarding, push,
or deployment has been performed. See [backend runbook](backend.md).

## Visual reference interpretation

Ten pages from lectures 01, 04 and 08 were rendered and visually inspected. The website can take inspiration from their deep teal, warm ivory, turquoise and muted gold/ochre palette, strong Arabic type hierarchy, calm spacing and fine geometric linework. Do not copy the slide frames, ornamental medallions, illustrations, calligraphy or compositions. Web forms and progress views should prioritize readable text and accessible interactions over slide ornamentation.
