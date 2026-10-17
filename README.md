# Cozy Palace Hotel and Restaurant

A hotel reservation prototype built with Next.js, TypeScript, Tailwind CSS, and Supabase/PostgreSQL. Customers can manage reservation drafts, staff can progress bookings, and administrators can view attributed activity.

## Current status

This is development software, not a live booking service. Dining, payment collection, purchase history, and financial report generation are not implemented. Do not use the fictional inventory for real reservations.

## Run the interface

Use Node 24 and npm:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Without Supabase configuration the app shows a setup state and cannot save bookings. There is no localStorage or in-memory substitute for reservations.

## Connect an isolated Supabase development project

1. Select a **new/empty development project** specifically for Cozy Palace. Do not run these migrations against an unrelated project.
2. Authenticate the Supabase CLI, then link to the approved development project and apply the committed migrations using the supported CLI commands. Run `npx supabase --help` and `npx supabase db push --help` for current options. The SQL can also be reviewed and applied in that project's SQL editor.
3. Apply `supabase/seed.sql`. All inventory and rates are fictional prototype fixtures.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. These are the only browser-exposed configuration values; never expose a service-role key or database password.
5. Create two verified customer test users and a staff/admin test user through Supabase Auth. A signup trigger creates the associated profile.
6. Assign a trusted employee role through the SQL editor, replacing the placeholder with that test user's actual UUID:

```sql
insert into public.staff_roles(user_id, role)
values ('ACTUAL_AUTH_USER_UUID', 'admin');
```

Do not add a self-service role assignment endpoint. Customers cannot promote themselves.

7. Allow the local app URL and `/auth/confirm` callback in Auth settings. Configure the confirmation template to supply `token_hash` and `type=email` if using the included confirmation route. The prototype signs in pre-created test accounts; public signup and password recovery are tracked for launch.

For a supported Docker local setup, `npx supabase start` and `npx supabase db reset` apply the migrations/seed to that local stack. Review CLI help first. A native Supabase runtime may also be available for your platform; do not assume it is installed.

## Verify

```sh
npm run typecheck
npm run lint
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

Import this repository and select the Next.js preset. Use `npm run build` and framework-managed output. Set the two public configuration values separately for Preview and Production, each pointing to its intended database. Set Auth redirect allowlists for the exact Preview/production URLs. No `dist`, static export or blanket SPA rewrite is needed.

This branch is not a deployed release. A configured Preview, hosted authentication tests, and native database concurrency checks are required before operational use.

### Prototype date policy

This increment accepts future check-in dates only. Same-day stays are rejected because the proposed pending-hold model ends at midnight on the arrival date. Confirm real check-in times and same-day handling before the production launch; do not advertise this prototype as supporting same-day booking.

## Contributing

Create a feature branch and open a pull request with a clear description and relevant verification results. Keep credentials, customer information, and private planning documents out of commits. Run the checks above before requesting review.
