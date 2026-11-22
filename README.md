# رفقاء الحفظ | Rofaqa al-Hifdh

Arabic, right-to-left Qur'an memorization workspace for an existing pair and their supervisor. Built with React, TypeScript, Vite and Supabase. The visual direction is an original interpretation of the supplied lecture references: deep teal, quiet ivory, muted gold and Arabic typography.

## Run locally

Requires Node.js 22.12+ (Node.js 24 LTS recommended).

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

## Connect the supplied Supabase project

The browser uses only the project's publishable key. This key is safe to include in the frontend and does **not** authorize database migrations, admin grants or project settings. No service-role or database password belongs in any `VITE_` variable.

1. Review and apply `supabase/migrations/202611220001_initial.sql` in the Supabase SQL editor as the project owner. The migration creates the schema, validated mutation functions, row-level authorization and a **private** resource bucket.
2. Configure authentication/Arabic templates and redirect URLs as explained in [operations](docs/operations.md). Do not turn off verified email ownership for real invitations.
3. Register a supervisor; use two controlled member accounts to test each seat's invitation. The first acceptance keeps the pair pending; both acceptances activate it.
4. Run the direct database authorization checks and complete the [acceptance checklist](docs/acceptance.md) in an isolated test environment before inviting real users.

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

Work is local; nothing has been pushed or deployed, following the SRS. Applying the remote migration, verifying the project's auth/email settings, checking live storage behavior and exercising backup/restore remain owner-side integration steps. The app must remain a test deployment until those checks and privacy/retention decisions pass.

See [backend contract](docs/backend.md), [operations and zero-cost constraints](docs/operations.md), and [SRS coverage and launch checks](docs/acceptance.md).
