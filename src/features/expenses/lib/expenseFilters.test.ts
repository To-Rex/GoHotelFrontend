import { describe, expect, it } from "vitest"

import { initialTableState, tableView } from "@/lib/tableState"
import type { Expense } from "@/types/api"
import {
  EMPTY_FILTERS,
  MIXED,
  SEARCH_FIELDS,
  SORT_ACCESSORS,
  SORT_OPTIONS,
  activeFilterCount,
  applyExpenseFilters,
  hasCategory,
  methodLabelOf,
  toggleCategory,
  userOptions,
} from "./expenseFilters"
import { groupExpenses } from "./expenseGroups"

const row = (over: Partial<Expense> & { id: string; amount: number }): Expense => ({
  hotel_id: "h",
  title: "x",
  category: null,
  payment_method: "CASH",
  expense_date: "2026-11-08",
  created_by: "u1",
  created_by_name: "Dilnoza Karimova",
  created_at: "2026-11-08T10:00:00Z",
  ...over,
})

const rows: Expense[] = [
  row({ id: "a", amount: 4500000, title: "Noyabr oyligi", category: "Ish haqi", created_at: "2026-11-08T09:00:00Z" }),
  row({ id: "b1", amount: 60000, title: "Kommunal", category: "Elektr energiyasi", split_group: "g", created_by: "u2", created_by_name: "Aziz Rahimov" }),
  row({ id: "b2", amount: 40000, title: "Kommunal", category: "Elektr energiyasi", payment_method: "ONLINE", split_group: "g", created_by: "u2", created_by_name: "Aziz Rahimov" }),
  row({ id: "c", amount: 820000, title: "Gaz, oktyabr", category: "gaz", payment_method: "BANK_TRANSFER", expense_date: "2026-11-07", notes: "Hududgaz" }),
  row({ id: "d", amount: 15000, title: "Mayda", category: null, payment_method: "CREDIT_CARD", expense_date: "2026-11-06", created_by: "u3", created_by_name: null }),
]
const groups = groupExpenses(rows)

describe("filtrlar", () => {
  it("bo'sh filtr hammasini qoldiradi va sanoq nol", () => {
    expect(applyExpenseFilters(groups, EMPTY_FILTERS).length).toBe(4)
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
  })

  it("toifa — bir nechtasi birga, harf kattaligi farqsiz, toifasiz 'Boshqa'", () => {
    let f = toggleCategory(EMPTY_FILTERS, "Gaz")
    expect(hasCategory(f, "GAZ")).toBe(true)
    expect(applyExpenseFilters(groups, f).map((g) => g.key)).toEqual(["c"])
    f = toggleCategory(f, "Boshqa")
    expect(applyExpenseFilters(groups, f).map((g) => g.key)).toEqual(["c", "d"])
    f = toggleCategory(f, "gaz")
    expect(applyExpenseFilters(groups, f).map((g) => g.key)).toEqual(["d"])
    expect(activeFilterCount(f)).toBe(1)
  })

  it("xodim bo'yicha", () => {
    expect(applyExpenseFilters(groups, { ...EMPTY_FILTERS, user: "u2" }).map((g) => g.key)).toEqual(["g"])
    const users = userOptions(groups)
    expect(users.map((u) => [u.name, u.count])).toEqual([
      ["Aziz Rahimov", 1],
      ["Dilnoza Karimova", 2],
      ["Noma'lum", 1],
    ])
  })

  it("to'lov turi — eski kodlar kanonik turga, qisman alohida", () => {
    expect(applyExpenseFilters(groups, { ...EMPTY_FILTERS, method: "CARD" }).map((g) => g.key)).toEqual(["d"])
    expect(applyExpenseFilters(groups, { ...EMPTY_FILTERS, method: "CASH" }).map((g) => g.key)).toEqual(["a"])
    expect(applyExpenseFilters(groups, { ...EMPTY_FILTERS, method: MIXED }).map((g) => g.key)).toEqual(["g"])
    expect(methodLabelOf(groups[1])).toBe("Aralash")
  })

  it("summa oralig'i guruh yig'indisi bo'yicha, formatlangan satrdan", () => {
    const f = { ...EMPTY_FILTERS, minAmount: "50 000", maxAmount: "1 000 000" }
    expect(applyExpenseFilters(groups, f).map((g) => g.key)).toEqual(["g", "c"])
    expect(activeFilterCount(f)).toBe(1)
    expect(applyExpenseFilters(groups, { ...EMPTY_FILTERS, minAmount: "abc" }).length).toBe(4)
  })
})

describe("qidiruv va saralash (tableView bilan)", () => {
  it("qidiruv nom, izoh, toifa, xodim, usul va summa bo'yicha", () => {
    const find = (q: string) =>
      tableView(groups, { ...initialTableState("expense_date"), search: q }, { search: SEARCH_FIELDS, sort: SORT_ACCESSORS }).rows.map((g) => g.key)
    expect(find("hududgaz")).toEqual(["c"])
    expect(find("aziz")).toEqual(["g"])
    expect(find("aralash")).toEqual(["g"])
    expect(find("820000")).toEqual(["c"])
    expect(find("ish haqi")).toEqual(["a"])
  })

  it("summa bo'yicha kamayish, sana bo'yicha vaqt hal qiladi", () => {
    const by = (sortBy: string, sortDir: "asc" | "desc") =>
      tableView(groups, { ...initialTableState(sortBy, sortDir) }, { search: SEARCH_FIELDS, sort: SORT_ACCESSORS }).rows.map((g) => g.key)
    expect(by("amount", "desc")).toEqual(["a", "c", "g", "d"])
    expect(by("amount", "asc")).toEqual(["d", "g", "c", "a"])
    // Bir kunda: "g" (10:00) "a" (09:00) dan keyin kiritilgan — yangisi avval
    expect(by("expense_date", "desc")).toEqual(["g", "a", "c", "d"])
    expect(by("created_by_name", "asc")).toEqual(["g", "a", "c", "d"])
  })

  it("mobil saralash variantlari mavjud ustunlarga ishora qiladi", () => {
    for (const o of SORT_OPTIONS) {
      const [column, dir] = o.value.split(":")
      expect(SORT_ACCESSORS[column]).toBeTypeOf("function")
      expect(["asc", "desc"]).toContain(dir)
    }
  })
})
