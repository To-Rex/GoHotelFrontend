import { describe, expect, it } from "vitest"

import type { Expense, ExpenseEdit } from "@/types/api"
import {
  buildUpdatePayload,
  cashOf,
  changeCount,
  changeRows,
  diffValues,
  editBadgeText,
  editWho,
  editsOf,
  layoutOf,
  valuesOfGroup,
  type ExpenseValues,
} from "./expenseEdit"
import { applyExpenseFilters, EMPTY_FILTERS, activeFilterCount, editedCount } from "./expenseFilters"
import { groupExpenses } from "./expenseGroups"

const row = (over: Partial<Expense> = {}): Expense => ({
  id: "e1",
  hotel_id: "h",
  title: "Gaz, noyabr",
  category: "Gaz",
  amount: 100000,
  payment_method: "CASH",
  expense_date: "2026-11-20",
  notes: null,
  created_by: "u1",
  created_by_name: "Kamola Kassir",
  created_at: "2026-11-20T09:30:00Z",
  split_group: null,
  ...over,
})

const single = () => groupExpenses([row()])[0]
const split = () =>
  groupExpenses([
    row({ id: "a", amount: 40000, payment_method: "ONLINE", split_group: "g" }),
    row({ id: "b", amount: 60000, payment_method: "CASH", split_group: "g" }),
  ])[0]

describe("xarajat qiymatlari", () => {
  it("oddiy va bo'lingan xarajatdan qiymat oladi", () => {
    expect(valuesOfGroup(single())).toEqual({
      title: "Gaz, noyabr",
      amount: 100000,
      category: "Gaz",
      payment: [{ payment_method: "CASH", amount: 100000 }],
      expense_date: "2026-11-20",
      notes: null,
    })
    // Bo'laklar katta summadan kichikka, kod katta harfda
    expect(valuesOfGroup(split()).payment).toEqual([
      { payment_method: "CASH", amount: 60000 },
      { payment_method: "ONLINE", amount: 40000 },
    ])
    expect(layoutOf([{ payment_method: "card", amount: 5 }, { payment_method: "cash", amount: 5 }])).toEqual([
      { payment_method: "CARD", amount: 5 },
      { payment_method: "CASH", amount: 5 },
    ])
  })
})

describe("o'zgarishlar (server bilan bir xil qoida)", () => {
  const before = valuesOfGroup(single())

  it("bitta turdagi xarajatda summa faqat 'Summa' da", () => {
    const after: ExpenseValues = { ...before, amount: 85000, payment: [{ payment_method: "CASH", amount: 85000 }] }
    const changes = diffValues(before, after)
    expect(Object.keys(changes)).toEqual(["amount"])
    expect(buildUpdatePayload(before, after)).toEqual({ amount: 85000, payment_method: "CASH" })
  })

  it("hech narsa o'zgarmasa — yuborilmaydi", () => {
    expect(changeCount(diffValues(before, { ...before }))).toBe(0)
    expect(buildUpdatePayload(before, { ...before }, "sabab")).toBeNull()
  })

  it("faqat o'zgargan maydonlar va tahrir sababi yuboriladi", () => {
    const after = { ...before, title: "Gaz", notes: "№12", category: null, expense_date: "2026-11-21" }
    expect(buildUpdatePayload(before, after, "  noto'g'ri sana ")).toEqual({
      title: "Gaz",
      notes: "№12",
      category: null,
      expense_date: "2026-11-21",
      note: "noto'g'ri sana",
    })
  })

  it("bo'lishda bo'laklar summa bilan birga ketadi", () => {
    const after = {
      ...before,
      payment: layoutOf([{ payment_method: "CASH", amount: 60000 }, { payment_method: "ONLINE", amount: 40000 }]),
    }
    const changes = diffValues(before, after)
    expect(Object.keys(changes)).toEqual(["payment"])
    expect(buildUpdatePayload(before, after)).toEqual({ amount: 100000, payments: after.payment })
  })

  it("bo'lingan xarajat bitta turga qaytadi yoki bo'laklari o'zgaradi", () => {
    const b = valuesOfGroup(split())
    expect(buildUpdatePayload(b, { ...b, payment: [{ payment_method: "CARD", amount: 100000 }] })).toEqual({
      amount: 100000,
      payment_method: "CARD",
    })
    const moved = { ...b, payment: layoutOf([{ payment_method: "CASH", amount: 50000 }, { payment_method: "ONLINE", amount: 50000 }]) }
    expect(Object.keys(diffValues(b, moved))).toEqual(["payment"])
    // Faqat nom o'zgarsa bo'laklar yuborilmaydi
    expect(buildUpdatePayload(b, { ...b, title: "Kommunal" })).toEqual({ title: "Kommunal" })
  })

  it("naqd qism — kassaga ta'sir qiladigan qism", () => {
    expect(cashOf(valuesOfGroup(split()).payment)).toBe(60000)
    expect(cashOf([{ payment_method: "CARD", amount: 5 }])).toBe(0)
  })
})

describe("tarix ko'rinishi", () => {
  const edit: ExpenseEdit = {
    at: "2026-11-21T05:00:00Z",
    by_name: "Aziz Admin",
    by_role: "CONFIGURATOR",
    note: "xato",
    changes: {
      amount: { old: 100000, new: 85000 },
      category: { old: "Gaz", new: null },
      payment: {
        old: [{ payment_method: "CASH", amount: 100000 }],
        new: [
          { payment_method: "CASH", amount: 45000 },
          { payment_method: "CARD", amount: 40000 },
        ],
      },
    },
  }

  it("o'zgarishlar ekrandagi tartibda, qiymatlar o'qiladigan", () => {
    const rows = changeRows(edit.changes)
    expect(rows.map((r) => r.field)).toEqual(["amount", "payment", "category"])
    expect(rows[0].new).toContain("85")
    expect(rows[1].old).toBe("Naqd pul")
    expect(rows[1].new).toContain("+")
    expect(rows[2].new).toBe("toifasiz")
  })

  it("kim tahrirlagani va belgi matni", () => {
    expect(editWho(edit)).toBe("Aziz Admin (Sozlovchi)")
    expect(editWho({ by_name: null, by_role: "SUPER_ADMIN" })).toBe("Tizim ma'muri")
    expect(editBadgeText(edit)).toMatch(/100.000 → 85.000/)
    expect(editBadgeText({ ...edit, changes: { title: { old: "a", new: "b" }, notes: { old: null, new: "x" } } })).toBe(
      "Nomi, Izoh"
    )
  })

  it("buzilgan yozuvlar tashlanadi", () => {
    expect(editsOf(null)).toEqual([])
    expect(editsOf({ edit_history: null })).toEqual([])
    expect(editsOf({ edit_history: [edit, null as unknown as ExpenseEdit, { at: "x" } as ExpenseEdit] })).toEqual([edit])
  })

  it("'Tahrirlanganlar' filtri", () => {
    const groups = groupExpenses([row({ id: "x", edit_history: [edit] }), row({ id: "y" })])
    expect(editedCount(groups)).toBe(1)
    const f = { ...EMPTY_FILTERS, edited: true }
    expect(applyExpenseFilters(groups, f).map((g) => g.key)).toEqual(["x"])
    expect(activeFilterCount(f)).toBe(1)
    expect(applyExpenseFilters(groups, EMPTY_FILTERS).length).toBe(2)
  })
})
