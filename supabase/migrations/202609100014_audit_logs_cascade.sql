-- Change audit_logs FK constraint to CASCADE instead of SET NULL
-- This is simpler and audit logs for deleted sites should be deleted anyway

alter table artikel.audit_logs
  drop constraint audit_logs_site_id_fkey,
  add constraint audit_logs_site_id_fkey 
    foreign key (site_id) 
    references artikel.sites(id) 
    on delete cascade;
