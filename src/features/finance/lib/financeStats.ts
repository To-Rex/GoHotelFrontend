import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"

import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"
import { UZ_MONTHS } from "@/lib/clock"
import { tr, trc } from "@/i18n"

/* Moliya statistikasi panellari uchun sof qoidalar: yorliqlar, ulushlar,
   kunlik ustunlar (bo'sh kunlar to'ldiriladi, uzun davr oylarga yig'iladi),
   foiz matni. Hisobning o'zi serverda (`finance_stats_service.py`). */

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString()

/* --- Yorliqlar ------------------------------------------------------- */

export const methodLabel = (key: string): string =>
  key === "OTHER"
    ? tr("Boshqa")
    : key === "MIXED"
      ? tr("Aralash")
      : PAYMENT_METHOD_LABELS[key] || key

const PURPOSE_LABELS: Record<string, string> = {
  ROOM: tr("Xona"),
  PENALTY: tr("Jarima"),
  SERVICE: tr("Xizmat"),
  OTHER: tr("Boshqa"),
  EXTRA: tr("Ortiqcha"),
  SHOP: tr("Do'kon"),
  REFUND: tr("Qaytarim"),
}
export const purposeLabel = (key: string): string => PURPOSE_LABELS[key] || key

const LINE_LABELS: Record<string, string> = {
  ROOM_CHARGE: tr("Xona haqi"),
  PENALTY: tr("Jarimalar"),
  SERVICE: tr("Xizmatlar"),
  SERVICE_CHARGE: tr("Xizmatlar"),
  TAX: tr("Soliq"),
  DISCOUNT: tr("Chegirma"),
  OTHER: tr("Boshqa"),
}
export const lineLabel = (key: string): string => LINE_LABELS[key] || key

const AGING_LABELS: Record<string, string> = {
  "0_7": tr("0–7 kun"),
  "8_30": tr("8–30 kun"),
  "31_90": tr("31–90 kun"),
  "90_plus": tr("90 kundan ko'p"),
}
export const agingLabel = (key: string): string => AGING_LABELS[key] || key

/** Hisob-faktura holatlari — jadval, filtr va statistikada bir xil */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: tr("Qoralama"),
  ISSUED: tr("Taqdim etilgan"),
  PARTIALLY_PAID: tr("Qisman to'langan"),
  PAID: tr("To'langan"),
  VOID: trc("invoice", "Bekor qilingan"),
  REFUNDED: tr("Qaytarilgan"),
}

export const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  VOID: "bg-red-100 text-red-600",
  REFUNDED: "bg-purple-100 text-purple-700",
}

/** Holat nomi (eski "CANCELLED" ham "Bekor qilingan") */
export const invoiceStatusLabel = (status: string): string =>
  INVOICE_STATUS_LABELS[status] || (status === "CANCELLED" ? INVOICE_STATUS_LABELS.VOID : status)

/** Bosilganda filtrga aylanadigan "Nima uchun" qatori (ro'yxat "Turi" bilan bir xil) */
export const PURPOSE_FILTER_KINDS = new Set(["ROOM", "PENALTY", "SERVICE", "EXTRA", "SHOP", "REFUND"])
/** Bosilganda filtrga aylanadigan to'lov turi */
export const METHOD_FILTER_KEYS = new Set(["CASH", "CARD", "ONLINE", "BANK_TRANSFER"])

/* --- Ulushlar -------------------------------------------------------- */

export interface ShareRow {
  key: string
  label: string
  amount: number
  count?: number
  /** 0..100 — eng katta musbat qiymatga nisbatan bar uzunligi */
  width: number
  /** 0..100 — jami musbat summadagi ulushi (manfiyda null) */
  share: number | null
  negative: boolean
}

/** Bar uzunligi — ENG KATTA qiymatga nisbatan (kichigi ham ko'rinsin),
 *  ulush foizi — jami musbat summaga nisbatan */
