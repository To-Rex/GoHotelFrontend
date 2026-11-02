import { addDays, format, isValid, parseISO, startOfMonth, startOfWeek } from "date-fns"

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

/**
 * Oy ko'rinishi: 6 hafta × 7 kun, DUSHANBADAN boshlab (O'zbekistonda hafta
 * dushanbadan). Har doim 42 katak — oylar almashganda kalendar balandligi
 * sakramaydi, qo'shni oy kunlari xira ko'rsatiladi.
 */
export function monthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

/**
 * Kalendarda kun bosilganda tanlov qanday o'zgaradi.
 *
 *  - hech narsa tanlanmagan yoki ikkalasi ham tanlangan → yangi BOSHLANISH
 *    (tugash tozalanadi, foydalanuvchi ikkinchi kunni tanlaydi);
 *  - faqat boshlanish bor → TUGASH va tanlov tugallanadi (`done`); ikkinchi
 *    kun birinchisidan oldin bo'lsa o'rni almashadi — teskari oraliq
 *    chiqmaydi. Bir kunni ikki marta bosish — bitta kunlik davr.
 */
export function pickDay(draft: RangeDraft, day: string): { draft: RangeDraft; done: boolean } {
  if (!draft.from || draft.to) return { draft: { from: day, to: "" }, done: false }
  const [from, to] = day < draft.from ? [day, draft.from] : [draft.from, day]
  return { draft: { from, to }, done: true }
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

/**
 * Kalendarda bo'yaladigan oraliq: tanlov tugallanmagan bo'lsa sichqoncha
 * turgan kungacha (ko'rib tanlash). Doim [kichik, katta] tartibda.
 */
export function highlightRange(draft: RangeDraft, hover: string | null): [string, string] | null {
  if (!draft.from) return null
  const end = draft.to || hover || draft.from
  return draft.from <= end ? [draft.from, end] : [end, draft.from]
}
