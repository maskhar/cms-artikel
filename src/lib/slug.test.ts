import { describe, expect, it } from "vitest";
import { isValidSlug } from "./slug";

describe("isValidSlug", () => {
  it.each(["artikel", "artikel-baru", "cms-2026", "a1-b2"])("menerima %s", (slug) => expect(isValidSlug(slug)).toBe(true));
  it.each(["Artikel", "artikel baru", "-artikel", "artikel-", "artikel--baru", "artikel_baru", ""])("menolak %s", (slug) => expect(isValidSlug(slug)).toBe(false));
});
