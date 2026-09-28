alter table artikel.user_roles drop constraint user_roles_pkey;
alter table artikel.user_roles add column id uuid not null default gen_random_uuid();
alter table artikel.user_roles add constraint user_roles_pkey primary key (id);
alter table artikel.user_roles add constraint user_roles_scope_unique unique nulls not distinct (user_id, site_id, role);

-- site_id mewarisi NOT NULL dari primary key komposit di 202609100001. Melepas
-- primary key tidak ikut melepas NOT NULL itu, jadi insert global admin di bawah
-- (site_id null) selalu gagal pada database bersih:
--   null value in column "site_id" of relation "user_roles" violates not-null
-- 202609100004 sudah melakukan drop not null, tapi baru SETELAH insert ini.
-- Dipindahkan ke sini; pernyataannya idempoten sehingga 202609100004 tetap aman.
alter table artikel.user_roles alter column site_id drop not null;

-- Seed admin global untuk lingkungan dev. Dikondisikan pada keberadaan user:
-- user_id punya FK ke auth.users, dan database bersih tidak memuat user ini.
insert into artikel.user_roles (user_id, site_id, role)
select '79ae741c-2a71-44bb-a97d-59f35ad0e500', null, 'admin'
where exists (select 1 from auth.users where id = '79ae741c-2a71-44bb-a97d-59f35ad0e500')
on conflict (user_id, site_id, role) do nothing;
