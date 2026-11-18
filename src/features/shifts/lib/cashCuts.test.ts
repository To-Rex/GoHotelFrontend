import { describe, expect, it } from "vitest"

import type { CashBreakdown, CashCut } from "../api/shifts"
import {
  ALL_CASH,
  amountDue,
  cashLeftAfter,
  cutRows,
  defaultCutChoice,
  effectiveCutChoice,
  handoverPeriod,
  hasCuts,
  parseDay,
  selectedCut,
} from "./cashCuts"

/* Kassani kunlik kesim bo'yicha topshirish — tanlov mantig'i.

   Misol: kesim 00:05, smena 15-noyabrda ochilgan, hozir 18-noyabr ertalab.
   Boshlang'ich 100 000; kunlar 1 200 000 / 850 000 / 400 000; kesimdan
   keyin 250 000 — kassada jami 2 800 000. */

const cut = (over: Partial<CashCut>): CashCut => ({
  cut_at: "",
  from_at: "",
  day: "",
  day_cash: 0,
  opening_cash: 100_000,
  payments_cash: 0,
  shop_cash: 0,
  expenses_cash: 0,
  expected_cash: 0,
  after_cash: 0,
  carried_cash: 0,
  due_cash: 0,
  methods: [],
  non_cash_income: 0,
  ...over,
})

const C16 = "2026-11-15T19:05:00+00:00"
const C17 = "2026-11-16T19:05:00+00:00"
const C18 = "2026-11-17T19:05:00+00:00"
const START = "2026-11-15T04:12:00+00:00"

const data = (cuts?: CashCut[]): CashBreakdown => ({
  opening_cash: 100_000,
  payments_cash: 2_750_000,
  shop_cash: 0,
  expenses_cash: 50_000,
  expected_cash: 2_800_000,
  methods: [],
  non_cash_income: 0,
  cuts,
})

const three = data([
  cut({ cut_at: C16, from_at: START, day: "2026-11-15", day_cash: 1_200_000, expected_cash: 1_300_000, due_cash: 1_300_000, after_cash: 1_500_000 }),
  cut({ cut_at: C17, from_at: C16, day: "2026-11-16", day_cash: 850_000, expected_cash: 2_150_000, due_cash: 2_150_000, after_cash: 650_000 }),
  cut({ cut_at: C18, from_at: C17, day: "2026-11-17", day_cash: 400_000, expected_cash: 2_550_000, due_cash: 2_550_000, after_cash: 250_000 }),
])

describe("kesim bor-yo'qligi", () => {
  it("kesim tushmagan sessiya (yoki eski server) — tanlov yo'q, hamma pul", () => {
    for (const d of [undefined, null, data(), data([])]) {
      expect(hasCuts(d)).toBe(false)
      expect(defaultCutChoice(d)).toBe(ALL_CASH)
      expect(selectedCut(d, null)).toBeNull()
      expect(cutRows(d, null)).toEqual([])
    }
    expect(amountDue(data(), null)).toBe(2_800_000)
    expect(cashLeftAfter(data(), null)).toBe(0)
  })
})

describe("standart tanlov", () => {
  it("oxirgi kesimgacha: tugagan kunlar topshiriladi, bugungi tushum qoladi", () => {
    expect(hasCuts(three)).toBe(true)
    expect(defaultCutChoice(three)).toBe(C18)
    const chosen = selectedCut(three, null)
    expect(chosen?.cut_at).toBe(C18)
    expect(amountDue(three, chosen)).toBe(2_550_000)
    expect(cashLeftAfter(three, chosen)).toBe(250_000)
  })

  it("xodim tanlagani saqlanadi; ro'yxatdan chiqib ketgan kesim — standartga", () => {
    expect(effectiveCutChoice(three, C16)).toBe(C16)
    expect(effectiveCutChoice(three, ALL_CASH)).toBe(ALL_CASH)
    // Hisob yangilandi va tanlangan kesim endi yo'q (masalan, u topshirilgan)
    expect(effectiveCutChoice(three, "2026-11-01T19:05:00+00:00")).toBe(C18)
  })
})

