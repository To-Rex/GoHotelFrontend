import { describe, expect, it } from "vitest"

import type { ShopBatch } from "../api/shop"
import {
  applyToRemaining,
  changedItems,
  formatPrice,
  parsePrice,
  priceRows,
  rowChanged,
  rowError,
  unitMargin,
} from "./batchPrices"

const b = (over: Partial<ShopBatch>): ShopBatch => ({
  id: "b1",
  quantity: 10,
  remaining: 10,
  cost_price: 6000,
  sale_price: 10000,
  created_at: "2026-11-01T08:00:00Z",
  ...over,
})

const product = () => ({
  batches: [
    b({ id: "new", created_at: "2026-11-10T08:00:00Z", cost_price: null, sale_price: 11000 }),
    b({ id: "old", created_at: "2026-11-01T08:00:00Z" }),
    b({ id: "done", created_at: "2026-10-01T08:00:00Z", remaining: 0, cost_price: null, sale_price: 9000 }),
  ],
})

describe("narx maydoni", () => {
  it("formatlash va o'qish (0 ham son)", () => {
    expect(formatPrice("12000")).toBe("12 000")
    expect(formatPrice("abc1 2x3")).toBe("123")
    expect(formatPrice("")).toBe("")
    expect(parsePrice("12 000")).toBe(12000)
    expect(parsePrice("0")).toBe(0)
    expect(parsePrice("")).toBeNull()
  })
})

describe("partiyalar qatori", () => {
  it("FIFO tartibi: qoldiqlilar tepada, hozir sotilayotgani belgilangan", () => {
    const rows = priceRows(product())
    expect(rows.map((r) => r.batch.id)).toEqual(["old", "new", "done"])
    expect(rows.map((r) => r.current)).toEqual([true, false, false])
    expect(rows.map((r) => r.depleted)).toEqual([false, false, true])
    expect(rows[0].sale).toBe("10 000")
    expect(rows[1].cost).toBe("")
  })

  it("faqat o'zgargan qiymat yuboriladi", () => {
    const rows = priceRows(product())
    expect(changedItems(rows)).toEqual([])
    rows[0] = { ...rows[0], sale: "12 000" }
    rows[1] = { ...rows[1], cost: "7 000" }
    // Tugagan partiyaning sotuv narxi o'zgarmaydi, olish narxi o'zgaradi
    rows[2] = { ...rows[2], sale: "1", cost: "5 000" }
    expect(changedItems(rows)).toEqual([
      { batch_id: "old", sale_price: 12000 },
      { batch_id: "new", cost_price: 7000 },
      { batch_id: "done", cost_price: 5000 },
    ])
    expect(rowChanged(rows[0])).toBe(true)
  })

  it("olish narxini o'chirish — null", () => {
    const rows = priceRows(product())
    rows[0] = { ...rows[0], cost: "" }
    expect(changedItems(rows)).toEqual([{ batch_id: "old", cost_price: null }])
  })

  it("sotuv narxi bo'sh yoki 0 — xato (tugagan partiyada emas)", () => {
    const rows = priceRows(product())
    expect(rowError({ ...rows[0], sale: "" })).toBe("sale_required")
    expect(rowError({ ...rows[0], sale: "0" })).toBe("sale_required")
    expect(rowError({ ...rows[2], sale: "" })).toBeNull()
    // Xato qiymat yuborilmaydi
    expect(changedItems([{ ...rows[0], sale: "" }])).toEqual([])
  })

  it("barcha qoldiqli partiyalarga bir narx — bo'sh maydon tegilmaydi", () => {
    const out = applyToRemaining(priceRows(product()), "12000", "")
    expect(out.map((r) => [r.sale, r.cost])).toEqual([
      ["12 000", "6 000"],
      ["12 000", ""],
      ["9 000", ""],
    ])
    expect(applyToRemaining(out, "", "7000").map((r) => r.cost)).toEqual(["7 000", "7 000", ""])
  })

  it("bir dona foydasi", () => {
    const [row] = priceRows(product())
    expect(unitMargin(row)).toEqual({ profit: 4000, margin: 40 })
    expect(unitMargin({ ...row, cost: "" })).toBeNull()
    expect(unitMargin({ ...row, cost: "12 000" })?.profit).toBe(-2000)
  })
})
