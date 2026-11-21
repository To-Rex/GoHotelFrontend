import { describe, expect, it } from "vitest"

import { tableView, initialTableState } from "@/lib/tableState"
import type { MissingCostBatch, ShopProfit, ShopProfitProduct } from "../api/shopProfit"
import {
  PRODUCT_SEARCH,
  PRODUCT_SORTS,
  costStatusBadge,
  hasActivity,
  isLossRow,
  lossParts,
  marginText,
  netFormula,
  netUnknown,
  profitUnknown,
  orderMissing,
  signed,
  toneOf,
  unitPreview,
} from "./shopProfit"

const bucket = (over = {}) => ({ count: 0, qty: 0, cost: 0, sale_value: 0, estimated: false, unknown_qty: 0, ...over })

const profit = (over: Partial<ShopProfit> = {}): ShopProfit => ({
  date_from: "2026-11-01",
  date_to: "2026-11-22",
  sales: { count: 3, items_qty: 15, revenue: 139000, unpaid: 6000 },
  revenue_covered: 124000,
  cost: { total: 72000, estimated: 12000 },
  gross_profit: 52000,
  margin: 41.94,
  uncovered: { revenue: 15000, qty: 3, products: 1 },
  below_cost: { qty: 0, loss: 0, products: 0 },
  writeoff: bucket({ count: 1, qty: 2, cost: 13000 }),
  shortage: bucket({ count: 1, qty: 3, cost: 12000 }),
  surplus: bucket({ count: 1, qty: 2, cost: 14000 }),
  losses: 25000,
  net_profit: 41000,
  stock: { qty: 0, cost_value: 0, sale_value: 0, covered_sale_value: 0, unknown_cost_qty: 0, potential_profit: 0 },
  products: [],
  missing_cost_batches: [],
  can_edit_cost: true,
  ...over,
})

const row = (over: Partial<ShopProfitProduct>): ShopProfitProduct => ({
  product_id: "p", name: "Cola", emoji: null, is_active: true, sold_qty: 1, revenue: 100, revenue_covered: 100,
  cost: 60, cost_estimated: 0, uncovered_qty: 0, uncovered_revenue: 0, estimated_qty: 0, below_cost_qty: 0,
  below_cost_loss: 0, writeoff_qty: 0, writeoff_cost: 0, shortage_qty: 0, shortage_cost: 0, surplus_qty: 0,
  surplus_cost: 0, loss_unknown_qty: 0, profit: 40, margin: 40, losses: 0, net: 40, cost_status: "exact",
  ...over,
})

describe("ishora va matnlar", () => {
  it("foyda, zarar va nol", () => {
    expect(toneOf(5)).toBe("pos")
    expect(toneOf(-5)).toBe("neg")
    expect(toneOf(0.2)).toBe("zero")
    expect(toneOf(null)).toBe("zero")
    expect(signed(52000)).toMatch(/^\+52.000$/)
    expect(signed(-2000)).toMatch(/^−2.000$/)
    expect(signed(0)).toBe("0")
  })

  it("marja bir xona bilan", () => {
    expect(marginText(41.94)).toMatch(/^41.9%$/)
    expect(marginText(40)).toBe("40%")
    expect(marginText(null)).toBe("—")
  })

  it("tannarx holati belgisi faqat aniq bo'lmaganda", () => {
    expect(costStatusBadge("exact")).toBeNull()
    expect(costStatusBadge("none")).toBeNull()
    expect(costStatusBadge("estimated")?.label).toBe("taxminiy")
    expect(costStatusBadge("unknown")?.label).toBe("tannarx yo'q")
    expect(costStatusBadge("partial")?.label).toBe("qisman")
  })
})

