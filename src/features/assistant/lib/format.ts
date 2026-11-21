import { tr } from "@/i18n"
import { formatHotelMoment, formatWallClock } from "@/lib/hotelTime"

/* Yordamchi bloklaridagi qiymatlarni ko'rsatish.

   Server summalarni ko'pincha MATN qilib yuboradi ("125000.00" — Decimal),
   shuning uchun raqam bo'lsa ham, matn bo'lsa ham bir xil formatlanadi:
   1 250 000 (bo'shliq bilan), kasr — ko'pi bilan 2 xona. */

export const toNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string") {
    const s = v.replace(/[\s ]/g, "")
    if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function formatNumber(v: unknown, maxFraction = 2): string {
  const n = toNumber(v)
  if (n === null) return v === null || v === undefined || v === "" ? "—" : String(v)
  const fixed = Math.abs(n) >= 1000 ? Math.round(n) : Math.round(n * 10 ** maxFraction) / 10 ** maxFraction
  const [int, frac] = String(Math.abs(fixed)).split(".")
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${n < 0 ? "−" : ""}${grouped}${frac ? `,${frac}` : ""}`
}

/** 12 400 → "12,4K"; 1 250 000 → "1,25M" (token sarfi uchun) */
export function formatCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—"
  const abs = Math.abs(v)
  const fmt = (x: number, digits: number) => String(Math.round(x * 10 ** digits) / 10 ** digits).replace(".", ",")
  if (abs >= 1_000_000) return `${fmt(v / 1_000_000, abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 10_000) return `${fmt(v / 1000, 0)}K`
  if (abs >= 1000) return `${fmt(v / 1000, 1)}K`
  return String(Math.round(v))
}

/* Bazadagi kodlar (holat, to'lov turi...) — ekranda tushunarli nom bilan.
   Ma'lumotning o'zi o'zgarmaydi, faqat ko'rinishi. */
// i18n:keys
const VALUE_LABELS: Record<string, string> = {
  AVAILABLE: "Bo'sh", OCCUPIED: "Band", RESERVED: "Bron qilingan", CLEANING: "Tozalanmoqda", MAINTENANCE: "Ta'mirda",
  OUT_OF_ORDER: "Ishlamaydi", CONFIRMED: "Tasdiqlangan", PENDING: "Kutilmoqda", CHECKED_IN: "Joylashgan",
  CHECKED_OUT: "Chiqib ketgan", CANCELLED: "Bekor qilingan", NO_SHOW: "Kelmadi", PAID: "To'langan",
  PARTIAL: "Qisman to'langan", PARTIALLY_PAID: "Qisman to'langan", UNPAID: "To'lanmagan", REFUNDED: "Qaytarilgan",
  VOID: "Bekor qilingan", OPEN: "Ochiq", IN_PROGRESS: "Jarayonda", COMPLETED: "Bajarildi", RESOLVED: "Hal qilindi",
  CASH: "Naqd", CARD: "Karta", ONLINE: "Onlayn", BANK_TRANSFER: "Bank o'tkazmasi", TRANSFER: "O'tkazma",
  DAILY: "Kunlik", HOURLY: "Soatlik", ACTIVE: "Faol", INACTIVE: "Nofaol",
}

/** "AVAILABLE" → "Bo'sh" (tanish kod bo'lsa), aks holda o'zi. */
export function valueLabel(v: unknown): string {
  const s = String(v ?? "")
  const label = /^[A-Z][A-Z_]+$/.test(s) ? VALUE_LABELS[s] : undefined
  return label ? tr(label) : s
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

export function formatCell(value: unknown, kind: string): string {
  if (value === null || value === undefined || value === "") return "—"
  if (kind === "money" || kind === "number") return formatNumber(value)
  if (typeof value === "string") {
    if (kind === "date" && DATE_ONLY.test(value)) return formatWallClock(value)
    if ((kind === "datetime" || kind === "date") && DATE_TIME.test(value)) {
      return formatHotelMoment(value, kind === "datetime")
    }
    return valueLabel(value)
  }
  if (typeof value === "boolean") return value ? "✓" : "—"
  return String(value)
}

/** Grafik o'qi yorlig'i: "2026-11-21" → "21.11", "2026-11" → "11.2026". */
export function formatAxisLabel(v: unknown): string {
  const s = String(v ?? "")
  if (DATE_ONLY.test(s)) return `${s.slice(8, 10)}.${s.slice(5, 7)}`
  if (/^\d{4}-\d{2}$/.test(s)) return `${s.slice(5, 7)}.${s.slice(0, 4)}`
  const label = valueLabel(s)
  return label.length > 14 ? `${label.slice(0, 13)}…` : label
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

/** Mehmonxona vaqtidagi "2026-11-23T09:00" → "23.11.2026 09:00" */
export const formatLocalDue = (local: string | null | undefined): string =>
  local ? formatWallClock(local, true) : ""
