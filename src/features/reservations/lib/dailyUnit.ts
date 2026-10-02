import { addDaysStr } from "./booking"

/* Kunlik bron hisobi — mehmonxona sozlamasi (Sozlamalar → Standart bron turi).

   "12h" (standart, avvalgi tartib): kalendarda tanlangan oxirgi kun —
   CHIQISH kuni. Bugun + ertaga tanlansa — 1 kecha (kirish bugun, chiqish
   ertaga). Bitta kun tanlansa — ertasi kuni chiqiladi (1 kecha).

   "24h": har tanlangan kun to'liq (24 soatlik) to'lanadigan kun. Bugun +
   ertaga — 2 kun, narx 2 barobar; chiqish — indinga.

   Server narxni ikkala rejimda ham kechalar soni (chiqish − kirish) bo'yicha
   hisoblaydi — rejim faqat kalendar tanlovi sanalarga qanday aylanishini va
   kalendar chizig'i qaysi kunlarni egallashini belgilaydi. Saqlangan bron
   ma'nosi o'zgarmaydi. */

export type DailyUnit = "12h" | "24h"

/** Sozlama hali kelmagan yoki buzuq bo'lsa — standart (12 soatlik). */
export const resolveDailyUnit = (
  settings: { daily_unit?: string | null } | undefined | null
): DailyUnit => (settings?.daily_unit === "24h" ? "24h" : "12h")

/** Kalendar tanlovidan chiqish sanasi (yyyy-MM-dd). */
export function selectionCheckoutFor(
  start: string | null,
  end: string | null,
  unit: DailyUnit
): string | null {
  if (!start || !end) return null
  if (unit === "24h") return addDaysStr(end, 1)
  return end > start ? end : addDaysStr(end, 1)
}

/**
 * Kunlik bron kalendarda qaysi kungacha "band" ko'rinadi (yyyy-MM-dd,
 * oxirgi kun ham kiradi).
 *
 * 12 soatlik — chiqish kuni ham (avvalgidek: mehmon o'sha kuni chiqadi).
 * 24 soatlik — chiqishdan oldingi kun: to'lanadigan kunlar aynan tanlangan
 * kataklar bo'ladi, chiqish kuni yangi bron uchun ochiq (server ham ketma-ket
 * bronlarga ruxsat beradi: kirish < boshqasining chiqishi).
 */
export function lastOccupiedDay(checkIn: string, checkOut: string, unit: DailyUnit): string {
  if (unit !== "24h") return checkOut
  const last = addDaysStr(checkOut, -1)
  return last < checkIn ? checkIn : last
}
