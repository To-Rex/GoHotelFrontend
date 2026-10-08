import { describe, expect, it } from "vitest"

import { faceStepDecision } from "./face"

/* Yuz biriktirgan hisobga faqat o'sha yuz bilan kiriladi: parol bilan
   o'tkazib yuborish faqat server yuzni tekshira olmaganda. */

describe("faceStepDecision", () => {
  it("kamera bor, server tekshira oladi — yuz so'raladi", () => {
    expect(faceStepDecision(true, true)).toBe("verify")
  })

  it("kamera yo'q, server tekshira oladi — kirish to'xtatiladi (yuzsiz yo'q)", () => {
    expect(faceStepDecision(true, false)).toBe("blocked")
  })

  it("server yuzni tekshira olmaydi — parol yetarli (kamera bo'lsa ham)", () => {
    expect(faceStepDecision(false, true)).toBe("skip")
    expect(faceStepDecision(false, false)).toBe("skip")
  })
})
