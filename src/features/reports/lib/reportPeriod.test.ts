import { describe, expect, it } from "vitest"
import { buildDatePresets } from "@/lib/datePresets"
import { effectivePresetKey, visiblePresets } from "./reportPeriod"

const presets = buildDatePresets(new Date("2026-09-25"), { withYesterday: true }).filter(
  (p) => p.key !== "all"
)

describe("visiblePresets", () => {
  it("admin/menejer — hamma tugmalar, tartib o'zgarmaydi", () => {
    expect(visiblePresets(presets, true).map((p) => p.key)).toEqual(
      presets.map((p) => p.key)
    )
  })

  it("qabulxona — faqat Bugun va Kecha", () => {
    expect(visiblePresets(presets, false).map((p) => p.label)).toEqual([
      "Bugun",
      "Kecha",
    ])
  })

  it("asl ro'yxatni o'zgartirmaydi", () => {
    const before = presets.length
    visiblePresets(presets, false)
    expect(presets.length).toBe(before)
  })
})

describe("effectivePresetKey", () => {
  const quick = visiblePresets(presets, false)

  it("to'liq huquqda tanlov o'z holicha, null (qo'lda oraliq) ham", () => {
    expect(effectivePresetKey("month", presets, true)).toBe("month")
    expect(effectivePresetKey(null, presets, true)).toBeNull()
  })

  it("cheklangan xodimda ruxsat etilgan kalit qoladi", () => {
    expect(effectivePresetKey("yesterday", quick, false)).toBe("yesterday")
    expect(effectivePresetKey("today", quick, false)).toBe("today")
  })

  it("cheklangan xodimda yopiq davr yoki qo'lda oraliq — Bugun", () => {
    // Ruxsatlar kelishidan oldin tanlangan bo'lishi mumkin — so'rov yopiq
    // davrga ketmasin
    expect(effectivePresetKey("month", quick, false)).toBe("today")
    expect(effectivePresetKey("week", quick, false)).toBe("today")
    expect(effectivePresetKey(null, quick, false)).toBe("today")
  })
})
