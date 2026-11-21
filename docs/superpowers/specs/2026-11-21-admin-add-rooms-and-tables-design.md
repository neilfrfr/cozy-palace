# Admin room and table creation

## Intent

Let administrators grow bookable inventory from the existing Rooms and Restaurant Tables pages. Room types can be reused by multiple rooms; each new room is assigned to a room type. Tables are created with a unique table number and seating capacity.

## Goals and constraints

- Upgrade the existing Rooms and Restaurant Tables pages with creation controls that use their current form layouts and interaction patterns.
- Add controls for room types, rooms, and tables without introducing a separate screen or a new visual system.
- Keep the current edit forms for room type rates/capacity and table seating; creation is an addition to those pages.
- Keep all writes behind admin-authorized database functions, consistent with existing inventory updates.
- Validate input in the form action and database function, enforce unique room/table numbers, and log each creation in the activity log.
- Revalidate affected admin and public inventory pages after a successful creation.
- Use the existing schema and page design; do not add editing/deletion or bulk import in this change.

## Approaches

- **Creation controls on the existing pages (chosen):** create a room type first, then add one or more rooms under it; add tables independently. This matches the schema and supports reusing types while keeping the current admin workflow.
- **Combined room flow:** create a room type and its first room together. This reduces steps for a single room but makes reusable room types less natural.

Separate creation controls on the existing pages were selected to preserve the distinction the database already makes between room types and physical rooms while extending the UI the admin already uses.

## Implementation calls

- Room type fields: name, description, capacity, and nightly rate.
- Room fields: room number and existing room type.
- Table fields: table number and capacity.
- Use guarded RPCs for creation, with database constraints as the final authority for uniqueness and valid values; record creation in the activity log.
- Keep the UI on the existing admin inventory pages, extend their current form patterns, and follow their notices and validation patterns.

## Out of scope

Editing or deleting room types, rooms, or tables; creating a room type and room in a single transaction; bulk import; changing public booking behavior beyond making newly created inventory available through existing reads.
