# Invitations in profile settings

The **الإعدادات → دعواتك** section lists invitations addressed to the signed-in
account's verified email. Valid invitations can be accepted there without
copying a secret link. Existing invitation links continue to work.

The first acceptance keeps the workspace pending. The second valid acceptance
activates it. Accepting an invitation does not bypass the existing membership,
enabled-account, expiry, revocation, or archived-pair rules.

## Update an existing Supabase project

The initial schema has already been installed in Aya's project. Apply only the
new additive migration:

[`supabase/migrations/202611240001_profile_invitations.sql`](../supabase/migrations/202611240001_profile_invitations.sql)

Open the project's **SQL Editor**, paste that file's contents and run it as the
project owner. Alternatively, use an authenticated Supabase migration tool to
apply that file. Do not rerun the initial migration. The frontend's publishable
key cannot install database functions.

After the migration succeeds, refresh the hosted app, open profile settings and
use controlled accounts to verify the inbox and both acceptance steps. A
deployment on Cloudflare does not apply Supabase migrations automatically.

## Privacy

The inbox uses dedicated authenticated RPCs rather than widening invitations
table access. It exposes invitation status, dates, and the supervisor's display
name, without another recipient's identity, pair notes, or stored token hashes.
Rotated invitations are replaced by the latest invitation for that seat. An
administrator has no special access to another person's inbox.

Inbox loading is separate from sign-in and workspace loading. If the database
update is missing or the request fails, only the invitations section shows a
localized retry message.

## Local verification

Use a disposable PostgreSQL database with the Auth/Storage test bootstrap and
both migrations installed. Run the existing `supabase/tests/regression.sql`,
then `supabase/tests/profile-invitations.sql`. The two-client runner also covers
mixed profile/link acceptance:

```bash
PGHOST=/tmp PGPORT=55432 PGUSER=aya PGDATABASE=rofaqa_profile_invites \
  python3 supabase/tests/concurrency.py
```

These checks use local service-contract stubs. They do not verify the live
project's Auth email delivery or replace applying the migration to that project.

On 2026-11-24, the final migration passed **72 existing regression checks,
47 inbox checks, and 12 two-client concurrency checks** in the disposable local
database. These include email isolation, disabled accounts, rotation, expiry,
revocation, shared rate limits, and mixed profile/link acceptance.
