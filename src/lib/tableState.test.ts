import { describe, expect, it } from "vitest"

import {
  PAGE_SIZE,
  clampPage,
  filterRows,
  initialTableState,
  pageCount,
  queryParams,
  rangeLabel,
  setSearch,
  sortRows,
  tableView,
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

describe("brauzer tomonidagi jadval", () => {
  interface Row {
    id: string
    guest: string
    room: string | null
    amount: number
    at: string
  }

  const rows: Row[] = [
    { id: "a", guest: "Aziz Karimov", room: "101", amount: 300, at: "2026-09-01" },
    { id: "b", guest: "Bobur Aliyev", room: null, amount: 100, at: "2026-09-03" },
    { id: "c", guest: "Vali Soatov", room: "205", amount: 200, at: "2026-09-02" },
  ]

  const options = {
    search: [(r: Row) => r.guest, (r: Row) => r.room],
    sort: {
      guest: (r: Row) => r.guest,
      amount: (r: Row) => r.amount,
      at: (r: Row) => r.at,
      room: (r: Row) => r.room,
    },
  }

  describe("qidiruv", () => {
    it("maydonlar bo'yicha topadi", () => {
      expect(filterRows(rows, "bobur", options.search).map((r) => r.id)).toEqual(["b"])
    })

    it("katta-kichik harf farq qilmaydi", () => {
      expect(filterRows(rows, "KARIMOV", options.search)).toHaveLength(1)
    })

    it("ikkinchi maydon bo'yicha ham", () => {
      expect(filterRows(rows, "205", options.search).map((r) => r.id)).toEqual(["c"])
    })

    it("bo'sh qidiruvda hammasi qaytadi", () => {
      expect(filterRows(rows, "   ", options.search)).toHaveLength(3)
    })

    it("null maydon xatoga olib kelmaydi", () => {
      expect(() => filterRows(rows, "10", options.search)).not.toThrow()
      expect(filterRows(rows, "101", options.search).map((r) => r.id)).toEqual(["a"])
    })

    it("topilmasa bo'sh", () => {
      expect(filterRows(rows, "yo'q", options.search)).toEqual([])
    })
  })

  describe("saralash", () => {
    it("son bo'yicha o'sish", () => {
      expect(sortRows(rows, "amount", "asc", options.sort).map((r) => r.amount)).toEqual(
        [100, 200, 300]
      )
    })

    it("son bo'yicha kamayish", () => {
      expect(sortRows(rows, "amount", "desc", options.sort).map((r) => r.amount)).toEqual(
        [300, 200, 100]
      )
    })

    it("matn bo'yicha", () => {
      expect(sortRows(rows, "guest", "asc", options.sort).map((r) => r.id)).toEqual([
        "a",
        "b",
        "c",
      ])
    })

    it("bo'sh qiymat ikkala yo'nalishda ham oxirida", () => {
      // "Xonasi yo'q" qatorlar ro'yxat boshini egallab olmasligi kerak
      expect(sortRows(rows, "room", "asc", options.sort).at(-1)?.id).toBe("b")
      expect(sortRows(rows, "room", "desc", options.sort).at(-1)?.id).toBe("b")
    })

    it("noma'lum ustunda tartib o'zgarmaydi", () => {
      expect(sortRows(rows, "yoq", "asc", options.sort).map((r) => r.id)).toEqual([
        "a",
        "b",
        "c",
      ])
    })

    it("asl ro'yxat o'zgarmaydi", () => {
      const before = rows.map((r) => r.id)
      sortRows(rows, "amount", "desc", options.sort)
      expect(rows.map((r) => r.id)).toEqual(before)
    })
  })

  describe("to'liq ko'rinish", () => {
    const many: Row[] = Array.from({ length: 120 }, (_, i) => ({
      id: `r${i}`,
      guest: `Mehmon ${i}`,
      room: `${100 + i}`,
      amount: i,
      at: "2026-09-01",
    }))

    it("birinchi sahifa", () => {
      const view = tableView(many, initialTableState("amount", "asc"), options)
      expect(view.rows).toHaveLength(PAGE_SIZE)
      expect(view.total).toBe(120)
      expect(view.pageCount).toBe(3)
      expect(view.label).toBe("1–50 / 120")
    })

    it("oxirgi sahifa to'liq bo'lmaydi", () => {
      const state = { ...initialTableState("amount", "asc"), page: 2 }
      const view = tableView(many, state, options)
      expect(view.rows).toHaveLength(20)
      expect(view.label).toBe("101–120 / 120")
    })

    it("qidiruv jamini kamaytiradi", () => {
      const state = setSearch(initialTableState("amount"), "Mehmon 11")
      const view = tableView(many, state, options)
      // "Mehmon 11", "Mehmon 110".."Mehmon 119"
      expect(view.total).toBe(11)
      expect(view.pageCount).toBe(1)
    })

    it("qidiruv toraysa sahifa chegaraga keltiriladi", () => {
      // Xodim 3-sahifada turib qidirdi — bo'sh jadval oldida qolmasligi kerak
      const state = { ...setSearch(initialTableState("amount"), "Mehmon 11"), page: 2 }
      const view = tableView(many, state, options)
      expect(view.page).toBe(0)
      expect(view.rows.length).toBeGreaterThan(0)
    })

    it("bo'sh ro'yxat", () => {
      const view = tableView([], initialTableState("amount"), options)
      expect(view.rows).toEqual([])
      expect(view.pageCount).toBe(1)
      expect(view.label).toBe("0")
    })

    it("saralash sahifalashdan OLDIN qo'llanadi", () => {
      const view = tableView(many, initialTableState("amount", "desc"), options)
      expect(view.rows[0].amount).toBe(119)
    })
  })
})
