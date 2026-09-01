/**
 * Navbar soati uchun formatlash.
 *
 * Komponentdan ajratilgan, chunki bu yerdagi yagona xavf — `Date` ning
 * indekslari: `getMonth()` noldan, `getDate()` birdan boshlanadi, va ularni
 * chalkashtirish sanani bir oy surib yuboradi. Sof funksiya buni bitta test
 * bilan qulflaydi; komponent esa brauzersiz sinab bo'lmaydi.
 */

export const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
] as const

export const UZ_DAYS = [
  "yakshanba", "dushanba", "seshanba", "chorshanba",
  "payshanba", "juma", "shanba",
] as const

export interface ClockParts {
  /** Soat va daqiqa, doim ikki xonali: "09:05". */
  hhmm: string
  /** Soniyalar, ikki xonali. */
  ss: string
  /** "1-sentabr, dushanba" */
  dateLabel: string
}

const pad = (value: number): string => String(value).padStart(2, "0")

export function clockParts(date: Date): ClockParts {
  return {
    hhmm: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    ss: pad(date.getSeconds()),
    dateLabel: `${date.getDate()}-${UZ_MONTHS[date.getMonth()]}, ${
      UZ_DAYS[date.getDay()]
    }`,
  }
}

/**
 * Keyingi soniya boshigacha necha millisekund qolgani.
 *
 * Oddiy `setInterval(1000)` sekin-asta siljiydi va raqam goh 0.6, goh 1.4
 * soniyada almashadigan bo'lib qoladi — bu ko'zga tashlanadi. Har tikdan
 * keyin qolgan vaqtga qayta rejalashtirish soatni chegarada ushlab turadi.
 */
export function msUntilNextSecond(date: Date): number {
  const remaining = 1000 - date.getMilliseconds()
  // 0 ms kutish cheksiz sikl yasashi mumkin — kamida bir marta kutamiz.
  return remaining <= 0 ? 1000 : remaining
}