describe("topshiriladigan summa", () => {
  it("eng eski kun — faqat u, qolgani kassada", () => {
    const chosen = selectedCut(three, C16)
    expect(amountDue(three, chosen)).toBe(1_300_000)
    expect(cashLeftAfter(three, chosen)).toBe(1_500_000)
  })

  it("hamma pul — avvalgidek", () => {
    const chosen = selectedCut(three, ALL_CASH)
    expect(chosen).toBeNull()
    expect(amountDue(three, chosen)).toBe(2_800_000)
    expect(cashLeftAfter(three, chosen)).toBe(0)
  })

  it("kesimdan keyingi xarajat uchun kassada qoldirilgan pul topshirilmaydi", () => {
    const d = data([
      cut({ cut_at: C18, from_at: START, day: "2026-11-17", opening_cash: 0, day_cash: 1_000_000, expected_cash: 1_000_000, after_cash: -50_000, carried_cash: 50_000, due_cash: 950_000 }),
    ])
    d.expected_cash = 950_000
    const chosen = selectedCut(d, null)
    expect(amountDue(d, chosen)).toBe(950_000)
    // Kassada jismonan hech narsa qolmaydi (50 000 allaqachon sarflangan)
    expect(cashLeftAfter(d, chosen)).toBe(0)
  })
})

describe("davrlar ro'yxati", () => {
  it("har kesim kuni + kesimdan keyin; yig'indi kassadagi jami pulga teng", () => {
    const rows = cutRows(three, null)
    expect(rows.map((r) => r.kind)).toEqual(["day", "day", "day", "rest"])
    expect(rows.map((r) => r.day)).toEqual(["2026-11-15", "2026-11-16", "2026-11-17", null])
    // Birinchi kunga boshlang'ich kassa ham kiradi
    expect(rows.map((r) => r.amount)).toEqual([1_300_000, 850_000, 400_000, 250_000])
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(three.expected_cash)
    expect(rows.map((r) => [r.from, r.to])).toEqual([
      [START, C16],
      [C16, C17],
      [C17, C18],
      [C18, null],
    ])
  })

  it("ketma-ket: tanlangan kungacha bo'lgan hammasi belgilanadi", () => {
    const flags = (choice: string | null) =>
      cutRows(three, choice).map((r) => `${r.included ? "+" : "-"}${r.selected ? "*" : ""}`)
    expect(flags(null)).toEqual(["+", "+", "+*", "-"])
    expect(flags(C16)).toEqual(["+*", "-", "-", "-"])
    expect(flags(C17)).toEqual(["+", "+*", "-", "-"])
    expect(flags(ALL_CASH)).toEqual(["+", "+", "+", "+*"])
  })

  it("qator bosilganda aynan o'sha tanlov o'rnatiladi", () => {
    expect(cutRows(three, null).map((r) => r.choice)).toEqual([C16, C17, C18, ALL_CASH])
  })
})

describe("topshirilayotgan davr", () => {
  it("kassa ochilgandan tanlangan kesimgacha; kunlar soni", () => {
    expect(handoverPeriod(three, null)).toEqual({ from: START, to: C18, days: 3 })
    expect(handoverPeriod(three, C16)).toEqual({ from: START, to: C16, days: 1 })
    expect(handoverPeriod(three, C17)).toEqual({ from: START, to: C17, days: 2 })
  })

  it("hamma pul — hozirgacha", () => {
    expect(handoverPeriod(three, ALL_CASH)).toEqual({ from: START, to: null, days: 3 })
  })

  it("kesim yo'q — davr ko'rsatilmaydi", () => {
    expect(handoverPeriod(data(), null)).toBeNull()
    expect(handoverPeriod(undefined, null)).toBeNull()
  })
})

describe("parseDay", () => {
  it("sana vaqt zonasidan qat'i nazar o'sha kun bo'lib qoladi", () => {
    const d = parseDay("2026-11-17")
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 11, 17])
  })
})
