import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_DURATION_MS, SESSION_TIMESTAMP_KEY } from "@/lib/session-policy";

/**
 * Fase 5.5 — gerbang auth sisi server.
 *
 * Yang dikunci di sini adalah keputusan gerbangnya: siapa dialihkan ke mana,
 * kapan sesi kedaluwarsa ditolak, dan apakah matcher benar-benar mencakup
 * halaman terproteksi. Audit awal sempat menyatakan gerbang ini tidak
 * ter-registrasi sama sekali (CRITICAL #7); ternyata false positive, tapi
 * "gerbang ini benar-benar mengalihkan" sebelumnya memang tidak pernah
 * terkunci oleh test apa pun.
 *
 * Supabase di-mock: yang diuji logika gerbang, bukan pustaka pihak ketiga.
 */

const getUser = vi.fn();
const signOut = vi.fn(async () => undefined);
let capturedSetAll: ((items: Array<{ name: string; value: string; options?: object }>) => void) | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: (i: never[]) => void } }) => {
    capturedSetAll = opts.cookies.setAll as never;
    return { auth: { getUser, signOut } };
  },
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

const { proxy, config } = await import("./proxy");

type Cookie = { name: string; value: string };

/** NextRequest tiruan — hanya bagian yang benar-benar dipakai proxy(). */
function makeRequest(pathname: string, cookies: Cookie[] = []) {
  const url = new URL(`https://cms.test${pathname}`);
  const store = new Map(cookies.map((c) => [c.name, c]));
  return {
    url: url.toString(),
    nextUrl: url,
    headers: new Headers(),
    cookies: {
      get: (name: string) => store.get(name),
      getAll: () => [...store.values()],
      set: (name: string, value: string) => store.set(name, { name, value }),
    },
  } as never;
}

function loggedIn() {
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
}

function loggedOut() {
  getUser.mockResolvedValue({ data: { user: null } });
}

/** Lokasi redirect, atau null kalau bukan redirect. */
function redirectTo(res: Response) {
  const status = res.status;
  if (status !== 307 && status !== 302 && status !== 308) return null;
  return res.headers.get("location");
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedSetAll = null;
});

describe("proxy — gerbang tanpa sesi", () => {
  it("mengalihkan halaman terproteksi ke /login", async () => {
    loggedOut();
    expect(redirectTo(await proxy(makeRequest("/team")))).toContain("/login");
  });

  it.each(["/", "/team", "/articles", "/api-keys", "/gallery", "/sites"])(
    "mengalihkan %s ke /login",
    async (path) => {
      loggedOut();
      expect(redirectTo(await proxy(makeRequest(path)))).toContain("/login");
    },
  );

  it("membiarkan /login diakses tanpa sesi", async () => {
    loggedOut();
    expect(redirectTo(await proxy(makeRequest("/login")))).toBeNull();
  });
});

describe("proxy — gerbang dengan sesi", () => {
  it("mengalihkan /login ke beranda supaya tidak login dua kali", async () => {
    loggedIn();
    const location = redirectTo(await proxy(makeRequest("/login")));
    expect(location).not.toBeNull();
    expect(new URL(location!).pathname).toBe("/");
  });

  it("meneruskan halaman terproteksi", async () => {
    loggedIn();
    expect(redirectTo(await proxy(makeRequest("/team")))).toBeNull();
  });
});

