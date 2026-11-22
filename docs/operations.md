# Local integration and operations

Reviewed against official provider documentation on 2026-11-22. No hosting resources were provisioned or deployed. The SRS explicitly requests local work at this stage.

## Configuration and environments

Use `.env.local` for the supplied project URL and publishable key; `.env.example` contains the exact public values. Never expose a service-role key, database password or SMTP password through Vite. The demo has a separate browser-local store; logging out of demo must not copy records into live accounts. Use a different Supabase project for destructive integration tests; preserve production project IDs and never reset a populated database to apply an update.

When using a different Supabase project for a hosted test build, update the exact `connect-src` origin in `public/_headers` to match its URL before building. The supplied CSP targets Aya's supplied project. The `_headers` file is interpreted by Cloudflare Pages, not by Vite's development server.

Run `npm ci`, `npm test`, `npm run build`, then `npm run dev` for local work. The static build is in `dist/`. Frontend route state uses URL fragments; invitation secrets also use fragments so ordinary HTTP access/referrer logs do not receive them. Do not add analytics that record fragments or session data.

## Apply the schema

Open the supplied project in Supabase's SQL editor as its owner, review the migration, and run it once. It is an initial migration, not a repeated reset script. Use later additive migrations for changes. The public/publishable key cannot perform this step.

Check the created private bucket `pair-resources`; keep it private. Upload limits are PDF/PNG/JPEG, 5 MiB per file, 50 MiB per pair. Resources download through authenticated Storage requests on every attempt. No permanent public URL or signed URL is issued, so account disable and withdrawal affect the next authorization check; an already downloaded copy cannot be recalled.

Grant the first administrator only through a trusted owner SQL session after the intended account exists:

```sql
update public.profiles
set is_admin = true
where id = 'REPLACE_WITH_VERIFIED_ACCOUNT_UUID';
```

Confirm exactly the intended row changed. Admin is separate from supervisor; never grant it from user metadata, signup or profile forms. An admin-only account cannot browse private pair content.

## Authentication, email ownership and recovery

Set Site URL and allowed redirect URLs to the exact local and, later, hosted app origins. For local Vite, include `http://localhost:5173/`. Keep email/password authentication and email confirmation enabled for live invitations. Adapt Supabase confirmation/reset templates to Arabic; the app presents Arabic recovery and error screens. Do not paste provider secrets into this repository.

**Built-in Supabase email is a test constraint.** Official [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp) currently says its default mailer sends only to project-team addresses, at two messages per hour. General pilot signup/recovery therefore requires a separately configured, verified **free** SMTP option, or stays a controlled test using team-owned addresses. No paid email provider/domain is required by the app. Do not disable verification or add real pilot members to the Supabase owner team to work around email delivery. Select and test a suitable free SMTP sender before public onboarding; its availability and limits have not been proven in this project.

Supervisor access is granted immediately when the authenticated account completes its supervisor profile; this is not admin approval. Invitation seats require a verified account with the intended email. Members begin via invitation; public registration never joins a pair.

Keep Supabase's [auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) enabled; official defaults currently include IP-based limits of 30 requests per five minutes and per-user email cooldowns. The database additionally rate-limits invitation operations. Do not log tokens or expose precise identity-existence errors to visitors. Test signup, confirmation, invite acceptance, recovery, expired/revoked links and retry behavior with controlled accounts.

## Zero-cost hosting candidate and pilot budget

