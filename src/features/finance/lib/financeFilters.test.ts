import { describe, expect, it } from "vitest"

import type { PenaltyJournalItem } from "@/features/reservations/api/penalties"
import {
  EMPTY_INVOICE_FILTERS,
  EMPTY_PAYMENT_FILTERS,
  EMPTY_PENALTY_FILTERS,
  EMPTY_SALE_FILTERS,
  NON_CASH,
  PAYMENT_SORT_OPTIONS,
  applyPenaltyFilters,
  invoiceFilterCount,
  invoiceFilterParams,
  isFilterKind,
  methodParam,
  parseSortOption,
  paymentFilterCount,
  paymentFilterParams,
  penaltyFilterCount,
  penaltySortAccessors,
  penaltyTotals,
  penaltyUserOptions,
  saleFilterCount,
  saleFilterParams,
  sortMethodRows,
  toggleValue,
} from "./financeFilters"
import { sortRows } from "@/lib/tableState"

describe("umumiy", () => {
  it("toggleValue qo'shadi va olib tashlaydi", () => {
    expect(toggleValue([], "SHOP")).toEqual(["SHOP"])
    expect(toggleValue(["SHOP", "PENALTY"], "SHOP")).toEqual(["PENALTY"])
  })

  it("to'lov turi: bitta tur, naqdsiz va hammasi", () => {
    expect(methodParam(null)).toBeUndefined()
    expect(methodParam("CARD")).toBe("CARD")
    expect(methodParam(NON_CASH)).toBe("CARD,ONLINE,BANK_TRANSFER")
  })

  it("mobil saralash qiymati", () => {
    expect(parseSortOption("amount:asc")).toEqual({ sortBy: "amount", sortDir: "asc" })
    expect(parseSortOption("created_at:desc")).toEqual({ sortBy: "created_at", sortDir: "desc" })
    // Har variant to'g'ri tuzilgan
    for (const o of PAYMENT_SORT_OPTIONS) expect(o.value).toMatch(/^[a-z_]+:(asc|desc)$/)
  })
})

describe("to'lovlar filtri", () => {
  it("bo'sh filtr hech narsa yubormaydi", () => {
    expect(paymentFilterCount(EMPTY_PAYMENT_FILTERS)).toBe(0)
    expect(paymentFilterParams(EMPTY_PAYMENT_FILTERS)).toEqual({
      kinds: undefined,
      methods: undefined,
      created_by: undefined,
      min_amount: undefined,
      max_amount: undefined,
      edited: undefined,
    })
  })

  it("parametrlar: tur tartibi barqaror, summa raqamga, tahrir", () => {
    const f = {
      kinds: ["PENALTY", "SHOP"],
      method: NON_CASH,
      user: "u-1",
      minAmount: "100 000",
      maxAmount: "",
      edited: true,
    }
    expect(paymentFilterParams(f)).toEqual({
      kinds: "SHOP,PENALTY",
      methods: "CARD,ONLINE,BANK_TRANSFER",
      created_by: "u-1",
      min_amount: 100000,
      max_amount: undefined,
      edited: true,
    })
    // Summa oralig'i bitta filtr hisoblanadi
    expect(paymentFilterCount(f)).toBe(5)
    expect(paymentFilterCount({ ...EMPTY_PAYMENT_FILTERS, minAmount: "0" })).toBe(0)
  })

  it("jadval belgisi filtrga aylanadi (Boshqa — yo'q)", () => {
    for (const k of ["RESERVATION", "SHOP", "ROOM", "PENALTY", "SERVICE", "DEBT", "EXTRA", "REFUND"]) {
      expect(isFilterKind(k)).toBe(true)
    }
    expect(isFilterKind("OTHER")).toBe(false)
  })
})

describe("hisob-fakturalar va do'kon filtri", () => {
  it("hisob-faktura parametrlari", () => {
    expect(invoiceFilterCount(EMPTY_INVOICE_FILTERS)).toBe(0)
    const f = { debtOnly: true, discountOnly: false, minAmount: "", maxAmount: "500 000" }
    expect(invoiceFilterParams(f)).toEqual({
      debt_only: true,
      discount_only: undefined,
      min_amount: undefined,
      max_amount: 500000,
    })
    expect(invoiceFilterCount(f)).toBe(2)
  })

  it("do'kon parametrlari", () => {
    expect(saleFilterCount(EMPTY_SALE_FILTERS)).toBe(0)
    const f = { method: "CASH", linked: "direct" as const, minAmount: "5 000", maxAmount: "" }
    expect(saleFilterParams(f)).toEqual({
      methods: "CASH",
      linked: "direct",
      min_amount: 5000,
      max_amount: undefined,
    })
    expect(saleFilterCount(f)).toBe(3)
  })
})

