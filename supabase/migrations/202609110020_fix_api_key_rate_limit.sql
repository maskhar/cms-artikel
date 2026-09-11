begin;

drop function if exists artikel.consume_api_key_rate_limit(uuid, integer, integer);

create function artikel.consume_api_key_rate_limit(api_key_id uuid, max_requests integer, window_seconds integer)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = artikel, pg_temp
as $$
declare
  current_count integer;
  current_window timestamptz;
begin
  if $2 < 1 or $3 < 1 then
    raise exception 'Rate limit configuration must be positive';
  end if;

  insert into artikel.api_key_rate_limits as limits (api_key_id, window_started_at, request_count, updated_at)
  values ($1, now(), 1, now())
  on conflict on constraint api_key_rate_limits_pkey do update set
    window_started_at = case when limits.window_started_at <= now() - make_interval(secs => $3) then now() else limits.window_started_at end,
    request_count = case when limits.window_started_at <= now() - make_interval(secs => $3) then 1 else limits.request_count + 1 end,
    updated_at = now()
  returning limits.request_count, limits.window_started_at into current_count, current_window;

  return query
  select current_count <= $2,
         greatest($2 - current_count, 0),
         current_window + make_interval(secs => $3);
end;
$$;

revoke all on function artikel.consume_api_key_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function artikel.consume_api_key_rate_limit(uuid, integer, integer) to service_role;

commit;
notify pgrst, 'reload schema';

