begin;

alter table artikel.media_assets alter column site_id drop not null;
create unique index if not exists media_assets_storage_path_unique on artikel.media_assets(storage_path);

insert into artikel.media_assets (
  site_id,
  storage_path,
  file_name,
  mime_type,
  file_size,
  alt_text,
  created_by,
  created_at,
  updated_at
)
select
  null,
  objects.name,
  regexp_replace(objects.name, '^.*/', ''),
  coalesce(objects.metadata ->> 'mimetype', 'application/octet-stream'),
  coalesce((objects.metadata ->> 'size')::bigint, 0),
  regexp_replace(regexp_replace(objects.name, '^.*/', ''), '\.[^.]+$', ''),
  objects.owner_id::uuid,
  objects.created_at,
  objects.updated_at
from storage.objects as objects
where objects.bucket_id = 'artikel-media'
  and objects.owner_id is not null
  and objects.name not like '%/.emptyFolderPlaceholder'
on conflict (storage_path) do nothing;

create or replace function artikel.is_media_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from artikel.user_roles
    where user_id = auth.uid() and is_active
      and role in ('admin', 'editor', 'writer')
  );
$$;
revoke all on function artikel.is_media_member() from public;
grant execute on function artikel.is_media_member() to authenticated, service_role;

drop policy if exists "members read media assets" on artikel.media_assets;
drop policy if exists "authenticated users read global media assets" on artikel.media_assets;
create policy "authenticated users read global media assets"
on artikel.media_assets for select to authenticated
using (artikel.is_media_member());

drop policy if exists "members create media assets" on artikel.media_assets;
create policy "members create media assets" on artikel.media_assets for insert to authenticated
with check (
  artikel.is_media_member() and created_by = auth.uid()
  and exists (select 1 from storage.objects where bucket_id = 'artikel-media'
    and name = storage_path and owner_id = auth.uid()::text)
);

drop policy if exists "editors manage media assets" on artikel.media_assets;
create policy "editors manage media assets" on artikel.media_assets for update to authenticated
using (artikel.is_media_member() and created_by = auth.uid())
with check (artikel.is_media_member() and created_by = auth.uid()
  and exists (select 1 from storage.objects where bucket_id = 'artikel-media'
    and name = storage_path and owner_id = auth.uid()::text));

drop policy if exists "cms members read global media storage" on storage.objects;
create policy "cms members read global media storage" on storage.objects for select to authenticated
using (bucket_id = 'artikel-media' and artikel.is_media_member());

drop policy if exists "cms members upload global media storage" on storage.objects;
create policy "cms members upload global media storage" on storage.objects for insert to authenticated
with check (bucket_id = 'artikel-media' and artikel.is_media_member());

drop policy if exists "cms owners delete global media storage" on storage.objects;
create policy "cms owners delete global media storage" on storage.objects for delete to authenticated
using (bucket_id = 'artikel-media' and owner_id = auth.uid()::text and artikel.is_media_member());

update storage.buckets set file_size_limit = 20971520, allowed_mime_types = null where id = 'artikel-media';

notify pgrst, 'reload schema';
commit;
