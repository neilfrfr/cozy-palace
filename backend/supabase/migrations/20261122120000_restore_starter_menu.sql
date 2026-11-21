-- Restore only missing starter dishes. Existing names keep their IDs, prices,
-- availability, photos, order references, and non-empty descriptions.
do $$
declare
  seed record;
  prior public.menu_items;
  saved public.menu_items;
begin
  for seed in
    select * from (values
      ('Lumpia Shooters','Appetizers',220::numeric,'Crisp Filipino spring rolls served as a lively, shareable first bite.'),
      ('Lemon Garlic Calamari','Appetizers',320::numeric,'Tender calamari brightened with lemon and savory garlic.'),
      ('Malunggay Niçoise Salad','Appetizers',280::numeric,'A fresh Niçoise inspired salad with a local malunggay touch.'),
      ('Kare-kare with Lechon Kawali','Main Course',520::numeric,'Rich Filipino kare-kare paired with crisp lechon kawali.'),
      ('Crispy Cordon Bleu','Main Course',450::numeric,'A golden, crisp take on the classic cordon bleu.'),
      ('Prawn Sinigang with Guava','Main Course',580::numeric,'Comforting prawn sinigang lifted with the gentle sweetness of guava.'),
      ('Halo-halo','Dessert',180::numeric,'A beloved Filipino shaved-ice dessert layered with colorful treats.'),
      ('Creamy Buko Tart','Dessert',150::numeric,'A smooth coconut tart in a delicate pastry shell.'),
      ('Assorted Kakanin','Dessert',160::numeric,'A selection of traditional Filipino rice delicacies.'),
      ('Premium Wine','Drinks',350::numeric,'A considered wine selection to complement your meal.'),
      ('Fresh Pineapple Juice','Drinks',120::numeric,'Bright, refreshing juice made with pineapple.'),
      ('Fruit Smoothie','Drinks',150::numeric,'A cool, blended fruit drink for a refreshing pause.')
    ) as defaults(name,section,price,description)
  loop
    select * into prior from public.menu_items where name=seed.name for update;
    if not found then
      insert into public.menu_items(name,section,price,description)
      values(seed.name,seed.section,seed.price,seed.description)
      returning * into saved;
      insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
      values(null,'System recovery migration','system','menu_item_created',saved.id,null,to_jsonb(saved));
    elsif coalesce(prior.description,'')='' then
      update public.menu_items set description=seed.description where id=prior.id
      returning * into saved;
      insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
      values(null,'System recovery migration','system','menu_item_updated',saved.id,to_jsonb(prior),to_jsonb(saved));
    end if;
  end loop;
end
$$;
