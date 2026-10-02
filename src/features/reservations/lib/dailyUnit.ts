import { addDaysStr } from "./booking"

/* Kunlik bron hisobi — mehmonxona sozlamasi (Sozlamalar → Standart bron turi).

   "12h" (standart, avvalgi tartib): kalendarda tanlangan oxirgi kun —
   CHIQISH kuni. Bugun + ertaga tanlansa — 1 kecha (kirish bugun, chiqish
   ertaga). Bitta kun tanlansa — ertasi kuni chiqiladi (1 kecha).

   "24h": har tanlangan kun to'liq (24 soatlik) to'lanadigan kun. Bugun +
   ertaga — 2 kun; chiqish — indinga. Xona narxi 12 soatlik deb olinadi:
   bir kun = narx × 2 (250 000 so'mlik xona — kuniga 500 000).

   Server rejimni bron YARATILGANDA unga yozadi (`daily_unit`) va keyingi
   qayta hisoblar shu qiymat bilan — sozlama o'zgarsa ham mavjud bronlar
   narxi o'zgarmaydi (backend: daily_unit.py). Bu yerdagi hisob faqat
   oldindan ko'rsatish uchun, server bilan bir xil. */

export type DailyUnit = "12h" | "24h"

/** Sozlama hali kelmagan yoki buzuq bo'lsa — standart (12 soatlik). */
export const resolveDailyUnit = (
  settings: { daily_unit?: string | null } | undefined | null
): DailyUnit => (settings?.daily_unit === "24h" ? "24h" : "12h")

/** 24 soatlik kun narxi — 12 soatlik narxning necha barobari (server:
 *  FULL_DAY_MULTIPLIER). */
export const FULL_DAY_MULTIPLIER = 2

/** Kunlik narx koeffitsienti: 24 soatlik kunlik bronda 2, aks holda 1.
 *  Soatlik bronga tegishli emas. */
export const dailyPriceMultiplier = (
  unit: DailyUnit | string | null | undefined,
  bookingType: string | null | undefined = "DAILY"
): number =>
  (bookingType || "DAILY") !== "HOURLY" && unit === "24h" ? FULL_DAY_MULTIPLIER : 1

/** Bronga yozilgan rejim; eski server javobida bo'lmasa — 12 soatlik. */
export const reservationDailyUnit = (
  res: { daily_unit?: string | null } | null | undefined
): DailyUnit => (res?.daily_unit === "24h" ? "24h" : "12h")

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
