import { describe, expect, it } from "vitest"

import { DEFAULT_RECEIPT_SETTINGS, type ShopSale } from "@/features/shop/api/shop"

import { buildReceiptElements } from "./tprints"

const sale: ShopSale = {
  id: "abcdef12-0000-0000-0000-000000000000",
  reservation_id: null,
  reservation_number: null,
  guest_name: null,
  total_amount: 24000,
  payment_method: "CASH",
  status: "PAID",
  paid_at: "2026-11-05T09:07:00+00:00",
  created_by: "",
  created_by_name: "Aziza",
  created_at: "2026-11-05T09:07:00+00:00",
  items: [{ product_id: "1", product_name: "Coca-Cola 0.5", quantity: 2, unit_price: 12000, total_price: 24000 }],
}

const rows = (els: any[]) => els.filter((e) => e.type === "row").map((e) => [e.left, e.right])

describe("do'kon cheki — 'Sana'", () => {
  it("serverdagi UTC daqiqa mehmonxona vaqtida (+05:00) chiqadi, kompyuter zonasiga bog'liq emas", () => {
    const els = buildReceiptElements(sale, "Grand", null, DEFAULT_RECEIPT_SETTINGS)
    expect(rows(els)).toContainEqual(["Sana:", "05.11.2026 14:07"])
  })

  it("vaqt belgisi bo'lmasa — hozirgi vaqt (bo'sh qolmaydi)", () => {
    const els = buildReceiptElements({ ...sale, created_at: null as unknown as string }, "Grand", null, DEFAULT_RECEIPT_SETTINGS)
    const sana = rows(els).find(([l]) => l === "Sana:")?.[1]
    expect(sana).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)
  })
})
