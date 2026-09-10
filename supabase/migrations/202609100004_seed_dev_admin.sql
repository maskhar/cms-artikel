alter table artikel.user_roles alter column site_id drop not null;

insert into artikel.user_roles (user_id, site_id, role)
values ('79ae741c-2a71-44bb-a97d-59f35ad0e500', null, 'admin')
on conflict (user_id, site_id, role) do nothing;
