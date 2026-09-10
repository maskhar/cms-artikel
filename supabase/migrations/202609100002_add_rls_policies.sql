create or replace function artikel.has_site_role(target_site_id uuid, allowed_roles artikel.user_role[])
returns boolean language sql stable security definer set search_path = artikel, auth as $$
  select exists (
    select 1 from artikel.user_roles
    where user_id = auth.uid()
      and role = any(allowed_roles)
      and (site_id = target_site_id or (site_id is null and role = 'admin'))
  );
$$;
grant execute on function artikel.has_site_role(uuid, artikel.user_role[]) to authenticated;

create policy "users read assigned roles" on artikel.user_roles for select to authenticated using (user_id = auth.uid() or artikel.has_site_role(site_id, array['admin']::artikel.user_role[]));
create policy "admins manage roles" on artikel.user_roles for all to authenticated using (artikel.has_site_role(site_id, array['admin']::artikel.user_role[])) with check (artikel.has_site_role(site_id, array['admin']::artikel.user_role[]));
create policy "site members read sites" on artikel.sites for select to authenticated using (artikel.has_site_role(id, array['admin','editor','writer']::artikel.user_role[]));
create policy "admins manage sites" on artikel.sites for all to authenticated using (artikel.has_site_role(id, array['admin']::artikel.user_role[])) with check (artikel.has_site_role(id, array['admin']::artikel.user_role[]));
create policy "members read categories" on artikel.categories for select to authenticated using (artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]));
create policy "editors manage categories" on artikel.categories for all to authenticated using (artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])) with check (artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
create policy "members read articles" on artikel.articles for select to authenticated using (author_id = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
create policy "writers create own articles" on artikel.articles for insert to authenticated with check (author_id = auth.uid() and artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]));
create policy "authors and editors update articles" on artikel.articles for update to authenticated using (author_id = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])) with check (author_id = auth.uid() or artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
create policy "editors delete articles" on artikel.articles for delete to authenticated using (artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
create policy "members read tags" on artikel.tags for select to authenticated using (artikel.has_site_role(site_id, array['admin','editor','writer']::artikel.user_role[]));
create policy "editors manage tags" on artikel.tags for all to authenticated using (artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[])) with check (artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
create policy "members manage article tags" on artikel.article_tags for all to authenticated using (exists (select 1 from artikel.articles a where a.id = article_id and (a.author_id = auth.uid() or artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[])))) with check (exists (select 1 from artikel.articles a where a.id = article_id and (a.author_id = auth.uid() or artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[]))));
create policy "members read revisions" on artikel.article_revisions for select to authenticated using (exists (select 1 from artikel.articles a where a.id = article_id and (a.author_id = auth.uid() or artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[]))));
create policy "authors add revisions" on artikel.article_revisions for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from artikel.articles a where a.id = article_id and (a.author_id = auth.uid() or artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[]))));
create policy "members read comments" on artikel.review_comments for select to authenticated using (exists (select 1 from artikel.articles a where a.id = article_id and (a.author_id = auth.uid() or artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[]))));
create policy "editors add comments" on artikel.review_comments for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from artikel.articles a where a.id = article_id and artikel.has_site_role(a.site_id, array['admin','editor']::artikel.user_role[])));
create policy "admins manage api keys" on artikel.api_keys for all to authenticated using (artikel.has_site_role(site_id, array['admin']::artikel.user_role[])) with check (artikel.has_site_role(site_id, array['admin']::artikel.user_role[]));
create policy "members read audit logs" on artikel.audit_logs for select to authenticated using (artikel.has_site_role(site_id, array['admin','editor']::artikel.user_role[]));
