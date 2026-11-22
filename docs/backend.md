# Supabase backend and operational boundaries

The frontend uses the supplied project's publishable key. It never needs a
service-role key. The publishable key cannot install a schema or grant database
administration privileges. No migration has been applied to the supplied remote
project automatically, and no real account or pair has been created there.

## Install the migration

1. Open the Supabase dashboard for project `gpkysjljythifexyutlg`.
2. Open SQL Editor as the project owner and execute
   `supabase/migrations/202611220001_initial.sql` once in a fresh project.
   Alternatively, link the Supabase CLI and run `supabase db push`.
3. The migration expects Supabase Auth, Storage, and the current
   `storage.allow_any_operation(text[])` helper. If the helper is unavailable,
   update the Storage service before installing; do not remove its checks to
   make a migration pass. They prevent users minting reusable signed URLs.
4. Enable email confirmation in Auth and configure the local/site callback URL.
   Keep password signup rate limits enabled. Use Supabase's free development
   email allowances only for the restricted pilot; do not promise arbitrary
   external delivery with its default mail provider.
5. Set Auth signup/signin/recovery rate limits and CAPTCHA before admitting real
   users. Authenticated invitation acceptance is limited to 40 attempts per
   account/hour, including invalid, wrong-recipient and expired tokens. Its
   inner exception block returns `{error, code}` so the outer attempt counter
   commits while membership changes roll back; the client must treat that JSON
   result as an error. Public invitation inspection still needs a gateway/IP
   abuse limit before public launch. The application remains a restricted test
   build until deployment controls are configured and tested.
6. Create a supervisor through the application. Supervisors obtain their role
   immediately, and have no access to anyone else's pairs.

The schema migration is intentionally not a seed of real user accounts.
Production and test projects must be separate. The browser demo is synthetic
data in local storage, not evidence that this migration exists remotely.

## First admin

Admin permission is independent of supervisor permission. A project owner may
grant it in SQL Editor to a known, verified account:

```sql
update public.profiles
set is_admin = true
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
```

There is no browser role editor, public admin signup, impersonation operation,
or admin exception to private pair access. An admin searches identity/account
metadata through `admin_accounts`, then confirms a disable or enable action in
the UI. Every state change is audited. The final enabled admin cannot be
disabled. Disabled users immediately fail new database/storage authorization,
including with a previously issued Auth JWT. Downloaded copies and data already
rendered on a device cannot be remotely erased.

## API contract

All application roles have SELECT access only to authorized rows. All mutations
use public RPCs, which check the authenticated actor and pair state. The owner,
pair, date and activity of an existing daily entry cannot be changed through an
editable identifier. The actor is obtained from `auth.uid()`, never a client role
or owner field.

| RPC                                           | Purpose                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `complete_profile`                            | Own display name and optional supervisor onboarding; never grants admin |
| `create_pair`                                 | Pending pair, two seats and two email-bound invites                     |
| `rotate_invitation`, `revoke_invitation`      | Assigned supervisor manages an unfilled seat                            |
| `inspect_invitation`                          | Minimal, safe invitation validity/status for the acceptance screen      |
| `accept_invitation`                           | Verified-email acceptance; second valid seat activates atomically       |
| `archive_pair`                                | Assigned supervisor closes a pair, invalidating open invites            |
| `save_weekly_target`, `respond_shared_target` | Own target or proposal/other-member confirmation                        |
| `save_daily_entry`                            | Independently writes own plan or own actuals, preserving the other      |
| `save_meeting`                                | Members schedule daily; supervisor schedules weekly                     |
| `publish_resource`, `update_resource`         | Assigned supervisor publishes/edits/withdraws                           |
| `resource_storage_usage`                      | Authorized pair's exact stored bytes, including abandoned uploads       |
| `admin_accounts`, `admin_set_enabled`         | Identity-only account administration and audit                          |