const penalty = (over: Partial<PenaltyJournalItem>): PenaltyJournalItem => ({
  id: Math.random().toString(36).slice(2),
  reservation_id: "r",
  kind: "LATE_CHECKOUT",
  amount: 50000,
  created_by: "u-1",
  created_by_name: "Aziz Karimov",
  created_at: "2026-11-14T10:00:00Z",
  ...over,
})

describe("jarimalar (brauzerda)", () => {
  const items = [
    penalty({ id: "a", kind: "LATE_CHECKOUT", amount: 50000 }),
    penalty({ id: "b", kind: "DAMAGE", amount: 200000, created_by: "u-2", created_by_name: "Bobur Aliyev", guest_name: "Ali" }),
    penalty({ id: "c", kind: "DAMAGE", amount: 80000, voided_at: "2026-11-14T12:00:00Z" }),
    penalty({ id: "d", kind: "OTHER", amount: 10000, created_by: null, created_by_name: null }),
  ]
  const ids = (list: PenaltyJournalItem[]) => list.map((p) => p.id)

  it("tur, holat, xodim va summa", () => {
    expect(ids(applyPenaltyFilters(items, EMPTY_PENALTY_FILTERS))).toEqual(["a", "b", "c", "d"])
    expect(ids(applyPenaltyFilters(items, { ...EMPTY_PENALTY_FILTERS, kinds: ["DAMAGE"] }))).toEqual(["b", "c"])
    expect(ids(applyPenaltyFilters(items, { ...EMPTY_PENALTY_FILTERS, status: "active" }))).toEqual(["a", "b", "d"])
    expect(ids(applyPenaltyFilters(items, { ...EMPTY_PENALTY_FILTERS, status: "voided" }))).toEqual(["c"])
    expect(ids(applyPenaltyFilters(items, { ...EMPTY_PENALTY_FILTERS, user: "u-2" }))).toEqual(["b"])
    expect(ids(applyPenaltyFilters(items, { ...EMPTY_PENALTY_FILTERS, minAmount: "50 000", maxAmount: "100 000" }))).toEqual(["a", "c"])
    expect(penaltyFilterCount({ ...EMPTY_PENALTY_FILTERS, kinds: ["OTHER"], status: "voided" })).toBe(2)
  })

  it("jami — bekor qilinganlarsiz; xodimlar ro'yxati soni bilan", () => {
    expect(penaltyTotals(items)).toEqual({ count: 4, total: 260000 })
    expect(penaltyUserOptions(items)).toEqual([
      { id: "u-1", name: "Aziz Karimov", count: 2 },
      { id: "u-2", name: "Bobur Aliyev", count: 1 },
    ])
  })

  it("saralash: summa, tur nomi, bo'sh mehmon oxirida", () => {
    const acc = penaltySortAccessors((k) => ({ LATE_CHECKOUT: "Kech", DAMAGE: "Shikast", OTHER: "Boshqa" })[k] ?? k)
    expect(ids(sortRows(items, "amount", "desc", acc))).toEqual(["b", "c", "a", "d"])
    expect(ids(sortRows(items, "kind", "asc", acc))).toEqual(["d", "a", "b", "c"])
    expect(ids(sortRows(items, "guest_name", "asc", acc))[0]).toBe("b")
  })
})

describe("to'lov usullari jadvali", () => {
  const rows = [
    { key: "CASH", label: "Naqd pul", pay: 100, shop: 0, income: 100, expense: 50, net: 50 },
    { key: "CARD", label: "Bank kartasi", pay: 300, shop: 20, income: 320, expense: 0, net: 320 },
    { key: "ONLINE", label: "Online to'lov", pay: 0, shop: 5, income: 5, expense: 90, net: -85 },
  ]
  it("saralanmagan — tanish tartib; ustun bo'yicha ikki yo'nalishda", () => {
    expect(sortMethodRows(rows, "", "desc").map((r) => r.key)).toEqual(["CASH", "CARD", "ONLINE"])
    expect(sortMethodRows(rows, "income", "desc").map((r) => r.key)).toEqual(["CARD", "CASH", "ONLINE"])
    expect(sortMethodRows(rows, "net", "asc").map((r) => r.key)).toEqual(["ONLINE", "CASH", "CARD"])
    expect(sortMethodRows(rows, "label", "asc").map((r) => r.key)).toEqual(["CARD", "CASH", "ONLINE"])
    // Noma'lum ustun — tartib o'zgarmaydi
    expect(sortMethodRows(rows, "nima", "asc").map((r) => r.key)).toEqual(["CASH", "CARD", "ONLINE"])
  })
})
