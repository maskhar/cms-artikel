update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = null
where id = 'artikel-media';

drop policy if exists "members read media assets" on artikel.media_assets;
drop policy if exists "members create media assets" on artikel.media_assets;
drop policy if exists "editors manage media assets" on artikel.media_assets;
drop policy if exists "editors delete media assets" on artikel.media_assets;

create policy "members read media assets"
on artikel.media_assets for select to authenticated
using (
  (site_id is null and created_by = auth.uid())
  or artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
);

create policy "members create media assets"
on artikel.media_assets for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    site_id is null
    or artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[])
  )
);

create policy "editors manage media assets"
on artikel.media_assets for update to authenticated
using (
  created_by = auth.uid()
  or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
)
with check (
  created_by = auth.uid()
  or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
);

create policy "editors delete media assets"
on artikel.media_assets for delete to authenticated
using (
  created_by = auth.uid()
  or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])
);