export function shareRows(
  items: ReadonlyArray<{ key: string; amount: number; count?: number }>,
  labelOf: (key: string) => string
): ShareRow[] {
  const positive = items.filter((i) => i.amount > 0)
  const total = positive.reduce((s, i) => s + i.amount, 0)
  const max = Math.max(0, ...items.map((i) => Math.abs(i.amount)))
  return items.map((i) => ({
    key: i.key,
    label: labelOf(i.key),
    amount: i.amount,
    count: i.count,
    width: max > 0 ? Math.max((Math.abs(i.amount) / max) * 100, i.amount !== 0 ? 2 : 0) : 0,
    share: i.amount > 0 && total > 0 ? (i.amount / total) * 100 : null,
    negative: i.amount < 0,
  }))
}

/** "46%" / "0.4%" / "<0.1%" */
export function percentText(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—"
  if (p > 0 && p < 0.1) return "<0.1%"
  return `${Number(p).toLocaleString(undefined, { maximumFractionDigits: p < 10 ? 1 : 0 })}%`
}

/* --- Kunlik ustunlar ------------------------------------------------- */

export interface DayBar {
  key: string
  /** Ustun ostidagi qisqa yozuv: "12" (kun) yoki "noy" (oy) */
  tick: string
  /** Izoh sarlavhasi: "12 noyabr" yoki "noyabr 2026" */
  title: string
  amount: number
  count: number
}

/** Shundan uzun davr oylarga yig'iladi (ustunlar ingichka bo'lib ketmasin) */
export const MAX_DAY_BARS = 62

const monthName = (m: number) => tr(UZ_MONTHS[m])

/** Kunlar ro'yxatini ustunlarga aylantiradi: davr ichidagi bo'sh kunlar 0
 *  bilan to'ldiriladi (grafik vaqt bo'yicha to'g'ri ko'rinsin); davr
 *  berilmasa — birinchi va oxirgi to'lov oralig'i; 62 kundan uzun — oylar. */
export function dayBars(
  days: ReadonlyArray<{ date: string; amount: number; count: number }>,
  from?: string,
  to?: string
): DayBar[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const start = parseISO(from || sorted[0].date)
  const end = parseISO(to || sorted[sorted.length - 1].date)
  const span = differenceInCalendarDays(end, start) + 1
  const byDay = new Map(sorted.map((d) => [d.date, d]))

  if (span > 0 && span <= MAX_DAY_BARS) {
    const out: DayBar[] = []
    for (let i = 0; i < span; i++) {
      const day = addDays(start, i)
      const key = format(day, "yyyy-MM-dd")
      const found = byDay.get(key)
      out.push({
        key,
        tick: String(day.getDate()),
        title: `${day.getDate()} ${monthName(day.getMonth())}`,
        amount: found?.amount ?? 0,
        count: found?.count ?? 0,
      })
    }
    return out
  }

  // Uzun davr — oylar bo'yicha
  const months = new Map<string, DayBar>()
  for (const d of sorted) {
    const day = parseISO(d.date)
    const key = format(day, "yyyy-MM")
    const bar = months.get(key) ?? {
      key,
      tick: monthName(day.getMonth()).slice(0, 3),
      title: `${monthName(day.getMonth())} ${day.getFullYear()}`,
      amount: 0,
      count: 0,
    }
    bar.amount += d.amount
    bar.count += d.count
    months.set(key, bar)
  }
  return [...months.values()]
}

/** Har nechanchi ustun ostiga yozuv qo'yiladi (yozuvlar ustma-ust tushmasin) */
export const tickStep = (n: number): number => (n <= 16 ? 1 : n <= 31 ? 2 : n <= 45 ? 5 : 7)

/** Ustun izohi: "12 noyabr · 1,250,000 · 8 ta to'lov" */
export const barTooltip = (b: DayBar): string =>
  tr("{{title}} · {{amount}} So'm · {{count}} ta to'lov", { title: b.title, amount: fmt(b.amount), count: b.count })
