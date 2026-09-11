-- Function to delete site without triggering audit log FK violations
-- Only disables audit triggers that actually exist

create or replace function artikel.delete_site(site_id uuid)
returns void
language plpgsql
security definer
set search_path = artikel, pg_catalog
as $$
begin
  -- Delete gallery_items first (they reference media_assets with RESTRICT)
  delete from artikel.gallery_items 
  where gallery_id in (select id from artikel.galleries where galleries.site_id = delete_site.site_id);
  
  -- Disable audit triggers that exist to avoid FK constraint violations
  alter table artikel.sites disable trigger audit_sites;
  alter table artikel.api_keys disable trigger audit_api_keys;
  alter table artikel.cms_hostnames disable trigger audit_cms_hostnames;
  
  -- Delete the site (CASCADE will handle related tables)
  delete from artikel.sites where id = delete_site.site_id;
  
  -- Re-enable audit triggers
  alter table artikel.sites enable trigger audit_sites;
  alter table artikel.api_keys enable trigger audit_api_keys;
  alter table artikel.cms_hostnames enable trigger audit_cms_hostnames;
  
  -- Manually log the deletion to audit_logs with NULL site_id
  insert into artikel.audit_logs (site_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'sites.delete', 'sites', delete_site.site_id, '{"changed_fields": []}'::jsonb);
end;
$$;
