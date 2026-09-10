create table artikel.api_key_rate_limits (
  api_key_id uuid primary key references artikel.api_keys(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table artikel.api_key_rate_limits enable row level security;

create or replace function artikel.consume_api_key_rate_limit(api_key_id uuid, max_requests integer, window_seconds integer)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql security definer set search_path = artikel, pg_temp as $$
declare
  current_count integer;
  current_window timestamptz;
begin
  if max_requests < 1 or window_seconds < 1 then
    raise exception 'Rate limit configuration must be positive';
  end if;

  insert into artikel.api_key_rate_limits as limits (api_key_id, window_started_at, request_count, updated_at)
  values (consume_api_key_rate_limit.api_key_id, now(), 1, now())
  on conflict (api_key_id) do update set
    window_started_at = case when limits.window_started_at <= now() - make_interval(secs => window_seconds) then now() else limits.window_started_at end,
    request_count = case when limits.window_started_at <= now() - make_interval(secs => window_seconds) then 1 else limits.request_count + 1 end,
    updated_at = now()
  returning limits.request_count, limits.window_started_at into current_count, current_window;

  return query select current_count <= max_requests, greatest(max_requests - current_count, 0), current_window + make_interval(secs => window_seconds);
end;
$$;

revoke all on function artikel.consume_api_key_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function artikel.consume_api_key_rate_limit(uuid, integer, integer) to service_role;

create or replace function artikel.audit_row_change()
returns trigger language plpgsql security definer set search_path = artikel, auth, pg_temp as $$
declare
  site uuid;
  entity uuid;
  old_data jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_data jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  changed_fields jsonb;
begin
  old_data := old_data - array['secret_hash', 'last_used_at', 'updated_at'];
  new_data := new_data - array['secret_hash', 'last_used_at', 'updated_at'];
  if tg_op = 'UPDATE' and old_data = new_data then return new; end if;

  select coalesce(jsonb_agg(key order by key) filter (where new_data -> key is distinct from old_data -> key), '[]'::jsonb)
  into changed_fields
  from (select jsonb_object_keys(old_data) as key union select jsonb_object_keys(new_data) as key) keys;

  if tg_table_name = 'article_tags' then
    entity := coalesce(new.article_id, old.article_id);
    select site_id into site from artikel.articles where id = entity;
  elsif tg_table_name = 'sites' then
    entity := coalesce(new.id, old.id);
    site := case when tg_op = 'DELETE' then null else entity end;
  else
    entity := coalesce(new.id, old.id);
    site := coalesce((new_data ->> 'site_id')::uuid, (old_data ->> 'site_id')::uuid);
  end if;

  insert into artikel.audit_logs (site_id, actor_id, action, entity_type, entity_id, metadata)
  values (site, auth.uid(), format('%s.%s', tg_table_name, lower(tg_op)), tg_table_name, entity, jsonb_build_object('changed_fields', changed_fields));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_sites after insert or update or delete on artikel.sites for each row execute function artikel.audit_row_change();
create trigger audit_categories after insert or update or delete on artikel.categories for each row execute function artikel.audit_row_change();
create trigger audit_tags after insert or update or delete on artikel.tags for each row execute function artikel.audit_row_change();
create trigger audit_articles after insert or update or delete on artikel.articles for each row execute function artikel.audit_row_change();
create trigger audit_article_tags after insert or update or delete on artikel.article_tags for each row execute function artikel.audit_row_change();
create trigger audit_api_keys after insert or update or delete on artikel.api_keys for each row execute function artikel.audit_row_change();
create trigger audit_review_comments after insert or update or delete on artikel.review_comments for each row execute function artikel.audit_row_change();
