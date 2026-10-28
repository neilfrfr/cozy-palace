-- Fictional prototype inventory. Replace only after operational data is confirmed.
insert into public.room_types(id,name,description,capacity,nightly_rate) values
('00000000-0000-4000-8000-000000000001','Garden Deluxe','A calm retreat with a king bed and garden outlook.',2,3200),
('00000000-0000-4000-8000-000000000002','Palace Suite','A generous suite with a separate space to slow down.',4,5800),
('00000000-0000-4000-8000-000000000003','Family Room','Room to settle in together, with two queen beds.',4,4600);
insert into public.rooms(id,room_number,room_type_id) values
('10000000-0000-4000-8000-000000000001','101','00000000-0000-4000-8000-000000000001'),
('10000000-0000-4000-8000-000000000002','201','00000000-0000-4000-8000-000000000002'),
('10000000-0000-4000-8000-000000000003','102','00000000-0000-4000-8000-000000000003');
-- Matches the table pins in frontend/components/table-picker.tsx (40 indoor, 18 patio seats).
insert into public.restaurant_tables(table_number,capacity) values
('T1',4),('T2',4),('T3',4),('T4',4),('T5',4),('T6',4),('T7',4),('T8',4),('T9',4),('T10',4),
('P1',4),('P2',4),('P3',4),('P4',2),('P5',2),('P6',2);
