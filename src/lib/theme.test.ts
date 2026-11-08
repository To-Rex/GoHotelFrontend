import { describe, expect, it } from "vitest"

import {
  FADE_MS,
  REVEAL_MS,
  THEME_KEY,
  nextTheme,
  persistTheme,
  readStoredTheme,
  revealRadius,
} from "./theme"

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

describe("mavzu", () => {
  it("navbatdagi mavzu teskarisi", () => {
    expect(nextTheme("light")).toBe("dark")
    expect(nextTheme("dark")).toBe("light")
  })

  it("saqlangan tanlov faqat ma'lum qiymatlarda, yopiq omborda null", () => {
    const s = new MemoryStorage()
    expect(readStoredTheme(s)).toBeNull()
    persistTheme("dark", s)
    expect(s.getItem(THEME_KEY)).toBe("dark")
    expect(readStoredTheme(s)).toBe("dark")
    s.setItem(THEME_KEY, "purple")
    expect(readStoredTheme(s)).toBeNull()
    expect(readStoredTheme(null)).toBeNull()
    const broken = { getItem: () => { throw new Error("blocked") } }
    expect(readStoredTheme(broken)).toBeNull()
    // Saqlash xatosi yutiladi
    expect(() => persistTheme("light", { setItem: () => { throw new Error("blocked") } })).not.toThrow()
  })

  it("doira radiusi eng uzoq burchakka yetadi", () => {
    // Chap yuqori burchakdan — diagonal
    expect(revealRadius(0, 0, 300, 400)).toBe(500)
    // Markazdan — yarim diagonal
    expect(revealRadius(150, 200, 300, 400)).toBe(250)
    // O'ng pastdan ham diagonal
    expect(revealRadius(300, 400, 300, 400)).toBe(500)
    // Har doim butun son, yuqoriga yaxlitlangan
    expect(Number.isInteger(revealRadius(10, 10, 333, 777))).toBe(true)
  })

  it("animatsiya vaqtlari oqilona", () => {
    expect(REVEAL_MS).toBeGreaterThan(300)
    expect(REVEAL_MS).toBeLessThan(1200)
    expect(FADE_MS).toBeGreaterThan(200)
  })
})
