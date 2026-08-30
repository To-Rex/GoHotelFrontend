import { describe, it, expect } from "vitest"
import {
  EMPTY_RULE,
  discountHint,
  discountProblem,
  ruleFor,
  type DiscountRule,
} from "./discountRules"

/* Chegirma qoidasi — bron oynasidagi tekshiruv.

   Bu server bilan BIR XIL qoida bo'lishi kerak: bu yerdagisi xodimga darhol
   javob berish uchun, haqiqiy to'siq esa serverda. Ikkalasi bir-biridan
   chetga chiqsa, oyna ruxsat bergan chegirma serverda rad etilib, xodim
   sababini tushunmay qoladi. */

const rule = (o: Partial<DiscountRule> = {}): DiscountRule => ({ ...EMPTY_RULE, ...o })

describe("discountProblem", () => {
  it("chegirmasiz bron hech qachon to'silmaydi", () => {
    const strict = rule({ enabled: false, min_duration: 99 })
    expect(discountProblem(strict, "HOURLY", 1, 100000, 0, 0)).toBeNull()
  })

  it("sozlanmagan mehmonxonada cheklov yo'q", () => {
    expect(discountProblem(EMPTY_RULE, "HOURLY", 1, 100000, 0, 90)).toBeNull()
  })

  it("o'chirilgan bo'lsa chegirma berilmaydi", () => {
    const problem = discountProblem(rule({ enabled: false }), "HOURLY", 3, 100000, 0, 5)
    expect(problem).toContain("o'chirilgan")
  })

  it("qisqa bronga chegirma berilmaydi", () => {
    const problem = discountProblem(rule({ min_duration: 2 }), "HOURLY", 1, 100000, 0, 5)
    expect(problem).toContain("2 soat")
  })

  it("chegara qiymatining o'zi ruxsat etiladi", () => {
    expect(discountProblem(rule({ min_duration: 2 }), "HOURLY", 2, 100000, 0, 5)).toBeNull()
    expect(discountProblem(rule({ max_percent: 10 }), "HOURLY", 2, 100000, 0, 10)).toBeNull()
  })

  it("uzun bronga chegirma berilmaydi", () => {
    const problem = discountProblem(rule({ max_duration: 2 }), "HOURLY", 5, 100000, 0, 5)
    expect(problem).toContain("2 soat")
  })

  it("kunlik bronda o'lchov kecha", () => {
    const problem = discountProblem(rule({ min_duration: 3 }), "DAILY", 1, 100000, 0, 5)
    expect(problem).toContain("kecha")
  })

  it("foiz chegarasi so'm orqali chetlab o'tilmaydi", () => {
    // 50 000 = 50% — foizda 10% chegara qo'yilgan
    const problem = discountProblem(rule({ max_percent: 10 }), "HOURLY", 3, 100000, 50000, 0)
    expect(problem).toContain("10%")
  })

  it("summa chegarasi foiz orqali chetlab o'tilmaydi", () => {
    // 50% = 50 000 so'm — summada 10 000 chegara qo'yilgan
    const problem = discountProblem(rule({ max_amount: 10000 }), "HOURLY", 3, 100000, 0, 50)
    expect(problem).toContain("so'm")
  })

  it("ikkala chegara birga ishlaydi", () => {
    const both = rule({ max_percent: 20, max_amount: 10000 })
    // 15% = 15 000: foizga sig'adi, summaga sig'maydi
    expect(discountProblem(both, "HOURLY", 3, 100000, 0, 15)).not.toBeNull()
    // 5% = 5 000: ikkalasiga ham sig'adi
    expect(discountProblem(both, "HOURLY", 3, 100000, 0, 5)).toBeNull()
  })

  it("narxi nol bo'lgan xonada yiqilmaydi", () => {
    expect(() =>
      discountProblem(rule({ max_percent: 10 }), "HOURLY", 3, 0, 5000, 0)
    ).not.toThrow()
  })
})

describe("ruleFor", () => {
  it("qoida kelmaguncha cheklovsiz deb qaraladi", () => {
    expect(ruleFor(undefined, "HOURLY")).toEqual(EMPTY_RULE)
  })

  it("bron turi bo'yicha ajratadi", () => {
    const rules = {
      daily: rule({ max_percent: 5 }),
      hourly: rule({ max_percent: 50 }),
    }
    expect(ruleFor(rules, "DAILY").max_percent).toBe(5)
    expect(ruleFor(rules, "HOURLY").max_percent).toBe(50)
  })
})

describe("discountHint", () => {
  it("cheklov yo'q bo'lsa izoh ham yo'q", () => {
    expect(discountHint(EMPTY_RULE, "HOURLY")).toBe("")
  })

  it("o'chirilganini aytadi", () => {
    expect(discountHint(rule({ enabled: false }), "HOURLY")).toContain("o'chirilgan")
  })

  it("belgilangan chegaralarni sanaydi", () => {
    const hint = discountHint(rule({ max_percent: 10, min_duration: 2 }), "HOURLY")
    expect(hint).toContain("10%")
    expect(hint).toContain("2 soat")
  })
})
