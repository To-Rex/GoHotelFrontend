/**
 * Bron muddatini sichqoncha bilan o'zgartirish hisobi.
 *
 * Tugash vaqti ikkala tomonga suriladi: mehmon qolsa CHO'ZILADI, erta
 * ketsa QISQARADI. Ikkita chegara bor:
 *
 * - YUQORI — shu xonadagi keyingi bron. Undan nariga o'tib bo'lmaydi;
 *   keyingi bron bo'lmasa cheklov ham yo'q.
 * - QUYI — bronning o'z boshlanishi. Eng qisqasi bir qadam (soatlik
 *   taxtada 15 daqiqa, kalendarda bir kun).
 *
 * Bu yerdagi hisob faqat KO'RSATISH uchun — haqiqiy ruxsatni server
 * beradi (`reservation_extend.py`). Ikkalasi bir xil qoidaga amal
 * qiladi, shuning uchun surish paytida ko'rinadigan chegara serverning
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
 * Qisqartirishning eng oxirgi nuqtasi — bron boshlanishidan bir qadam.
 *
 * Kunlik bronda bu bazadagi `check_out_date > check_in_date` cheklovi
 * bilan bir xil: nol kunlik bron bo'lmaydi.
 */
export function resizeFloor(start: number, step: number): number {
  return start + step
}

export interface ResizeBounds {
  /** Quyi chegara — `resizeFloor` */
  min: number
  /** Yuqori chegara — `extendCeiling` */
  max: number
  step: number
}

/**
 * Sichqoncha siljishidan yangi tugash nuqtasi.
 *
 * `step` ga yaxlitlanadi (taxtada 15 daqiqa, kalendarda 1 kun) va
 * [min ... max] oralig'idan chiqmaydi.
 */
export function resizeTarget(
  currentEnd: number,
  delta: number,
  { min, max, step }: ResizeBounds
): number {
  // Chegaralar teskari bo'lib qolsa (keyingi bron juda yaqin) hech
  // qanday o'zgarish bo'lmaydi
  if (max < min) return currentEnd
  const snapped = Math.round((currentEnd + delta) / step) * step
  return Math.min(Math.max(snapped, min), max)
}

/**
 * Dastak umuman ko'rsatiladimi.
 *
 * Kamida bitta yo'nalishda bir qadam joy bo'lishi kerak: joysiz dastak
 * bosiladi-yu hech narsa qilmaydi va bu chalg'itadi.
 */
export function canResize(
  currentEnd: number,
  { min, max, step }: ResizeBounds
): boolean {
  return max - currentEnd >= step || currentEnd - min >= step
}

//: Bron muddati o'zgartirilmaydigan holatlar — serverdagi ro'yxat bilan bir xil
export const EXTEND_LOCKED_STATUSES = ["CHECKED_OUT", "CANCELLED", "NO_SHOW"]

export function isExtendable(status?: string | null): boolean {
  return !EXTEND_LOCKED_STATUSES.includes(String(status || ""))
}
