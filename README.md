# Cozy Palace Hotel and Restaurant

A hotel reservation prototype built with Next.js, TypeScript, Tailwind CSS, and Supabase/PostgreSQL. Customers can manage reservation drafts, staff can progress bookings, and administrators can view attributed activity.

## Current status

This is development software, not a live booking service. Live payment collection, purchase history, and financial report generation are not implemented. Do not use the fictional inventory for real reservations.

## Repository structure

- `frontend/`: Next.js pages, components, auth integration, Server Actions, and frontend tests.
- `backend/`: Supabase configuration, migrations, seed data, database tests, and concurrency tooling.
- Root: npm workspace commands, shared lockfile, and CI.

Next.js Server Actions and server-only services stay in `frontend/` because they are compiled and deployed with Next.js. Supabase supplies the database backend; this repository does not run a separate API server.

## Developer setup on a local machine

### Prerequisites

Install [Git](https://git-scm.com/downloads), [Node.js 24 LTS](https://nodejs.org/en/download) **24.16.0 or newer within the 24.x line** (npm is included), and optionally [VS Code](https://code.visualstudio.com/). Restart the terminal after installing Node. Confirm:

```sh
node --version
npm --version
git --version
```

Docker is optional when using the team's hosted Supabase development project. It is needed for the Docker-based local Supabase stack and the disposable native PostgreSQL concurrency test below. Python, a global Next.js installation, and a separate backend server are not required.

### 1. Clone and install all project dependencies

Run these commands in VS Code's terminal or your normal terminal:

```sh
git clone https://github.com/neilfrfr/cozy-palace.git
cd cozy-palace
npm ci
```

Run `npm ci` from the repository root. It installs **all three npm workspaces** from the committed lockfile; do not install frontend and backend dependencies separately. The installed tools include:

| Workspace      | Dependencies supplied by `npm ci`                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js, React, TypeScript, Tailwind CSS, Zod, Lucide icons, Supabase JS and SSR clients, Vitest, Playwright, ESLint and Prettier |
| Backend        | Supabase CLI, PGlite, PostgreSQL client and database test tools                                                                   |
| Shared tooling | The local Next.js ESLint glob adapter and shared lint dependencies                                                                |

Do not manually install different package versions or run `npm audit fix --force`. Keep `package-lock.json` committed and use a feature branch for dependency changes.

### 2. Create each developer's environment file

**Windows PowerShell:**

```powershell
Copy-Item frontend/.env.example frontend/.env.local
```

**macOS, Linux, or Git Bash:**

```sh
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=YOUR_DEVELOPMENT_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_DEVELOPMENT_PUBLISHABLE_KEY
SITE_URL=http://localhost:3000
```

Get the development project URL and publishable key from the team lead or the approved Supabase project's connection/API settings. Each developer keeps their own local file; it is ignored by Git. No root `.env` is needed. Never put a Supabase secret/service-role key or database password in this file's public variables.

When using the **already configured shared development database**, do not rerun migrations or seed data on every computer. The database owner applies schema changes once. Register an individual test account; an administrator grants employee access separately. New isolated projects need the database setup in the next section.

### 3. Start and open the prototype

From the repository root:

```sh
npm run dev
```

Open **http://localhost:3000**. Keep the terminal running and press `Ctrl+C` to stop it. Restart the server after editing environment values. If port 3000 is occupied, stop the other server or configure the selected port consistently in `SITE_URL` and Supabase's redirect allowlist.

Useful routes are `/register`, `/staff/register`, `/login`, `/rooms`, `/reservations`, `/account`, `/staff/reservations`, `/admin/staff`, and `/admin/activity`. Staff/admin routes require the corresponding database role; knowing the URL does not grant access.

Without Supabase configuration the app shows a setup state and cannot save bookings. There is no localStorage or in-memory substitute for reservations. The Next.js app runs the server actions; there is no second backend process to start.

### 4. Checks and future updates

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

The database integration tests use a disposable PGlite instance and do not need hosted Supabase credentials or Docker. To run browser tests, install Chromium once on each computer:

```sh
npx playwright install chromium
npm run test:e2e
```

On Linux, Playwright may also require system packages; use `npx playwright install --with-deps chromium`. The public browser suite expects an unconfigured Supabase environment; run it in a clean checkout without `frontend/.env.local`. For a configured app, follow the connected-test section below with disposable test accounts. Browser binaries are separate from the npm packages and may need reinstalling after a Playwright upgrade.

Before starting a new feature, commit or stash your work, update main, and create your branch:

```sh
git switch main
git pull --ff-only origin main
npm ci
git switch -c feat/your-feature
```

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

Create the first administrator using a verified Auth account and the trusted SQL role assignment shown above. Then sign in at `/login` and open `/admin/staff`. Create a staff record with the employee's exact email, full name, and job title. This screen does not send invitations: share the `/staff/register` URL separately (also linked from login and customer registration). Employees register, confirm their email, then sign in; only a matching verified email can activate the pre-approved staff record. Public signup has no role selector. Existing staff can activate on their next sign-in.

Staff CRUD includes creating/listing onboarding records, updating names and job titles, and deleting records to revoke employee privileges immediately. Email addresses are immutable; remove a pending record and create a new one to correct an address. Administrator roles cannot be demoted through this interface. Removing staff access does not delete the person's Auth account, customer bookings, or append-only audit history. Customer `/account` supports viewing/editing their own profile and changing their password; customer Auth-account deletion is not implemented.

Hotel reservation create/read/update/delete remains under `/reservations` (deletion is limited to unpaid drafts). Staff process reservation status at `/staff/reservations`; administrators review account/staff/reservation events at `/admin/activity`. Dining, payment posting, and financial reports remain outside this increment.

Optional connected staff verification uses `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` and `TEST_ONBOARD_EMAIL` / `TEST_ONBOARD_PASSWORD`. The onboarding account must be verified, disposable, and have no existing staff-directory record. `npm run test:e2e:connected` then checks staff create/read/update/delete, email-verified activation, and rejection of a still-signed-in staff session after revocation. Use only isolated test accounts. This test is skipped without those variables; hosted signup/email delivery must also be verified manually.

### Public pages and checkout

The public home, room search/details, dining, about and contact pages follow the Figma design. Rooms, prices, capacities and table states come from Supabase. Administrators can view live counts and inventory at `/admin`, `/admin/rooms` and `/admin/tables`, and manage employees at `/admin/staff`.

Customers can open checkout from their own reservation. It displays the stored reservation total. Online payment stays disabled until the three payment variables in `frontend/.env.example` are set; see below. Inventory screens are read-only. Contact details and room photographs are omitted until verified information is available. Original Figma photographs and licensed local fonts are bundled with the frontend.

### Booking without an account

When `SUPABASE_SECRET_KEY` and both Cloudflare Turnstile keys are set, a signed-out visitor can book a room (from **Choose room**) or a restaurant table (from **Dining**) without an account. They enter their name, email and mobile number and pass a Turnstile CAPTCHA, which the server re-checks with Cloudflare before it touches the database. With a real secret, the server also checks the token came from the same form (action `book_room` or `book_table`) on a hostname listed in `TURNSTILE_HOSTNAMES`; booking without an account stays off until that list is set. The app server books through `book_as_guest` or `book_table_as_guest`, database functions only the server can call. Each creates a `pending` reservation with booking source `guest_online`: a room is held until staff confirm it or the check-in day, a table until staff confirm it or the seating starts. Each IP address can make 5 bookings per hour, and each email can hold 2 pending bookings at once. The visitor sees their booking reference on screen and gets the details by email from the hotel's Gmail account (when `GMAIL_USER` and `GMAIL_APP_PASSWORD`, a Google app password, are set). The email is sent after the response, so it never delays or undoes the booking. Visitors have no page to view, cancel or pay for the booking: they contact the front desk with the reference, and online payment is for account holders only. Staff and admins see these bookings in the queue and the table list as "Online guest (no account)", can filter the queue to them, change the stay and correct the guest's contact details (the email and phone can be corrected but not removed), and move them through confirmation, check-in or seating as with any booking. Without the Turnstile keys, booking without an account stays off and visitors are asked to sign in. For local testing use Cloudflare's always-pass test keys listed in `frontend/.env.example`. Signed-in customers find their own bookings on **My Reservations** with the **Find my reservation** box, which searches their rooms and tables by reference. Migrations: `backend/supabase/migrations/20261029100000_online_guest_bookings.sql` and `20261029120000_guest_email_only.sql`. Tests: `backend/tests/integration/online-guest-bookings.test.ts` and `frontend/tests/unit/guest-bookings.test.ts`.

### Online payment (PayMongo, test mode)

A submitted (pending) reservation with an active hold can be paid through PayMongo's hosted checkout (GCash, Maya or card). Card and wallet details never reach this app. The amount always comes from the stored total. A payment is recorded as paid only when PayMongo's signed `checkout_session.payment.paid` webhook arrives at `/api/paymongo/webhook`, not when the customer returns from checkout. Paying never confirms a booking: staff confirm every customer and visitor booking, and a confirmed, unpaid stay can still be paid. A payment whose amount does not match, that arrives after a pending hold lapsed, or that pays an already-paid stay is stored with status `review` for staff to refund. Pending room requests are held until check-in day; table requests until the seating starts.

1. Apply `backend/supabase/migrations/20261029090000_payments.sql`.
2. Locally, set `PAYMONGO_SECRET_KEY=sk_test_…` and `SUPABASE_SECRET_KEY` in `frontend/.env.local`, plus any non-empty `PAYMONGO_WEBHOOK_SECRET`. The button then opens PayMongo, but webhooks cannot reach localhost, so the stay stays pending.
3. On Vercel, set the same variables for **Preview only**. In the PayMongo dashboard (test mode), add a webhook to `https://<preview-host>/api/paymongo/webhook` for `checkout_session.payment.paid` and use its secret as `PAYMONGO_WEBHOOK_SECRET`. If Deployment Protection is on, the webhook needs a protection bypass.
4. Pay with a test card (`4343434343434345` succeeds; `5100000000000198` declines for insufficient funds) or pick GCash/Maya and press Authorize or Fail on PayMongo's test page.

Without a PayMongo account, set `PAYMONGO_SECRET_KEY=sk_test_placeholder` and any `PAYMONGO_WEBHOOK_SECRET` locally. Clicking **Pay with PayMongo** then shows an error, but it still opens the payment row. Run `npm run simulate:payment -- CP-XXXXXXXXXXXX` while `npm run dev` is running to send a signed paid event to the local webhook. Add an amount in pesos after the reference (for example `1`) to check that a wrong amount goes to `review`. The script only posts to localhost.

`sk_live_` keys are ignored outside Vercel Production. Covered by `tests/unit/payments.test.ts` (signature, parsing, key guard, webhook responses) and `backend/tests/integration/payments.test.ts` (ownership, amounts, replays, holds, permissions).

### Staff operations and management dashboards

Staff sign in to `/staff`; administrators sign in to `/admin`. Employees use the operational reservation queue at `/staff/reservations` and create guest bookings at `/staff/reservations/new`. Customers keep their own booking flow at `/reservations`. Employee accounts cannot create personal customer bookings, including through direct customer RPC calls.

Apply the new migrations in filename order after the existing three migrations:

1. `backend/supabase/migrations/20261018150337_role_guest_bookings.sql`
2. `backend/supabase/migrations/20261018150421_operational_queue.sql`

These migrations preserve existing reservation owners/references and add staff-entered guest snapshots and employee attribution to the same reservation ledger. A staff guest booking has no customer Auth account and no employee customer ownership. Confirming it atomically blocks the room and records the employee; customer online bookings and guest bookings share conflict protection. Guest name is required; email/phone are optional. Same-day staff arrivals are supported. Confirmation is not a payment record.

Demo: sign in as staff, open New guest booking, enter guest/stay details, review the server quote and confirm. Reload its CP-reference detail, edit a permitted future/current booking, then cancel or progress through check-in and completion as allowed. A future reservation cannot be checked in early. Use disposable guest data. Administrators review the source, employee actor and resulting activity without using customer checkout.

The dashboard shows actual pending confirmations, arrivals, checked-in stays, status totals, staff records and inventory counts. The hotel queue is shared; it does not claim individual task assignment. Inventory lists remain read-only. Payments, financial reports and restaurant booking operations remain outside this increment. Migrations must be installed before using these screens.
