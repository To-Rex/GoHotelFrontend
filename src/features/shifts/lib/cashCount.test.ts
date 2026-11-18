import { describe, expect, it } from "vitest"

import {
  breakdownRows,
  caretForDigits,
  checkCount,
  digitsBefore,
  formatCountInput,
  groupSeparator,
  parseCountInput,
} from "./cashCount"

describe("formatCountInput", () => {
  it("minglarni bo'shliq bilan ajratadi", () => {
    expect(formatCountInput("2550000")).toBe("2 550 000")
    expect(formatCountInput("1250")).toBe("1 250")
    expect(formatCountInput("999")).toBe("999")
  })

  it("raqam bo'lmagan belgilarni tashlaydi", () => {
    expect(formatCountInput("2 550 000 so'm")).toBe("2 550 000")
    expect(formatCountInput("1,250,000")).toBe("1 250 000")
    expect(formatCountInput("-500")).toBe("500")
    expect(formatCountInput("abc")).toBe("")
    expect(formatCountInput("")).toBe("")
  })

  it("bosh nollarni oladi, yolg'iz nolni saqlaydi", () => {
    expect(formatCountInput("007")).toBe("7")
    expect(formatCountInput("0")).toBe("0")
    expect(formatCountInput("000")).toBe("0")
  })

  it("haddan uzun sonni kesadi", () => {
    expect(formatCountInput("12345678901234567890")).toBe("1 234 567 890 123")
  })
})

describe("groupSeparator", () => {
  it("brauzer tilidagi ajratgichni oladi", () => {
    expect(groupSeparator("11,111")).toBe(",")
    expect(groupSeparator("11.111")).toBe(".")
    expect(groupSeparator("11’111")).toBe("’")
  })

  it("har qanday bo'shliq — oddiy bo'shliq; ajratgichsiz til — bo'shliq", () => {
    expect(groupSeparator("11\u00a0111")).toBe(" ")
    expect(groupSeparator("11\u202f111")).toBe(" ")
    expect(groupSeparator("11 111")).toBe(" ")
    expect(groupSeparator("11111")).toBe(" ")
  })

  it("boshqa ajratgich bilan formatlash va qayta o'qish", () => {
    expect(formatCountInput("2550000", ",")).toBe("2,550,000")
    expect(parseCountInput("2,550,000")).toBe(2550000)
    expect(parseCountInput("2.550.000")).toBe(2550000)
  })
})

describe("parseCountInput", () => {
  it("formatlangan satrni songa aylantiradi", () => {
    expect(parseCountInput("2 550 000")).toBe(2550000)
    expect(parseCountInput(formatCountInput("98765"))).toBe(98765)
  })

  it("nol — haqiqiy qiymat, bo'sh maydon — null", () => {
    expect(parseCountInput("0")).toBe(0)
    expect(parseCountInput("")).toBeNull()
    expect(parseCountInput("   ")).toBeNull()
    expect(parseCountInput("so'm")).toBeNull()
  })
})

describe("kursor o'rni", () => {
  it("kursorgacha bo'lgan raqamlarni sanaydi", () => {
    expect(digitsBefore("2 550 000", 0)).toBe(0)
    expect(digitsBefore("2 550 000", 1)).toBe(1)
    expect(digitsBefore("2 550 000", 3)).toBe(2)
    expect(digitsBefore("2 550 000", 99)).toBe(7)
  })

  it("formatlangan satrda o'sha raqamdan keyingi o'rinni topadi", () => {
    expect(caretForDigits("2 550 000", 0)).toBe(0)
    expect(caretForDigits("2 550 000", 1)).toBe(1)
    expect(caretForDigits("2 550 000", 2)).toBe(3)
    expect(caretForDigits("2 550 000", 4)).toBe(5)
    expect(caretForDigits("2 550 000", 7)).toBe(9)
    expect(caretForDigits("2 550 000", 20)).toBe(9)
  })

  it("o'rtaga raqam yozilganda kursor o'sha raqam yonida qoladi", () => {
    // "2 550 000" da "2 5|50 000" ga "9" yozildi → brauzer "2 59|50 000" beradi
    const typed = "2 5950 000"
    const formatted = formatCountInput(typed)
    expect(formatted).toBe("25 950 000")
    expect(caretForDigits(formatted, digitsBefore(typed, 4))).toBe(4) // "25 9|50 000"
  })
})

describe("checkCount", () => {
  it("kiritilmagan", () => {
    expect(checkCount(1000, null)).toEqual({ state: "empty", diff: 0 })
  })

  it("mos", () => {
    expect(checkCount(2550000, 2550000)).toEqual({ state: "match", diff: 0 })
    // tiyinlar farq hisoblanmaydi
    expect(checkCount(2550000.4, 2550000)).toEqual({ state: "match", diff: 0 })
    expect(checkCount(0, 0)).toEqual({ state: "match", diff: 0 })
  })

  it("kamomad va ortiqcha", () => {
    expect(checkCount(2550000, 2500000)).toEqual({ state: "short", diff: 50000 })
    expect(checkCount(2550000, 2570000)).toEqual({ state: "over", diff: 20000 })
  })

  it("kutilgan summa manfiy (xarajat tushumdan ko'p) — nol ham ortiqcha", () => {
    expect(checkCount(-50000, 0)).toEqual({ state: "over", diff: 50000 })
  })
})

describe("breakdownRows", () => {
  it("faqat noldan farqli qatorlar", () => {
    expect(
      breakdownRows({ opening_cash: 100000, payments_cash: 2450000, shop_cash: 0, expenses_cash: 0 })
    ).toEqual([
      { key: "opening", amount: 100000, sign: 0 },
      { key: "payments", amount: 2450000, sign: 1 },
    ])
  })

  it("xarajat va kassada qoldiriladigan qism ayiriladi", () => {
    const rows = breakdownRows(
      { opening_cash: 100000, payments_cash: 1200000, shop_cash: 30000, expenses_cash: 20000 },
      50000
    )
    expect(rows.map((r) => r.key)).toEqual(["opening", "payments", "shop", "expenses", "carried"])
    const total = rows.reduce((sum, r) => sum + (r.sign === -1 ? -r.amount : r.amount), 0)
    expect(total).toBe(100000 + 1200000 + 30000 - 20000 - 50000)
  })

  it("ma'lumot yo'q yoki hammasi nol — bo'sh", () => {
    expect(breakdownRows(undefined)).toEqual([])
    expect(breakdownRows(null)).toEqual([])
    expect(breakdownRows({ opening_cash: 0, payments_cash: 0 })).toEqual([])
  })
})
