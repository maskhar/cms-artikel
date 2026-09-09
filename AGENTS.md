## Supabase Server

Project uses self-hosted Supabase. All CMS data lives in PostgreSQL schema `artikel`.

Schema rules:

1. Use `artikel` for CMS tables, database functions, views, policies, and migrations.
2. Do not create one PostgreSQL database, schema, or physical table per website or category.
3. Model websites as tenants using `artikel.sites` and scope related records with `site_id`.
4. Public API access must be limited by a site-specific API key and return only published records for that site.
5. Enable and maintain Row Level Security for every application table exposed through Supabase APIs.

* SSH endpoint:

  `maskhar@20.20.20.173`

* SSH host alias:

  `maskhar@supabase-server`

* Supabase Docker directory:

  `~/docker/supabase/supabase-1.26.05/docker`

Before deploying, debugging, restarting, or modifying Supabase services:

1. Connect to the self-hosted server through SSH.
2. Change directory to the Supabase Docker directory.
3. Inspect the currently running Docker Compose configuration before making infrastructure changes.
4. Preserve existing services, volumes, environment variables, secrets, and unrelated applications.

Do not assume the server configuration is identical to the default Supabase repository.
