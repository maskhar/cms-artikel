import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type RecordedCall } from "./supabase-mock";

/**
 * Fase 5.3 — `authenticatePublicApiKey` di `src/lib/public-api.ts`.
 *
 * Ini satu-satunya gerbang untuk Public Read API: sekali lolos, pemanggil
 * membaca lewat service-role client yang bypass RLS. Jadi setiap syarat di sini
 * (hash, pencabutan, kedaluwarsa, site nonaktif, rate limit) adalah penegakan
 * terakhir — tidak ada lapis di bawahnya.
 *
 * Perhatian khusus pada dua hal yang mudah rusak diam-diam:
 * - key **mentah** tidak boleh pernah dipakai sebagai filter; yang dicocokkan
 *   harus hash ber-pepper;
 * - rate limit harus **fail-closed** — RPC gagal berarti tolak, bukan lewatkan.
 */

const SITE = "11111111-1111-4111-8111-111111111111";
const KEY_ID = "kkkkkkkk-kkkk-4kkk-8kkk-kkkkkkkkkkkk";
const RAW_KEY = "artikel_live_rahasia";

let mock: ReturnType<typeof createMockSupabase>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mock.client,
  apiKeyHash: (key: string) => `sha256:${key}:pepper`,
}));

const { authenticatePublicApiKey } = await import("@/lib/public-api");

type RateLimit = { allowed: boolean; remaining: number; reset_at: string };

const okLimit = (over: Partial<RateLimit> = {}): RateLimit => ({
  allowed: true,
  remaining: 119,
  reset_at: new Date(Date.now() + 60_000).toISOString(),
  ...over,
});

function setup({
  apiKey = { id: KEY_ID, site_id: SITE, sites: { is_active: true } } as unknown,
  limit = okLimit(),
  limitError = null as unknown,
}: {
  apiKey?: unknown;
  limit?: RateLimit | null;
  limitError?: unknown;
} = {}) {
  mock = createMockSupabase({
    tables: {
      api_keys: (call: RecordedCall) =>
        call.op === "select" ? { data: apiKey, error: null } : { data: null, error: null },
    },
    rpc: { consume_api_key_rate_limit: { data: limit, error: limitError } },
  });
}

/** Ambil status dari hasil — sukses bukan Response, jadi dianggap 200. */
async function statusOf(result: Awaited<ReturnType<typeof authenticatePublicApiKey>>) {
  return result instanceof Response ? result.status : 200;
}

async function codeOf(result: Awaited<ReturnType<typeof authenticatePublicApiKey>>) {
  if (!(result instanceof Response)) return null;
  return (await result.json()).error?.code ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public API key — key hilang atau tidak dikenal", () => {
  it("menolak key null dengan 401 tanpa menyentuh database", async () => {
    setup();
    const result = await authenticatePublicApiKey(null);
    expect(await statusOf(result)).toBe(401);
    expect(await codeOf(result)).toBe("INVALID_API_KEY");
    expect(mock.db.calls).toHaveLength(0);
  });

  it("menolak key kosong", async () => {
    setup();
    expect(await statusOf(await authenticatePublicApiKey(""))).toBe(401);
  });

  it("menolak key yang tidak cocok dengan hash mana pun", async () => {
    setup({ apiKey: null });
    const result = await authenticatePublicApiKey(RAW_KEY);
    expect(await statusOf(result)).toBe(401);
    expect(await codeOf(result)).toBe("INVALID_API_KEY");
  });

  it("pesan penolakan tidak membedakan 'tidak ada' dari 'kedaluwarsa'", async () => {
    // Pesan yang membedakan keduanya memberi penyerang oracle untuk menebak
    // key mana yang pernah ada.
    setup({ apiKey: null });
    const result = await authenticatePublicApiKey(RAW_KEY);
    const body = result instanceof Response ? await result.json() : null;
    expect(body.error.message).toBe("API key tidak valid atau telah kedaluwarsa.");
  });
});

describe("public API key — pencocokan hash", () => {
  it("mencocokkan secret_hash, tidak pernah key mentah", async () => {
    setup();
    await authenticatePublicApiKey(RAW_KEY);
    const filters = mock.db.callTo("api_keys")?.filters ?? [];
    expect(filters).toContainEqual(["eq", "secret_hash", `sha256:${RAW_KEY}:pepper`]);
    // Kalau key mentah sampai jadi nilai filter, berarti kolomnya menyimpan
    // plaintext — bocornya dump database langsung berarti bocornya semua key.
    for (const [, , value] of filters) {
      expect(value).not.toBe(RAW_KEY);
    }
  });

  it("menyaring key yang sudah dicabut lewat revoked_at is null", async () => {
    setup();
    await authenticatePublicApiKey(RAW_KEY);
    expect(mock.db.callTo("api_keys")?.filters).toContainEqual(["is", "revoked_at", null]);
  });

  it("menyaring key kedaluwarsa terhadap waktu sekarang", async () => {
    setup();
    await authenticatePublicApiKey(RAW_KEY);
    const or = mock.db.callTo("api_keys")?.filters.find(([method]) => method === "or");
    expect(or?.[1]).toMatch(/^expires_at\.is\.null,expires_at\.gt\./);
    // Batasnya harus waktu sekarang, bukan konstanta yang ikut basi.
    const iso = String(or?.[1]).split("expires_at.gt.")[1];
    expect(Math.abs(Date.parse(iso) - Date.now())).toBeLessThan(5_000);
  });
});

