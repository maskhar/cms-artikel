import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function createAdminClient() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function apiKeyHash(key: string) {
  const pepper = required("ARTIKEL_API_KEY_PEPPER");
  return createHash("sha256").update(`${key}:${pepper}`).digest("hex");
}
