# Admin room and table creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let administrators create room types, rooms, and restaurant tables from the existing inventory pages.

**Architecture:** Add a Supabase migration with admin-guarded creation RPCs that validate, insert, and write audit log entries. Extend the existing server action, inventory query, schemas, notices, and page forms to call those RPCs and present creation controls in the current admin pages.

**Tech Stack:** Next.js 16 Server Actions, TypeScript, Zod, Supabase Postgres SQL migrations.

**Spec:** `docs/superpowers/specs/2026-11-21-admin-add-rooms-and-tables-design.md`

## Global Constraints

- Use the existing Rooms and Restaurant Tables pages and their current form patterns.
- Keep all inventory writes behind admin-authorized RPCs and record each creation in the activity log.
- Room types have a name, description, capacity, and nightly rate; rooms have a number and room type; tables have a number and capacity.
- Revalidate affected admin and public inventory pages after successful creation.
- Do not add editing/deletion, bulk import, or a combined room-type-and-room transaction.
- Do not add or run tests as part of this implementation.

## Review Focus

- Non-admin users must not create inventory, even if they call the RPC directly; the SQL function checks `private.is_admin()`.
- Duplicate room and table numbers must be rejected by database uniqueness constraints and shown as a useful form error.
- Room types must remain creatable when no rooms exist; load room types directly instead of deriving them only from the current room list.
- Invalid capacities, prices, names, and descriptions must be rejected by both server-side schema validation and database function validation.
- New room types should receive the existing database-generated `RT-` code, and every successful creation must have an audit log entry.

---

### Task 1: Add guarded Supabase creation RPCs

**Files:**
- Create: `backend/supabase/migrations/<timestamp>_admin_inventory_creation.sql`

**Interfaces:**
- Produces `public.create_room_type(p_name text, p_description text, p_capacity integer, p_nightly_rate numeric) returns jsonb`.
- Produces `public.create_room(p_room_number text, p_room_type_id uuid) returns jsonb`.
- Produces `public.create_table(p_table_number text, p_capacity integer) returns jsonb`.

- [x] Add private security-definer functions that check `private.is_admin()`, trim and validate input, and insert into `public.room_types`, `public.rooms`, or `public.restaurant_tables`.
- [x] Enforce database-side limits: room type name 1–100 characters, description up to 500 characters, capacity 1–20, nightly rate 0–1,000,000, and room/table numbers 1–30 characters. Preserve the existing unique number and generated room-type code constraints.
- [x] Log each insert using `private.log` with actions `room_type_created`, `room_created`, and `table_created`, then return the inserted row as JSON.
- [x] Revoke direct execution on the private functions and expose authenticated public invoker wrappers that delegate to them.
- [x] Inspect the migration against existing table constraints and grant patterns; do not apply it to an external Supabase project.

### Task 2: Add inventory schemas, queries, and server actions

**Files:**
- Modify: `frontend/lib/inventory/forms.ts`
- Modify: `frontend/lib/inventory/service.ts`
- Modify: `frontend/app/actions/inventory.ts`
- Modify: `frontend/lib/reservations/errors.ts`
- Modify: `frontend/lib/activity.ts`
- Modify: `frontend/app/admin/activity/page.tsx`

**Interfaces:**
- Produces `getAdminRoomTypes(): Promise<InventoryRoomType[]>`, returning room type `id`, `code`, `name`, `description`, `capacity`, and `nightly_rate`.
- Produces `createRoomTypeAction(form: FormData)`, `createRoomAction(form: FormData)`, and `createTableAction(form: FormData)` Server Actions.

- [x] Add strict Zod schemas for the three create forms matching the migration limits.
- [x] Add `getAdminRoomTypes` using `requireStaff(true)` so unused types are available in the room selector.
- [x] In each Server Action, call `requireStaff(true)`, validate `FormData`, call its matching RPC, and revalidate `/admin/rooms`, `/admin/tables`, `/admin/activity`, `/rooms`, and `/dining` through the existing completion pattern.
- [x] Map PostgreSQL unique-violation code `23505` to a duplicate-inventory error and provide a clear message in the existing inventory notice component.
- [x] Include the three creation actions in the inventory activity filter so admins can find the new audit entries.

### Task 3: Upgrade the existing inventory pages

**Files:**
- Modify: `frontend/app/admin/rooms/page.tsx`
- Modify: `frontend/app/admin/tables/page.tsx`
- Modify: `frontend/app/globals.css`

**Interfaces:**
- Rooms page consumes `getAdminRoomTypes`, `createRoomTypeAction`, and `createRoomAction`.
- Tables page consumes `createTableAction`.

- [x] Add a room type creation form with name, description, guest capacity, and nightly rate alongside the existing room-type edit forms.
- [x] Add a room creation form with room number and a selector of all existing room types, including types with no rooms yet.
- [x] Add a table creation form with table number and seat count near the existing table capacity forms.
- [x] Reuse existing `.panel-card`, `.room-type-card`, `.capacity-grid`, and responsive form conventions; add only the CSS needed to fit the added fields on narrow screens.
- [x] Keep the existing edit and closure forms intact and ensure all labels are accessible and unique.
