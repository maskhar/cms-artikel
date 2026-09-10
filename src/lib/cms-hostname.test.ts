import { describe, expect, it } from "vitest";
import { isValidCmsHostname, normalizeCmsHostname } from "./cms-hostname";

describe("CMS hostname", () => {
  it("menormalkan forwarded host dan port", () => {
    expect(normalizeCmsHostname("CMS.UTEROINDONESIA.COM:3000")).toBe("cms.uteroindonesia.com");
    expect(normalizeCmsHostname("cms.uteroindonesia.com:3000, proxy.local")).toBe("cms.uteroindonesia.com");
  });

  it.each(["cms.carubra.com", "cms.uteroindonesia.com", "admin-2.example.co.id"])("menerima %s", (hostname) => expect(isValidCmsHostname(hostname)).toBe(true));
  it.each(["http://cms.carubra.com", "cms", "cms_utama.carubra.com", "-cms.carubra.com", "cms.carubra.com/path"])("menolak %s", (hostname) => expect(isValidCmsHostname(hostname)).toBe(false));
});
