# Cozy Palace Hotel and Restaurant

A hotel reservation prototype built with Next.js, TypeScript, Tailwind CSS, and Supabase/PostgreSQL. Customers can manage reservation drafts, staff can progress bookings, and administrators can view attributed activity.

## Current status

This is development software, not a live booking service. Dining, payment collection, purchase history, and financial report generation are not implemented. Do not use the fictional inventory for real reservations.

## Repository structure

- `frontend/`: Next.js pages, components, auth integration, Server Actions, and frontend tests.
- `backend/`: Supabase configuration, migrations, seed data, database tests, and concurrency tooling.
- Root: npm workspace commands, shared lockfile, and CI.

Next.js Server Actions and server-only services stay in `frontend/` because they are compiled and deployed with Next.js. Supabase supplies the database backend; this repository does not run a separate API server.

## Run the interface

Use Node 24.16 or newer and npm:

```sh
npm ci
cp frontend/.env.example frontend/.env.local
npm run dev
```

Without Supabase configuration the app shows a setup state and cannot save bookings. There is no localStorage or in-memory substitute for reservations.

## Connect an isolated Supabase development project

1. Select a **new/empty development project** specifically for Cozy Palace. Do not run these migrations against an unrelated project.
2. Run Supabase CLI commands from `backend/`. Authenticate the Supabase CLI, then link to the approved development project and apply the committed migrations using the supported CLI commands. Run `npx supabase --help` and `npx supabase db push --help` for current options. The SQL can also be reviewed and applied in that project's SQL editor.
3. Apply `backend/supabase/seed.sql`. All inventory and rates are fictional prototype fixtures.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env.local`. These are the only browser-exposed configuration values; never expose a service-role key or database password.
5. Create two verified customer test users and a staff/admin test user through Supabase Auth. A signup trigger creates the associated profile.
6. Assign a trusted employee role through the SQL editor, replacing the placeholder with that test user's actual UUID:

```sql
insert into public.staff_roles(user_id, role)
values ('ACTUAL_AUTH_USER_UUID', 'admin');
```

Do not add a self-service role assignment endpoint. Customers cannot promote themselves.

7. Allow the local app URL and `/auth/confirm` callback in Auth settings. Configure the confirmation template to supply `token_hash` and `type=email` if using the included confirmation route. Public signup, email confirmation/resend, password recovery, profile editing, and admin-managed staff onboarding are available.

For a supported Docker local setup, `npx supabase start` and `npx supabase db reset` apply the migrations/seed to that local stack. Review CLI help first. A native Supabase runtime may also be available for your platform; do not assume it is installed.

## Verify

```sh
npm run typecheck
npm run lint
npm run test:security
npm audit
npm test
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
```

The integration suite runs the actual PostgreSQL engine in PGlite/WASM with `btree_gist`. It verifies SQL, RLS, guarded functions and persistence, with an Auth schema test fixture. It does **not** prove Supabase Auth, PostgREST behavior, network connectivity or independent concurrent backend sessions.

### Independent PostgreSQL concurrency check

Use a fresh disposable PostgreSQL database with permission to create roles, schemas and extensions. The runner refuses a database already containing reservations and never deletes it.

```sh
# Example local disposable server; password is test-only.
docker run --rm --name cozy-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cozy_test -p 5432:5432 postgres:17
# In a second terminal, after pg_isready:
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cozy_test npm run test:concurrency
```

The test creates the schema/fixtures and sends overlapping submissions from two independent connections. Exactly one must succeed. GitHub Actions runs this against a fresh PostgreSQL service. Never point this bootstrap runner at a Supabase or production project.

### Connected browser test

After setting real development Supabase configuration, provide `TEST_CUSTOMER_EMAIL` and `TEST_CUSTOMER_PASSWORD` for a disposable account and run `npm run test:e2e:connected`. Optionally set `TEST_APP_URL` to a Vercel Preview URL. This creates, reloads, edits and deletes an unpaid draft. It cannot run without that infrastructure. Also verify that customers cannot access another customer’s reservations, staff actions require an employee role, and activity logs require an administrator role.

## Database design

- Public data: room types, physical rooms and dining tables.
- Private customer data: profiles, reservations and room/table allocations, protected by RLS.
- Trusted staff roles: provisioned by an administrator, never by editable metadata.
- Writes: public invoker RPC wrappers call guarded functions in non-exposed `private`; direct writes are denied.
- Active intervals: half-open `[check_in, check_out)` with a database exclusion constraint. Drafts do not block inventory.
- Mutation checks: validated identity, ownership/role, expected version, input/capacity, server rate and atomic overlap constraints.
- Audit: append-only attribution, original/correcting actors and system-labelled hold expiry; deleting a draft keeps its audit evidence.

## Vercel

Import this repository, set the Vercel Root Directory to `frontend`, enable access to files outside the Root Directory for workspace dependencies, and select the Next.js preset. Use `npm run build` and framework-managed output. Set the two public configuration values separately for Preview and Production, each pointing to its intended database. Set Auth redirect allowlists for the exact Preview/production URLs. No `dist`, static export or blanket SPA rewrite is needed.

This branch is not a deployed release. A configured Preview, hosted authentication tests, and native database concurrency checks are required before operational use.

### Prototype date policy

This increment accepts future check-in dates only. Same-day stays are rejected because the proposed pending-hold model ends at midnight on the arrival date. Confirm real check-in times and same-day handling before the production launch; do not advertise this prototype as supporting same-day booking.

## Contributing

Create a feature branch and open a pull request with a clear description and relevant verification results. Keep credentials, customer information, and private planning documents out of commits. Run the checks above before requesting review.

### Lint dependency security

The Next.js 16.4.2 ESLint plugin's `fast-glob` dependency is scoped to a local adapter in `tools/next-eslint-glob/` through the root npm override. It uses Node.js built-in globbing, without the vulnerable `braces` dependency or a new third-party glob library. The adapter supports only Next's directory-only `globSync` call, returns only matching directories, preserves absolute paths, and rejects excessive pattern nesting and brace-expansion work before parsing. Other fast-glob APIs are deliberately unsupported.

Use `npm ci` from the repository root. Keep the shared lockfile and tooling workspace in deployments. Before changing the Next ESLint plugin version, review its glob API usage and rerun `npm run test:security`, `npm audit`, and lint from both the root and frontend workspace. The version-scoped override must be reviewed when the plugin changes.

## Accounts and staff onboarding

Apply `backend/supabase/migrations/20261017134808_account_staff_onboarding.sql` after the core migration. Existing installations need only this new migration; do not rerun the seed or core migration. Set `SITE_URL=http://localhost:3000` in `frontend/.env.local` locally, or the exact HTTPS deployment origin on Vercel. Add the corresponding `/auth/confirm` URL to Supabase Auth redirect allowlists and enable email/password signup with email confirmation.

