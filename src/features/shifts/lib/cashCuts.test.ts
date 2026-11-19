import { describe, expect, it } from "vitest"

import type { CashBreakdown, CashCut, PrevShiftsPlan } from "../api/shifts"
import {
  ALL_CASH,
  amountDue,
  cashLeftAfter,
  closedDaysOnly,
  cutRows,
  dayOffset,
  defaultCutChoice,
  effectiveCutChoice,
  handoverBlocked,
  handoverPeriod,
  handoverScopeOf,
  hasCuts,
  parseDay,
  prevShiftsOnly,
  prevShiftsPlan,
  selectedCut,
  shiftSplit,
  showsDays,
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

/* "Faqat yopilgan kunlar" rejimi (sozlama): tanlov yo'q — kunlik kesim
   yopgan kunlarning hammasi birga topshiriladi, bugungi tushum esa keyingi
   kesimdan keyin. */
describe("faqat yopilgan kunlar rejimi", () => {
  const strict: CashBreakdown = { ...three, closed_days_only: true }
  const todayOnly: CashBreakdown = { ...data([]), expected_cash: 250_000, closed_days_only: true }

  it("rejim faqat server aytganda yoqiladi (eski serverda — erkin)", () => {
    expect(closedDaysOnly(strict)).toBe(true)
    for (const d of [three, data(), undefined, null]) expect(closedDaysOnly(d)).toBe(false)
  })

  it("tanlov inobatga olinmaydi: har doim oxirgi kesimgacha", () => {
    for (const choice of [null, C16, C17, ALL_CASH, "2026-11-01T19:05:00+00:00"]) {
      expect(effectiveCutChoice(strict, choice)).toBe(C18)
      const chosen = selectedCut(strict, choice)
      expect(chosen?.cut_at).toBe(C18)
      expect(amountDue(strict, chosen)).toBe(2_550_000)
      expect(cashLeftAfter(strict, chosen)).toBe(250_000)
      expect(handoverPeriod(strict, choice)).toEqual({ from: START, to: C18, days: 3 })
    }
  })

  it("ro'yxatda yopilgan kunlar belgilangan, bugungi qator — yo'q", () => {
    const flags = (choice: string | null) =>
      cutRows(strict, choice).map((r) => `${r.included ? "+" : "-"}${r.selected ? "*" : ""}`)
    expect(flags(null)).toEqual(["+", "+", "+*", "-"])
    expect(flags(C16)).toEqual(["+", "+", "+*", "-"])
    expect(flags(ALL_CASH)).toEqual(["+", "+", "+*", "-"])
  })

  it("yopilgan kun yo'q — topshirib bo'lmaydi", () => {
    expect(handoverBlocked(todayOnly)).toBe(true)
    expect(handoverBlocked(strict)).toBe(false)
    // Erkin rejimda kesimsiz sessiya — "hamma pul", to'siq yo'q
    expect(handoverBlocked(data([]))).toBe(false)
    expect(handoverBlocked(undefined)).toBe(false)
  })

  it("erkin rejim o'zgarmagan", () => {
    const free: CashBreakdown = { ...three, closed_days_only: false }
    expect(effectiveCutChoice(free, C16)).toBe(C16)
    expect(effectiveCutChoice(free, ALL_CASH)).toBe(ALL_CASH)
    expect(shiftSplit(free)).toBeNull()
  })
})

describe("smena kunlik kesimda yopilishi", () => {
  const strict: CashBreakdown = { ...three, closed_days_only: true }

  it("yopilgan kunlar va bugungi tushum — yig'indisi kassadagi jami pul", () => {
    const split = shiftSplit(strict)
    expect(split).toEqual({
      from: START,
      cutAt: C18,
      days: 3,
      closedCash: 2_550_000,
      todayCash: 250_000,
    })
    expect(split!.closedCash + split!.todayCash).toBe(strict.expected_cash)
  })

  it("kesimdan keyin xarajat ko'p bo'lsa bugungi qism manfiy", () => {
    const d: CashBreakdown = {
      ...data([
        cut({ cut_at: C18, from_at: START, day: "2026-11-17", opening_cash: 0, day_cash: 1_000_000, expected_cash: 1_000_000, after_cash: -50_000, carried_cash: 50_000, due_cash: 950_000 }),
      ]),
      expected_cash: 950_000,
      closed_days_only: true,
    }
    const split = shiftSplit(d)
    expect(split?.closedCash).toBe(1_000_000)
    expect(split?.todayCash).toBe(-50_000)
    expect(split!.closedCash + split!.todayCash).toBe(d.expected_cash)
  })

  it("sessiyaga kesim tushmagan yoki rejim o'chiq — bo'linmaydi", () => {
    expect(shiftSplit({ ...data([]), closed_days_only: true })).toBeNull()
    expect(shiftSplit(three)).toBeNull()
    expect(shiftSplit(undefined)).toBeNull()
  })
})

describe("dayOffset", () => {
  const now = new Date(2026, 10, 18, 8, 40)

  it("bugun, ertaga va undan keyin", () => {
    expect(dayOffset(new Date(2026, 10, 18, 23, 0).toISOString(), now)).toBe(0)
    expect(dayOffset(new Date(2026, 10, 19, 0, 5).toISOString(), now)).toBe(1)
    expect(dayOffset(new Date(2026, 10, 20, 0, 5).toISOString(), now)).toBe(2)
  })

  it("oy va yil chegarasidan o'tadi", () => {
    expect(dayOffset(new Date(2026, 11, 1, 0, 5).toISOString(), new Date(2026, 10, 30, 23, 50))).toBe(1)
    expect(dayOffset(new Date(2027, 0, 1, 0, 5).toISOString(), new Date(2026, 11, 31, 12, 0))).toBe(1)
  })
})

/* "Faqat oldingi smenalar" rejimi (sozlama): topshiriladigani — oldingi
   smenalardan qolgan (smena boshida qabul qilingan) pul; xodimning o'z
   smenasidagi tushum kassada qoladi. Kunlik kesim bu rejimda ishlatilmaydi.

   Misol: Azizdan 1 000 000 qabul qilingan, o'z smenasida 650 000 tushgan. */
describe("faqat oldingi smenalar rejimi", () => {
  const ACCEPTED = "2026-11-17T04:00:00+00:00"
  const plan = (over: Partial<PrevShiftsPlan> = {}): PrevShiftsPlan => ({
    ...cut({ cut_at: ACCEPTED, from_at: ACCEPTED, day: "2026-11-16", opening_cash: 1_000_000, expected_cash: 1_000_000, after_cash: 650_000, due_cash: 1_000_000 }),
    received_from: { user_name: "Aziz Karimov", accepted_at: ACCEPTED, counted_cash: 1_000_000 },
    ...over,
  })
  const prev = (p: PrevShiftsPlan = plan(), cuts: CashCut[] = []): CashBreakdown => ({
    ...data(cuts),
    opening_cash: 1_000_000,
    expected_cash: 1_650_000,
    handover_scope: "prev_shifts",
    closed_days_only: false,
    prev_shifts: p,
  })

  it("rejim serverning javobidan aniqlanadi", () => {
    expect(handoverScopeOf(prev())).toBe("prev_shifts")
    expect(prevShiftsOnly(prev())).toBe(true)
    expect(closedDaysOnly(prev())).toBe(false)
    // Eski server: yangi maydon yo'q — eski bayroqdan
    expect(handoverScopeOf({ ...three, closed_days_only: true })).toBe("closed_days")
    expect(handoverScopeOf(three)).toBe("free")
    expect(handoverScopeOf(undefined)).toBe("free")
    expect(handoverScopeOf({ ...three, handover_scope: "weekly" as never })).toBe("free")
    // Yangi maydon eski bayroqdan ustun
    expect(handoverScopeOf({ ...three, handover_scope: "free", closed_days_only: true })).toBe("free")
  })

  it("topshiriladigani — smena boshida qabul qilingan pul", () => {
    const d = prev()
    const chosen = selectedCut(d, null)
    expect(chosen?.cut_at).toBe(ACCEPTED)
    expect(amountDue(d, chosen)).toBe(1_000_000)
    // O'z smenasidagi tushum kassada qoladi
    expect(cashLeftAfter(d, chosen)).toBe(650_000)
    expect(effectiveCutChoice(d, null)).toBe(ACCEPTED)
    expect(prevShiftsPlan(d)?.received_from?.user_name).toBe("Aziz Karimov")
  })

  it("xodim tanlovi va kunlik kesimlar inobatga olinmaydi", () => {
    // Sessiyaga kunlik kesimlar tushgan bo'lsa ham — bu rejimda kunlar yo'q
    const d = prev(plan(), three.cuts)
    expect(hasCuts(d)).toBe(true)
    expect(showsDays(d)).toBe(false)
    expect(cutRows(d, null)).toEqual([])
    expect(handoverPeriod(d, null)).toBeNull()
    for (const choice of [null, C16, C18, ALL_CASH]) {
      expect(selectedCut(d, choice)?.cut_at).toBe(ACCEPTED)
      expect(amountDue(d, selectedCut(d, choice))).toBe(1_000_000)
    }
    // Smena bu rejimda kesim bo'yicha bo'linmaydi
    expect(shiftSplit(d)).toBeNull()
  })

  it("o'z smenasidagi xarajatga ketgan qism topshirilmaydi", () => {
    const d = {
      ...prev(plan({ after_cash: -300_000, carried_cash: 300_000, due_cash: 700_000 })),
      expected_cash: 700_000,
    }
    const chosen = selectedCut(d, null)
    expect(amountDue(d, chosen)).toBe(700_000)
    // Kassada jismonan hech narsa qolmaydi
    expect(cashLeftAfter(d, chosen)).toBe(0)
    expect(handoverBlocked(d)).toBe(false)
  })

  it("oldingi smena puli yo'q — topshirib bo'lmaydi", () => {
    const empty = prev(plan({ opening_cash: 0, expected_cash: 0, due_cash: 0, received_from: null }))
    expect(handoverBlocked(empty)).toBe(true)
    // Hammasi smenadagi xarajatga ketgan
    const spent = prev(plan({ after_cash: -1_200_000, carried_cash: 1_000_000, due_cash: 0 }))
    expect(handoverBlocked(spent)).toBe(true)
    // Hisobda reja umuman yo'q
    const missing: CashBreakdown = { ...prev(), prev_shifts: undefined }
    expect(handoverBlocked(missing)).toBe(true)
    expect(selectedCut(missing, null)).toBeNull()
    expect(handoverBlocked(prev())).toBe(false)
  })

  it("boshqa rejimlarda reja ishlatilmaydi", () => {
    const stray: CashBreakdown = { ...three, prev_shifts: plan() }
    expect(prevShiftsPlan(stray)).toBeNull()
    expect(showsDays(stray)).toBe(true)
    expect(selectedCut(stray, null)?.cut_at).toBe(C18)
    expect(handoverBlocked(stray)).toBe(false)
  })
})
