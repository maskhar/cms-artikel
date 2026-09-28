/**
 * Kebijakan umur sesi: 6 jam sejak login, ditegakkan di server (proxy.ts untuk
 * halaman, requireUser() untuk API) — bukan cuma client-side localStorage.
 * Satu sumber konstanta dipakai di semua tempat supaya tidak bisa mencong.
 */
export const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;

/** Nama cookie httpOnly (server) sekaligus key localStorage (client, untuk UX proaktif). */
export const SESSION_TIMESTAMP_KEY = "artikel_session_start";