describe("public API key — status site", () => {
  it("menolak site nonaktif dengan 403", async () => {
    setup({ apiKey: { id: KEY_ID, site_id: SITE, sites: { is_active: false } } });
    const result = await authenticatePublicApiKey(RAW_KEY);
    expect(await statusOf(result)).toBe(403);
    expect(await codeOf(result)).toBe("SITE_INACTIVE");
  });

  it("menolak saat relasi site tidak terbaca sama sekali", async () => {
    // Fail-closed: embed kosong berarti status site tidak diketahui.
    setup({ apiKey: { id: KEY_ID, site_id: SITE, sites: null } });
    expect(await statusOf(await authenticatePublicApiKey(RAW_KEY))).toBe(403);
  });

  it("menerima embed berbentuk objek — bentuk yang benar-benar dikirim PostgREST", async () => {
    // Regresi: embed to-one mengembalikan OBJEK, bukan array. Kode yang hanya
    // menangani array menolak setiap key yang sah.
    setup({ apiKey: { id: KEY_ID, site_id: SITE, sites: { is_active: true } } });
    expect(await statusOf(await authenticatePublicApiKey(RAW_KEY))).toBe(200);
  });

  it("tetap menerima embed berbentuk array", async () => {
    setup({ apiKey: { id: KEY_ID, site_id: SITE, sites: [{ is_active: true }] } });
    expect(await statusOf(await authenticatePublicApiKey(RAW_KEY))).toBe(200);
  });
});

describe("public API key — rate limit", () => {
  it("menolak 429 dengan Retry-After saat kuota habis", async () => {
    const resetAt = new Date(Date.now() + 30_000).toISOString();
    setup({ limit: { allowed: false, remaining: 0, reset_at: resetAt } });
    const result = await authenticatePublicApiKey(RAW_KEY);
    expect(await statusOf(result)).toBe(429);
    expect(await codeOf(result)).toBe("RATE_LIMITED");
    const retry = (result as Response).headers.get("Retry-After");
    expect(Number(retry)).toBeGreaterThan(0);
    expect(Number(retry)).toBeLessThanOrEqual(31);
  });

  it("fail-closed saat RPC rate limit error — bukan dilewatkan", async () => {
    // Kalau error diperlakukan sebagai "lanjut saja", rate limit hilang persis
    // ketika database sedang tertekan, yaitu saat paling dibutuhkan.
    setup({ limit: null, limitError: { message: "deadlock detected" } });
    const result = await authenticatePublicApiKey(RAW_KEY);
    expect(await statusOf(result)).toBe(500);
    expect(await codeOf(result)).toBe("INTERNAL_ERROR");
  });

  it("fail-closed saat RPC mengembalikan null tanpa error", async () => {
    setup({ limit: null });
    expect(await statusOf(await authenticatePublicApiKey(RAW_KEY))).toBe(500);
  });

  it("tidak membocorkan pesan database ke pemanggil", async () => {
    setup({ limit: null, limitError: { message: 'relation "artikel.api_key_rate_limits" tidak ada' } });
    const result = await authenticatePublicApiKey(RAW_KEY);
    const body = JSON.stringify(await (result as Response).json());
    expect(body).not.toContain("api_key_rate_limits");
  });

  it("menghitung kuota per api key, bukan per site", async () => {
    // Per-site berarti satu key sibuk menghabiskan kuota key lain di site yang sama.
    setup();
    await authenticatePublicApiKey(RAW_KEY);
    expect(mock.db.rpcCalls[0]).toMatchObject({
      name: "consume_api_key_rate_limit",
      args: { api_key_id: KEY_ID },
    });
  });

  it("menerima bentuk hasil RPC berupa array satu baris", async () => {
    setup({ limit: [okLimit()] as unknown as RateLimit });
    expect(await statusOf(await authenticatePublicApiKey(RAW_KEY))).toBe(200);
  });
});

describe("public API key — jalur sukses", () => {
  it("mengembalikan apiKey beserta header kuota", async () => {
    setup({ limit: okLimit({ remaining: 42 }) });
    const result = await authenticatePublicApiKey(RAW_KEY);
    expect(result).not.toBeInstanceOf(Response);
    const { apiKey, headers } = result as { apiKey: { id: string; site_id: string }; headers: Headers };
    expect(apiKey).toMatchObject({ id: KEY_ID, site_id: SITE });
    expect(headers.get("X-RateLimit-Remaining")).toBe("42");
    expect(headers.get("X-RateLimit-Limit")).toBe("120");
    expect(Number(headers.get("X-RateLimit-Reset"))).toBeGreaterThan(Date.now() / 1000 - 1);
  });

  it("mencatat last_used_at hanya setelah semua pemeriksaan lolos", async () => {
    setup();
    await authenticatePublicApiKey(RAW_KEY);
    const update = mock.db.calls.find((c) => c.table === "api_keys" && c.op === "update");
    expect(update?.filters).toContainEqual(["eq", "id", KEY_ID]);
  });

  it("tidak mencatat last_used_at saat key ditolak", async () => {
    setup({ apiKey: null });
    await authenticatePublicApiKey(RAW_KEY);
    expect(mock.db.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("tidak mencatat last_used_at saat kena rate limit", async () => {
    setup({ limit: { allowed: false, remaining: 0, reset_at: new Date(Date.now() + 10_000).toISOString() } });
    await authenticatePublicApiKey(RAW_KEY);
    expect(mock.db.calls.some((c) => c.op === "update")).toBe(false);
  });
});
