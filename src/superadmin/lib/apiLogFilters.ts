/* So'rovlar jurnali filtrlari — URL parametri <-> panel holati.

   Holat filtri serverga bitta ifoda bo'lib boradi (backend `parse_status`):
   vergul bilan bo'laklar — aniq kod ("404"), sinf ("4xx"), oraliq
   ("500-504"); oldida "!" — chiqarib tashlash. Panel ikki rejimni beradi:
   "faqat tanlanganlarni ko'rsatish" (400,401,422) va "tanlanganlarni
   yashirish" (!200,!304). Ifoda URL'da turadi: sahifa yangilansa ham,
   havola boshqaga yuborilsa ham filtr saqlanadi. */

import { tr } from "@/i18n"

export type StatusMode = "include" | "exclude"

export interface StatusSelection {
  tokens: string[]
  mode: StatusMode
}

export const STATUS_CLASSES = ["2xx", "3xx", "4xx", "5xx"] as const
export type StatusClass = (typeof STATUS_CLASSES)[number]

/** "404" | "4xx" | "500-504" (bo'sh joy, katta harf, teskari tartib ham) → kanonik ko'rinish; aks holda null. */
export function normalizeStatusToken(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "")
  if (/^[1-5]xx$/.test(s)) return s
  if (/^\d{3}$/.test(s)) {
    const n = Number(s)
    return n >= 100 && n <= 599 ? String(n) : null
  }
  const m = /^(\d{3})-(\d{3})$/.exec(s)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y)
    if (a < 100 || b > 599) return null
    return a === b ? String(a) : `${a}-${b}`
  }
  return null
}

/** URL'dagi ifoda → tanlov. Aralash ifoda (masalan "4xx,!401") panelda
 *  ifodalanmaydi — bunday holda "ko'rsatish" qismi olinadi. */
export function parseStatusParam(value: string | null | undefined): StatusSelection {
  const parts = (value || "").split(",").map((p) => p.trim()).filter(Boolean)
  const include: string[] = []
  const exclude: string[] = []
  for (const part of parts) {
    const negated = part.startsWith("!")
    const token = normalizeStatusToken(negated ? part.slice(1) : part)
    if (!token) continue
    const list = negated ? exclude : include
    if (!list.includes(token)) list.push(token)
  }
  if (include.length) return { tokens: include, mode: "include" }
  if (exclude.length) return { tokens: exclude, mode: "exclude" }
  return { tokens: [], mode: "include" }
}

/** Tanlov → serverga/URL'ga boradigan ifoda ("" — filtr yo'q). */
export function buildStatusParam({ tokens, mode }: StatusSelection): string {
  return tokens.map((t) => (mode === "exclude" ? `!${t}` : t)).join(",")
}

/** Bo'lak shu kodni qamraydimi ("4xx" → 401 ha; "500-504" → 502 ha). */
export function tokenCovers(token: string, code: number): boolean {
  if (/^[1-5]xx$/.test(token)) return Math.floor(code / 100) === Number(token[0])
  const m = /^(\d{3})-(\d{3})$/.exec(token)
  if (m) return code >= Number(m[1]) && code <= Number(m[2])
  return Number(token) === code
}

export const statusClassOf = (code: number): StatusClass | null => {
  const c = `${Math.floor(code / 100)}xx`
  return (STATUS_CLASSES as readonly string[]).includes(c) ? (c as StatusClass) : null
}

/** Tanlovni bir bo'lakka almashtirib-qo'yish (bor bo'lsa olib tashlanadi). */
export function toggleToken(sel: StatusSelection, token: string): StatusSelection {
  return sel.tokens.includes(token)
    ? { ...sel, tokens: sel.tokens.filter((t) => t !== token) }
    : { ...sel, tokens: [...sel.tokens, token] }
}

/** Jadvaldagi holat belgisini bosish: shu kod "ko'rsatiladiganlar" ga
 *  qo'shiladi (yana bosilsa olib tashlanadi). Yashirish rejimida bosilsa —
 *  faqat shu kodni ko'rsatishga o'tadi (yashirilgan kodni "qo'shish"
 *  kutilmagan natija berardi). */
