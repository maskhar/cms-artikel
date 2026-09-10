alter table artikel.user_roles add column if not exists is_active boolean not null default true;

create or replace function artikel.has_site_role(target_site_id uuid, allowed_roles artikel.user_role[])
returns boolean language sql stable security definer set search_path = artikel, auth as $$
  select exists (
    select 1 from artikel.user_roles
    where user_id = auth.uid()
      and is_active
      and role = any(allowed_roles)
      and (site_id = target_site_id or (site_id is null and role = 'admin'))
  );
$$;
