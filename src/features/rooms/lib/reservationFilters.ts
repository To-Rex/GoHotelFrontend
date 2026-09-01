import type { RoomReservation } from "../api/rooms"
import { reservationStartMs } from "./roomReservations"

/**
 * Xona bandlovlari ro'yxatining filtri va tartibi.
 *
 * Nega alohida modul: oynada endi oltita filtr va beshta tartib bor,
 * ularning o'zaro ta'siri esa ko'ringanidan nozikroq. Sana oralig'i
 * "kesishish" bo'yicha ishlaydi — bu eng ko'p adashiladigan joy; qidiruv
 * bir nechta maydonni qamraydi; tartiblash esa kunlik va soatlik bronni
 * bir xil o'lchov bilan solishtirishi kerak. Bularning har biri testga
 * arziydi, komponent esa brauzersiz sinalmaydi.
 */

export type ReservationSort =
  | "newest"
  | "oldest"
  | "amount_desc"
  | "amount_asc"
  | "guest"
  | "debt"

export const SORT_LABELS: Record<ReservationSort, string> = {
  newest: "Avval yangilari",
  oldest: "Avval eskilari",
  amount_desc: "Summa: ko'pdan kamga",
  amount_asc: "Summa: kamdan ko'pga",
  debt: "Qarzi ko'plari",
  guest: "Mehmon ismi (A–Z)",
}

export interface ReservationFilters {
  /** Bandlov raqami, mehmon ismi yoki telefon */
  search: string
  /** Bandlov holati: CONFIRMED, CHECKED_IN, ... */
  status: string
  /** To'lov holati: UNPAID, PARTIALLY_PAID, ... */
  paymentStatus: string
  /** DAILY yoki HOURLY */
  bookingType: string
  /** "yyyy-MM-dd", bo'sh — chegarasiz */
  dateFrom: string
  dateTo: string
}

export const EMPTY_FILTERS: ReservationFilters = {
  search: "",
  status: "",
  paymentStatus: "",
  bookingType: "",
  dateFrom: "",
  dateTo: "",
}

/** Bironta filtr qo'yilganmi — "tozalash" tugmasi shu bo'yicha chiqadi. */
export function hasActiveFilters(f: ReservationFilters): boolean {
  return (
    !!f.search.trim() ||
    !!f.status ||
    !!f.paymentStatus ||
    !!f.bookingType ||
    !!f.dateFrom ||
    !!f.dateTo
  )
}

/**
 * Bandlov berilgan sana oralig'iga tegadimi.
 *
 * KESISHISH bo'yicha, boshlanish sanasi bo'yicha emas. "1-15 sentabrda bu
 * xonada kim turgan?" degan savolga 25-avgustda kirib 5-sentabrda chiqqan
 * mehmon ham javob bo'ladi — boshlanish sanasiga qarasak u ro'yxatdan
 * tushib qolardi.
 *
 * Chegara bo'sh bo'lsa o'sha tomondan cheklov yo'q.
 */
export function stayOverlaps(
  res: RoomReservation,
  from: string,
  to: string
): boolean {
  const start = res.check_in_date || ""
  // Soatlik bronda chiqish sanasi kirish sanasi bilan bir xil bo'lishi mumkin
  const end = res.check_out_date || start
  if (from && end && end < from) return false
  if (to && start && start > to) return false
  return true
}

/** Qidiruv: bandlov raqami, mehmon ismi va telefoni bo'yicha. */
export function matchesSearch(res: RoomReservation, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    (res.reservation_number || "").toLowerCase().includes(q) ||
    (res.guest_name || "").toLowerCase().includes(q) ||
    (res.guest_phone || "").toLowerCase().includes(q)
  )
}

export function matchesFilters(
  res: RoomReservation,
  f: ReservationFilters
): boolean {
  if (f.status && res.status !== f.status) return false
  if (f.paymentStatus && res.payment_status !== f.paymentStatus) return false
  if (
    f.bookingType &&
    (res.booking_type || "").toUpperCase() !== f.bookingType
  ) {
    return false
  }
  if (!stayOverlaps(res, f.dateFrom, f.dateTo)) return false
  return matchesSearch(res, f.search)
}

const amountOf = (res: RoomReservation) => Number(res.total_amount || 0)
const debtOf = (res: RoomReservation) =>
  Math.max(Number(res.total_amount || 0) - Number(res.paid_amount || 0), 0)

const createdMs = (res: RoomReservation): number => {
  const ms = res.created_at ? new Date(res.created_at).getTime() : NaN
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Tartiblash. Kirish massivi o'zgartirilmaydi — chaqiruvchi uni `useMemo`
 * ichida ishlatadi va React holatini joyida o'zgartirish kutilmagan qayta
 * chizishlarga olib kelardi.
 *
 * Teng qiymatlarda doim boshlanish payti hal qiladi, ya'ni bir xil summali
 * ikki bron har render'da o'rin almashmaydi.
 */
export function sortReservations(
  items: readonly RoomReservation[],
  sort: ReservationSort
): RoomReservation[] {
  const byStartDesc = (a: RoomReservation, b: RoomReservation) =>
    reservationStartMs(b) - reservationStartMs(a) || createdMs(b) - createdMs(a)

  const list = [...items]
  switch (sort) {
    case "oldest":
      return list.sort((a, b) => -byStartDesc(a, b))
    case "amount_desc":
      return list.sort((a, b) => amountOf(b) - amountOf(a) || byStartDesc(a, b))
    case "amount_asc":
      return list.sort((a, b) => amountOf(a) - amountOf(b) || byStartDesc(a, b))
    case "debt":
      return list.sort((a, b) => debtOf(b) - debtOf(a) || byStartDesc(a, b))
    case "guest":
      return list.sort(
        (a, b) =>
          (a.guest_name || "").localeCompare(b.guest_name || "", undefined, {
            sensitivity: "base",
          }) || byStartDesc(a, b)
      )
    case "newest":
    default:
      return list.sort(byStartDesc)
  }
}

/** Filtrlab, so'ng tartiblab qaytaradi. */
export function applyFilters(
  items: readonly RoomReservation[],
  f: ReservationFilters,
  sort: ReservationSort
): RoomReservation[] {
  return sortReservations(
    items.filter((res) => matchesFilters(res, f)),
    sort
  )
}

/**
 * Ko'rinib turgan ro'yxat bo'yicha jamlanma.
 *
 * Bekor qilingan va kelmagan bronlar pul hisobiga kirmaydi — ular uchun
 * pul olinmagan, jamiga qo'shilsa tushum bo'rttirilgan bo'lardi.
 */
export function summarize(items: readonly RoomReservation[]) {
  const live = items.filter(
    (r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW"
  )
  return {
    total: items.length,
    active: items.filter(
      (r) => r.status === "CHECKED_IN" || r.status === "CONFIRMED"
    ).length,
    income: live.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0),
    debt: live.reduce((sum, r) => sum + debtOf(r), 0),
  }
}
