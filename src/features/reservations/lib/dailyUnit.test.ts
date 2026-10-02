import { describe, expect, it } from "vitest"

import { lastOccupiedDay, resolveDailyUnit, selectionCheckoutFor } from "./dailyUnit"
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
