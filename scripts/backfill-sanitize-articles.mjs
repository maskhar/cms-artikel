/**
 * Backfill sanitasi konten artikel (Fase 2.3.5 plan remediasi keamanan).
 *
 * Konten yang tersimpan sebelum sanitasi saat-tulis diaktifkan bisa memuat
 * payload XSS. Route publik sudah menyanitasi saat baca, tapi data mentah di
 * DB tetap perlu dibersihkan supaya konsumen lain (ekspor, CMS UI, integrasi
 * baru) tidak ikut terpapar.
 *
 * Default: DRY RUN — tidak menulis apa pun, hanya melaporkan baris yang akan
 * berubah. Tambahkan --apply untuk benar-benar menulis.
 *
 *   node scripts/backfill-sanitize-articles.mjs
 *   node scripts/backfill-sanitize-articles.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import DOMPurify from "isomorphic-dompurify";
import { readFileSync } from "node:fs";

// Baca .env tanpa dependency tambahan; hanya key yang dibutuhkan.
function loadEnv(file) {
  try {
    for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = rawLine.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    /* file opsional */
  }
}
loadEnv(".env");

const APPLY = process.argv.includes("--apply");

// Harus identik dengan src/lib/sanitize-html.ts.
const ALLOWED_TAGS = [
  "p", "br", "hr", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup", "small",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
];
const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "title", "width", "height", "loading",
  "class", "id",
  "colspan", "rowspan", "align", "style",
  "data-color",
];
const sanitizeHtml = (html) =>
  !html
    ? ""
    : DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpeg|gif|webp);|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "svg", "math", "link", "meta", "base"],
        FORBID_ATTR: ["srcset", "formaction", "xlink:href", "ping"],
        ALLOW_DATA_ATTR: false,
        KEEP_CONTENT: true,
      });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak tersedia.");
  process.exit(1);
}

const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } }).schema("artikel");

const { data: articles, error } = await db.from("articles").select("id, site_id, title, content");
if (error) {
  console.error("Gagal membaca artikel:", error.message);
  process.exit(1);
}

console.log(`Mode: ${APPLY ? "APPLY (menulis ke DB)" : "DRY RUN (tidak menulis)"}`);
console.log(`Total artikel: ${articles.length}\n`);

const changed = [];
for (const article of articles) {
  const before = article.content ?? "";
  const after = sanitizeHtml(before);
  if (before !== after) changed.push({ ...article, before, after });
}

for (const item of changed) {
  console.log(`- ${item.id} | site=${item.site_id} | ${item.title}`);
  console.log(`    ${item.before.length} -> ${item.after.length} char (selisih ${item.after.length - item.before.length})`);
  const removedTags = [...new Set([...item.before.matchAll(/<\s*([a-zA-Z0-9-]+)/g)].map((m) => m[1].toLowerCase()))]
    .filter((tag) => !new Set([...item.after.matchAll(/<\s*([a-zA-Z0-9-]+)/g)].map((m) => m[1].toLowerCase())).has(tag));
  if (removedTags.length) console.log(`    tag hilang: ${removedTags.join(", ")}`);
}

console.log(`\nArtikel yang akan berubah: ${changed.length} dari ${articles.length}`);

if (!APPLY) {
  console.log("Dry run selesai. Jalankan ulang dengan --apply untuk menulis.");
  process.exit(0);
}

let ok = 0;
for (const item of changed) {
  const { error: updateError } = await db.from("articles").update({ content: item.after }).eq("id", item.id);
  if (updateError) console.error(`  GAGAL ${item.id}: ${updateError.message}`);
  else ok += 1;
}
console.log(`\nSelesai: ${ok}/${changed.length} artikel diperbarui.`);
