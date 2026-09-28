import { describe, expect, it } from "vitest";
import { sanitizeHtml, sanitizeHtmlField } from "./sanitize-html";

/**
 * Fase 5.4. Konten artikel diserve ke situs-situs konsumen lewat Public Read API,
 * jadi satu payload yang lolos jadi stored-XSS di setiap brand sekaligus.
 *
 * Test di sini menegaskan properti, bukan bentuk output DOMPurify: yang dikunci
 * adalah "tidak ada vektor eksekusi yang tersisa", supaya upgrade DOMPurify yang
 * mengubah formatting tidak bikin test merah palsu — tapi yang benar-benar
 * melemahkan sanitasi tetap tertangkap.
 */

/** Penanda yang dipakai payload untuk membuktikan eksekusi. */
const MARKER = /alert|XSS\(|document\.cookie|evil\.test/i;

/** Vektor eksekusi yang tidak boleh pernah tersisa, apa pun bentuk output. */
function assertNoExecutionVector(output: string) {
  const lower = output.toLowerCase();
  expect(lower).not.toContain("<script");
  expect(lower).not.toContain("<iframe");
  expect(lower).not.toContain("<object");
  expect(lower).not.toContain("<embed");
  expect(lower).not.toContain("<svg");
  expect(lower).not.toContain("<form");
  expect(lower).not.toContain("javascript:");
  expect(lower).not.toContain("vbscript:");
  // Semua handler inline on*= (onerror, onload, onmouseover, onfocus, ...).
  expect(lower).not.toMatch(/\son[a-z]+\s*=/);
}

describe("sanitizeHtml — payload XSS umum", () => {
  const payloads: Array<[string, string]> = [
    ["script tag polos", '<p>halo</p><script>alert("XSS")</script>'],
    ["img onerror", '<img src="x" onerror="alert(1)">'],
    ["svg onload", '<svg onload="alert(1)"></svg>'],
    ["iframe javascript:", '<iframe src="javascript:alert(1)"></iframe>'],
    ["anchor javascript:", '<a href="javascript:alert(document.cookie)">klik</a>'],
    ["anchor JaVaScRiPt: campuran kapital", '<a href="JaVaScRiPt:alert(1)">klik</a>'],
    ["body onload", '<body onload="alert(1)">teks</body>'],
    ["div onmouseover", '<div onmouseover="alert(1)">arahkan</div>'],
    ["object data", '<object data="javascript:alert(1)"></object>'],
    ["embed src", '<embed src="//evil.test/x.swf">'],
    ["form action", '<form action="//evil.test"><input name="a"></form>'],
    ["meta refresh", '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'],
    ["base href", '<base href="//evil.test/">'],
    ["style expression", '<style>body{background:url("javascript:alert(1)")}</style>'],
    ["link stylesheet", '<link rel="stylesheet" href="//evil.test/x.css">'],
    ["input autofocus onfocus", '<input autofocus onfocus="alert(1)">'],
    ["details ontoggle", '<details open ontoggle="alert(1)">x</details>'],
    ["srcset", '<img src="ok.png" srcset="//evil.test/x.png 1x">'],
    ["formaction", '<button formaction="javascript:alert(1)">kirim</button>'],
    ["vbscript:", '<a href="vbscript:msgbox(1)">klik</a>'],
    ["data:text/html", '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">klik</a>'],
    ["script bersarang terpotong", '<scr<script>ipt>alert(1)</scr</script>ipt>'],
    ["atribut tanpa kutip", "<img src=x onerror=alert(1)>"],
    ["marquee onstart", '<marquee onstart="alert(1)">x</marquee>'],
  ];

  it.each(payloads)("menetralkan %s", (_label, payload) => {
    assertNoExecutionVector(sanitizeHtml(payload));
  });

  it("tidak menyisakan penanda eksekusi di dalam atribut mana pun", () => {
    for (const [, payload] of payloads) {
      const out = sanitizeHtml(payload);
      // Teks boleh tersisa sebagai teks biasa (KEEP_CONTENT), tapi tidak boleh
      // berada di dalam atribut — di sanalah ia jadi eksekusi.
      const attrs = out.match(/\s[a-z-]+\s*=\s*"[^"]*"/gi) ?? [];
      for (const attr of attrs) {
        expect(attr).not.toMatch(MARKER);
      }
    }
  });
});

describe("sanitizeHtml — konten sah tidak ikut hangus", () => {
  it("mempertahankan rich text dasar", () => {
    const html =
      "<h2>Judul</h2><p><strong>tebal</strong> dan <em>miring</em></p><ul><li>satu</li></ul>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("mempertahankan tautan http/https beserta rel dan target", () => {
    const out = sanitizeHtml('<a href="https://contoh.test/a" target="_blank" rel="noopener">x</a>');
    expect(out).toContain('href="https://contoh.test/a"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener"');
  });

  it("mempertahankan mailto dan tel", () => {
    expect(sanitizeHtml('<a href="mailto:a@b.test">surel</a>')).toContain("mailto:a@b.test");
    expect(sanitizeHtml('<a href="tel:+628123">telepon</a>')).toContain("tel:+628123");
  });

  it("mempertahankan gambar beserta alt dan dimensi", () => {
    const out = sanitizeHtml('<img src="/media/a.png" alt="gambar" width="400" height="300">');
    expect(out).toContain('src="/media/a.png"');
    expect(out).toContain('alt="gambar"');
    expect(out).toContain('width="400"');
  });

  it("mempertahankan data:image inline yang dipakai editor", () => {
    const out = sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="inline">');
    expect(out).toContain("data:image/png;base64");
  });

  it("mempertahankan tabel beserta colspan", () => {
    const out = sanitizeHtml("<table><tbody><tr><td colspan=\"2\">sel</td></tr></tbody></table>");
    expect(out).toContain("<table>");
    expect(out).toContain('colspan="2"');
  });

  it("mempertahankan blockquote, pre, dan code", () => {
    const html = "<blockquote><p>kutipan</p></blockquote><pre><code>kode()</code></pre>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("mempertahankan teks di dalam tag yang dibuang (KEEP_CONTENT)", () => {
    // Isi <form> dibuang tag-nya tapi teksnya tetap, supaya konten tidak hilang diam-diam.
    expect(sanitizeHtml("<form>teks penting</form>")).toContain("teks penting");
  });
});

describe("sanitizeHtml — masukan tepi", () => {
  it("string kosong tetap kosong", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("nilai falsy tidak melempar", () => {
    expect(sanitizeHtml(undefined as unknown as string)).toBe("");
    expect(sanitizeHtml(null as unknown as string)).toBe("");
  });

  it("teks biasa tanpa tag dibiarkan apa adanya", () => {
    expect(sanitizeHtml("halo dunia")).toBe("halo dunia");
  });

  it("idempoten — menyanitasi hasil sanitasi tidak mengubah apa pun", () => {
    const once = sanitizeHtml('<p>a</p><img src="x" onerror="alert(1)">');
    expect(sanitizeHtml(once)).toBe(once);
  });
});

describe("sanitizeHtmlField", () => {
  it("berperilaku sama dengan sanitizeHtml (dipakai sebagai transform zod)", () => {
    const payload = '<p>ok</p><script>alert(1)</script>';
    expect(sanitizeHtmlField(payload)).toBe(sanitizeHtml(payload));
    assertNoExecutionVector(sanitizeHtmlField(payload));
  });
});
