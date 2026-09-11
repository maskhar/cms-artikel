-- Function to delete site without triggering audit log FK violations
-- Disables all audit triggers temporarily to prevent cascade issues

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
  
  -- Disable all audit triggers temporarily to avoid FK constraint violations
  alter table artikel.sites disable trigger audit_sites;
  alter table artikel.galleries disable trigger audit_galleries;
  alter table artikel.media_assets disable trigger audit_media_assets;
  alter table artikel.article_addons disable trigger audit_article_addons;
  alter table artikel.api_keys disable trigger audit_api_keys;
  alter table artikel.audit_logs disable trigger audit_audit_logs;
  alter table artikel.user_roles disable trigger audit_user_roles;
  
  -- Delete the site (CASCADE will handle related tables)
  delete from artikel.sites where id = delete_site.site_id;
  
  -- Re-enable all audit triggers
  alter table artikel.sites enable trigger audit_sites;
  alter table artikel.galleries enable trigger audit_galleries;
  alter table artikel.media_assets enable trigger audit_media_assets;
  alter table artikel.article_addons enable trigger audit_article_addons;
  alter table artikel.api_keys enable trigger audit_api_keys;
  alter table artikel.audit_logs enable trigger audit_audit_logs;
  alter table artikel.user_roles enable trigger audit_user_roles;
  
  -- Manually log the deletion to audit_logs with NULL site_id
  insert into artikel.audit_logs (site_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'sites.delete', 'sites', delete_site.site_id, '{"changed_fields": []}'::jsonb);
end;
$$;
