/**
 * Xona holati bron qilishga yo'l qo'yadimi.
 *
 * Ikki daraja bor, chunki ikki holat bir xil emas. Ta'mir, tekshiruv va
 * xizmatdan chiqarish — xona umuman ishlatilmaydi va bu qachon tugashi
 * noma'lum, shuning uchun kelgusi sanalarga ham bron qilinmaydi: avval holat
 * almashtirilishi kerak. Tozalash esa qisqa va o'z-o'zidan tugaydi, kelgusi
 * sanalarga to'sqinlik qilmaydi — faqat mehmon AYNAN HOZIR kirmoqchi bo'lsa
 * to'sadi.
 *
 * Bu qoida serverda ham bor (`reservation_service._assert_room_bookable`) —
 * u haqiqiy himoya, bu esa xodim so'rov yuborishdan oldin sababni ko'rishi
 * uchun. Ikkalasi bir xil bo'lishi kerak, shuning uchun chegaralar shu yerda
 * bitta joyda yozilgan va test bilan qulflangan.
 */

/** Holat almashtirilmaguncha hech qanday sanaga bron qilib bo'lmaydi. */
export const BLOCKED_ALWAYS = [
  "MAINTENANCE",
  "INSPECTION",
  "OUT_OF_SERVICE",
] as const

/** Faqat hozirgi paytni qamraydigan bron uchun yopiq. */
export const BLOCKED_NOW = ["CLEANING"] as const

const STATUS_LABEL: Record<string, string> = {
  CLEANING: "tozalanmoqda",
  MAINTENANCE: "ta'mirda",
  INSPECTION: "tekshiruvda",
  OUT_OF_SERVICE: "xizmatdan tashqari",
}

export interface BookableRoom {
  room_number?: string
  current_status: string
}

/** Bron davri. Soatlikda aniq vaqt, kunlikda sanalar. */
export interface BookingWindow {
  bookingType: "DAILY" | "HOURLY"
  /** "yyyy-MM-dd" */
  checkInDate?: string | null
  checkOutDate?: string | null
  /** Soatlik uchun: "yyyy-MM-ddTHH:mm" yoki ISO */
  checkInAt?: string | null
  checkOutAt?: string | null
}

/** Holat almashtirilmaguncha butunlay yopiqmi. */
export function isBlockedAlways(status: string): boolean {
  return (BLOCKED_ALWAYS as readonly string[]).includes(status)
}

/** Hozirgi payt uchun yopiq bo'lishi mumkinmi (tozalash). */
export function isBlockedNow(status: string): boolean {
  return (BLOCKED_NOW as readonly string[]).includes(status)
}

/** Bron qilishga xalaqit beradigan holatdami (ikkala darajadan biri). */
export function isRestrictedStatus(status: string): boolean {
  return isBlockedAlways(status) || isBlockedNow(status)
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] || status
}

const parseMs = (value?: string | null): number | null => {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Bron davri hozirgi paytni qamrab oladimi.
 *
 * Kunlik bronda kun aniqligida: kirish sanasi bugun yoki undan oldin, chiqish
 * sanasi esa bugundan keyin. Soatlikda aniq vaqt bo'yicha.
 *
 * Vaqti noma'lum bo'lsa (sanalar hali kiritilmagan) `false` — xodim hali
 * hech narsa tanlamagan bo'lsa uni ogohlantirish erta bo'lardi.
 */
export function windowCoversNow(w: BookingWindow, now: Date): boolean {
  if (w.bookingType === "HOURLY") {
    const start = parseMs(w.checkInAt)
    const end = parseMs(w.checkOutAt)
    if (start === null || end === null) return false
    const ms = now.getTime()
    return start <= ms && ms < end
  }

  if (!w.checkInDate || !w.checkOutDate) return false
  const pad = (n: number) => String(n).padStart(2, "0")
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return w.checkInDate <= today && today < w.checkOutDate
}

/**
 * Bron qilishga to'siq bo'lsa — sababi, bo'lmasa null.
 *
 * `window` berilmasa faqat "har qanday vaqt uchun taqiq" tekshiriladi: bu
 * ro'yxatlarda xonani belgilash uchun, sanalar hali ma'lum bo'lmaganda.
 */
export function roomBookingBlock(
  room: BookableRoom,
  window: BookingWindow | null,
  now: Date
): string | null {
  const status = room.current_status
  const where = room.room_number ? `${room.room_number}-xona` : "Xona"
  const label = statusLabel(status)

  if (isBlockedAlways(status)) {
    return `${where} ${label} — holat o'zgartirilmaguncha hech qanday sanaga bron qilib bo'lmaydi.`
  }

  if (!window || !isBlockedNow(status)) return null

  if (windowCoversNow(window, now)) {
    return `${where} hozir ${label} — tozalash yakunlangach bron qilish mumkin. Kelgusi sanalarga hozir ham bron qilsa bo'ladi.`
  }

  return null
}
