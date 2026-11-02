import { describe, expect, it } from "vitest"

import { highlightRange, monthGrid, pickDay, rangeLabel, toIso } from "./dateRange"

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

describe("pickDay", () => {
  const empty = { from: "", to: "" }

  it("birinchi bosish — boshlanish, tanlov tugallanmagan", () => {
    expect(pickDay(empty, "2026-11-05")).toEqual({
      draft: { from: "2026-11-05", to: "" },
      done: false,
    })
  })

  it("ikkinchi bosish — tugash, tanlov tugallanadi", () => {
    expect(pickDay({ from: "2026-11-05", to: "" }, "2026-11-09")).toEqual({
      draft: { from: "2026-11-05", to: "2026-11-09" },
      done: true,
    })
  })

  it("teskari tartibda bosilsa o'rni almashadi", () => {
    expect(pickDay({ from: "2026-11-09", to: "" }, "2026-11-05").draft).toEqual({
      from: "2026-11-05",
      to: "2026-11-09",
    })
  })

  it("bir kun ikki marta — bitta kunlik davr", () => {
    expect(pickDay({ from: "2026-11-05", to: "" }, "2026-11-05")).toEqual({
      draft: { from: "2026-11-05", to: "2026-11-05" },
      done: true,
    })
  })

  it("tugallangan tanlovdan keyin bosish — yangi boshlanish", () => {
    expect(pickDay({ from: "2026-11-01", to: "2026-11-09" }, "2026-11-20")).toEqual({
      draft: { from: "2026-11-20", to: "" },
      done: false,
    })
  })
})

describe("rangeLabel", () => {
  it("to'liq, bir kunlik, ochiq va bo'sh oraliqlar", () => {
    expect(rangeLabel("2026-10-01", "2026-10-31", "Barcha davr")).toBe("01.10.2026 — 31.10.2026")
    expect(rangeLabel("2026-11-02", "2026-11-02", "Barcha davr")).toBe("02.11.2026")
    expect(rangeLabel("2026-10-01", "", "Barcha davr")).toBe("01.10.2026 — …")
    expect(rangeLabel("", "2026-10-31", "Barcha davr")).toBe("… — 31.10.2026")
    expect(rangeLabel("", "", "Barcha davr")).toBe("Barcha davr")
  })
})

describe("highlightRange", () => {
  it("tanlov tugallanmagan — sichqoncha turgan kungacha, tartiblangan", () => {
    expect(highlightRange({ from: "2026-11-10", to: "" }, "2026-11-03")).toEqual([
      "2026-11-03",
      "2026-11-10",
    ])
    expect(highlightRange({ from: "2026-11-10", to: "" }, null)).toEqual(["2026-11-10", "2026-11-10"])
  })

  it("tugallangan tanlovda sichqoncha ta'sir qilmaydi", () => {
    expect(highlightRange({ from: "2026-11-01", to: "2026-11-09" }, "2026-11-25")).toEqual([
      "2026-11-01",
      "2026-11-09",
    ])
    expect(highlightRange({ from: "", to: "" }, "2026-11-25")).toBeNull()
  })
})
