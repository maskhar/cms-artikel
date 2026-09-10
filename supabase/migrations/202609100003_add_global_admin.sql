alter table artikel.user_roles drop constraint user_roles_pkey;
alter table artikel.user_roles add column id uuid not null default gen_random_uuid();
alter table artikel.user_roles add constraint user_roles_pkey primary key (id);
alter table artikel.user_roles add constraint user_roles_scope_unique unique nulls not distinct (user_id, site_id, role);

insert into artikel.user_roles (user_id, site_id, role)
values ('79ae741c-2a71-44bb-a97d-59f35ad0e500', null, 'admin')
on conflict (user_id, site_id, role) do nothing;