describe("yig'ma", () => {
  it("harakat bormi", () => {
    expect(hasActivity(profit())).toBe(true)
    const empty = profit({ sales: { count: 0, items_qty: 0, revenue: 0, unpaid: 0 }, writeoff: bucket(), shortage: bucket(), surplus: bucket() })
    expect(hasActivity(empty)).toBe(false)
    expect(hasActivity({ ...empty, writeoff: bucket({ count: 1 }) })).toBe(true)
  })

  it("yo'qotishlar tarkibi va sof foyda formulasi", () => {
    const p = profit()
    expect(lossParts(p)).toEqual([
      expect.stringMatching(/^spisaniye 13.000$/),
      expect.stringMatching(/^kamomad 12.000$/),
      expect.stringMatching(/^ortiqcha \+14.000$/),
    ])
    const f = netFormula(p)
    expect(f.map((x) => x.sign)).toEqual(["first", "minus", "minus", "plus"])
    expect(f[0].value - f[1].value - f[2].value + f[3].value).toBe(p.net_profit)
    // Spisaniye bo'lmasa — formulada ham yo'q
    expect(netFormula(profit({ writeoff: bucket(), shortage: bucket(), surplus: bucket() }))).toHaveLength(1)
  })
})

describe("mahsulotlar jadvali", () => {
  const rows = [
    row({ product_id: "a", name: "Cola", net: 40, margin: 40, revenue: 100 }),
    row({ product_id: "b", name: "Suv", net: -2000, margin: -33.3, revenue: 6000 }),
    row({ product_id: "c", name: "Choy", net: 0, margin: null, revenue: 15000, cost_status: "unknown" }),
  ]

  it("natija bo'yicha saralanadi, marjasi yo'q pastda", () => {
    const view = tableView(rows, initialTableState("net", "desc"), { search: PRODUCT_SEARCH, sort: PRODUCT_SORTS })
    expect(view.rows.map((r) => r.product_id)).toEqual(["a", "c", "b"])
    const byMargin = tableView(rows, initialTableState("margin", "desc"), { search: PRODUCT_SEARCH, sort: PRODUCT_SORTS })
    expect(byMargin.rows.map((r) => r.product_id)).toEqual(["a", "b", "c"])
    const found = tableView(rows, { ...initialTableState("net"), search: "suv" }, { search: PRODUCT_SEARCH, sort: PRODUCT_SORTS })
    expect(found.rows.map((r) => r.product_id)).toEqual(["b"])
  })

  it("tannarxi noma'lum — foyda va natija hisoblanmagan", () => {
    expect(profitUnknown(rows[2])).toBe(true)
    expect(netUnknown(rows[2])).toBe(true)
    // Yo'qotishi bo'lsa natija baribir ko'rsatiladi
    expect(netUnknown({ ...rows[2], losses: 5000 })).toBe(false)
    expect(profitUnknown(rows[0])).toBe(false)
  })

  it("zarar qatori", () => {
    expect(isLossRow(rows[1])).toBe(true)
    expect(isLossRow(rows[0])).toBe(false)
    expect(isLossRow(rows[2])).toBe(false)
  })
})

describe("tannarx kiritish", () => {
  const b = (over: Partial<MissingCostBatch>): MissingCostBatch => ({
    batch_id: "x", product_id: "p", product_name: "Cola", emoji: null, quantity: 10, remaining: 0,
    sold_in_period: 0, sale_price: 10000, created_at: "2026-11-01T08:00:00Z", ...over,
  })

  it("avval davrda sotilganlari, keyin qoldig'i ko'pi, keyin yangisi", () => {
    const out = orderMissing([
      b({ batch_id: "old", remaining: 5, created_at: "2026-10-01T00:00:00Z" }),
      b({ batch_id: "sold", sold_in_period: 2 }),
      b({ batch_id: "new", remaining: 5, created_at: "2026-11-10T00:00:00Z" }),
      b({ batch_id: "big", remaining: 9 }),
    ])
    expect(out.map((x) => x.batch_id)).toEqual(["sold", "big", "new", "old"])
  })

  it("bir dona foydasi oldindan", () => {
    expect(unitPreview(6000, 10000)).toEqual({ profit: 4000, margin: 40 })
    expect(unitPreview(12000, 10000)?.profit).toBe(-2000)
    expect(unitPreview(0, 10000)?.margin).toBe(100)
    expect(unitPreview(null, 10000)).toBeNull()
  })
})
