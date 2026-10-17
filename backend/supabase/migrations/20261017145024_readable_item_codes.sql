-- Readable business codes supplement UUID keys. No extra business rows or tables.
create sequence private.room_type_code_seq as bigint no cycle;
create sequence private.staff_member_code_seq as bigint no cycle;
revoke all on sequence private.room_type_code_seq, private.staff_member_code_seq from public, anon, authenticated;

-- Invoker-only helper used by trusted database writes, not exposed as an API.
create function private.next_display_code(p_prefix text, p_sequence regclass, p_width integer)
returns text language plpgsql volatile security invoker set search_path = '' as $$
declare n text := nextval(p_sequence)::text;
begin
  return p_prefix || lpad(n, greatest(p_width, length(n)), '0');
end;
$$;
revoke all on function private.next_display_code(text, regclass, integer) from public, anon, authenticated;

alter table public.room_types add column code text;
alter table public.staff_members add column employee_code text;

-- Stable order for existing rows; never replace primary or foreign keys.
do $$
declare item record;
begin
  for item in select id from public.room_types order by id loop
    update public.room_types set code = private.next_display_code('RT-', 'private.room_type_code_seq'::regclass, 3) where id = item.id;
  end loop;
  for item in select id from public.staff_members order by created_at, id loop
    update public.staff_members set employee_code = private.next_display_code('EMP-', 'private.staff_member_code_seq'::regclass, 4) where id = item.id;
  end loop;
end;
$$;

alter table public.room_types
  alter column code set default private.next_display_code('RT-', 'private.room_type_code_seq'::regclass, 3),
  alter column code set not null,
  add constraint room_types_code_unique unique (code),
  add constraint room_types_code_format check (code ~ '^RT-[0-9]{3,}$');
alter table public.staff_members
  alter column employee_code set default private.next_display_code('EMP-', 'private.staff_member_code_seq'::regclass, 4),
  alter column employee_code set not null,
  add constraint staff_members_employee_code_unique unique (employee_code),
  add constraint staff_members_employee_code_format check (employee_code ~ '^EMP-[0-9]{4,}$');

comment on column public.room_types.code is 'Permanent readable room-type code; UUID remains the relational key. Sequence gaps are expected.';
comment on column public.staff_members.employee_code is 'Permanent code for this staffing record; removal and recreation produces a new code. UUID remains the relational key.';
