import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_DURATION_MS, SESSION_TIMESTAMP_KEY } from "@/lib/session-policy";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
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

export const config = { matcher: ["/((?!api|_next/static|_next/image|image|favicon(?:/|\.ico)).*)"] };