The callback accepts PKCE `code` links and token-hash links. For a token-hash confirmation template, use `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`; for password recovery use `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`. These templates assume the app supplies a RedirectTo URL containing `?next=`. Keep the URL placeholders intact. Test actual email delivery and cookie handling with disposable accounts before using real customer details. Supabase email rate limits and delivery configuration still apply.

Create the first administrator using a verified Auth account and the trusted SQL role assignment shown above. Then sign in at `/login` and open `/admin/staff`. Create a staff record with the employee's exact email, full name, and job title. This screen does not send invitations: share the `/register` URL separately. Employees register, confirm their email, then sign in; only a matching verified email can activate the pre-approved staff record. Public signup has no role selector. Existing staff can activate on their next sign-in.

Staff CRUD includes creating/listing onboarding records, updating names and job titles, and deleting records to revoke employee privileges immediately. Email addresses are immutable; remove a pending record and create a new one to correct an address. Administrator roles cannot be demoted through this interface. Removing staff access does not delete the person's Auth account, customer bookings, or append-only audit history. Customer `/account` supports viewing/editing their own profile and changing their password; customer Auth-account deletion is not implemented.

Hotel reservation create/read/update/delete remains under `/reservations` (deletion is limited to unpaid drafts). Staff process reservation status at `/staff/reservations`; administrators review account/staff/reservation events at `/admin/activity`. Dining, payment posting, and financial reports remain outside this increment.

Optional connected staff verification uses `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` and `TEST_ONBOARD_EMAIL` / `TEST_ONBOARD_PASSWORD`. The onboarding account must be verified, disposable, and have no existing staff-directory record. `npm run test:e2e:connected` then checks staff create/read/update/delete, email-verified activation, and rejection of a still-signed-in staff session after revocation. Use only isolated test accounts. This test is skipped without those variables; hosted signup/email delivery must also be verified manually.
