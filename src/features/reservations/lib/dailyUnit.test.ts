import { describe, expect, it } from "vitest"

import {
  dailyPriceMultiplier,
  lastOccupiedDay,
  reservationDailyUnit,
  resolveDailyUnit,
  selectionCheckoutFor,
} from "./dailyUnit"
import { dayDiff } from "./booking"

/* Kunlik bron hisobi: 12 soatlik (avvalgidek) va 24 soatlik. */

const nights = (start: string, end: string, unit: "12h" | "24h") => {
  const out = selectionCheckoutFor(start, end, unit)
  return out ? dayDiff(start, out) : 0
}

describe("resolveDailyUnit", () => {
  it("standart va buzuq qiymat — 12 soatlik", () => {
    expect(resolveDailyUnit(undefined)).toBe("12h")
    expect(resolveDailyUnit(null)).toBe("12h")
    expect(resolveDailyUnit({})).toBe("12h")
    expect(resolveDailyUnit({ daily_unit: "24" })).toBe("12h")
    expect(resolveDailyUnit({ daily_unit: "24h" })).toBe("24h")
  })
})

describe("selectionCheckoutFor", () => {
  it("12 soatlik — avvalgi tartib aynan saqlangan", () => {
    // Bitta kun: ertasi kuni chiqiladi
    expect(selectionCheckoutFor("2026-10-02", "2026-10-02", "12h")).toBe("2026-10-03")
    // Bugun + ertaga: oxirgi kun — chiqish kuni, 1 kecha
    expect(selectionCheckoutFor("2026-10-02", "2026-10-03", "12h")).toBe("2026-10-03")
    expect(nights("2026-10-02", "2026-10-03", "12h")).toBe(1)
    expect(nights("2026-10-02", "2026-10-05", "12h")).toBe(3)
  })

  it("24 soatlik — har tanlangan kun to'liq kun", () => {
    expect(selectionCheckoutFor("2026-10-02", "2026-10-02", "24h")).toBe("2026-10-03")
    // Bugun + ertaga: 2 kun, chiqish indinga — narx 2 barobar
    expect(selectionCheckoutFor("2026-10-02", "2026-10-03", "24h")).toBe("2026-10-04")
    expect(nights("2026-10-02", "2026-10-03", "24h")).toBe(2)
    expect(nights("2026-10-02", "2026-10-02", "24h")).toBe(1)
    // Oy chegarasidan o'tadi
    expect(selectionCheckoutFor("2026-10-30", "2026-10-31", "24h")).toBe("2026-11-01")
  })

  it("tanlov to'liq bo'lmasa — null", () => {
    expect(selectionCheckoutFor(null, null, "24h")).toBeNull()
    expect(selectionCheckoutFor("2026-10-02", null, "12h")).toBeNull()
  })
})

describe("lastOccupiedDay", () => {
  it("12 soatlik — chiqish kuni ham band (avvalgidek)", () => {
    expect(lastOccupiedDay("2026-10-02", "2026-10-04", "12h")).toBe("2026-10-04")
  })

  it("24 soatlik — faqat to'lanadigan kunlar band", () => {
    expect(lastOccupiedDay("2026-10-02", "2026-10-04", "24h")).toBe("2026-10-03")
    expect(lastOccupiedDay("2026-10-02", "2026-10-03", "24h")).toBe("2026-10-02")
    // Buzuq yozuv (chiqish = kirish) — kirish kunidan oldinga ketmaydi
    expect(lastOccupiedDay("2026-10-02", "2026-10-02", "24h")).toBe("2026-10-02")
  })
})

describe("dailyPriceMultiplier", () => {
  it("24 soatlik kun = 2 × 12 soatlik narx (server bilan bir xil)", () => {
    expect(dailyPriceMultiplier("24h")).toBe(2)
    expect(dailyPriceMultiplier("24h", "DAILY")).toBe(2)
    expect(dailyPriceMultiplier("12h")).toBe(1)
    expect(dailyPriceMultiplier(undefined)).toBe(1)
    // Soatlik bronga tegishli emas
    expect(dailyPriceMultiplier("24h", "HOURLY")).toBe(1)
    // 250 000 so'mlik xona, 1 kun — 500 000
    expect(nights("2026-10-02", "2026-10-02", "24h") * 250_000 * dailyPriceMultiplier("24h")).toBe(500_000)
    // Bugun + ertaga: 12 soatlikda 1 kecha (250 000), 24 soatlikda 2 kun (1 000 000)
    expect(nights("2026-10-02", "2026-10-03", "12h") * 250_000 * dailyPriceMultiplier("12h")).toBe(250_000)
    expect(nights("2026-10-02", "2026-10-03", "24h") * 250_000 * dailyPriceMultiplier("24h")).toBe(1_000_000)
  })

  it("bronning o'z rejimi; eski javob — 12 soatlik", () => {
    expect(reservationDailyUnit({ daily_unit: "24h" })).toBe("24h")
    expect(reservationDailyUnit({})).toBe("12h")
    expect(reservationDailyUnit(null)).toBe("12h")
  })
})