export function focusCode(sel: StatusSelection, code: number): StatusSelection {
  const token = String(code)
  if (sel.mode === "exclude") return { tokens: [token], mode: "include" }
  return toggleToken(sel, token)
}

/** Tayyor tanlovlar — bir bosishda. */
export interface StatusPreset {
  id: string
  label: string
  selection: StatusSelection
}

export const sameSelection = (a: StatusSelection, b: StatusSelection): boolean =>
  (a.tokens.length === 0 && b.tokens.length === 0) ||
  (a.mode === b.mode &&
    a.tokens.length === b.tokens.length &&
    a.tokens.every((t) => b.tokens.includes(t)))

/** Kodlar ro'yxati: serverdagi sonlar + tanlangan aniq kodlar (soni 0 bo'lsa
 *  ham ko'rinib tursin — tanlovni bekor qilish mumkin bo'lsin), sinf bo'yicha. */
export function groupCodes(
  counts: Record<string, number> | undefined,
  tokens: string[]
): { cls: StatusClass; total: number; codes: { code: number; count: number }[] }[] {
  const map = new Map<number, number>()
  for (const [k, v] of Object.entries(counts || {})) {
    const code = Number(k)
    if (Number.isFinite(code)) map.set(code, v)
  }
  for (const t of tokens) if (/^\d{3}$/.test(t) && !map.has(Number(t))) map.set(Number(t), 0)
  return STATUS_CLASSES.map((cls) => {
    const codes = [...map.entries()]
      .filter(([code]) => statusClassOf(code) === cls)
      .sort(([a], [b]) => a - b)
      .map(([code, count]) => ({ code, count }))
    return { cls, total: codes.reduce((s, c) => s + c.count, 0), codes }
  }).filter((g) => g.codes.length > 0 || tokens.includes(g.cls))
}

/** Metodlar: "GET,POST" <-> ["GET","POST"]. */
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

export const parseMethodsParam = (value: string | null | undefined): string[] =>
  [...new Set((value || "").split(",").map((m) => m.trim().toUpperCase()).filter(Boolean))]

/** Davr filtri (daqiqa) va nomi. */
// i18n:keys
export const SINCE_LABELS: Record<number, string> = {
  5: "Oxirgi 5 daqiqa",
  15: "Oxirgi 15 daqiqa",
  60: "Oxirgi 1 soat",
  360: "Oxirgi 6 soat",
  1440: "Oxirgi 24 soat",
  4320: "Oxirgi 3 kun",
}
export const SINCE_OPTIONS = [5, 15, 60, 360, 1440, 4320] as const

export const parseSinceParam = (value: string | null | undefined): number | undefined => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/* --- Holat kodlari nomlari (ko'rsatish uchun) --- */

// i18n:keys
const STATUS_LABELS: Record<number, string> = {
  200: "Muvaffaqiyatli",
  201: "Yaratildi",
  202: "Qabul qilindi",
  204: "Mazmunsiz javob",
  301: "Ko'chirildi",
  302: "Yo'naltirildi",
  304: "O'zgarmagan",
  307: "Vaqtincha yo'naltirildi",
  400: "Noto'g'ri so'rov",
  401: "Avtorizatsiya yo'q",
  403: "Ruxsat yo'q",
  404: "Topilmadi",
  405: "Metod mumkin emas",
  409: "Ziddiyat",
  410: "O'chirilgan",
  413: "Juda katta",
  415: "Format qo'llanmaydi",
  422: "Ma'lumot xato",
  423: "Qulflangan",
  429: "Juda ko'p so'rov",
  500: "Server xatosi",
  502: "Shlyuz xatosi",
  503: "Xizmat ishlamayapti",
  504: "Javob kechikdi",
}

// i18n:keys
export const CLASS_LABELS: Record<StatusClass, string> = {
  "2xx": "Muvaffaqiyat",
  "3xx": "Yo'naltirish",
  "4xx": "Mijoz xatosi",
  "5xx": "Server xatosi",
}

/** Kod nomi (ma'lum bo'lsa) — tanlagichda va jadvalda sarlavha sifatida. */
export const statusLabel = (code: number): string | null =>
  STATUS_LABELS[code] ? tr(STATUS_LABELS[code]) : null
