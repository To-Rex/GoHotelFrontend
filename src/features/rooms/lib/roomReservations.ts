import type { RoomReservation } from "../api/rooms"

/**
 * Xona bandlovlarini vaqt bo'yicha tartiblash.
 *
 * Nega alohida funksiya: qoida ko'ringanidan nozikroq. Kunlik bronda faqat
 * sana bor, soatlikda esa aniq vaqt ham. Faqat sanaga qarab saralansa bir
 * kundagi soatlik bronlar tasodifiy — aslida kiritilish — tartibida qoladi,
 * ya'ni 09:00 dagi bron 22:00 dagisidan keyin turishi mumkin. Aynan shu
 * xato tuzatilmoqda, va uni test bilan qulflab qo'ygan ma'qul.
 */

/**
 * Bandlovning boshlanish payti, millisekundda.
 *
 * Soatlik bronda `check_in_datetime`, kunlikda esa sana kun boshi deb
 * olinadi. O'qib bo'lmaydigan sana 0 qaytaradi — yozuv ro'yxat oxiriga
 * tushadi, lekin yo'qolmaydi: buzuq sana tufayli bandlovni yashirish
 * xodimni u umuman yo'q deb o'ylashga majbur qilardi.
 */
export function reservationStartMs(r: RoomReservation): number {
  const raw = r.check_in_datetime || r.check_in_date
  const ms = raw ? new Date(raw).getTime() : NaN
  return Number.isNaN(ms) ? 0 : ms
}

function createdMs(r: RoomReservation): number {
  const ms = r.created_at ? new Date(r.created_at).getTime() : NaN
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Yangisidan eskisiga: avval boshlanish payti, teng bo'lsa — keyin
 * kiritilgani yuqorida.
 *
 * Kirish massivi o'zgartirilmaydi — chaqiruvchi uni `useMemo` ichida
 * ishlatadi va React state'ini joyida o'zgartirish kutilmagan qayta
 * chizishlarga olib kelardi.
 */
export function sortRoomReservations(
  items: readonly RoomReservation[]
): RoomReservation[] {
  return [...items].sort(
    (a, b) => reservationStartMs(b) - reservationStartMs(a) || createdMs(b) - createdMs(a)
  )
}
