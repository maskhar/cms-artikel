create table artikel.cms_hostnames (
  id uuid primary key default gen_random_uuid(),
  hostname text not null unique check (hostname = lower(hostname) and hostname ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'),
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  site_id uuid references artikel.sites(id) on delete set null,
  is_canonical boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cms_hostnames_one_canonical_idx on artikel.cms_hostnames(is_canonical) where is_canonical;
create trigger cms_hostnames_updated_at before update on artikel.cms_hostnames for each row execute function artikel.set_updated_at();
alter table artikel.cms_hostnames enable row level security;
grant select, insert, update, delete on artikel.cms_hostnames to authenticated, service_role;

create policy "authenticated read cms hostnames" on artikel.cms_hostnames for select to authenticated using (true);
create policy "admins manage cms hostnames" on artikel.cms_hostnames for all to authenticated
using (artikel.has_site_role(site_id, array['admin']::artikel.user_role[]))
with check (artikel.has_site_role(site_id, array['admin']::artikel.user_role[]));

insert into artikel.cms_hostnames (hostname, display_name, is_canonical)
values ('cms.carubra.com', 'Carubra CMS', true)
on conflict (hostname) do update set display_name = excluded.display_name, is_canonical = true, is_active = true;

create trigger audit_cms_hostnames after insert or update or delete on artikel.cms_hostnames
for each row execute function artikel.audit_row_change();
