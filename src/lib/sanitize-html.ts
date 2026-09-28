import DOMPurify from "isomorphic-dompurify";

/**
 * Konten artikel diserve mentah ke situs-situs konsumen lewat Public API, jadi
 * HTML yang lolos ke sini otomatis jadi stored-XSS di setiap brand sekaligus.
 * Allow-list sengaja dibatasi pada tag yang memang dipakai rich-text editor.
 */
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

export function sanitizeHtml(html: string) {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // `javascript:` dan sejenisnya ditolak; data: hanya untuk gambar inline.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpeg|gif|webp);|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "svg", "math", "link", "meta", "base"],
    FORBID_ATTR: ["srcset", "formaction", "xlink:href", "ping"],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}

/** Dipakai sebagai `.transform()` pada skema zod field konten. */
export const sanitizeHtmlField = (value: string) => sanitizeHtml(value);
