import { describe, expect, it } from "vitest"

import { hasNonCashIncome, nonCashBuckets } from "./methodSummary"

/* Naqdsiz to'lovlar sessiya ko'rsatkichi: usul bo'yicha yig'indi, eski
   kodlarni kanonik usulga birlashtirish va "har smenada 0 dan boshlanadi"
   qoidasining ekranda ko'rinishi. */

const row = (method: string, payments = 0, shop = 0) => ({
  method,
  payments,
  shop,
  expenses: 0,
  income: payments + shop,
})

describe("nonCashBuckets", () => {
  it("naqdni chiqarib tashlaydi va usullarni yig'adi", () => {
    const buckets = nonCashBuckets([
      row("CASH", 700000, 40000),
      row("ONLINE", 120000),
      row("CARD", 50000, 25000),
    ])
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b.amount]))
    expect(byKey.CASH).toBeUndefined()
    expect(byKey.ONLINE).toBe(120000)
    expect(byKey.CARD).toBe(75000) // bron to'lovi + do'kon savdosi
    expect(byKey.BANK_TRANSFER).toBe(0)
  })

  it("eski kodlarni kanonik usulga birlashtiradi", () => {
    const buckets = nonCashBuckets([
      row("CREDIT_CARD", 30000),
      row("DEBIT_CARD", 20000),
      row("MOBILE_PAYMENT", 10000),
      row("TRANSFER", 5000),
    ])
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b.amount]))
    expect(byKey.CARD).toBe(50000)
    expect(byKey.ONLINE).toBe(10000)
    expect(byKey.BANK_TRANSFER).toBe(5000)
  })

  it("har yangi smenada asosiy usullar 0 bilan qaytadi", () => {
    const buckets = nonCashBuckets([])
    expect(buckets.map((b) => b.key)).toEqual(["CARD", "ONLINE", "BANK_TRANSFER"])
    expect(buckets.every((b) => b.amount === 0)).toBe(true)
    expect(hasNonCashIncome([])).toBe(false)
  })

  it("notanish kodni Boshqa usulga qo'shadi — faqat mavjud bo'lsa", () => {
    const withOther = nonCashBuckets([row("WALLET", 7000)])
    const other = withOther.find((b) => b.key === "OTHER")
    expect(other?.amount).toBe(7000)
    // Summa bo'lmasa qator umuman chiqmaydi
    const without = nonCashBuckets([row("CARD", 1000)])
    expect(without.some((b) => b.key === "OTHER")).toBe(false)
  })

  it("ma'lumot kelmasa ham (eski javob) 0 to'plam qaytaradi", () => {
    expect(nonCashBuckets(undefined).map((b) => b.amount)).toEqual([0, 0, 0])
    expect(nonCashBuckets(null).map((b) => b.amount)).toEqual([0, 0, 0])
  })
})
