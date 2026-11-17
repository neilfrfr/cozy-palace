-- FR09: email guests when an order is placed, charged to the room, or cancelled; other status changes and counter payments send nothing.
create or replace function private.notify_order() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.reservations; ev text;
begin
 if new.reservation_id is null then return null;end if;
 if tg_op='INSERT' then ev:=case when new.room_id is null then 'order_placed' else 'room_charge' end;
 elsif new.status='cancelled' and old.status<>'cancelled' then ev:='order_updated';
 end if;
 if ev is null then return null;end if;
 select * into r from public.reservations where id=new.reservation_id;
 perform private.enqueue(r,ev,new.id||':'||ev||':'||new.version,new.id);
 return null;
end $$;