describe("proxy — kebijakan umur sesi 6 jam", () => {
  it("menolak sesi yang sudah lewat 6 jam dan menyebut alasannya", async () => {
    loggedIn();
    const expiredAt = Date.now() - SESSION_DURATION_MS - 1000;
    const res = await proxy(
      makeRequest("/team", [{ name: SESSION_TIMESTAMP_KEY, value: String(expiredAt) }]),
    );
    const location = redirectTo(res);
    expect(location).toContain("/login");
    expect(location).toContain("reason=session_expired");
  });

  it("memanggil signOut saat sesi kedaluwarsa — bukan sekadar mengalihkan", async () => {
    loggedIn();
    const expiredAt = Date.now() - SESSION_DURATION_MS - 1000;
    await proxy(makeRequest("/team", [{ name: SESSION_TIMESTAMP_KEY, value: String(expiredAt) }]));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("meneruskan sesi yang masih di dalam 6 jam", async () => {
    loggedIn();
    const fresh = Date.now() - 60_000;
    const res = await proxy(
      makeRequest("/team", [{ name: SESSION_TIMESTAMP_KEY, value: String(fresh) }]),
    );
    expect(redirectTo(res)).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("menolak tepat pada batas 6 jam (>=, bukan >)", async () => {
    loggedIn();
    const exactly = Date.now() - SESSION_DURATION_MS;
    const res = await proxy(
      makeRequest("/team", [{ name: SESSION_TIMESTAMP_KEY, value: String(exactly) }]),
    );
    expect(redirectTo(res)).toContain("reason=session_expired");
  });

  it("memasang cookie penanda httpOnly saat sesi belum punya penanda", async () => {
    loggedIn();
    const res = await proxy(makeRequest("/team"));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(SESSION_TIMESTAMP_KEY);
    // httpOnly wajib: kalau klien bisa menulis ulang, kebijakan 6 jam bisa
    // di-reset dari devtools — persis kelemahan versi localStorage lama.
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("tidak memasang penanda di /login", async () => {
    loggedIn();
    // /login dengan sesi selalu redirect, jadi tidak boleh ada penanda baru.
    const res = await proxy(makeRequest("/login"));
    expect(res.headers.get("set-cookie") ?? "").not.toContain(SESSION_TIMESTAMP_KEY);
  });
});

describe("proxy — header keamanan per-request", () => {
  it("memasang CSP dengan nonce pada respons yang diteruskan", async () => {
    loggedIn();
    const csp = (await proxy(makeRequest("/team"))).headers.get("content-security-policy");
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("nonce berbeda tiap request — kalau tetap, CSP tak ada gunanya", async () => {
    loggedIn();
    const a = (await proxy(makeRequest("/team"))).headers.get("content-security-policy");
    const b = (await proxy(makeRequest("/team"))).headers.get("content-security-policy");
    const pick = (csp: string | null) => csp?.match(/'nonce-([^']+)'/)?.[1];
    expect(pick(a)).toBeTruthy();
    expect(pick(a)).not.toBe(pick(b));
  });

  it("mengunci direktif yang meredam XSS dan clickjacking", async () => {
    loggedIn();
    const csp = (await proxy(makeRequest("/team"))).headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("script-src tidak pernah memakai 'unsafe-inline'", async () => {
    loggedIn();
    const csp = (await proxy(makeRequest("/team"))).headers.get("content-security-policy") ?? "";
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("CSP tetap terpasang saat token di-refresh (response dibuat ulang)", async () => {
    loggedIn();
    getUser.mockImplementation(async () => {
      // Meniru @supabase/ssr yang menulis cookie saat me-refresh token; jalur ini
      // membuat ulang objek response di dalam proxy().
      capturedSetAll?.([{ name: "sb-access-token", value: "baru", options: {} }]);
      return { data: { user: { id: "user-1" } } };
    });
    const res = await proxy(makeRequest("/team", [{ name: SESSION_TIMESTAMP_KEY, value: String(Date.now()) }]));
    expect(res.headers.get("content-security-policy")).toMatch(/'nonce-/);
  });
});

describe("proxy — matcher", () => {
  // Next mencocokkan matcher secara ter-anchor ke seluruh pathname.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/", "/team", "/articles/abc", "/login", "/gallery", "/sites"])(
    "mencakup %s",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );

  // Regresi: pengecualian tanpa batas segmen membuat "api" cocok sebagai awalan
  // kata, sehingga halaman penerbitan API key lolos dari gerbang auth.
  it.each(["/api-keys", "/api-docs"])(
    "mencakup %s — nama halaman yang berawalan kata terkecualikan",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );

  it.each([
    "/api",
    "/api/cms/articles",
    "/api/v1/articles",
    "/_next/static/chunk.js",
    "/_next/image/x.png",
    "/image",
    "/image/logo.png",
    "/favicon.ico",
  ])("mengecualikan %s", (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});
