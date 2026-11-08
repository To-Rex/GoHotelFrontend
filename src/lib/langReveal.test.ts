import { describe, expect, it } from "vitest"

import {
  COVER_MS,
  LANG_REVEAL_KEY,
  PENDING_TTL_MS,
  REVEAL_MS,
  clearPendingReveal,
  easeOut,
  readPendingReveal,
  savePendingReveal,
} from "./langReveal"

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}

describe("til almashinuvi nuqtasi", () => {
  it("saqlanadi, o'qiladi va o'chiriladi", () => {
    const s = new MemoryStorage()
    expect(readPendingReveal(s)).toBeNull()
    savePendingReveal({ x: 1200, y: 40, t: 1000 }, s)
    expect(JSON.parse(s.getItem(LANG_REVEAL_KEY)!)).toEqual({ x: 1200, y: 40, t: 1000 })
    expect(readPendingReveal(s, 1500)).toEqual({ x: 1200, y: 40, t: 1000 })
    // Sahna rangi ham saqlanadi; uzun/begona qiymat tashlanadi
    savePendingReveal({ x: 1, y: 2, t: 1000, c: "#fdf6e3" }, s)
    expect(readPendingReveal(s, 1000)).toEqual({ x: 1, y: 2, t: 1000, c: "#fdf6e3" })
    s.setItem(LANG_REVEAL_KEY, JSON.stringify({ x: 1, y: 2, t: 1000, c: "x".repeat(41) }))
    expect(readPendingReveal(s, 1000)).toEqual({ x: 1, y: 2, t: 1000 })
    clearPendingReveal(s)
    expect(readPendingReveal(s, 1500)).toBeNull()
    // Yopiq ombor — xato yutiladi
    expect(readPendingReveal(null)).toBeNull()
    expect(() => savePendingReveal({ x: 1, y: 1, t: 1 }, null)).not.toThrow()
    expect(() => clearPendingReveal(null)).not.toThrow()
  })

  it("eskirgan yoki buzilgan nuqta e'tiborga olinmaydi", () => {
    const s = new MemoryStorage()
    savePendingReveal({ x: 10, y: 10, t: 1000 }, s)
    expect(readPendingReveal(s, 1000 + PENDING_TTL_MS + 1)).toBeNull()
    // Soat orqaga ketgan bo'lsa ham
    expect(readPendingReveal(s, 1000 - PENDING_TTL_MS - 1)).toBeNull()
    s.setItem(LANG_REVEAL_KEY, "{bu json emas")
    expect(readPendingReveal(s, 1000)).toBeNull()
    s.setItem(LANG_REVEAL_KEY, JSON.stringify({ x: "12", y: 3, t: 1000 }))
    expect(readPendingReveal(s, 1000)).toBeNull()
    s.setItem(LANG_REVEAL_KEY, JSON.stringify({ x: Infinity, y: 3, t: 1000 }))
    expect(readPendingReveal(s, 1000)).toBeNull()
  })

  it("egri 0 dan 1 gacha, sekinlashib, chegaradan chiqmaydi", () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(-1)).toBe(0)
    expect(easeOut(2)).toBe(1)
    // Boshida tez: yarmida 87% dan oshgan
    expect(easeOut(0.5)).toBeGreaterThan(0.87)
    let prev = 0
    for (let i = 1; i <= 10; i++) {
      const v = easeOut(i / 10)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it("davomiyliklar oqilona: qoplash ochilishdan qisqa", () => {
    expect(COVER_MS).toBeLessThan(REVEAL_MS)
    expect(COVER_MS).toBeGreaterThan(150)
    expect(REVEAL_MS).toBeLessThan(1200)
  })
})
