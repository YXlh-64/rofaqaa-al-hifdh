# رفقاء الحفظ | Rofaqa al-Hifdh

Arabic, right-to-left Qur'an memorization workspace for an existing pair and their supervisor. Built with React, TypeScript, Vite and Supabase. The visual direction is an original interpretation of the supplied lecture references: deep teal, quiet ivory, muted gold and Arabic typography.

## Run locally

Use Node.js 24 LTS (`nvm use` reads `.nvmrc`).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open the printed local URL. Choose **استكشاف النسخة التجريبية** to explore Aya Benali Khodja and fictional Maryam's workspace without creating accounts. The banner distinguishes browser-local demo records from Supabase records. Settings switches test roles. Do not put real study records in demo mode.

```bash
npm test
npm run build
npm run preview
```

## Hosting and live Supabase

The source repository is [YXlh-64/rofaqaa-al-hifdh](https://github.com/YXlh-64/rofaqaa-al-hifdh), with production branch `master`. The deployment target is **Cloudflare Pages connected to this repository**, while Supabase provides authentication, the database and private files. See the [deployment steps](docs/deployment.md).

Cloudflare builds with `npm ci && npm run build:deploy`, publishes `dist`, and applies the security response headers in `public/_headers`. Set `SKIP_DEPENDENCY_INSTALL=1` to avoid a second automatic install. `.nvmrc` pins Node.js 24. `.github/workflows/ci.yml` checks tests and the production build on pushes and pull requests. The hosting build also runs the tests before publishing each deployment.

Aya confirmed that the initial Supabase migration was applied. A subsequent [read-only live check](docs/live-readiness.md) verified the public surah metadata and anonymous denial for private tables. **Do not re-run the initial migration** on that populated project; future schema updates need separate additive migrations.

The browser uses only the project's publishable key. This key is safe to include in the frontend and does **not** authorize database migrations, admin grants or project settings. No service-role or database password belongs in any `VITE_` variable.

1. Import the existing GitHub repository into Cloudflare **Pages → Connect to Git**, preserving `master` as the production branch. Use the public values in `.env.example` for the two Vite variables.
2. After the production URL is assigned, configure Supabase's exact Site URL and redirect allowlist as explained in [deployment](docs/deployment.md). Verify confirmation/recovery email delivery; do not turn off verified email ownership for real invitations.
3. Register a supervisor and use two controlled member accounts to test each seat's invitation. The first acceptance keeps the pair pending; both acceptances activate it.
4. Complete the [acceptance checklist](docs/acceptance.md) and live private-file checks before general onboarding.

For a separate, empty development/test Supabase project only, install `supabase/migrations/202611220001_initial.sql` once as its owner. Never upload or run the local `supabase/tests/bootstrap.sql` against hosted Supabase.

## Implemented journeys

- Arabic sign-in, supervisor onboarding, recovery and invitation acceptance.
- Supervisor-owned pairs, two separately bound invitation links, rotation/revocation and archiving.
- Sunday-Saturday weeks in Africa/Algiers; individual targets and proposed/confirmed shared targets.
- Independent daily Hifdh and revision plans, explicit rest/draft choices, separate partial/completed actuals, corrections and plan-versus-actual review.
- Daily partner and weekly supervisor meetings, authorized scheduling and outcomes independent from progress.
- Private file/link resources, supervisor metadata edits/withdrawal, file/pair quota checks and authenticated downloads.
- Independent account administration, disable confirmation, audit trail and final-admin protection.

The SQL enforces access on every read/write, including already-issued sessions. Browser role visibility is only a convenience. The demo is an interaction fixture, not evidence of server authorization.

## Readiness

Verified locally: **25 application/domain tests**, **72 PostgreSQL authorization/validation checks**, **6 two-client concurrency checks**, and the production build. Database checks use actual PostgreSQL roles with minimal Supabase Auth/Storage service-contract stubs. A browser was unavailable, so desktop/mobile visual QA remains pending. The app and favicon both returned HTTP 200 during local preview checks.

Aya has authorized GitHub publication and web hosting, superseding the earlier SRS instruction to keep work local. Cloudflare account/GitHub connection and an actual production URL are still pending; repository configuration alone is not a deployed website. Hosted auth redirects, email delivery, authenticated Storage behavior and backup/restore remain live integration checks. The app remains a restricted pilot until those checks and privacy/retention decisions pass.

See [backend contract](docs/backend.md), [operations and zero-cost constraints](docs/operations.md), and [SRS coverage and launch checks](docs/acceptance.md).
