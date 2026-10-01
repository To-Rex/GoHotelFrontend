// Matn "odam o'qiydigan"mi yoki texnikmi — i18n skriptlari uchun umumiy
// qoidalar. Natija: "natural" (tarjima qilinadi), "technical" (tegilmaydi)
// yoki "ambiguous" (bitta kichik harfli so'z: "kun" ham bo'lishi mumkin,
// "rooms" ham — joylashuviga qarab hal qilinadi).

/** Klaviatura tugmalari, brendlar, shrift nomlari — tarjima qilinmaydi. */
const TECH_WORDS = new Set([
  "Enter", "Escape", "Tab", "Backspace", "Delete", "Space", "ArrowUp",
  "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Shift", "Control",
  "Alt", "Meta", "PageUp", "PageDown", "Bearer", "Basic", "Authorization",
  "Inter", "Roboto", "Arial", "Helvetica", "Courier", "Consolas", "Monaco",
  "GoHotel", "Xabarchi", "TPrints", "Telegram", "Android", "Windows",
  "Google", "Chrome", "Safari", "Firefox", "Edge", "Infinity", "Object",
  "Array", "String", "Number", "Boolean", "Function", "Symbol", "Promise",
  "Linux", "Opera", "Yandex", "Brave", "Samsung", "Vivaldi", "Chromium",
])

/** Yolg'iz kelganda ham Tailwind sinfi bo'ladigan so'zlar. */
const TW_BARE = new Set([
  "flex", "grid", "block", "inline", "hidden", "relative", "absolute",
  "fixed", "sticky", "static", "truncate", "uppercase", "lowercase",
  "capitalize", "italic", "underline", "border", "rounded", "shadow",
  "transition", "container", "group", "peer", "visible", "invisible", "grow",
  "shrink", "ring", "outline", "antialiased", "isolate", "contents", "table",
  "transform", "filter", "blur", "resize", "prose", "dark", "collapse",
  "overline", "ordinal", "subpixel", "normal", "invert", "grayscale",
])

const CSS_WORDS = new Set([
  "solid", "dashed", "dotted", "none", "auto", "inherit", "inset", "ease",
  "linear", "infinite", "both", "forwards", "center", "left", "right", "top",
  "bottom", "repeat", "no-repeat", "cover", "contain", "normal", "bold",
  "italic", "transparent", "white", "black", "currentcolor", "sans-serif",
  "serif", "monospace", "important", "ease-in", "ease-out", "ease-in-out",
  "all", "px", "rem", "em", "at", "circle", "ellipse", "to", "from",
])

