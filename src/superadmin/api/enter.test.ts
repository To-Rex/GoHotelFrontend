import { describe, expect, it } from "vitest"

import { safeEntryPath, seedMainAppSession } from "./enter"

/* Paneldan mehmonxonaga kirish: asosiy tizim sessiyasi brauzer xotirasiga
   store/auth.ts o'qiydigan shaklda yoziladi; yo'l faqat ilova ichidagi. */

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

describe("seedMainAppSession", () => {
  it("tokenlar va profil asosiy tizim kutgan kalitlarda", () => {
    const storage = new MemoryStorage()
    seedMainAppSession(storage, {
      access_token: "acc",
      refresh_token: "ref",
      user: { id: "u1", user_type: "CONFIGURATOR", hotel_id: "h1", branch_id: "b2", branch_name: "Chilonzor" },
      hotel: { id: "h1", name: "Grand", code: "GR" },
    })
    expect(storage.getItem("accessToken")).toBe("acc")
    expect(storage.getItem("refreshToken")).toBe("ref")
    const auth = JSON.parse(storage.getItem("auth-storage") || "{}")
    expect(auth.version).toBe(0)
    expect(auth.state.isAuthenticated).toBe(true)
    expect(auth.state.user.branch_name).toBe("Chilonzor")
  })
})

describe("safeEntryPath", () => {
  it("faqat ilova ichidagi yo'l, aks holda /start", () => {
    expect(safeEntryPath("/settings")).toBe("/settings")
    expect(safeEntryPath("/rooms?x=1")).toBe("/rooms?x=1")
    expect(safeEntryPath(undefined)).toBe("/start")
    expect(safeEntryPath("")).toBe("/start")
    expect(safeEntryPath("https://evil.example")).toBe("/start")
    expect(safeEntryPath("//evil.example")).toBe("/start")
  })
})
