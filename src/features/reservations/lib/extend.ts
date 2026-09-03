/**
 * Bronni sichqoncha bilan cho'zish hisobi.
 *
 * Chegara bitta: shu xonadagi KEYINGI bron. Undan nariga o'tib bo'lmaydi,
 * keyingi bron bo'lmasa esa cheklov ham yo'q.
 *
 * Bu yerdagi hisob faqat KO'RSATISH uchun — cho'zishga haqiqiy ruxsatni
 * server beradi (`reservation_extend.py`). Ikkalasi bir xil qoidaga
 * amal qiladi, shuning uchun surish paytida ko'rinadigan chegara serverning
 * javobiga mos tushadi.
 *
 * O'lchov birligi ataylab ko'rsatilmagan: soatlik taxtada bu daqiqa,
 * kalendarda esa kun. Qoida ikkalasida bir xil.
 */

/** Vaqt o'qidagi band oraliq. */
export interface Busy {
  start: number
  end: number
}

/** Keyingi band oraliq qachon boshlanadi. Yo'q bo'lsa — `Infinity`. */
export function nextBusyStart(busy: ReadonlyArray<Busy>, from: number): number {
  let nearest = Infinity
  for (const b of busy) {
    if (b.start >= from && b.start < nearest) nearest = b.start
  }
  return nearest
}

export interface CeilingOptions {
  /** Soatlik bronda keyingi bron oldidan tozalash tanaffusi qoladi */
  turnover: number
  /** Kunlik bronda tanaffus ayirilmaydi — chiqish kuni kirish kuni bo'la oladi */
  hourly: boolean
  /** Ko'rinadigan oynaning oxiri — undan nariga surib bo'lmaydi */
  ceiling: number
}

/**
 * Cho'zishning eng oxirgi nuqtasi.
 *
 * Keyingi bron bo'lmasa oynaning oxirigacha: "istalgancha" degani amalda
 * ko'rinadigan lentaning oxiri, chunki undan nariga sudrab ham bo'lmaydi.
 */
export function extendCeiling(
  nextStart: number,
  { turnover, hourly, ceiling }: CeilingOptions
): number {
  if (!Number.isFinite(nextStart)) return ceiling
  const limit = hourly ? nextStart - turnover : nextStart
  return Math.min(limit, ceiling)
}

/**
 * Sichqoncha siljishidan yangi tugash nuqtasi.
 *
 * `step` ga yaxlitlanadi (taxtada 15 daqiqa, kalendarda 1 kun) va
 * [hozirgi tugash ... chegara] oralig'idan chiqmaydi. Chegara hozirgi
 * tugashdan oldinda bo'lsa (keyingi bron juda yaqin) — hech qanday
 * cho'zish bo'lmaydi.
 */
export function extendTarget(
  currentEnd: number,
  delta: number,
  limit: number,
  step: number
): number {
  if (limit <= currentEnd) return currentEnd
  const proposed = currentEnd + delta
  const snapped = Math.round(proposed / step) * step
  return Math.min(Math.max(snapped, currentEnd), limit)
}

/** Cho'zish umuman mumkinmi — dastak ko'rsatish uchun. */
export function canExtendTo(currentEnd: number, limit: number, step: number): boolean {
  return limit - currentEnd >= step
}

//: Bron cho'zilmaydigan holatlar — serverdagi ro'yxat bilan bir xil
export const EXTEND_LOCKED_STATUSES = ["CHECKED_OUT", "CANCELLED", "NO_SHOW"]

export function isExtendable(status?: string | null): boolean {
  return !EXTEND_LOCKED_STATUSES.includes(String(status || ""))
}
