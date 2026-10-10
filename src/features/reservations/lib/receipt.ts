import { differenceInCalendarDays, differenceInHours, format } from "date-fns"

import { canonicalMethod, PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"
import type { ReservationReceiptData } from "@/lib/tprints"

/* Bron cheki — ma'lumotni yig'ish va "to'lovdan keyin chek" sozlamasi
   (sof funksiyalar — testlangan).

   Chek uch joydan chiqadi va hammasi shu yerdan quriladi, shuning uchun
   ular bir-biridan farq qilmaydi:
   * bron oynasidagi "Chek chiqarish" tugmasi (istalgan bron, eskisi ham);
   * "Yangi bandlov" — bron to'lov bilan yaratilganda avtomatik;
   * bron oynasidagi "To'lovni qabul qilish" (qo'shimcha to'lov) — avtomatik. */

/** Chek uchun yetarli bo'lgan eng kichik ma'lumot.
 *
 *  To'liq `Reservation` emas: xona bandlovlari ro'yxati kabi qisqartirilgan
 *  javoblar ham chek chiqara olishi kerak — chek baribir faqat shu
 *  maydonlardan quriladi. */
export interface ReceiptReservation {
  reservation_number: string
  booking_type: string
  check_in_date: string
  check_out_date: string
  check_in_datetime?: string | null
  check_out_datetime?: string | null
  adults: number
  children: number
  total_amount: number
  paid_amount: number
  discount_amount: number
  /** Qimmatroq xonaga ko'chirishda berilgan chegirma — chekda umumiy
   *  chegirmaga qo'shiladi (eski server javobida bo'lmasligi mumkin) */
  move_discount_amount?: number | null
  /** Faol jarimalar yig'indisi — chekda alohida qator */
  penalty_amount?: number | null
  created_at: string
  status: string
}

export interface ReceiptPaymentRow {
  /** To'lov usuli kodi (CASH, CARD, ...) */
  method: string
  amount: number
}

export interface ReceiptExtras {
  guestName?: string | null
  roomNumber?: string | null
  roomType?: string | null
  createdByName?: string | null
  services?: Array<{ name: string; quantity?: number | null; amount: number }>
  /** Shu chekdagi to'lov(lar) usuli bilan */
  payments?: ReceiptPaymentRow[]
  /** true — `payments` faqat SHU safargi to'lov (qo'shimcha to'lov);
   *  "To'langan" esa baribir butun bron bo'yicha */
  paymentsNow?: boolean
}

export const fmtReceiptDate = (value?: string | null, withTime = false) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return format(date, withTime ? "dd.MM.yyyy HH:mm" : "dd.MM.yyyy")
}

/** Soatlik bronda soat, kunlikda sutka; aniqlab bo'lmasa `null` */
export const receiptDuration = (
  checkIn: string,
  checkOut: string,
  hourly: boolean
): number | null => {
  const from = new Date(checkIn)
  const to = new Date(checkOut)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  const value = hourly ? differenceInHours(to, from) : differenceInCalendarDays(to, from)
  return value > 0 ? value : null
}

/** To'lovlar usul bo'yicha yig'iladi (eski kodlar kanonik nomga) va
 *  nomlanadi; nol summalar tashlanadi. Tartib — birinchi uchragan usul. */
export const summarizePayments = (
  rows: ReceiptPaymentRow[] = []
): Array<{ label: string; amount: number }> => {
  const order: string[] = []
  const sums: Record<string, number> = {}
  for (const row of rows) {
    const amount = Number(row.amount) || 0
    if (amount <= 0) continue
    const key = canonicalMethod(row.method)
    const label =
      key === "OTHER"
        ? PAYMENT_METHOD_LABELS[String(row.method || "").toUpperCase()] || String(row.method || "—")
        : PAYMENT_METHOD_LABELS[key]
    if (!(label in sums)) {
      order.push(label)
      sums[label] = 0
    }
    sums[label] += amount
  }
  return order.map((label) => ({ label, amount: sums[label] }))
}

export const buildReservationReceiptData = (
  reservation: ReceiptReservation,
  extras: ReceiptExtras = {}
): ReservationReceiptData => {
  const hourly = (reservation.booking_type || "").toUpperCase() === "HOURLY"
  const checkIn = reservation.check_in_datetime || reservation.check_in_date
  const checkOut = reservation.check_out_datetime || reservation.check_out_date
  const payments = summarizePayments(extras.payments)
  return {
    reservation_number: reservation.reservation_number,
    guest_name: extras.guestName,
    room_number: extras.roomNumber,
    room_type: extras.roomType,
    check_in: fmtReceiptDate(checkIn, hourly),
    check_out: fmtReceiptDate(checkOut, hourly),
    nights: receiptDuration(checkIn, checkOut, hourly),
    booking_type: reservation.booking_type,
    adults: reservation.adults,
    children: reservation.children,
    total_amount: Number(reservation.total_amount || 0),
    paid_amount: Number(reservation.paid_amount || 0),
    discount_amount:
      Number(reservation.discount_amount || 0) + Number(reservation.move_discount_amount || 0),
    penalty_amount: Number(reservation.penalty_amount || 0),
    services: extras.services,
    payments: payments.length ? payments : undefined,
    payments_now: payments.length ? !!extras.paymentsNow : undefined,
    created_at: reservation.created_at,
    created_by_name: extras.createdByName,
    status: reservation.status,
  }
}

// ---------------------------------------------------------------------------
// "To'lov qilinsa chek chiqarish" — har kompyuter uchun (kassa qurilmasiga
// bog'liq sozlama, printer manzili kabi). Do'kon chekidagi sozlamadan
// alohida: mehmonxona do'kon chekini xohlab, bron chekini xohlamasligi
// mumkin (yoki aksincha).
// ---------------------------------------------------------------------------

export const BOOKING_AUTO_PRINT_KEY = "tprints_booking_auto_print"

/** Sukut — yoqilgan: pul olinsa chek beriladi */
export const getBookingAutoPrint = (): boolean => {
  try {
    return localStorage.getItem(BOOKING_AUTO_PRINT_KEY) !== "0"
  } catch {
    return true
  }
}

export const setBookingAutoPrint = (on: boolean) => {
  try {
    localStorage.setItem(BOOKING_AUTO_PRINT_KEY, on ? "1" : "0")
  } catch {
    /* saqlab bo'lmadi — joriy sahifada baribir amal qiladi */
  }
}

/** Chek avtomatik chiqadimi: sozlama yoqilgan va shu safar pul olingan */
export const shouldPrintAfterPayment = (enabled: boolean, paidNow: number) =>
  enabled && Number(paidNow) > 0
