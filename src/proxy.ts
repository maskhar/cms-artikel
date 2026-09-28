import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_DURATION_MS, SESSION_TIMESTAMP_KEY } from "@/lib/session-policy";

const supabaseHost = "supabase.carubra.com";

// CSP dibangun per-request (bukan di next.config.ts) karena script-src butuh
// nonce unik tiap request — 'strict-dynamic' + nonce menggantikan 'unsafe-inline'
// untuk script Next.js sendiri (RSC flight data / __next_f.push) tanpa melonggarkan
// ke script pihak ketiga mana pun. Header lain yang tak butuh nonce (HSTS, X-Frame-Options,
// dst) tetap statis di next.config.ts.
function buildCsp(nonce: string) {
  // 'unsafe-eval' HANYA di dev: React mode development memakai eval() untuk
  // rekonstruksi stack trace / fitur debug. React produksi tak pernah pakai eval,
  // jadi build produksi tetap tanpa 'unsafe-eval'.
  const devEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    // 'unsafe-inline' cuma untuk style-src: satu komponen pakai style={{}} inline
    // (atribut style, bukan <style> — nonce tidak berlaku di situ).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://" + supabaseHost,
    "font-src 'self' data:",
    "connect-src 'self' https://" + supabaseHost + " wss://" + supabaseHost,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          // Response dibuat ulang di sini, jadi x-nonce (request header) dan
          // header CSP-nya harus ikut dipasang lagi — kalau tidak, request yang
          // kebetulan me-refresh token kehilangan CSP sekaligus nonce-nya.
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set("Content-Security-Policy", csp);
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const loginPath = request.nextUrl.pathname === "/login";

  if (user) {
    // Penegakan sisi server kebijakan 6 jam — sebelumnya cuma localStorage
    // (bisa dilewati lewat devtools). Cookie ini httpOnly, klien tak bisa ubah.
    const cookieStart = request.cookies.get(SESSION_TIMESTAMP_KEY)?.value;
    const now = Date.now();
    if (cookieStart && now - parseInt(cookieStart, 10) >= SESSION_DURATION_MS) {
      await supabase.auth.signOut();
      const expired = NextResponse.redirect(new URL("/login?reason=session_expired", request.url));
      // Salin cookie sb-* yang baru dibersihkan signOut() (nempel di `response`
      // lewat setAll di atas) ke response redirect yang sebenarnya dikembalikan.
      response.cookies.getAll().forEach((cookie) => expired.cookies.set(cookie));
      expired.cookies.delete(SESSION_TIMESTAMP_KEY);
      return expired;
    }
    if (!cookieStart && !loginPath) {
      response.cookies.set(SESSION_TIMESTAMP_KEY, now.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_DURATION_MS / 1000,
      });
    }
  }

  if (!user && !loginPath) return NextResponse.redirect(new URL("/login", request.url));
  if (user && loginPath) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

// Setiap pengecualian diakhiri batas segmen (`/` atau akhir string). Tanpa itu,
// `api` juga cocok sebagai AWALAN kata: /api-keys dan /api-docs ikut lolos dari
// gerbang auth. /api-keys adalah halaman penerbitan & rotasi API key, jadi
// halaman itu sebelumnya tidak pernah dijaga proxy sama sekali. (Datanya sendiri
// tetap aman karena /api/cms/api-keys memeriksa sesi, tapi gerbangnya bolong.)
// Ditemukan 28 September 2026 lewat test matcher di src/proxy.test.ts.
export const config = {
  matcher: ["/((?!api(?:/|$)|_next/static/|_next/image/|image(?:/|$)|favicon(?:/|\.ico$)).*)"],
};
