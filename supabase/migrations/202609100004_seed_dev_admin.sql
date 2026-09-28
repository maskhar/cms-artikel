-- Idempoten; sudah dijalankan lebih dulu di 202609100003 karena insert di sana
-- membutuhkannya. Dipertahankan agar database yang terlanjur menerima versi lama
-- 202609100003 tetap sampai ke keadaan yang sama.
alter table artikel.user_roles alter column site_id drop not null;

-- Lihat catatan di 202609100003: dikondisikan pada keberadaan user karena
-- user_id punya FK ke auth.users dan database bersih tidak memuatnya.
insert into artikel.user_roles (user_id, site_id, role)
select '79ae741c-2a71-44bb-a97d-59f35ad0e500', null, 'admin'
where exists (select 1 from auth.users where id = '79ae741c-2a71-44bb-a97d-59f35ad0e500')
on conflict (user_id, site_id, role) do nothing;