const APOSTROPHES = /['’ʻʼ`]/

/** Kamida ikki harfli so'z bormi (bitta "x" yoki "№" tarjima qilinmaydi). */
export const hasWord = (s) => /\p{L}{2,}/u.test(s)

function isTailwind(s) {
  const tokens = s.split(/\s+/).filter(Boolean)
  return (
    tokens.length > 0 &&
    tokens.every(
      (tok) =>
        /^[!-]?[a-z0-9@[*][\w:/[\]().,%#!&>~*=+-]*$/.test(tok) &&
        (/[-:[]/.test(tok) || TW_BARE.has(tok))
    )
  )
}

function isDateFormat(s) {
  return (
    /^[dDMyYHhmsSaAEeTZzXxPpQqwWcGukKB\s.,:/\-'[\]()]+$/.test(s) &&
    /(dd|MM|yy|HH|hh|mm|ss|\bd\b|\bM\b)/.test(s)
  )
}

function isCss(s) {
  if (
    !/(\d(px|rem|em|vh|vw|ms|deg|fr|%)(\s|$|,|\))|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|var\(--|calc\(|cubic-bezier|-gradient\(|translate[XY3d]*\(|rotate\(|scale\()/.test(
      s
    )
  ) {
    return false
  }
  // Raqam, birlik va funksiyalarni olib tashlagach faqat CSS so'zlari qolsa
  const rest = s
    .replace(/[a-z-]+\([^)]*\)/gi, " ")
    .replace(/#[0-9a-fA-F]{3,8}\b/g, " ")
    .replace(/-?\d*\.?\d+(px|rem|em|vh|vw|ms|s|deg|fr|%)?/g, " ")
    .split(/[\s,/!]+/)
    .filter(Boolean)
  return rest.every((w) => CSS_WORDS.has(w.toLowerCase()))
}

function isMimeList(s) {
  const tokens = s.split(/\s+/).filter(Boolean)
  return tokens.every((tok) => /^[\w.+*-]+\/[\w.+*-]+[,;]?$/.test(tok))
}

function classifyWord(s) {
  if (TECH_WORDS.has(s)) return "technical"
  if (/^[A-Z0-9_\-+.#]+$/.test(s)) return "technical" // CONST, "A4", "UZS"
  if (/[/\\@=<>{}[\]|$^&*~;]/.test(s)) return "technical"
  if (/^[.#]|^--?[a-z]/.test(s)) return "technical"
  if (/^[\w.-]+\.[a-z0-9]{2,5}$/i.test(s)) return "technical" // fayl.kengaytma
  // "yuklanmoqda...", "oxirgisi:", "(ixtiyoriy)" — so'z + gap tinishi: matn
  if (/^\(?[\p{L}'’ʻʼ`]{2,}(\.\.\.|[.…:!?,)])+$/u.test(s) && !/^[a-z]+[A-Z]/.test(s)) return "natural"
  if (/^[a-z0-9]+([_:.-][a-zA-Z0-9]+)+$/.test(s)) return "technical" // kebab/snake
  if (/^[a-z]+[A-Z]/.test(s)) return "technical" // camelCase
  if (/^[A-Z][a-z0-9]+[A-Z]/.test(s)) return "technical" // PascalCase
  const core = s.replace(/^[("'«“]+/, "").replace(/[)"'»”.,:;!?…]+$/, "")
  if (!core) return "technical"
  if (APOSTROPHES.test(core) && /^[\p{L}'’ʻʼ`-]+$/u.test(core)) return "natural"
  if (/^\p{Lu}\p{Ll}+$/u.test(core)) return "natural" // Saqlash
  if (/^\p{Lu}[\p{L}'’ʻʼ-]+$/u.test(core) && /\p{Ll}/u.test(core)) return "natural"
  if (core !== s && /^[\p{L}-]+$/u.test(core)) return "natural" // "jami:", "(ixtiyoriy)"
  if (/^\p{Ll}+$/u.test(core)) return "ambiguous"
  return "ambiguous"
}

/**
 * @param {string} raw  matn (shablon bo'lsa — o'zgaruvchilar olib tashlangan)
 * @returns {"natural" | "technical" | "ambiguous"}
 */
export function classify(raw) {
  const s = raw.trim()
  if (!s || !hasWord(s)) return "technical"
  if (/[\u0400-\u04FF]/.test(s)) return "natural" // kirill
  if (/<\/?[a-zA-Z][^>]*>/.test(s)) return "technical" // HTML
  if (/^(https?:|data:|blob:|mailto:|tel:|wss?:)/i.test(s)) return "technical"
  if (/[{}]/.test(s) && /[\w-]+\s*:\s*[^;{}]+;/.test(s)) return "technical" // CSS bloki
  if (!/\s/.test(s)) return classifyWord(s)
  if (isDateFormat(s) || isTailwind(s) || isCss(s) || isMimeList(s)) {
    return "technical"
  }
  return "natural"
}

const ENTITIES = {
  apos: "'", quot: '"', amp: "&", lt: "<", gt: ">", nbsp: "\u00a0",
  middot: "\u00b7", times: "\u00d7", mdash: "\u2014", ndash: "\u2013",
  hellip: "\u2026", laquo: "\u00ab", raquo: "\u00bb", larr: "\u2190",
  rarr: "\u2192", copy: "\u00a9", bull: "\u2022",
}

/** JSX matni/atributidagi HTML entity'larni ochish (&apos; → ').
 *  Notanish entity uchrasa null — bunday matn qo'lda ko'riladi. */
export function decodeJsxEntities(s) {
  let unknown = false
  const out = s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
    if (name.startsWith("#x")) return String.fromCodePoint(parseInt(name.slice(2), 16))
    if (name.startsWith("#")) return String.fromCodePoint(parseInt(name.slice(1), 10))
    if (name in ENTITIES) return ENTITIES[name]
    unknown = true
    return m
  })
  return unknown ? null : out
}

/** JS satr literali; uzilmas bo'shliq ko'rinadigan qilib yoziladi. */
export const lit = (s) => JSON.stringify(s).replace(/\u00a0/g, "\u00a0")

/** JSX matnini React ko'radigan satrga keltirish (TS/Babel qoidasi):
 *  qatorlar chetidagi bo'shliq olib tashlanadi, bo'sh qatorlar tushadi,
 *  qolganlari bitta bo'shliq bilan ulanadi. */
export function normalizeJsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  const out = []
  lines.forEach((line, i) => {
    let s = line
    if (i !== 0) s = s.replace(/^[ \t]+/, "")
    if (i !== lines.length - 1) s = s.replace(/[ \t]+$/, "")
    if (s) out.push(s)
  })
  return out.join(" ")
}
