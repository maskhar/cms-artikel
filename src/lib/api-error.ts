import { NextResponse } from "next/server";

/**
 * Peta kode error Postgres -> pesan aman berbahasa Indonesia. `error.message`
 * Supabase mentah bisa membocorkan nama tabel/kolom/skema internal ke klien;
 * detail asli tetap di-log di server lewat console.error.
 *
 * Bentuk respons tetap `{ error: string }` (konvensi /api/cms/*) — JANGAN
 * pindah ke bentuk `{ code, message }` milik /api/v1/*.
 */
const CODE_MESSAGES: Record<string, { message: string; status: number }> = {
  "23505": { message: "Data sudah ada (duplikat).", status: 409 },
  "23503": { message: "Data terkait tidak ditemukan atau masih dipakai di tempat lain.", status: 409 },
  "23502": { message: "Ada data wajib yang kosong.", status: 400 },
  "22P02": { message: "Format data tidak valid.", status: 400 },
  "42501": { message: "Anda tidak berwenang melakukan aksi ini.", status: 403 },
};

export function mapDbError(
  error: unknown,
  fallback = "Permintaan tidak dapat diproses.",
  fallbackStatus = 400,
): { message: string; status: number } {
  console.error("DB error:", error);
  const code = (error as { code?: string } | null | undefined)?.code;
  return (code && CODE_MESSAGES[code]) || { message: fallback, status: fallbackStatus };
}

/**
 * Error yang pesannya memang sengaja ditujukan ke pengguna (bukan bocoran DB).
 * Dipakai di blok try/catch supaya pesan disengaja tetap lolos, sementara error
 * Postgres mentah yang nyasar ke catch yang sama tetap dipetakan jadi generik.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ApiError";
  }
}

/** Bungkus langsung jadi NextResponse — pola paling umum di rute CMS. */
export function dbErrorResponse(error: unknown, fallback?: string, fallbackStatus?: number): NextResponse {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  const { message, status } = mapDbError(error, fallback, fallbackStatus);
  return NextResponse.json({ error: message }, { status });
}
