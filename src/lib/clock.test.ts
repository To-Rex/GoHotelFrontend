import { describe, it, expect } from "vitest"
import { UZ_DAYS, UZ_MONTHS, clockParts, msUntilNextSecond } from "./clock"

/* Navbar soati.

   Butun xavf `Date` ning indekslarida: `getMonth()` noldan, `getDate()`
   birdan boshlanadi. Ularni chalkashtirish sanani bir oy surib yuboradi va
   soat baribir to'g'ri ko'rinaveradi — shuning uchun aynan shu tekshiriladi. */

describe("clockParts", () => {
  it("soat va daqiqani ikki xonali qiladi", () => {
    // 9:05 — "9:5" emas, "09:05" bo'lishi kerak
    expect(clockParts(new Date(2026, 8, 1, 9, 5, 3)).hhmm).toBe("09:05")
    expect(clockParts(new Date(2026, 8, 1, 9, 5, 3)).ss).toBe("03")
  })

  it("yarim tunni 00:00 deb ko'rsatadi", () => {
    expect(clockParts(new Date(2026, 8, 1, 0, 0, 0)).hhmm).toBe("00:00")
  })

  it("kechqurunni 24 soatlik formatda beradi", () => {
    expect(clockParts(new Date(2026, 8, 1, 23, 59, 59)).hhmm).toBe("23:59")
  })

  it("oyni to'g'ri oladi — getMonth() noldan boshlanadi", () => {
    // 2026-yil 1-sentabr — seshanba
    const parts = clockParts(new Date(2026, 8, 1, 12, 0, 0))
    expect(parts.dateLabel).toBe("1-sentabr, seshanba")
  })

  it("yilning birinchi va oxirgi kunlari", () => {
    expect(clockParts(new Date(2026, 0, 1, 12, 0)).dateLabel).toContain("1-yanvar")
    expect(clockParts(new Date(2026, 11, 31, 12, 0)).dateLabel).toContain("31-dekabr")
  })

  it("hafta kunlari to'liq va tartibda", () => {
    expect(UZ_DAYS).toHaveLength(7)
    expect(UZ_MONTHS).toHaveLength(12)
    // 2026-08-30 — yakshanba, ya'ni ro'yxatning boshi
    expect(clockParts(new Date(2026, 7, 30, 12, 0)).dateLabel).toContain("yakshanba")
  })
})

describe("msUntilNextSecond", () => {
  it("soniya chegarasigacha qolgan vaqtni beradi", () => {
    const d = new Date(2026, 8, 1, 12, 0, 0)
    d.setMilliseconds(250)
    expect(msUntilNextSecond(d)).toBe(750)
  })

  it("aniq chegarada to'liq soniya kutadi, nol emas", () => {
    // Nol qaytarsa setTimeout cheksiz siklga aylanardi.
    const d = new Date(2026, 8, 1, 12, 0, 0)
    d.setMilliseconds(0)
    expect(msUntilNextSecond(d)).toBe(1000)
  })
})
