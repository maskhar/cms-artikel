import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryResult, type RecordedCall } from "./supabase-mock";

/**
 * Fase 5.2 — `privileged()` di `POST /api/cms/articles/bulk`.
 *
 * Satu endpoint ini mengendalikan aksi massal sampai 100 artikel sekaligus,
 * termasuk **delete permanen**. Logika izinnya ditulis inline dalam satu baris
 * padat dengan campuran `&&`/`||` tanpa kurung, dan menangani tiga hal sekaligus:
 * admin global (`site_id is null`), admin/editor per-site, dan aksi lintas-site
 * dalam satu batch. Itu persis bentuk kode yang salahnya tidak terlihat saat
 * dibaca — jadi yang dikunci di sini adalah tabel keputusannya, bukan bentuk
 * ekspresinya.
 */

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const USER = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const ART_A = "aaaa1111-1111-4111-8111-111111111111";
const ART_B = "bbbb2222-2222-4222-8222-222222222222";

type Role = { role: "admin" | "editor" | "writer"; site_id: string | null };

let mock: ReturnType<typeof createMockSupabase>;

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mock.client }));

const { POST } = await import("@/app/api/cms/articles/bulk/route");

const body = (payload: unknown) =>
  new Request("https://cms.test/api/cms/articles/bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });

/**
 * Siapkan artikel yang "ditemukan" dan role user. `mutation` adalah hasil
 * update/delete akhir; defaultnya sukses mengubah semua artikel.
 */
function setup({
  articles,
  roles,
  user = USER as { id: string } | null,
  mutation,
}: {
  articles: Array<{ id: string; site_id: string; status: string }>;
  roles: Role[];
  user?: { id: string } | null;
  mutation?: QueryResult;
}) {
  const affected = mutation ?? { data: articles.map((a) => ({ id: a.id })), error: null };
  mock = createMockSupabase({
    tables: {
      // Rantai `articles` dipakai dua kali: pembacaan awal (select), lalu mutasi.
      articles: (call: RecordedCall) =>
        call.op === "select" ? { data: articles, error: null } : affected,
      user_roles: { data: roles, error: null },
    },
  });
  (mock.client.auth as { getUser: ReturnType<typeof vi.fn> }).getUser =
    vi.fn(async () => ({ data: { user } }));
}

const at = (siteId: string, id = ART_A) => [{ id, site_id: siteId, status: "published" }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bulk articles — prasyarat", () => {
  it("menolak tanpa sesi dengan 401", async () => {
    setup({ articles: at(SITE_A), roles: [], user: null });
    const res = await POST(body({ ids: [ART_A], action: "archive" }));
    expect(res.status).toBe(401);
  });

  it("menolak payload dengan id non-UUID", async () => {
    setup({ articles: [], roles: [] });
    const res = await POST(body({ ids: ["bukan-uuid"], action: "archive" }));
    expect(res.status).toBe(400);
  });

  it("menolak batch lebih dari 100 id — batas beban aksi massal", async () => {
    setup({ articles: [], roles: [] });
    const ids = Array.from({ length: 101 }, (_, i) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`);
    const res = await POST(body({ ids, action: "archive" }));
    expect(res.status).toBe(400);
  });

  it("hanya melihat artikel yang lolos RLS — 404 kalau kosong", async () => {
    // Pembacaan awal memakai klien ber-sesi (bukan service-role), jadi artikel
    // milik tenant lain sudah tersaring RLS sebelum cek role dijalankan.
    setup({ articles: [], roles: [{ role: "admin", site_id: null }] });
    const res = await POST(body({ ids: [ART_A], action: "archive" }));
    expect(res.status).toBe(404);
  });

  it("hanya menimbang role yang aktif", async () => {
    // Role nonaktif (mis. anggota yang di-suspend) tidak boleh ikut memberi izin.
    setup({ articles: at(SITE_A), roles: [{ role: "admin", site_id: SITE_A }] });
    await POST(body({ ids: [ART_A], action: "archive" }));
    expect(mock.db.callTo("user_roles")?.filters).toContainEqual(["eq", "is_active", true]);
  });
});

describe("bulk articles — aksi status/archive butuh admin atau editor", () => {
  const cases: Array<[string, Role[], number]> = [
    ["admin global", [{ role: "admin", site_id: null }], 200],
    ["admin site tersebut", [{ role: "admin", site_id: SITE_A }], 200],
    ["editor site tersebut", [{ role: "editor", site_id: SITE_A }], 200],
    ["admin site LAIN", [{ role: "admin", site_id: SITE_B }], 403],
    ["editor site LAIN", [{ role: "editor", site_id: SITE_B }], 403],
    ["tanpa role sama sekali", [], 403],
  ];

  it.each(cases)("archive sebagai %s → %i", async (_label, roles, status) => {
    setup({ articles: at(SITE_A), roles });
    const res = await POST(body({ ids: [ART_A], action: "archive" }));
    expect(res.status).toBe(status);
  });

  it.each(cases)("ubah status sebagai %s → %i", async (_label, roles, status) => {
    setup({ articles: at(SITE_A), roles });
    const res = await POST(body({ ids: [ART_A], action: "status", status: "published" }));
    expect(res.status).toBe(status);
  });

  it("menolak batch lintas-site kalau salah satu site tidak dikuasai", async () => {
    // Inti `siteIds.some(...)`: cukup SATU artikel di site asing untuk menolak
    // seluruh batch. Tanpa ini, satu id selundupan ikut terbawa aksi massal.
    setup({
      articles: [
        { id: ART_A, site_id: SITE_A, status: "published" },
        { id: ART_B, site_id: SITE_B, status: "published" },
      ],
      roles: [{ role: "admin", site_id: SITE_A }],
    });
    const res = await POST(body({ ids: [ART_A, ART_B], action: "archive" }));
    expect(res.status).toBe(403);
  });

  it("mengizinkan batch lintas-site kalau kedua site dikuasai", async () => {
    setup({
      articles: [
        { id: ART_A, site_id: SITE_A, status: "published" },
        { id: ART_B, site_id: SITE_B, status: "published" },
      ],
      roles: [
        { role: "editor", site_id: SITE_A },
        { role: "admin", site_id: SITE_B },
      ],
    });
    const res = await POST(body({ ids: [ART_A, ART_B], action: "archive" }));
    expect(res.status).toBe(200);
  });
});

describe("bulk articles — delete permanen butuh admin, bukan editor", () => {
  const cases: Array<[string, Role[], number]> = [
    ["admin global", [{ role: "admin", site_id: null }], 200],
    ["admin site tersebut", [{ role: "admin", site_id: SITE_A }], 200],
    ["editor site tersebut", [{ role: "editor", site_id: SITE_A }], 403],
    ["writer site tersebut", [{ role: "writer", site_id: SITE_A }], 403],
    ["admin site LAIN", [{ role: "admin", site_id: SITE_B }], 403],
  ];

  it.each(cases)("delete sebagai %s → %i", async (_label, roles, status) => {
    setup({ articles: at(SITE_A), roles });
    const res = await POST(body({ ids: [ART_A], action: "delete" }));
    expect(res.status).toBe(status);
  });

  it("editor yang ditolak delete tidak pernah menjalankan mutasi", async () => {
    setup({ articles: at(SITE_A), roles: [{ role: "editor", site_id: SITE_A }] });
    await POST(body({ ids: [ART_A], action: "delete" }));
    expect(mock.db.calls.filter((c) => c.op === "delete")).toHaveLength(0);
  });

  it("delete hanya menyentuh id yang diminta", async () => {
    setup({ articles: at(SITE_A), roles: [{ role: "admin", site_id: null }] });
    await POST(body({ ids: [ART_A], action: "delete" }));
    const del = mock.db.calls.find((c) => c.op === "delete");
    expect(del?.filters).toContainEqual(["in", "id", [ART_A]]);
  });
});

describe("bulk articles — aksi review terbuka untuk penulis", () => {
  it("writer boleh mengirim artikelnya ke review", async () => {
    // `review` sengaja tidak ada di daftar aksi ber-privilese; batasannya
    // ditegakkan RLS + filter status, bukan cek role.
    setup({
      articles: [{ id: ART_A, site_id: SITE_A, status: "draft" }],
      roles: [{ role: "writer", site_id: SITE_A }],
    });
    const res = await POST(body({ ids: [ART_A], action: "review" }));
    expect(res.status).toBe(200);
  });

  it("review dibatasi ke status draft / revision_requested", async () => {
    setup({
      articles: [{ id: ART_A, site_id: SITE_A, status: "draft" }],
      roles: [{ role: "writer", site_id: SITE_A }],
    });
    await POST(body({ ids: [ART_A], action: "review" }));
    const update = mock.db.calls.find((c) => c.op === "update");
    expect(update?.filters).toContainEqual(["in", "status", ["draft", "revision_requested"]]);
  });
});

describe("bulk articles — RLS menolak diam-diam", () => {
  it("membalas 409, bukan sukses palsu, kalau nol baris berubah", async () => {
    // Update yang ditolak RLS mengembalikan 0 baris tanpa error. Tanpa cek ini
    // UI akan melaporkan berhasil padahal tidak ada yang berubah.
    setup({
      articles: at(SITE_A),
      roles: [{ role: "admin", site_id: null }],
      mutation: { data: [], error: null },
    });
    const res = await POST(body({ ids: [ART_A], action: "archive" }));
    expect(res.status).toBe(409);
  });

  it("tidak membocorkan detail Postgres saat mutasi gagal", async () => {
    setup({
      articles: at(SITE_A),
      roles: [{ role: "admin", site_id: null }],
      mutation: {
        data: null,
        error: { code: "42501", message: 'row-level security policy for table "artikel.articles"' },
      },
    });
    const res = await POST(body({ ids: [ART_A], action: "archive" }));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("row-level security");
    expect(text).not.toContain("artikel.articles");
  });
});
