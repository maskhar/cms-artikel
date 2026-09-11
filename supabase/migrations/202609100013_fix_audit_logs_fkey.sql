-- Fix audit_logs foreign key constraint to be DEFERRABLE
-- This allows audit trigger to insert with site_id during DELETE operation

alter table artikel.audit_logs
  drop constraint audit_logs_site_id_fkey,
  add constraint audit_logs_site_id_fkey 
    foreign key (site_id) 
    references artikel.sites(id) 
    on delete set null
    deferrable initially deferred;
