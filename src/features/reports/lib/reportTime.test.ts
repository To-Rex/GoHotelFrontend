import { describe, expect, it } from "vitest"

import { EMPTY_HOURS, hasHours, hoursLabel, inWindow, isHHMM, resolveReportWindow } from "./reportTime"

const TZ = 300 // UTC+5

describe("resolveReportWindow", () => {
  it("soatsiz — o'zgarmaydi", () => {
    const w = resolveReportWindow("2026-11-14", "2026-11-14", EMPTY_HOURS)
    expect(w).toEqual({ dateFrom: "2026-11-14", dateTo: "2026-11-14", overnight: false, invalid: false })
    expect(hasHours(EMPTY_HOURS)).toBe(false)
  })

  it("kunduzgi smena — o'sha kun", () => {
    const w = resolveReportWindow("2026-11-14", "2026-11-14", { from: "08:00", to: "20:00" })
    expect(w).toMatchObject({ dateTo: "2026-11-14", timeFrom: "08:00", timeTo: "20:00", overnight: false, invalid: false })
    expect(hoursLabel(w)).toBe("08:00–20:00")
  })

  it("tungi smena — tugash ertasi kun, oy va yil chegarasida ham", () => {
    expect(resolveReportWindow("2026-11-14", "2026-11-14", { from: "20:00", to: "08:00" })).toMatchObject({
      dateTo: "2026-11-15",
      overnight: true,
      invalid: false,
    })
    expect(resolveReportWindow("2026-12-31", "2026-12-31", { from: "22:00", to: "06:00" }).dateTo).toBe("2027-01-01")
    // Teng soatlar — to'liq sutka (ertasi kun shu soatgacha)
    expect(resolveReportWindow("2026-11-14", "2026-11-14", { from: "08:00", to: "08:00" })).toMatchObject({
      dateTo: "2026-11-15",
      overnight: true,
    })
  })

  it("ko'p kunli davrda soatlar chetlarni belgilaydi, tungi o'tish yo'q", () => {
    const w = resolveReportWindow("2026-11-10", "2026-11-14", { from: "20:00", to: "08:00" })
    expect(w).toMatchObject({ dateFrom: "2026-11-10", dateTo: "2026-11-14", overnight: false, invalid: false })
  })

  it("faqat bitta soat, noto'g'ri format e'tiborsiz", () => {
    expect(resolveReportWindow("2026-11-14", "2026-11-14", { from: "14:30", to: "" })).toMatchObject({
      timeFrom: "14:30",
      timeTo: undefined,
      invalid: false,
    })
    expect(resolveReportWindow("2026-11-14", "2026-11-14", { from: "8:00", to: "25:00" }).timeFrom).toBeUndefined()
    expect(isHHMM("23:59")).toBe(true)
    expect(isHHMM("24:00")).toBe(false)
  })

  it("teskari oraliq — invalid", () => {
    expect(resolveReportWindow("2026-11-15", "2026-11-14", { from: "08:00", to: "20:00" }).invalid).toBe(true)
  })
})

describe("inWindow", () => {
  const day = resolveReportWindow("2026-11-14", "2026-11-14", { from: "08:00", to: "20:00" })
  const night = resolveReportWindow("2026-11-14", "2026-11-14", { from: "20:00", to: "08:00" })

  it("mahalliy vaqt bilan, tugash daqiqasi kirmaydi", () => {
    // 03:00 UTC = 08:00 mahalliy — kiradi
    expect(inWindow("2026-11-14T03:00:00Z", day, TZ)).toBe(true)
    // 14:59 UTC = 19:59 — kiradi; 15:00 UTC = 20:00 — kirmaydi (tungiga tegishli)
    expect(inWindow("2026-11-14T14:59:00Z", day, TZ)).toBe(true)
    expect(inWindow("2026-11-14T15:00:00Z", day, TZ)).toBe(false)
    expect(inWindow("2026-11-14T15:00:00Z", night, TZ)).toBe(true)
    // Ertasi 02:00 mahalliy (21:00 UTC 14-kun) — tungi smenada
    expect(inWindow("2026-11-14T21:00:00Z", night, TZ)).toBe(true)
    expect(inWindow("2026-11-15T03:00:00Z", night, TZ)).toBe(false)
    expect(inWindow(null, day, TZ)).toBe(false)
  })

  it("soatsiz — hammasi o'tadi (sana serverda filtrlangan)", () => {
    expect(inWindow("2026-11-14T15:00:00Z", resolveReportWindow("2026-11-14", "2026-11-14", EMPTY_HOURS), TZ)).toBe(true)
  })
})
