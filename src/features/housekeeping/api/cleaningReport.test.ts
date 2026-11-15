import { describe, expect, it } from "vitest"

import { cleaningHealth, cleaningSegments, formatMinutes, type CleaningSummary } from "./cleaningReport"

const summary = (over: Partial<CleaningSummary> = {}): CleaningSummary => ({
  checkouts: 20,
  with_task: 18,
  cleaned_by_person: 14,
  auto_closed: 3,
  still_open: 1,
  cancelled: 0,
  no_task: 2,
  avg_wait_minutes: 12,
  avg_work_minutes: 35,
  verified_percent: 70,
  ...over,
})

describe("cleaningSegments", () => {
  it("nol bo'laklar tushib qoladi, yig'indi chiqishlarga teng", () => {
    const segs = cleaningSegments(summary())
    expect(segs.map((s) => s.key)).toEqual(["by_person", "auto", "open", "no_task"])
    expect(segs.reduce((a, s) => a + s.count, 0)).toBe(20)
    expect(segs[0].percent).toBe(70)
    expect(segs[1].percent).toBe(15)
  })

  it("chiqish bo'lmasa — bo'sh", () => {
    expect(cleaningSegments(summary({ checkouts: 0 }))).toEqual([])
  })
})

describe("cleaningHealth", () => {
  it("baho chegaralari", () => {
    expect(cleaningHealth(summary({ verified_percent: 90, no_task: 0 }))).toBe("good")
    // 90% bo'lsa ham vazifasiz chiqish bor — ogohlantirish
    expect(cleaningHealth(summary({ verified_percent: 90, no_task: 1 }))).toBe("warn")
    expect(cleaningHealth(summary({ verified_percent: 70 }))).toBe("warn")
    expect(cleaningHealth(summary({ verified_percent: 40 }))).toBe("bad")
    expect(cleaningHealth(summary({ checkouts: 0, verified_percent: null }))).toBe("none")
  })
})

describe("formatMinutes", () => {
  it("daqiqa va soat", () => {
    expect(formatMinutes(null)).toBe("—")
    expect(formatMinutes(45)).toBe("45 daq")
    expect(formatMinutes(80)).toBe("1 soat 20 daq")
    expect(formatMinutes(120)).toBe("2 soat")
  })
})
