# Deploy the existing GitHub repository on Cloudflare Pages

The source repository is [YXlh-64/rofaqaa-al-hifdh](https://github.com/YXlh-64/rofaqaa-al-hifdh), production branch `master`. Aya reports that the Supabase migration has been applied. Cloudflare account connection, GitHub authorization and the first hosted deployment are still pending; no production URL has been verified.

## Connect GitHub and build

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/) and select the intended account on the **Free** plan.
2. Go to **Workers & Pages → Create application → Pages → Connect to Git**, then choose GitHub. Authorize Cloudflare Pages for the existing `YXlh-64/rofaqaa-al-hifdh` repository and select it. Do not create a duplicate repository or choose a Workers deployment.
3. Choose **Git integration** at project creation. A [Direct Upload project cannot later switch to Git integration](https://developers.cloudflare.com/pages/get-started/direct-upload/); it would require a new project. Native Git integration gives this repository automatic deployments on pushes.
4. Confirm these settings:

   | Setting                | Value                                    |
   | ---------------------- | ---------------------------------------- |
   | Production branch      | `master`                                 |
   | Root directory         | Repository root; leave the path empty    |
   | Framework preset       | React (Vite)                             |
   | Node.js                | `24`, selected by the committed `.nvmrc` |
   | Build command          | `npm ci && npm run build:deploy`         |
   | Build output directory | `dist`                                   |

5. Add these **Production** build environment variables:

   | Name                            | Value                                                       |
   | ------------------------------- | ----------------------------------------------------------- |
   | `SKIP_DEPENDENCY_INSTALL`       | `1`                                                         |
   | `VITE_SUPABASE_URL`             | Copy the exact value from [`.env.example`](../.env.example) |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Copy the exact value from [`.env.example`](../.env.example) |

   Cloudflare normally installs dependencies automatically. `SKIP_DEPENDENCY_INSTALL=1` lets the build command run one deterministic `npm ci` install before `build:deploy`, which runs tests and the TypeScript/Vite production build. [Build image configuration](https://developers.cloudflare.com/pages/configuration/build-image/) supports both this variable and `.nvmrc`.

   Vite embeds its two public values at build time. Never add a service-role key, database password or SMTP secret to a `VITE_` variable. If the Supabase project changes, update the exact CSP `connect-src` origins in `public/_headers` too.

6. Select **Save and Deploy**, wait for a successful deployment, and record the stable production `https://…pages.dev/` address and source commit returned by Cloudflare. Use that stable address for invitations.

[Cloudflare's Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) supports the existing repository and lets you select `master` as the production branch. Production is served from the domain root, so the current Vite `/` base and hash routes need no repository subpath. The security headers in `public/_headers` are copied to `dist/_headers` and [applied by Pages to static responses](https://developers.cloudflare.com/pages/configuration/headers/).

## Configure Supabase redirects

After the stable production address exists, open Supabase **Authentication → URL Configuration**:

- Set **Site URL** to the exact production root, for example `https://YOUR-ACTUAL-PROJECT.pages.dev/`, with a trailing slash. Replace this placeholder with the returned address; it is not a claimed deployment URL.
- Add the same exact URL to **Redirect URLs**. Retain `http://localhost:5173/` only if local development is needed.
- Keep email confirmation enabled. The app constructs signup/recovery redirects from its current origin and pathname and uses fragments for navigation and invitations.

Use exact production redirect entries as recommended by [Supabase's redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls). Do not allow all `*.pages.dev` sites against the real project. For a deliberate preview auth test, allow only that controlled preview URL temporarily, preferably with an isolated test Supabase project, then remove it.

Preview builds are not a privacy boundary: this app has fallback public configuration for the supplied project even if environment variables are omitted. Disable unneeded preview branch builds or protect them with Cloudflare Access where configured, use synthetic data, and do not distribute preview invitations to pilot users. Supabase RLS remains the data authorization boundary. If preview builds are enabled, configure their build/install variables separately.

## Verify the hosted build

Run `npm ci` and `npm run build:deploy` before publishing changes. Once deployed:

1. Open the production root and favicon; verify Arabic RTL desktop/mobile rendering and that reloads on `#plan` and `#meetings` work.
2. Inspect response headers for CSP, `Referrer-Policy: no-referrer`, frame protections and `X-Content-Type-Options: nosniff`. Confirm Supabase network calls are allowed by CSP.
3. Explore the local demo, then sign out and test a controlled supervisor account. Confirm signup email, email ownership and password recovery return to the production root.
4. Create a synthetic pair, accept both email-bound invitations, save both activities, hold a meeting separately, publish a small private file and test its authorized download. Attempt access from an unrelated account and a disabled open session.
5. Record the deployment URL/commit and outcomes. Applying the migration or receiving a successful frontend build alone does not verify hosted Auth/Storage behavior. See [the acceptance checklist](acceptance.md) and [operations](operations.md) for remaining restoration and privacy decisions.

Email delivery remains a separate check. If custom SMTP has not been configured and proven, the built-in Supabase mailer may restrict recipients and rate-limit messages; follow [the operations email guidance](operations.md#authentication-email-ownership-and-recovery). Keep onboarding controlled until delivery, confirmation and recovery succeed. Do not disable verified email ownership to bypass delivery problems.

## Cost, updates and rollback

Keep the Cloudflare account on Free and use the included `pages.dev` domain. Current [Pages Free limits](https://developers.cloudflare.com/pages/platform/limits/) include 500 builds per month, one concurrent build, 20,000 site files and 25 MiB per static asset. A build times out after 20 minutes. Monitor build usage and stop unnecessary preview builds before the allowance is exhausted; do not enable a paid upgrade. This app needs no Pages Functions, Workers paid plan, paid domain or extra storage product. Pair files stay in the existing private Supabase bucket, with its independent quotas.

After Git integration is connected, pushes to `master` deploy production automatically. Check the commit's CI result and Pages build outcome. Updating build environment variables requires a new deployment.

For a bad frontend release, roll back to an available previously verified production deployment in Cloudflare, or revert the source commit and let `master` rebuild. Older deployments may expire under Pages retention limits. Frontend rollback does not undo database migrations or recover resource files; use additive schema changes and the separate backup/restore process. Stop onboarding while investigating exhausted quotas or failed authorization checks, preserving the zero-cost requirement.
