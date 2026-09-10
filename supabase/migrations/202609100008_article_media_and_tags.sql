insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artikel-media', 'artikel-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function artikel.article_tag_site_matches()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from artikel.articles article
    join artikel.tags tag on tag.id = new.tag_id
    where article.id = new.article_id and article.site_id = tag.site_id
  ) then
    raise exception 'Tag must belong to the same site as its article';
  end if;
  return new;
end;
$$;

drop trigger if exists article_tags_site_matches on artikel.article_tags;
create trigger article_tags_site_matches before insert or update on artikel.article_tags
for each row execute function artikel.article_tag_site_matches();

create or replace function artikel.storage_site_id(path text)
returns uuid language sql immutable as $$
  select case
    when (storage.foldername(path))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(path))[1]::uuid
  end;
$$;

create policy "members read article media" on storage.objects for select to authenticated
using (bucket_id = 'artikel-media' and artikel.has_site_role(artikel.storage_site_id(name), array['admin','editor','writer']::artikel.user_role[]));

create policy "members upload article media" on storage.objects for insert to authenticated
with check (bucket_id = 'artikel-media' and owner_id = auth.uid() and artikel.has_site_role(artikel.storage_site_id(name), array['admin','editor','writer']::artikel.user_role[]));

create policy "owners update article media" on storage.objects for update to authenticated
using (bucket_id = 'artikel-media' and owner_id = auth.uid() and artikel.has_site_role(artikel.storage_site_id(name), array['admin','editor','writer']::artikel.user_role[]))
with check (bucket_id = 'artikel-media' and owner_id = auth.uid() and artikel.has_site_role(artikel.storage_site_id(name), array['admin','editor','writer']::artikel.user_role[]));

create policy "owners delete article media" on storage.objects for delete to authenticated
using (bucket_id = 'artikel-media' and owner_id = auth.uid() and artikel.has_site_role(artikel.storage_site_id(name), array['admin','editor','writer']::artikel.user_role[]));
