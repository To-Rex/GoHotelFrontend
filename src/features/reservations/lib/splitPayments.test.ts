import { describe, it, expect } from "vitest"
import { extrasTotal, parseAmount, remainderForFirst } from "./splitPayments"

/* Bo'lib to'lash: JAMI summa alohida saqlanadi, birinchi qator esa undan
   qo'shimcha qatorlar ayirilgani.

   Nega ayirma bilan emas: birinchi qator nolga tushib qolganda ayirmaga
   tayangan hisob orqaga qaytmasdi — kattaroq summa kiritib, keyin uni
   o'chirganda birinchi qator eski holatiga emas, noto'g'ri songa
   aylanardi. Aynan shu xato ishlab chiqarishda chiqdi. */

const row = (amount: string) => ({ amount })

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

describe("extrasTotal", () => {
  it("qatorlarni qo'shadi", () => {
    expect(extrasTotal([row("200000"), row("100000")])).toBe(300000)
  })

  it("bo'sh qatorlar hisobga olinmaydi", () => {
    expect(extrasTotal([row(""), row("100000"), row("abc")])).toBe(100000)
  })

  it("qator yo'q", () => {
    expect(extrasTotal([])).toBe(0)
  })
})

describe("remainderForFirst", () => {
  it("qo'shimcha qator birinchisidan ayriladi", () => {
    // 500 000 naqd edi, 200 000 karta bilan — naqd 300 000 bo'ladi
    expect(remainderForFirst(500000, [row("200000")])).toBe(300000)
  })

  it("uchinchi qator ham birinchisidan ayiradi", () => {
    expect(remainderForFirst(500000, [row("200000"), row("100000")])).toBe(200000)
  })

  it("jami har doim saqlanadi", () => {
    const total = 500000
    const extras = [row("200000"), row("100000")]
    expect(remainderForFirst(total, extras) + extrasTotal(extras)).toBe(total)
  })

  it("qator kamaytirilsa pul birinchisiga qaytadi", () => {
    expect(remainderForFirst(500000, [row("100000")])).toBe(400000)
  })

  it("qator tozalansa hammasi qaytadi", () => {
    expect(remainderForFirst(500000, [row("")])).toBe(500000)
    expect(remainderForFirst(500000, [])).toBe(500000)
  })

  it("jamidan katta summa kiritilsa birinchisi nolga tushadi", () => {
    expect(remainderForFirst(500000, [row("800000")])).toBe(0)
  })

  /* ENG MUHIM TEKSHIRUV: ortiqcha summa kiritilib, keyin o'chirilsa
     birinchi qator ESKI HOLATIGA qaytishi kerak. Ayirmaga tayangan eski
     hisobda u 800 000 bo'lib qolardi. */
  it("ortiqcha summa o'chirilgach birinchisi to'liq tiklanadi", () => {
    const total = 500000
    expect(remainderForFirst(total, [row("800000")])).toBe(0)
    expect(remainderForFirst(total, [row("")])).toBe(500000)
    expect(remainderForFirst(total, [])).toBe(500000)
  })

  it("ortiqcha summa kamaytirilsa ham to'g'ri hisoblanadi", () => {
    const total = 500000
    expect(remainderForFirst(total, [row("800000")])).toBe(0)
    expect(remainderForFirst(total, [row("300000")])).toBe(200000)
  })

  it("bir nechta ortiqcha qatordan keyin ham tiklanadi", () => {
    const total = 500000
    expect(remainderForFirst(total, [row("400000"), row("400000")])).toBe(0)
    expect(remainderForFirst(total, [row("400000")])).toBe(100000)
    expect(remainderForFirst(total, [])).toBe(500000)
  })

  it("jami nol bo'lsa birinchisi ham nol", () => {
    expect(remainderForFirst(0, [row("100000")])).toBe(0)
  })
})