Ranges use `{ "surah": 24, "from": 1, "to": 10 }`. Multiple ranges are allowed
for work crossing surahs. The migration validates all 114 Hafs/Kufan ayah counts
from [Tanzil Quran metadata](https://tanzil.net/docs/quran_metadata), totalling
6,236 ayahs. No Quran text is hosted. Percentages must deduplicate overlapping
ranges in the frontend; the database accepts overlaps as descriptive entries.

Plan activities have `state: draft | none | planned` and `ranges: []`.
Actual activities have `state: unlogged | not_done | partial | completed` and
`ranges: []`. Both activities must be supplied. Planned/partial/completed states
require actual ranges; explicit none/not_done/unlogged require no ranges.
Plans and actuals are stored independently. Missing actuals never imply failure.

Shared targets preserve individual target history. A proposal does not affect
the active reference until the other member confirms. Once actuals exist, the
active reference cannot be replaced. The first pilot does not support switching
back from a confirmed shared goal to individual mode in the same week; create
the next week's goals instead. This restriction prevents erasing agreement or
silently replacing a partner's target.

Updates to daily entries, meetings, shared proposals, and resource metadata
require the current version. A conflict returns an Arabic reload prompt.
Meetings are unique per local daily date or Sunday-start week. Meeting outcome
updates never alter memorization/revision results. All local dates and meeting
times use `Africa/Algiers`; the migration deliberately restricts the pilot to
that timezone.

## Invitations

Links contain a 256-bit opaque token in a URL fragment. Only its SHA-256 hash is
stored. Plaintext tokens are returned once to the supervisor so they can copy
and send the links outside the app. Do not log RPC bodies containing tokens.
The ordinary invitations read grant excludes the hash column.

Invites expire after seven days. Rotation invalidates the previous link. The
acceptance RPC binds to `auth.users.email` with a confirmed email timestamp,
not a browser-supplied email. A repeated successful acceptance returns the same
pair outcome. A global transaction advisory lock serializes pilot membership
activation across pending pairs, ensuring one active pair per member.
The first accepted member cannot read a pending pair's workspace.

## Files, quotas, withdrawal and cleanup

The private bucket is `pair-resources`. Upload a fresh path
`PAIR_UUID/RANDOM_UUID/filename.pdf` with `upsert: false`, then finalize with
`publish_resource`. A failed upload never creates a visible resource. The
bucket and database enforce the allowlist PDF/PNG/JPEG, 5 MiB per file and
50 MiB of stored objects per pair. Quota checks serialize using the same pair
lock as publication and lifecycle writes. Storage's trusted object metadata,
not the browser's resource payload, determines accepted size and MIME type.
MIME declarations are not content inspection: the app downloads files and does
not embed, execute, convert or actively render them.

Downloads use `storage.from('pair-resources').download(objectKey)` with the
user's authentication. Operation-aware SELECT policies permit authenticated
download/info only. Object listing and `createSignedUrl`/`createSignedUrls`
are denied even to an otherwise authorized member. Thus no signed URL
revocation window exists: the next authenticated origin request checks the
current account, membership and publication status. Previously downloaded or
browser-cached bytes cannot be revoked. Do not add a public bucket policy.

On withdrawal, metadata immediately becomes unavailable to members and all
new authenticated file downloads fail. The supervisor should then call
`storage.remove([objectKey])`. A separate delete-only SELECT policy allows
removal of withdrawn or unfinalized files without allowing their download.
A failed cleanup leaves the withdrawal effective and the bytes counted in
`resource_storage_usage`. Link publication remains available at full quota.

For failed finalization, remove the newly uploaded orphan through Storage API.
For operational cleanup, a project owner should periodically identify old
unreferenced objects and remove them through Storage API/Dashboard, after
checking that no upload is in progress. Never delete `storage.objects` rows
with SQL: that would leave the actual object bytes orphaned. Query-only
inventory (SQL Editor owner):

```sql
select o.name, o.created_at, o.metadata
from storage.objects o
where o.bucket_id = 'pair-resources'
  and o.created_at < now() - interval '24 hours'
  and not exists (
    select 1 from public.resources r
    where r.object_key = o.name and r.status = 'published'
  );
```

Only the assigned enabled supervisor can publish, download, or remove files
as permitted by lifecycle rules. Admin permission adds no file access. Pair
archive blocks further writes, including new files; historical published files
remain available to previously authorized enabled users.

Storage policy references:
[Supabase operation-aware helpers](https://supabase.com/docs/guides/storage/schema/helper-functions),
[authenticated private downloads](https://supabase.com/docs/guides/storage/serving/downloads),
[Storage schema cautions](https://supabase.com/docs/guides/storage/schema/design).

## Local database regression tests

Use a disposable PostgreSQL database, never the supplied live project. The
bootstrap script creates minimal Auth/Storage contracts and test roles, not a
complete Supabase service. For example, with a local server on port 55432:

```bash
psql -h /tmp -p 55432 -U aya -d postgres -v ON_ERROR_STOP=1 \
  -f supabase/tests/bootstrap.sql \
  -f supabase/migrations/202611220001_initial.sql \
  -f supabase/tests/regression.sql
```

Regression checks run `SET ROLE authenticated` for real RLS evaluation. They
exercise Arabic validation, ownership, private metadata/file rows, lifecycle,
disabled JWT access, admin boundaries, shared confirmation, stale updates and
storage quotas. Test data rolls back. The two-client runner additionally proves
simultaneous seat acceptance, idempotent concurrent retries, and competing pair
activation for a single member:

```bash
PGHOST=/tmp PGPORT=55432 PGUSER=aya PGDATABASE=rofaqa_check2 \
  python3 supabase/tests/concurrency.py
```

It refuses non-local sockets or databases without a `rofaqa_` test-name prefix.
Its synthetic fixtures remain in that disposable database. These tests do not prove live Auth email
delivery, the actual Storage HTTP operation marker, API rate limits, or remote
restore. Verify those separately against an isolated Supabase test project
before pilot onboarding.

Local verification on 2026-11-22 used conventional PostgreSQL 18.6 with the
minimal Auth/Storage bootstrap, real `SET ROLE authenticated` evaluation, and
the migration in a fresh `rofaqa_check2` database: **72 regression checks and
6 two-client concurrency checks passed**. The separate server tests covered
RLS/private file rows, immediate disabled-session authorization, hashed bound
invitations, durable failed-attempt throttling, concurrent membership activation,
5/50 MiB quota rules, shared proposals, ownership, and archived/frozen pairs.
This is database-level evidence using service-contract stubs; it is not a live
Supabase Auth/Storage HTTP or backup-restore certification.

## Backup, restore and restricted pilot gate

Export application tables and Auth user identities with the Supabase CLI/pg_dump
using project-owner credentials held outside source control. Export Storage
**bytes separately** via Storage API/CLI; a database dump contains metadata, not
file contents. Keep exports encrypted, access restricted, and labelled with the
schema migration revision. Do not log credentials or invitation payloads.

Before relying on a pilot, restore into a separate test project: install the
same migration, restore users with matching UUIDs, restore relational records,
reupload object bytes preserving their keys, then compare file hashes and run
two-pair authorization checks using new test sessions. Confirm archived and
disabled-account behavior, resource withdrawal, and the 50 MiB limit too.
No restore drill has been performed against the remote project by this code
handoff; that remains a release gate.

Permanent user deletion, retention duration, consent/age policy, supervisor
departure/reassignment, public hosting, and recurring backups need explicit
operational decisions before inviting real pilot users. Until those and the
live tests above are resolved, use only synthetic adult test accounts. Pausing
the frontend alone does not revoke direct API access; disable affected accounts
or archive pairs if records must become read-only.
