import { describe, it, expect } from "vitest"
import {
  parseAmount,
  rebalanceFirstAmount,
  restoreFirstAmount,
} from "./splitPayments"

/* Bo'lib to'lash: keyingi qatorlarga kiritilgan summa birinchisidan
   ayriladi, ya'ni JAMI o'zgarmaydi. */

describe("parseAmount", () => {
  it("sonni o'qiydi", () => {
    expect(parseAmount(200000)).toBe(200000)
    expect(parseAmount("200000")).toBe(200000)
  })

  it("bo'sh va buzuq qiymat nol", () => {
    expect(parseAmount("")).toBe(0)
    expect(parseAmount(null)).toBe(0)
    expect(parseAmount(undefined)).toBe(0)
    expect(parseAmount("abc")).toBe(0)
  })

  it("manfiy va nol qiymat nol", () => {
    // Manfiy to'lov bo'lmaydi; maydonga tushib qolsa hisobni buzmasin
    expect(parseAmount(-500)).toBe(0)
    expect(parseAmount(0)).toBe(0)
  })
})

describe("rebalanceFirstAmount", () => {
  it("ikkinchi qatorga yozilgan summa birinchisidan ayriladi", () => {
    // 500 000 naqd edi, 200 000 karta bilan — naqd 300 000 bo'ladi
    expect(rebalanceFirstAmount(500000, 0, 200000)).toBe(300000)
  })

  it("qator oshirilsa farqigina ayriladi", () => {
    // 200 000 dan 250 000 ga: birinchisidan yana 50 000
    expect(rebalanceFirstAmount(300000, 200000, 250000)).toBe(250000)
  })

  it("qator kamaytirilsa pul birinchisiga qaytadi", () => {
    expect(rebalanceFirstAmount(300000, 200000, 100000)).toBe(400000)
  })

  it("qator tozalansa hammasi qaytadi", () => {
    expect(rebalanceFirstAmount(300000, 200000, 0)).toBe(500000)
  })

  it("o'zgarish bo'lmasa summa ham o'zgarmaydi", () => {
    expect(rebalanceFirstAmount(300000, 200000, 200000)).toBe(300000)
  })

  it("birinchi qatorda yetarli pul bo'lmasa nolga tushadi", () => {
    /* Xodimning kiritganini o'zgartirmaymiz — jami narxdan oshadi va
       oyna buni allaqachon ogohlantiradi. */
    expect(rebalanceFirstAmount(100000, 0, 300000)).toBe(0)
  })

  it("jami o'zgarmaydi — asosiy qoida", () => {
    const first = 500000
    const next = rebalanceFirstAmount(first, 0, 200000)
    expect(next + 200000).toBe(first)
  })

  it("uchinchi qator ham birinchisidan ayiradi", () => {
    // 500 000 → karta 200 000 → naqd 300 000; keyin o'tkazma 100 000
    const afterSecond = rebalanceFirstAmount(500000, 0, 200000)
    const afterThird = rebalanceFirstAmount(afterSecond, 0, 100000)
    expect(afterThird).toBe(200000)
    expect(afterThird + 200000 + 100000).toBe(500000)
  })
})

describe("restoreFirstAmount", () => {
  it("o'chirilgan qator summasi birinchisiga qaytadi", () => {
    expect(restoreFirstAmount(300000, 200000)).toBe(500000)
  })

  it("bo'sh qator o'chirilsa hech nima o'zgarmaydi", () => {
    expect(restoreFirstAmount(300000, 0)).toBe(300000)
  })
})
