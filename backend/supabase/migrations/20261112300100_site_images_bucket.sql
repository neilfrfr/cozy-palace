-- Public bucket for website photos, served by URL; only admins upload. JPEG/PNG/WebP up to 5 MB.
-- No select policy: public URLs need none, and it would let anyone list the bucket.
-- Guarded so plain-Postgres test databases without Supabase Storage still apply every migration.
do $do$
begin
 if to_regclass('storage.buckets') is null then return; end if;
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('site-images','site-images',true,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
 execute $p$create policy site_images_insert on storage.objects for insert to authenticated with check(bucket_id='site-images' and private.is_admin())$p$;end $do$;