The frontend is static and can later use a free `pages.dev` subdomain on Cloudflare Pages. No hosting action is part of this local handoff. A later deployment uses build command `npm run build`, output `dist`, and the two public Vite variables. [Cloudflare's official limits](https://developers.cloudflare.com/pages/platform/limits/) list 500 Free builds/month; [Pages](https://www.cloudflare.com/products/pages/) describes free static requests/bandwidth. Avoid paid Workers, paid domains and paid add-ons. Set `Referrer-Policy: no-referrer`, frame protections and a Content Security Policy allowing the app and this Supabase project when publishing.

[Supabase Free pricing](https://supabase.com/pricing) currently lists 500 MB database, 1 GB file storage, 5 GB egress, 5 GB cached egress and 50,000 monthly active users; projects pause after a week of inactivity and there are two active free projects. This is a planning limit, not a guarantee of continued free service. Confirm the supplied project is on Free with no paid add-ons before launch. Do not enable an automatic paid upgrade.

Proposed restricted pilot: at most **5 pairs / 10 members and 2 supervisors**, 50 MiB per pair, 250 MiB total files. The per-pair database quota is enforced; the global participant cap and provider usage thresholds require operator monitoring. Review storage/database/egress weekly; stop onboarding at 70% of any provider quota, pause uploads at 80% global storage and preserve link sharing. Stop pilot writes/exports at service exhaustion and explain the interruption; never silently enable billing. Database and network quota enforcement/availability at exhaustion remain provider behavior to verify in the real project.

For an Algeria-based pilot, [Supabase lists Paris and Frankfurt among available regions](https://supabase.com/docs/guides/platform/regions). The supplied URL alone does not reveal the existing project's actual region. Confirm its location, availability and privacy suitability in the dashboard; do not assume a region from the project ID or recreate it without a migration plan.

## Pause and resume

To freeze a single pair without exposing notes, disable the departed participant or archive the pair through the assigned supervisor. Account disable denies subsequent authenticated requests and freezes pair writes. Re-enable restores access only to existing permissions. Archiving retains authorized historical reads and is intentionally not an in-place member replacement flow.

For maintenance, announce the downtime outside the app through the team's usual means, take a verified export, stop pilot onboarding/writes, and use the provider dashboard to pause only after understanding its retention/reactivation behavior. Do not delete the project as a pause operation. Reactivate, verify schema/storage and run the controlled account smoke journey before resuming. The app handles an unavailable backend with Arabic retry/error states; it does not substitute browser-local demo data for live records.

## Backup and restore gate

Supabase says [Free projects should export regularly](https://supabase.com/docs/guides/platform/backups), and **database backups do not contain stored file objects**. A database-only dump is insufficient.

Before real pilot use:

1. Create an isolated test project (within the two-project free allowance) and record source/target project IDs. Use synthetic accounts and files only.
2. With owner credentials kept outside this repo, export the application schema/data and required auth identities using Supabase's [CLI backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Encrypt the export off-site. Keep the migration, application version and an inventory of resource object keys, MIME types, sizes and SHA-256 checksums with it.
3. Download all private `pair-resources` objects separately through an owner-authorized Storage API session or controlled operator tool. Back up withdrawn/retained objects according to the retention decision; do not leave private exports under `public/` or source control.
4. Restore roles/schema/data/auth according to that documented procedure into the empty test target. Restore private bucket settings, upload each object with its original key and MIME type, and verify every checksum. Recreate secrets/auth redirect settings separately; database exports do not safely substitute for project configuration backups.
5. Sign in as an authorized member in the target; verify plans, partial actuals, meeting outcomes and a downloaded PDF. Attempt the same download as an unrelated member/admin-only/disabled account and verify denial. Check invitation retry behavior without replaying an old consumed token.
6. Record timestamps, dataset/object counts, checksums, commands and results. Stop and keep the environment test-only if either authorized restoration or isolation fails.

This exercise has **not been performed against the supplied project** because the publishable key is not owner access. Do not label the pilot production-ready until it passes. A local SQL stub test cannot prove the hosted Auth or Storage service works.

## Privacy, retention and deletion

Default eligibility is an adult-only restricted pilot. The UI includes a privacy notice and signup consent. Decide retention duration, export/delete request owner, minors policy and departed-supervisor closure before onboarding real users. Archive is not deletion. A trusted operator must process verified deletion requests without giving an administrator access to unrelated notes. Export/restore credentials and backups must be access-controlled and destroyed according to the agreed retention schedule. Do not add automated deletion until that policy is approved.
