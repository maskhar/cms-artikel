-- Function to delete site without triggering audit log
-- This prevents FK constraint violation when audit trigger tries to insert with deleted site_id

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
  
  -- Disable audit trigger temporarily
  alter table artikel.sites disable trigger audit_sites;
  
  -- Delete the site (CASCADE will handle related tables)
  delete from artikel.sites where id = delete_site.site_id;
  
  -- Re-enable audit trigger
  alter table artikel.sites enable trigger audit_sites;
  
  -- Manually log the deletion to audit_logs with NULL site_id
  insert into artikel.audit_logs (site_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'sites.delete', 'sites', delete_site.site_id, '{"changed_fields": []}'::jsonb);
end;
$$;

-- Grant execute to authenticated users (will be protected by route-level auth)
grant execute on function artikel.delete_site(uuid) to authenticated, service_role;
