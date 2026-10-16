import { describe, expect, it, vi } from "vitest"

import {
  holdDebtToast,
  isDebtToastHeld,
  onDebtToastGateChange,
  releaseDebtToast,
  takePendingDebtToasts,
} from "./debtToastGate"

/* Bron oynasi ochiq — toast to'xtatiladi; to'lovsiz yopilsa ko'rsatiladi,
   to'lov bilan yopilsa umuman chiqmaydi. */

describe("debtToastGate", () => {
  it("ushlab turganda toast chiqmaydi", () => {
    holdDebtToast("r1")
    expect(isDebtToastHeld("r1")).toBe(true)
    expect(takePendingDebtToasts().has("r1")).toBe(false)
  })

  it("to'lov bilan yopilsa — kutilayotganlarga tushmaydi", () => {
    holdDebtToast("r2")
    releaseDebtToast("r2", true)
    expect(isDebtToastHeld("r2")).toBe(false)
    expect(takePendingDebtToasts().has("r2")).toBe(false)
  })

  it("to'lovsiz yopilsa — kutilayotganlarga tushadi va bir marta o'qiladi", () => {
    holdDebtToast("r3")
    releaseDebtToast("r3", false)
    const first = takePendingDebtToasts()
    expect(first.has("r3")).toBe(true)
    // Ikkinchi o'qishda bo'sh — toast takror chiqmasin
    expect(takePendingDebtToasts().size).toBe(0)
  })

  it("release'da obunachilarga xabar beriladi", () => {
    const listener = vi.fn()
    const off = onDebtToastGateChange(listener)
    releaseDebtToast("r4", false)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    releaseDebtToast("r5", false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("bo'sh id bilan hech narsa qilmaydi", () => {
    expect(() => releaseDebtToast(null, false)).not.toThrow()
    expect(() => holdDebtToast(null)).not.toThrow()
  })
})
