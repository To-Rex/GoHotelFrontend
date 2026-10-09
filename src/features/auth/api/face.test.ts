import { describe, expect, it } from "vitest"

import { faceStepDecision, skipReason } from "./face"

/* Kamerali qurilmada yuz bosqichi majburiy (faqat biriktirilgan yuz ochadi);
   kamerasiz kompyuterda yoki serverda dvigatel yo'q bo'lsa parol yetarli. */

describe("faceStepDecision", () => {
  it("kamera bor, server tekshira oladi — yuz so'raladi", () => {
    expect(faceStepDecision(true, true)).toBe("verify")
  })

  it("kamerasiz kompyuter — parol bilan kiradi", () => {
    expect(faceStepDecision(true, false)).toBe("skip")
    expect(skipReason(true)).toBe("qurilmada kamera topilmadi")
  })

  it("server yuzni tekshira olmaydi — parol yetarli (kamera bo'lsa ham)", () => {
    expect(faceStepDecision(false, true)).toBe("skip")
    expect(faceStepDecision(false, false)).toBe("skip")
    expect(skipReason(false)).toBe("serverda yuz tekshiruvi yo'q")
  })
})
