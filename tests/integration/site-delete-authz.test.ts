import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCookies, createMockSupabase, type QueryResult } from "./supabase-mock";

/**
 * Fase 5.1 — gerbang `DELETE /api/cms/sites/[siteId]`.
 *
 * Ini lubang CRITICAL #1: sebelum remediasi, route hanya memeriksa `if (!user)`
 * lalu memakai service-role client (bypass RLS) untuk memanggil `delete_site`,
 * sehingga SETIAP user yang login bisa menghapus tenant milik orang lain
 * sekaligus jejak auditnya. Test di sini mengunci gerbangnya supaya regresi itu
 * tidak bisa kembali diam-diam.
 *
 * Yang dikunci: keputusan izin route — bukan `has_site_role` di database
 * (itu punya penegakannya sendiri lewat RLS + guard di dalam `delete_site`).
 */

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const USER = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

let serverClient: ReturnType<typeof createMockSupabase>;
let adminClient: ReturnType<typeof createMockSupabase>;
let cookieStore: ReturnType<typeof createMockCookies>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => serverClient.client,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient.client,
  apiKeyHash: (key: string) => `hash:${key}`,
}));
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

const { DELETE } = await import("@/app/api/cms/sites/[siteId]/route");

/** `params` dalam Next 16 adalah Promise. */
const route = (siteId: string) => DELETE(new Request("https://cms.test"), { params: Promise.resolve({ siteId }) });

/** Site kosong: semua hitungan dependensi nol, sehingga delete boleh lanjut. */
const emptySite: QueryResult = { data: [], count: 0, error: null };

/**
 * Siapkan dunia: apakah `has_site_role` mengizinkan, dan apakah `delete_site`
 * sempat dipanggil.
 */
function setup({ allowed, user = USER as { id: string } | null }: { allowed: boolean; user?: { id: string } | null }) {
  cookieStore = createMockCookies();
  serverClient = createMockSupabase({
    rpc: { has_site_role: { data: allowed, error: null } },
  });
  (serverClient.client.auth as { getUser: ReturnType<typeof vi.fn> }).getUser =
    vi.fn(async () => ({ data: { user } }));
  adminClient = createMockSupabase({
    tables: { articles: emptySite, categories: emptySite, tags: emptySite },
    rpc: { delete_site: { data: null, error: null } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/cms/sites/[siteId] — gerbang otorisasi", () => {
  it("menolak tanpa sesi dengan 401", async () => {
    setup({ allowed: false, user: null });
    const res = await route(SITE_A);
    expect(res.status).toBe(401);
    expect(adminClient.db.rpcCalls).toHaveLength(0);
  });

  it("menolak non-admin dengan 403", async () => {
    setup({ allowed: false });
    const res = await route(SITE_A);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Hanya admin website ini yang boleh menghapus." });
  });

  it("tidak pernah menyentuh service-role client saat izin ditolak", async () => {
    // Inti CRITICAL #1: gerbang HARUS berada sebelum createAdminClient(). Kalau
    // suatu saat dipindah ke belakang, hitungan dependensi sudah jalan lebih
    // dulu dengan hak bypass-RLS.
    setup({ allowed: false });
    await route(SITE_A);
    expect(adminClient.db.calls).toHaveLength(0);
    expect(adminClient.db.rpcCalls).toHaveLength(0);
  });

  it("memeriksa izin terhadap site yang diminta, bukan site lain", async () => {
    // Admin site A memanggil delete untuk site B: route wajib menanyakan izin
    // dengan site_id = B. Kalau yang ditanyakan A, admin A bisa menghapus B.
    setup({ allowed: false });
    await route(SITE_B);
    expect(serverClient.db.rpcCalls[0]).toMatchObject({
      name: "has_site_role",
      args: { target_site_id: SITE_B, allowed_roles: ["admin"] },
    });
  });

  it("menolak site ID non-UUID dengan 400 sebelum memanggil apa pun", async () => {
    setup({ allowed: true });
    const res = await route("bukan-uuid");
    expect(res.status).toBe(400);
    expect(serverClient.db.rpcCalls).toHaveLength(0);
  });

  it("meneruskan admin site tersebut", async () => {
    setup({ allowed: true });
    const res = await route(SITE_A);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("mengirim actor_id ke delete_site — DB memverifikasi ulang, bukan percaya aplikasi", async () => {
    // `delete_site` dipanggil lewat service-role (bypass RLS), jadi `auth.uid()`
    // di dalamnya selalu NULL. Guard di DB bergantung penuh pada actor_id ini.
    setup({ allowed: true });
    await route(SITE_A);
    expect(adminClient.db.rpcCalls).toContainEqual(
      expect.objectContaining({ name: "delete_site", args: { site_id: SITE_A, actor_id: USER.id } }),
    );
  });
});

describe("DELETE /api/cms/sites/[siteId] — guard site tidak kosong", () => {
  it("menolak 409 kalau masih ada artikel, dan tidak memanggil delete_site", async () => {
    setup({ allowed: true });
    adminClient = createMockSupabase({
      tables: {
        articles: { data: [], count: 3, error: null },
        categories: emptySite,
        tags: emptySite,
      },
      rpc: { delete_site: { data: null, error: null } },
    });
    const res = await route(SITE_A);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SITE_NOT_EMPTY");
    expect(body.dependencies.articles).toBe(3);
    expect(adminClient.db.rpcCalls).toHaveLength(0);
  });

  it("menghitung dependensi hanya untuk site yang diminta", async () => {
    setup({ allowed: true });
    await route(SITE_A);
    for (const table of ["articles", "categories", "tags"]) {
      expect(adminClient.db.callTo(table)?.filters).toContainEqual(["eq", "site_id", SITE_A]);
    }
  });
});

describe("DELETE /api/cms/sites/[siteId] — kebocoran error", () => {
  it("tidak membocorkan pesan Postgres mentah saat delete_site gagal", async () => {
    setup({ allowed: true });
    adminClient = createMockSupabase({
      tables: { articles: emptySite, categories: emptySite, tags: emptySite },
      rpc: {
        delete_site: {
          data: null,
          error: {
            code: "42501",
            message: 'new row violates row-level security policy for table "artikel.sites"',
          },
        },
      },
    });
    const res = await route(SITE_A);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("row-level security");
    expect(body).not.toContain("artikel.sites");
  });
});
