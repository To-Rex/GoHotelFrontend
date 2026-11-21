import { describe, expect, it } from "vitest"

import {
  MAX_DAY_BARS,
  agingLabel,
  dayBars,
  invoiceStatusLabel,
  lineLabel,
  methodLabel,
  percentText,
  purposeLabel,
  shareRows,
  tickStep,
} from "./financeStats"

describe("yorliqlar", () => {
  it("to'lov turi, nima uchun, qator turi, qarz yoshi, holat", () => {
    expect(methodLabel("CASH")).toBe("Naqd pul")
    expect(methodLabel("OTHER")).toBe("Boshqa")
    expect(methodLabel("MIXED")).toBe("Aralash")
    expect(purposeLabel("PENALTY")).toBe("Jarima")
    expect(purposeLabel("NOMA")).toBe("NOMA")
    expect(lineLabel("ROOM_CHARGE")).toBe("Xona haqi")
    expect(agingLabel("90_plus")).toBe("90 kundan ko'p")
    expect(invoiceStatusLabel("PAID")).toBe("To'langan")
    // Eski "CANCELLED" — "Bekor qilingan" bilan bir xil
    expect(invoiceStatusLabel("CANCELLED")).toBe(invoiceStatusLabel("VOID"))
  })
})

describe("ulushlar", () => {
  it("chiziq eng kattasiga, foiz jami musbatga nisbatan; manfiy alohida", () => {
    const rows = shareRows(
      [
        { key: "ROOM", amount: 300 },
        { key: "PENALTY", amount: 100 },
        { key: "REFUND", amount: -50 },
        { key: "ZERO", amount: 0 },
      ],
      purposeLabel
    )
    expect(rows.map((r) => r.width)).toEqual([100, expect.closeTo(33.33, 1), expect.closeTo(16.67, 1), 0])
    expect(rows[0].share).toBe(75)
    expect(rows[1].share).toBe(25)
    expect(rows[2].share).toBeNull()
    expect(rows[2].negative).toBe(true)
    expect(rows[0].label).toBe("Xona")
  })

  it("juda kichik qiymat ham ko'rinadi (kamida 2%)", () => {
    const rows = shareRows([{ key: "A", amount: 1_000_000 }, { key: "B", amount: 1 }], (k) => k)
    expect(rows[1].width).toBe(2)
  })

  it("foiz matni", () => {
    expect(percentText(75)).toBe("75%")
    expect(percentText(4.25)).toMatch(/^4.3%$/)
    expect(percentText(0.04)).toBe("<0.1%")
    expect(percentText(null)).toBe("—")
  })
})

describe("kunlik ustunlar", () => {
  it("davr ichidagi bo'sh kunlar 0 bilan to'ldiriladi", () => {
    const bars = dayBars(
      [
        { date: "2026-11-03", amount: 50, count: 1 },
        { date: "2026-11-01", amount: 300, count: 2 },
      ],
      "2026-11-01",
      "2026-11-04"
    )
    expect(bars.map((b) => [b.key, b.amount, b.count])).toEqual([
      ["2026-11-01", 300, 2],
      ["2026-11-02", 0, 0],
      ["2026-11-03", 50, 1],
      ["2026-11-04", 0, 0],
    ])
    expect(bars[0].tick).toBe("1")
    expect(bars[0].title).toBe("1 noyabr")
  })

  it("davr berilmasa — birinchi va oxirgi to'lov oralig'i", () => {
    const bars = dayBars([
      { date: "2026-11-05", amount: 1, count: 1 },
      { date: "2026-11-07", amount: 1, count: 1 },
    ])
    expect(bars.map((b) => b.key)).toEqual(["2026-11-05", "2026-11-06", "2026-11-07"])
  })

  it(`${MAX_DAY_BARS} kundan uzun davr — oylar bo'yicha`, () => {
    const bars = dayBars(
      [
        { date: "2026-01-10", amount: 100, count: 1 },
        { date: "2026-01-20", amount: 50, count: 2 },
        { date: "2026-03-05", amount: 70, count: 1 },
      ],
      "2026-01-01",
      "2026-03-31"
    )
    expect(bars.map((b) => [b.key, b.amount, b.count])).toEqual([
      ["2026-01", 150, 3],
      ["2026-03", 70, 1],
    ])
    expect(bars[0].title).toBe("yanvar 2026")
  })

  it("bo'sh ro'yxat va yozuv qadami", () => {
    expect(dayBars([], "2026-11-01", "2026-11-30")).toEqual([])
    expect(tickStep(7)).toBe(1)
    expect(tickStep(30)).toBe(2)
    expect(tickStep(40)).toBe(5)
    expect(tickStep(62)).toBe(7)
  })
})
