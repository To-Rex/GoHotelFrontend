import { describe, expect, it } from "vitest"

import {
  PAGE_SIZE,
  clampPage,
  initialTableState,
  pageCount,
  queryParams,
  rangeLabel,
  setSearch,
  toggleSort,
} from "./tableState"

describe("saralash", () => {
  const base = initialTableState("payment_date")

  it("boshqa ustun bosilsa o'sha ustunga o'tadi", () => {
    const next = toggleSort(base, "amount")
    expect(next.sortBy).toBe("amount")
    expect(next.sortDir).toBe("desc")
  })

  it("o'sha ustun qayta bosilsa yo'nalish teskarisiga o'zgaradi", () => {
    const once = toggleSort(base, "payment_date")
    expect(once.sortDir).toBe("asc")
    expect(toggleSort(once, "payment_date").sortDir).toBe("desc")
  })

  it("standart yo'nalishni berish mumkin", () => {
    expect(toggleSort(base, "payment_number", "asc").sortDir).toBe("asc")
  })

  it("saralash o'zgarsa birinchi sahifaga qaytadi", () => {
    const deep = { ...base, page: 7 }
    expect(toggleSort(deep, "amount").page).toBe(0)
    // O'sha ustunni qayta bosganda ham
    expect(toggleSort(deep, "payment_date").page).toBe(0)
  })

  it("holat o'zgarmaydi (yangi obyekt qaytadi)", () => {
    const deep = { ...base, page: 3 }
    toggleSort(deep, "amount")
    expect(deep.page).toBe(3)
    expect(deep.sortBy).toBe("payment_date")
  })
})

describe("qidiruv", () => {
  it("qidiruv o'zgarsa birinchi sahifaga qaytadi", () => {
    const state = { ...initialTableState("created_at"), page: 4 }
    const next = setSearch(state, "PAY-01")
    expect(next.search).toBe("PAY-01")
    expect(next.page).toBe(0)
  })

  it("saralash saqlanadi", () => {
    const state = { ...initialTableState("amount", "asc"), page: 2 }
    const next = setSearch(state, "naqd")
    expect(next.sortBy).toBe("amount")
    expect(next.sortDir).toBe("asc")
  })
})

describe("sahifalar soni", () => {
  it("to'liq bo'linganda", () => {
    expect(pageCount(100, 50)).toBe(2)
  })

  it("qoldiq bo'lsa yuqoriga yaxlitlanadi", () => {
    expect(pageCount(101, 50)).toBe(3)
    expect(pageCount(1, 50)).toBe(1)
  })

  it("bo'sh ro'yxatda ham bitta sahifa", () => {
    expect(pageCount(0, 50)).toBe(1)
    expect(pageCount(-5, 50)).toBe(1)
  })

  it("buzuq qiymatlar sahifani yo'qotmaydi", () => {
    expect(pageCount(Number.NaN, 50)).toBe(1)
    expect(pageCount(100, 0)).toBe(1)
  })
})

describe("sahifa chegarasi", () => {
  it("oxirgi sahifadan nariga o'tmaydi", () => {
    expect(clampPage(9, 100, 50)).toBe(1)
  })

  it("chegara ichida o'zgarmaydi", () => {
    expect(clampPage(1, 100, 50)).toBe(1)
  })

  it("manfiy raqam nolga keltiriladi", () => {
    expect(clampPage(-3, 100, 50)).toBe(0)
  })

  it("ro'yxat bo'shab qolsa birinchi sahifaga tushadi", () => {
    // Xodim 5-sahifada turganda davrni o'zgartirdi va yozuv qolmadi
    expect(clampPage(5, 0, 50)).toBe(0)
  })

  it("yozuvlar kamayganda oxirgi mavjud sahifaga tushadi", () => {
    expect(clampPage(9, 120, 50)).toBe(2)
  })
})

describe("qatorlar oralig'i yozuvi", () => {
  it("birinchi sahifa", () => {
    expect(rangeLabel(0, 50, 1240)).toBe("1–50 / 1240")
  })

  it("o'rtadagi sahifa", () => {
    expect(rangeLabel(2, 50, 1240)).toBe("101–150 / 1240")
  })

  it("oxirgi sahifa to'liq bo'lmasa haqiqiy songa qarab yoziladi", () => {
    // 1240 = 24 ta to'liq sahifa + 40 qator
    expect(rangeLabel(24, 40, 1240)).toBe("1201–1240 / 1240")
  })

  it("bo'sh natija", () => {
    expect(rangeLabel(0, 0, 0)).toBe("0")
  })
})

describe("so'rov parametrlari", () => {
  it("sahifa raqami skip ga aylanadi", () => {
    const state = { ...initialTableState("amount"), page: 3 }
    expect(queryParams(state).skip).toBe(3 * PAGE_SIZE)
    expect(queryParams(state).limit).toBe(PAGE_SIZE)
  })

  it("bo'sh qidiruv yuborilmaydi", () => {
    expect(queryParams(initialTableState("amount")).search).toBeUndefined()
    expect(
      queryParams(setSearch(initialTableState("amount"), "   ")).search
    ).toBeUndefined()
  })

  it("qidiruvdagi ortiqcha bo'shliq olib tashlanadi", () => {
    const state = setSearch(initialTableState("amount"), "  PAY-7 ")
    expect(queryParams(state).search).toBe("PAY-7")
  })

  it("saralash uzatiladi", () => {
    const state = initialTableState("total_amount", "asc")
    expect(queryParams(state)).toMatchObject({
      sort_by: "total_amount",
      sort_dir: "asc",
    })
  })

  it("boshqa sahifa hajmi bilan", () => {
    const state = { ...initialTableState("amount"), page: 2 }
    expect(queryParams(state, 25)).toMatchObject({ skip: 50, limit: 25 })
  })
})
