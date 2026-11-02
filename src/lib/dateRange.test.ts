import { describe, expect, it } from "vitest"

import { highlightRange, monthGrid, pickDayFor, rangeDays, rangeLabel, toIso } from "./dateRange"

describe("monthGrid", () => {
  it("6 hafta, dushanbadan boshlanadi, butun oyni qamraydi", () => {
    // 2026-11-01 — yakshanba; dushanbadan boshlansa 26-oktabrdan ochiladi
    const grid = monthGrid(new Date(2026, 10, 1))
    expect(grid).toHaveLength(42)
    expect(toIso(grid[0])).toBe("2026-10-26")
    expect(grid[0].getDay()).toBe(1)
    expect(grid.map(toIso)).toContain("2026-11-01")
    expect(grid.map(toIso)).toContain("2026-11-30")
    expect(toIso(grid[41])).toBe("2026-12-06")
  })

  it("oy dushanbadan boshlansa birinchi katak o'sha kun", () => {
    // 2026-06-01 — dushanba
    expect(toIso(monthGrid(new Date(2026, 5, 15))[0])).toBe("2026-06-01")
  })
})

describe("pickDayFor", () => {
  const empty = { from: "", to: "" }

  it("boshlanish tanlanadi, navbat tugashga", () => {
    expect(pickDayFor(empty, "from", "2026-11-05")).toEqual({
      draft: { from: "2026-11-05", to: "" },
      field: "to",
    })
  })

  it("tugash tanlanadi, tanlov tugallanadi — navbat boshlanishga", () => {
    expect(pickDayFor({ from: "2026-11-05", to: "" }, "to", "2026-11-09")).toEqual({
      draft: { from: "2026-11-05", to: "2026-11-09" },
      field: "from",
    })
  })

  it("tugash uchun boshlanishdan oldingi kun bosilsa o'rni almashadi", () => {
    expect(pickDayFor({ from: "2026-11-09", to: "" }, "to", "2026-11-05").draft).toEqual({
      from: "2026-11-05",
      to: "2026-11-09",
    })
  })

  it("bir kun ikki marta — bitta kunlik davr", () => {
    expect(pickDayFor({ from: "2026-11-05", to: "" }, "to", "2026-11-05")).toEqual({
      draft: { from: "2026-11-05", to: "2026-11-05" },
      field: "from",
    })
  })

  it("tugash navbatida boshlanish bo'lmasa avval u qo'yiladi", () => {
    expect(pickDayFor(empty, "to", "2026-11-05")).toEqual({
      draft: { from: "2026-11-05", to: "" },
      field: "to",
    })
  })

  it("boshlanishni surish: tugash undan keyin qolsa saqlanadi, oldin qolsa tozalanadi", () => {
    const full = { from: "2026-11-01", to: "2026-11-09" }
    expect(pickDayFor(full, "from", "2026-11-03")).toEqual({
      draft: { from: "2026-11-03", to: "2026-11-09" },
      field: "to",
    })
    expect(pickDayFor(full, "from", "2026-11-20")).toEqual({
      draft: { from: "2026-11-20", to: "" },
      field: "to",
    })
  })
})

describe("highlightRange", () => {
  it("tugash tanlanmoqda — boshlanishdan sichqoncha turgan kungacha, tartiblangan", () => {
    expect(highlightRange({ from: "2026-11-10", to: "" }, "2026-11-03", "to")).toEqual([
      "2026-11-03",
      "2026-11-10",
    ])
    expect(highlightRange({ from: "2026-11-10", to: "" }, null, "to")).toEqual([
      "2026-11-10",
      "2026-11-10",
    ])
    expect(highlightRange({ from: "", to: "" }, "2026-11-25", "to")).toEqual([
      "2026-11-25",
      "2026-11-25",
    ])
  })

  it("boshlanish tanlanmoqda — sichqoncha turgan kundan tugashgacha (yoki bitta kun)", () => {
    expect(highlightRange({ from: "2026-11-01", to: "2026-11-09" }, "2026-11-04", "from")).toEqual([
      "2026-11-04",
      "2026-11-09",
    ])
    expect(highlightRange({ from: "2026-11-01", to: "2026-11-09" }, "2026-11-20", "from")).toEqual([
      "2026-11-20",
      "2026-11-20",
    ])
    expect(highlightRange({ from: "2026-11-01", to: "2026-11-09" }, null, "from")).toEqual([
      "2026-11-01",
      "2026-11-09",
    ])
    expect(highlightRange({ from: "", to: "" }, null, "from")).toBeNull()
  })
})

describe("rangeDays / rangeLabel", () => {
  it("kunlar soni — ikkala chegara bo'lsa, bir kun 1", () => {
    expect(rangeDays("2026-11-05", "2026-11-12")).toBe(8)
    expect(rangeDays("2026-11-05", "2026-11-05")).toBe(1)
    expect(rangeDays("2026-11-05", "")).toBeNull()
    expect(rangeDays("", "")).toBeNull()
  })

  it("to'liq, bir kunlik, ochiq va bo'sh oraliqlar", () => {
    expect(rangeLabel("2026-10-01", "2026-10-31", "Barcha davr")).toBe("01.10.2026 — 31.10.2026")
    expect(rangeLabel("2026-11-02", "2026-11-02", "Barcha davr")).toBe("02.11.2026")
    expect(rangeLabel("2026-10-01", "", "Barcha davr")).toBe("01.10.2026 — …")
    expect(rangeLabel("", "2026-10-31", "Barcha davr")).toBe("… — 31.10.2026")
    expect(rangeLabel("", "", "Barcha davr")).toBe("Barcha davr")
  })
})
