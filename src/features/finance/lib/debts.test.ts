import { describe, expect, it } from "vitest"

import type { DebtReason, DebtorReservation } from "../api/debtors"
import { hasDebt, primaryKind, reasonDetail, reasonTitle, reasonsSummary } from "./debtReasons"
import { newDebtors, rankDebtors, shouldRemind } from "./debtReminder"

/* Qarz: sababi aniq ko'rinsin va unutilmasin. */

const reason = (over: Partial<DebtReason>): DebtReason => ({ kind: "room", amount: 0, charged: 0, ...over })

describe("qarz sababi matni", () => {
  it("har turdagi sabab o'qiladigan sarlavha oladi", () => {
    expect(reasonTitle(reason({ kind: "room", room_number: "101" }))).toBe("Turar joy (101-xona)")
    expect(reasonTitle(reason({ kind: "penalty", penalty_kind: "LATE_CHECKOUT", note: "1 soat" }))).toBe(
      "Jarima (kech chiqish, 1 soat)"
    )
    expect(reasonTitle(reason({ kind: "penalty" }))).toBe("Jarima")
    expect(reasonTitle(reason({ kind: "shop", products: "Cola ×2" }))).toBe("Do'kon: Cola ×2")
    expect(reasonTitle(reason({ kind: "service", name: "Kir yuvish" }))).toBe("Xizmat: Kir yuvish")
    expect(reasonTitle(reason({ kind: "extension" }))).toContain("uzaytirilgan")
  })

  it("qisman to'langan haqning qancha qolgani yoziladi", () => {
    const detail = reasonDetail(reason({ kind: "room", nights: 2, unit_price: 250000, charged: 500000, amount: 200000 }))
    expect(detail).toContain("2 × 250")
    expect(detail).toContain("200")
    expect(reasonDetail(reason({ kind: "shop", charged: 30000, amount: 30000 }))).toBeNull()
  })

  it("ro'yxat uchun qisqa jamlanma", () => {
    const list = [
      reason({ kind: "penalty", penalty_kind: "DAMAGE", amount: 50000 }),
      reason({ kind: "shop", products: "Cola ×1", amount: 12000 }),
      reason({ kind: "room", amount: 1000 }),
    ]
    const text = reasonsSummary(list, 2)
    expect(text.startsWith("Jarima (shikast) 50")).toBe(true)
    expect(text.endsWith("+1")).toBe(true)
    expect(primaryKind(list)).toBe("penalty")
    expect(reasonsSummary(undefined)).toBe("")
  })

  it("yarim so'mlik yaxlitlash qarz emas", () => {
    expect(hasDebt({ total_debt: 0.4 })).toBe(false)
    expect(hasDebt({ total_debt: 1000 })).toBe(true)
    expect(hasDebt(null)).toBe(false)
  })
})

const debtor = (id: string, over: Partial<DebtorReservation> = {}): DebtorReservation => ({
  id,
  reservation_number: id,
  booking_type: "DAILY",
  check_in_date: "2026-10-01",
  check_out_date: "2026-10-03",
  status: "CHECKED_OUT",
  total_amount: 0,
  paid_amount: 0,
  debt_amount: 1000,
  ...over,
})

describe("eslatma qoidalari", () => {
  const MIN = 60_000

  it("davriy eslatma oraliqda, qarz bor ekan", () => {
    expect(shouldRemind(null, 0, 120, true, 2)).toBe(true)
    expect(shouldRemind(0, 119 * MIN, 120, true, 2)).toBe(false)
    expect(shouldRemind(0, 120 * MIN, 120, true, 2)).toBe(true)
    expect(shouldRemind(null, 0, 120, true, 0)).toBe(false)
    expect(shouldRemind(null, 0, 120, false, 5)).toBe(false)
  })

  it("yangi qarzdor darhol, lekin sahifa ochilganda eski qarzlar emas", () => {
    const items = [debtor("a"), debtor("b")]
    expect(newDebtors(null, items)).toEqual([])
    expect(newDebtors(new Set(["a"]), items).map((d) => d.id)).toEqual(["b"])
    expect(newDebtors(new Set(["a", "b"]), items)).toEqual([])
  })

  it("eng eski va eng katta qarz yuqorida", () => {
    const ranked = rankDebtors([
      debtor("new-big", { overdue_days: 0, debt_amount: 900000 }),
      debtor("old", { overdue_days: 9, debt_amount: 10000 }),
      debtor("mid", { overdue_days: 0, debt_amount: 50000 }),
    ])
    expect(ranked.map((d) => d.id)).toEqual(["old", "new-big", "mid"])
  })
})
