import { beforeEach, describe, expect, it } from "vitest";
import { apiKeyHash } from "./supabase/admin";
import { isFutureExpiration } from "./api-key";

describe("apiKeyHash", () => {
  beforeEach(() => { process.env.ARTIKEL_API_KEY_PEPPER = "test-pepper"; });

  it("stabil untuk key dan pepper yang sama", () => {
    expect(apiKeyHash("ak_live_example")).toBe(apiKeyHash("ak_live_example"));
    expect(apiKeyHash("ak_live_example")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("berubah saat key atau pepper berubah", () => {
    const original = apiKeyHash("ak_live_example");
    expect(apiKeyHash("ak_live_other")).not.toBe(original);
    process.env.ARTIKEL_API_KEY_PEPPER = "different-pepper";
    expect(apiKeyHash("ak_live_example")).not.toBe(original);
  });

  it("menerima expiry masa depan dan menolak expiry lampau", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    expect(isFutureExpiration(null, now)).toBe(true);
    expect(isFutureExpiration("2026-09-11T00:00:00.000Z", now)).toBe(true);
    expect(isFutureExpiration("2026-09-10T00:00:00.000Z", now)).toBe(false);
    expect(isFutureExpiration("2026-09-09T23:59:59.000Z", now)).toBe(false);
  });
});
