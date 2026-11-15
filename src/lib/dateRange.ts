import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"

/**
 * Sana oralig'i kalendarining sof mantiqi (komponentdan ajratilgan —
 * testlanadi, UI ga bog'liq emas).
 *
 * Sanalar hamma joyda "yyyy-MM-dd" satr: API ham, sahifa holati ham shu
 * ko'rinishda ishlaydi, satrlarni oddiy `<`/`>` bilan solishtirsa bo'ladi.
 */

export const ISO = "yyyy-MM-dd"

export const toIso = (d: Date): string => format(d, ISO)

export function fromIso(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = parseISO(value)
  return isValid(d) ? d : null
}

export interface RangeDraft {
  /** "yyyy-MM-dd" yoki bo'sh satr (tanlanmagan / "Barcha davr"). */
  from: string
  to: string
}

/** Kalendarda hozir qaysi chegara tanlanmoqda. */
export type RangeField = "from" | "to"

/**
 * Oy ko'rinishi: 6 hafta × 7 kun, DUSHANBADAN boshlab (O'zbekistonda hafta
 * dushanbadan). Har doim 42 katak — oylar almashganda kalendar balandligi
 * sakramaydi.
 */
export function monthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

const ordered = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a])

/**
 * Kalendarda kun bosilganda tanlov qanday o'zgaradi — qaysi chegara
 * (`field`) tanlanayotganiga qarab:
 *
 *  - "from": boshlanish shu kun; tugash undan oldin qolsa tozalanadi,
 *    aks holda saqlanadi (faqat boshlanishni surish mumkin). Navbat tugashga.
 *  - "to": tugash shu kun. Boshlanish hali yo'q bo'lsa avval u qo'yiladi
 *    (navbat tugashda qoladi). Kun boshlanishdan OLDIN bo'lsa o'rni
 *    almashadi — teskari oraliq chiqmaydi. Tugallangach navbat boshlanishga.
 *
 * Bir kunni ikki marta bosish — bitta kunlik davr.
 */
export function pickDayFor(
  draft: RangeDraft,
  field: RangeField,
  day: string
): { draft: RangeDraft; field: RangeField } {
  if (field === "from") {
    const to = draft.to && draft.to >= day ? draft.to : ""
    return { draft: { from: day, to }, field: "to" }
  }
  if (!draft.from) return { draft: { from: day, to: "" }, field: "to" }
  const [from, to] = ordered(draft.from, day)
  return { draft: { from, to }, field: "from" }
}

/**
 * Kalendarda bo'yaladigan oraliq — tanlangan kunlar va sichqoncha turgan
 * kungacha ko'rib tanlash (`hover`). Doim [kichik, katta] tartibda.
 */
export function highlightRange(
  draft: RangeDraft,
  hover: string | null,
  field: RangeField
): [string, string] | null {
  if (field === "to") {
    if (!draft.from) return hover ? [hover, hover] : null
    return ordered(draft.from, draft.to || hover || draft.from)
  }
  if (hover) {
    // Boshlanish suriladi: tugash saqlansa ungacha, aks holda bitta kun
    const end = draft.to && draft.to >= hover ? draft.to : hover
    return [hover, end]
  }
  if (!draft.from) return null
  return ordered(draft.from, draft.to || draft.from)
}

/** Oraliqdagi kunlar soni (ikkala chegara ham bo'lsa), bir kun — 1. */
export function rangeDays(from: string, to: string): number | null {
  const a = fromIso(from)
  const b = fromIso(to)
  if (!a || !b) return null
  return Math.abs(differenceInCalendarDays(b, a)) + 1
}

/** Ko'rsatish uchun sana: 02.11.2026 */
export const displayDate = (iso: string): string => {
  const d = fromIso(iso)
  return d ? format(d, "dd.MM.yyyy") : iso
}

/**
 * Tugmadagi yozuv: "01.10.2026 — 31.10.2026"; bitta kun — "02.11.2026";
 * faqat boshlanish — "01.10.2026 — …"; faqat tugash — "… — 31.10.2026";
 * ikkalasi bo'sh — `allLabel` ("Barcha davr").
 */
export function rangeLabel(from: string, to: string, allLabel: string): string {
  if (!from && !to) return allLabel
  if (from && to && from === to) return displayDate(from)
  return `${from ? displayDate(from) : "…"} — ${to ? displayDate(to) : "…"}`
}

/* --- Ixtiyoriy soat (kalendar menyusida "Sanadan / Sanagacha" ichida) --- */

/** Soat oralig'i: "HH:MM" yoki bo'sh (kun boshi / oxiri) */
export interface TimeRange {
  from: string
  to: string
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
export const isTime = (value: string | null | undefined): boolean => !!value && HHMM.test(value)
export const hasTime = (h: TimeRange | null | undefined): boolean => !!h && (isTime(h.from) || isTime(h.to))

/** Keyingi kun (ISO) */
export const nextDay = (iso: string): string => {
  const d = fromIso(iso)
  if (!d) return iso
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
}

/** Tungi oraliq: bitta kun, ikkala soat bor va "gacha" ≤ "dan" — tugash
 *  ertasi kunga o'tadi (20:00 → ertasi 08:00) */
export const isOvernight = (from: string, to: string, h: TimeRange | null | undefined): boolean =>
  !!h && !!from && from === to && isTime(h.from) && isTime(h.to) && h.to <= h.from

/** Yozuv soat bilan: "14.11.2026, 08:00–20:00", tungida
 *  "14.11.2026 20:00 → 15.11.2026 08:00", ko'p kunda
 *  "10.11.2026 14:00 — 14.11.2026". Soat yo'q — `rangeLabel`. */
export function rangeLabelWithTime(
  from: string,
  to: string,
  h: TimeRange | null | undefined,
  allLabel: string
): string {
  if (!hasTime(h) || !from || !to) return rangeLabel(from, to, allLabel)
  const tf = isTime(h!.from) ? h!.from : ""
  const tt = isTime(h!.to) ? h!.to : ""
  if (isOvernight(from, to, h)) {
    return `${displayDate(from)} ${tf} → ${displayDate(nextDay(to))} ${tt}`
  }
  if (from === to) return `${displayDate(from)}, ${tf || "00:00"}–${tt || "24:00"}`
  return `${displayDate(from)}${tf ? ` ${tf}` : ""} — ${displayDate(to)}${tt ? ` ${tt}` : ""}`
}
