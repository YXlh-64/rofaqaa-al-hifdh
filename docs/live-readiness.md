# Live Supabase readiness audit

Audit date: **2026-11-22**, Africa/Algiers. Target:
`https://gpkysjljythifexyutlg.supabase.co`.

Aya reported that the initial migration had been applied. This bounded audit
used only the supplied publishable key and public, read-only HTTP GET requests.
No Auth user, email, invitation, pair, resource, schema, or configuration was
created or changed. Private-table requests used `limit=0` so they could not
return private rows even if access were misconfigured.

## Checks and observed responses

| Request                                            | Observed response                                                                          | What it establishes                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `GET /rest/v1/surahs?select=id,ayahs&order=id.asc` | HTTP 200; 114 rows; 6,236 total ayahs; first row `{id:1,ayahs:7}`, last `{id:114,ayahs:6}` | The live public metadata table is present, reachable, and has the expected row count and total ayahs. |
| `GET /auth/v1/settings`                            | HTTP 200                                                                                   | Auth's public settings endpoint is reachable.                                                         |
| `GET /rest/v1/profiles?select=id&limit=0`          | HTTP 401, SQLSTATE `42501`, `permission denied for table profiles`                         | Anonymous table SELECT privilege is denied; no private rows requested or received.                    |
| `GET /rest/v1/pairs?select=id&limit=0`             | HTTP 401, SQLSTATE `42501`, `permission denied for table pairs`                            | Anonymous pair-table SELECT privilege is denied.                                                      |
| `GET /rest/v1/resources?select=id&limit=0`         | HTTP 401, SQLSTATE `42501`, `permission denied for table resources`                        | Anonymous resource-metadata SELECT privilege is denied.                                               |

Public Auth settings relevant to this application:

```json
{
  "external": {
    "email": true,
    "anonymous_users": false,
    "phone": false
  },
  "disable_signup": false,
  "mailer_autoconfirm": false,
  "phone_autoconfirm": false
}
```

The response also showed all listed OAuth providers disabled. Email/password
signup is enabled and automatic email confirmation is disabled. This is
consistent with requiring email ownership confirmation; actual signup,
confirmation delivery, and sign-in still need a controlled account test.
Supabase documents the meaning of confirmation settings in its
[Auth general configuration](https://supabase.com/docs/guides/auth/general-configuration)
and [Auth service configuration](https://github.com/supabase/auth/blob/master/README.md).

The generic database error includes a hint to grant SELECT. **Do not apply that
hint to these private tables.** The denied anonymous privilege is intentional.

## What these checks do not establish

The public key cannot inspect owner-only Auth/SMTP configuration, the project's
actual plan/region/billing limits, or private policies and function definitions.
Presence of the surahs table does not prove every migration statement or later
function revision is installed. This audit made no authenticated requests and
therefore does not replace the local 72 database checks and 6 concurrency checks
or prove those same rules on the live project.

In particular, the following were not exercised here:

- Sign-up, delivered email confirmation, existing-account sign-in, recovery,
  or email-bound invitation acceptance.
- Authenticated cross-pair isolation, disabled-session revocation, supervisor
  ownership, admin boundaries, or concurrent updates on the live project.
- Actual private Storage upload/download, operation-aware signed-URL denial,
  MIME/size quotas, withdrawal, cleanup, or CDN/cache behavior.
- Database and resource-file export/restore in a separate environment.

## Owner configuration and real-use checks still needed

1. **Hosted callback URLs:** after the final hosted URL is known, set Auth's
   Site URL and redirect allowlist to that exact origin and the application
   callback/recovery paths. Keep email confirmation enabled; use Arabic email
   templates and test confirmation and recovery from the hosted site.
2. **Email delivery:** verify whether custom SMTP or a Send Email hook is
   configured. The public settings response does not reveal it. Supabase's
   default development mailer currently sends only to project-team addresses
   and has a project-wide limit of two messages/hour; general real-user signup
   therefore requires suitable configured delivery. This is a conditional
   blocker, **not evidence that this project's SMTP is missing**.
   [Official SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)
   and [hosted Auth testing guidance](https://supabase.com/docs/guides/auth/testing-auth-flows).
3. **Controlled real flow:** use accounts controlled by the tester to complete
   supervisor signup, both intended-member confirmations and invitations,
   separate daily actuals, both meeting types, a small private PDF, and account
   recovery. Confirm no additional supervisor approval is required.
4. **Owner dashboard controls:** confirm actual Free plan, selected region,
   quota/bandwidth thresholds, no paid fallback, Auth rate limits, allowed
   redirect URLs, appropriate link expiry, and public endpoint abuse controls.
5. **Live access and restoration:** repeat the two-pair/disabled/admin download
   checks in a separate test project and perform the database-plus-file restore
   drill described in [operations](operations.md) and [backend runbook](backend.md).

The public HTTP surface checked here is reachable and has the expected metadata
and anonymous-denial behavior. Hosting can proceed within Aya's authorization;
general onboarding should wait for the email-delivery and hosted callback flow
to be verified. These observations do not justify calling the full live service
production-ready.

## Reproduce without reading private data

Use the existing local environment values; no service-role key is required.
For each path above, send the publishable key in the `apikey` header and accept
JSON. Do not add a user JWT, raise the private-query limits, or change a request
to POST/PATCH/DELETE for this read-only audit. Do not log future invitation or
authentication tokens.
