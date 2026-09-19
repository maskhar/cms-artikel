import { describe, expect, it, vi } from "vitest";
import { ApiError, dbErrorResponse, mapDbError } from "./api-error";

describe("mapDbError", () => {
  it("memetakan kode Postgres ke pesan aman, bukan error.message mentah", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const leaky = { code: "23505", message: 'duplicate key value violates unique constraint "articles_site_id_slug_key"' };
    const mapped = mapDbError(leaky);
    expect(mapped.status).toBe(409);
    expect(mapped.message).not.toContain("articles_site_id_slug_key");
    expect(mapped.message).not.toContain("duplicate key");
  });
});

describe("dbErrorResponse", () => {
  it("error tak dikenal jatuh ke pesan generik, nama tabel tidak bocor", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = dbErrorResponse({ code: "XX999", message: 'relation "artikel.secret_table" does not exist' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("secret_table");
  });

  it("42501 (RLS menolak) jadi 403, detail policy tidak bocor", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = dbErrorResponse({ code: "42501", message: 'new row violates row-level security policy for table "articles"' });
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("row-level security");
  });

  it("ApiError lolos apa adanya — pesannya memang ditujukan ke pengguna", async () => {
    const res = dbErrorResponse(new ApiError("Tag tidak valid untuk website ini."));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Tag tidak valid untuk website ini.");
  });

  it("bentuk respons tetap { error: string } (konvensi /api/cms/*)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await dbErrorResponse({ code: "23502", message: "null value in column" }).json();
    expect(Object.keys(body)).toEqual(["error"]);
    expect(typeof body.error).toBe("string");
  });
});
