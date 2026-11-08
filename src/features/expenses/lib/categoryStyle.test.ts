import { describe, expect, it } from "vitest"

import type { ExpenseCategory } from "../api/expenseCategories"
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  COLOR_KEYS,
  DEFAULT_CATEGORY_NAMES,
  FALLBACK_COLOR,
  FALLBACK_ICON,
  ICON_KEYS,
  categoryVisual,
  findCategory,
  formatAmountInput,
  hashColor,
  nameKey,
  parseAmountInput,
  titlePlaceholder,
} from "./categoryStyle"

/* Serverdagi ro'yxatlar (app/shared/expense_categories.py) — mijoz
   ularning hammasini bilishi kerak, aks holda ekranda bo'sh joy chiqadi. */
const BACKEND_ICONS = [
  "wallet", "zap", "flame", "droplets", "wifi", "utensils", "shopping-basket",
  "washing-machine", "wrench", "car", "landmark", "megaphone", "ellipsis",
  "tag", "hammer", "paintbrush", "truck", "phone", "shield-check", "users",
  "gift", "package", "bed", "sparkles", "receipt", "banknote", "building-2",
  "fuel", "lightbulb", "thermometer", "printer", "monitor", "scissors",
  "leaf", "bath", "coins", "percent", "heart-handshake", "cable",
  "briefcase-business", "stethoscope", "bus", "shirt",
]
const BACKEND_COLORS = [
  "gray", "slate", "red", "orange", "amber", "lime", "emerald", "teal",
  "sky", "indigo", "violet", "fuchsia", "rose",
]
const BACKEND_DEFAULTS: Array<[string, string, string]> = [
  ["Ish haqi", "wallet", "emerald"],
  ["Elektr energiyasi", "zap", "amber"],
  ["Gaz", "flame", "orange"],
  ["Suv", "droplets", "sky"],
  ["Internet va aloqa", "wifi", "indigo"],
  ["Oziq-ovqat", "utensils", "rose"],
  ["Xo'jalik buyumlari", "shopping-basket", "lime"],
  ["Kir yuvish", "washing-machine", "teal"],
  ["Ta'mirlash", "wrench", "slate"],
  ["Transport", "car", "violet"],
  ["Soliqlar", "landmark", "red"],
  ["Reklama", "megaphone", "fuchsia"],
  ["Boshqa", "ellipsis", "gray"],
]

const cat = (name: string, icon: string | null = "zap", color: string | null = "amber"): ExpenseCategory => ({
  id: name,
  hotel_id: "h",
  name,
  icon,
  color,
  sort_order: 0,
  is_active: true,
  usage_count: 0,
  usage_total: 0,
})

describe("server bilan moslik", () => {
  it("barcha server belgilari va ranglari mijozda bor", () => {
    expect([...ICON_KEYS].sort()).toEqual([...BACKEND_ICONS].sort())
    expect([...COLOR_KEYS].sort()).toEqual([...BACKEND_COLORS].sort())
    for (const key of ICON_KEYS) expect(CATEGORY_ICONS[key]).toBeTruthy()
    for (const key of COLOR_KEYS) {
      const style = CATEGORY_COLORS[key]
      expect(style.chip).toContain(`-`)
      expect(style.selected).toContain("border-")
    }
  })

  it("standart toifalar nomi serverdagi bilan bir xil va belgilari ma'lum", () => {
    expect([...DEFAULT_CATEGORY_NAMES]).toEqual(BACKEND_DEFAULTS.map(([n]) => n))
    for (const [, icon, color] of BACKEND_DEFAULTS) {
      expect(ICON_KEYS).toContain(icon)
      expect(COLOR_KEYS).toContain(color)
    }
  })
})

describe("nom kaliti va rang", () => {
  it("harf kattaligi va bo'shliqlar farq qilmaydi", () => {
    expect(nameKey("  Ish   haqi ")).toBe("ish haqi")
    expect(nameKey("ISH HAQI")).toBe(nameKey("ish haqi"))
    expect(nameKey(null)).toBe("")
  })

  it("nomdan rang barqaror va palitradan, kulrang emas", () => {
    expect(hashColor("Qo'riqlash")).toBe(hashColor(" qo'riqlash "))
    for (const name of ["Qo'riqlash", "Avans", "Kanstovar", "Sug'urta"]) {
      const color = hashColor(name)
      expect(COLOR_KEYS).toContain(color)
      expect(["gray", "slate"]).not.toContain(color)
    }
    expect(hashColor("")).toBe(FALLBACK_COLOR)
  })
})

describe("toifa ko'rinishi", () => {
  const list = [cat("Gaz", "flame", "orange"), cat("Ish haqi", "wallet", "emerald"), cat("Eski", null, null)]

  it("ro'yxatdagi toifa o'z belgisi va rangi bilan, nom yozilishidan qat'i nazar", () => {
    expect(findCategory(" gaz ", list)?.name).toBe("Gaz")
    const v = categoryVisual("GAZ", list)
    expect(v.known).toBe(true)
    expect(v.colorKey).toBe("orange")
    expect(v.Icon).toBe(CATEGORY_ICONS.flame)
  })

  it("belgisi/rangi bo'sh toifa standart belgi va kulrang oladi", () => {
    const v = categoryVisual("Eski", list)
    expect(v.known).toBe(true)
    expect(v.Icon).toBe(CATEGORY_ICONS[FALLBACK_ICON])
    expect(v.colorKey).toBe(FALLBACK_COLOR)
  })

  it("ro'yxatda yo'q nom teg belgisi va nomdan tanlangan rang oladi", () => {
    const v = categoryVisual("Qo'riqlash", list)
    expect(v.known).toBe(false)
    expect(v.Icon).toBe(CATEGORY_ICONS.tag)
    expect(v.colorKey).toBe(hashColor("Qo'riqlash"))
    // Bo'sh toifa — kulrang
    expect(categoryVisual(null, list).colorKey).toBe(FALLBACK_COLOR)
    expect(categoryVisual("", []).known).toBe(false)
  })
})

describe("summa maydoni", () => {
  it("raqamlarni minglik bo'shliq bilan ko'rsatadi", () => {
    expect(formatAmountInput("150000")).toBe("150 000")
    expect(formatAmountInput("1 500 000")).toBe("1 500 000")
    expect(formatAmountInput("12")).toBe("12")
    expect(formatAmountInput("007")).toBe("7")
    expect(formatAmountInput("abc")).toBe("")
    expect(formatAmountInput("")).toBe("")
  })

  it("formatlangan satrdan sonni qaytaradi, bo'sh va nol — null", () => {
    expect(parseAmountInput("150 000")).toBe(150000)
    expect(parseAmountInput("1 500 000 so'm")).toBe(1500000)
    expect(parseAmountInput("0")).toBeNull()
    expect(parseAmountInput("")).toBeNull()
    expect(parseAmountInput(formatAmountInput("98765"))).toBe(98765)
  })
})

describe("nom namunasi", () => {
  it("toifaga mos, noma'lum toifada umumiy", () => {
    expect(titlePlaceholder("ish haqi")).toContain("oyligi")
    expect(titlePlaceholder("Gaz")).toContain("gaz")
    expect(titlePlaceholder("Qo'riqlash")).toBe(titlePlaceholder(null))
  })
})
