-- Function to delete site safely
-- Archives articles instead of blocking deletion
-- Keeps galleries and media_assets (they are reusable assets)

alter table artikel.galleries alter column site_id drop not null;
alter table artikel.media_assets alter column site_id drop not null;

alter table artikel.galleries
  drop constraint if exists galleries_site_id_fkey,
  add constraint galleries_site_id_fkey foreign key (site_id) references artikel.sites(id) on delete set null;

alter table artikel.media_assets
  drop constraint if exists media_assets_site_id_fkey,
  add constraint media_assets_site_id_fkey foreign key (site_id) references artikel.sites(id) on delete set null;

create or replace function artikel.delete_site(site_id uuid)
returns void
language plpgsql
security definer
set search_path = artikel, pg_catalog
as $$
begin
  -- Archive all articles for this site instead of blocking deletion
  update artikel.articles 
  set status = 'archived', archived_at = now()
  where articles.site_id = delete_site.site_id 
    and status != 'archived';
  
  -- Remove site_id from galleries and media_assets (make them orphaned/reusable)
  update artikel.galleries set site_id = null where galleries.site_id = delete_site.site_id;
  update artikel.media_assets set site_id = null where media_assets.site_id = delete_site.site_id;
  
  -- Disable audit triggers to avoid FK constraint violations
  alter table artikel.sites disable trigger audit_sites;
  alter table artikel.categories disable trigger audit_categories;
  alter table artikel.tags disable trigger audit_tags;
  alter table artikel.articles disable trigger audit_articles;
  alter table artikel.api_keys disable trigger audit_api_keys;
  alter table artikel.cms_hostnames disable trigger audit_cms_hostnames;
  
  -- Delete the site (CASCADE will handle categories, tags, user_roles, api_keys, cms_hostnames)
  delete from artikel.sites where id = delete_site.site_id;
  
  -- Re-enable audit triggers
  alter table artikel.sites enable trigger audit_sites;
  alter table artikel.categories enable trigger audit_categories;
  alter table artikel.tags enable trigger audit_tags;
  alter table artikel.articles enable trigger audit_articles;
  alter table artikel.api_keys enable trigger audit_api_keys;
  alter table artikel.cms_hostnames enable trigger audit_cms_hostnames;
  
  -- Manually log the deletion
  insert into artikel.audit_logs (site_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'sites.delete', 'sites', delete_site.site_id, '{"changed_fields": []}'::jsonb);
end;
$$;
