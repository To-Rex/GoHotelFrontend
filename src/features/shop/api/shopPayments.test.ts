import { describe, expect, it } from "vitest"

import { isPartiallyPaid, partsProblem, salePaid, saleRemaining } from "./shop"
import { emptyPartRows, partsOf } from "../components/PaymentPartsEditor"

/* Do'kon savdosini qisman va aralash to'lash — yordamchilar (server bilan
   bir xil qoidalar: shop_payments.py). */

const sale = (over: Record<string, unknown> = {}) =>
  ({ status: "PENDING", total_amount: 100_000, ...over }) as Parameters<typeof salePaid>[0] & {
    remaining_amount?: number
  }

describe("salePaid / saleRemaining", () => {
  it("server maydonlari bo'lsa — o'shalar", () => {
    const s = sale({ paid_amount: 30_000, remaining_amount: 70_000 })
    expect(salePaid(s)).toBe(30_000)
    expect(saleRemaining(s)).toBe(70_000)
    expect(isPartiallyPaid(s)).toBe(true)
  })

  it("eski server javobi — holatdan", () => {
    expect(salePaid(sale({ status: "PAID" }))).toBe(100_000)
    expect(saleRemaining(sale({ status: "PAID" }))).toBe(0)
    expect(salePaid(sale())).toBe(0)
    expect(saleRemaining(sale())).toBe(100_000)
    expect(isPartiallyPaid(sale())).toBe(false)
    expect(isPartiallyPaid(sale({ status: "PAID" }))).toBe(false)
  })
})

describe("partsProblem", () => {
  it("qisman: jami qoldiqdan oshmasa bo'ladi", () => {
    expect(partsProblem([{ amount: 20_000 }, { amount: 30_000 }], 70_000)).toBeNull()
    expect(partsProblem([{ amount: 70_000 }], 70_000)).toBeNull()
    expect(partsProblem([{ amount: 40_000 }, { amount: 40_000 }], 70_000)).toBe("exceeds")
    expect(partsProblem([{ amount: 0 }], 70_000)).toBe("empty")
    expect(partsProblem([], 70_000)).toBe("empty")
  })
})

describe("partsOf", () => {
  it("bo'sh qatorlar tashlanadi, usul saqlanadi", () => {
    const rows = emptyPartRows()
    rows[0].amount = "20000"
    expect(partsOf(rows)).toEqual([{ amount: 20000, payment_method: "CASH" }])
    rows[1].amount = "abc"
    expect(partsOf(rows)).toHaveLength(1)
  })
})
