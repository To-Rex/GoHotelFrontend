import { describe, expect, it } from "vitest"

import {
  MANAGER_EDIT_WINDOW_HOURS,
  canEditPaymentMethod,
  editCount,
  isWithinManagerWindow,
  parsePartialAmount,
  paymentEditBlock,
  remainingEdits,
} from "./paymentEdit"

/* To'lov turini tahrirlash oynasi: menejer faqat oxirgi 2 kunlik to'lovlar,
   admin cheklovsiz — server qoidasi bilan bir xil. */

const NOW = new Date("2026-10-15T12:00:00Z")
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()

describe("canEditPaymentMethod", () => {
  it("admin eski to'lovni ham tahrirlay oladi", () => {
    expect(
      canEditPaymentMethod({
        payment: { created_at: hoursAgo(24 * 365) },
        isAdmin: true,
        canForceClose: false,
        now: NOW,
      })
    ).toBe(true)
  })

  it("menejer faqat oxirgi 2 kunlikni", () => {
    expect(
      canEditPaymentMethod({
        payment: { created_at: hoursAgo(MANAGER_EDIT_WINDOW_HOURS - 1) },
        isAdmin: false,
        canForceClose: true,
        now: NOW,
      })
    ).toBe(true)
    expect(
      canEditPaymentMethod({
        payment: { created_at: hoursAgo(MANAGER_EDIT_WINDOW_HOURS + 1) },
        isAdmin: false,
        canForceClose: true,
        now: NOW,
      })
    ).toBe(false)
  })

  it("boshqa xodim (kassir) tahrirlay olmaydi", () => {
    expect(
      canEditPaymentMethod({
        payment: { created_at: hoursAgo(1) },
        isAdmin: false,
        canForceClose: false,
        now: NOW,
      })
    ).toBe(false)
  })

  it("sana yo'q yoki buzuq bo'lsa — menejerga ruxsat yo'q", () => {
    expect(isWithinManagerWindow(null, NOW)).toBe(false)
    expect(isWithinManagerWindow("not-a-date", NOW)).toBe(false)
  })
})

describe("parsePartialAmount", () => {
  const TOTAL = 100000

  it("bo'sh yoki buzuq qiymat — xato", () => {
    for (const raw of ["", "   ", "abc", "0", "-5000"]) {
      expect(parsePartialAmount(TOTAL, raw).error).toBe("nan")
      expect(parsePartialAmount(TOTAL, raw).amount).toBeNull()
    }
  })

  it("summadan katta bo'lsa — range xatosi", () => {
    const parsed = parsePartialAmount(TOTAL, "150000")
    expect(parsed.error).toBe("range")
    expect(parsed.amount).toBeNull()
  })

  it("bo'shliq va vergul bilan yozilgan summani o'qiydi", () => {
    expect(parsePartialAmount(TOTAL, "50 000").amount).toBe(50000)
    expect(parsePartialAmount(TOTAL, "50,5").amount).toBe(50.5)
  })

  it("butun summaga teng — ruxsat (server to'liq tahrir qiladi)", () => {
    const parsed = parsePartialAmount(TOTAL, "100000")
    expect(parsed.error).toBeNull()
    expect(parsed.amount).toBe(100000)
  })
})

/* Qabulxona: sozlama, bitta to'lovga chegara va 2 kunlik oyna —
   server (payment_edit_settings) bilan bir xil. */
describe("qabulxona tahriri", () => {
  const fresh = { created_at: hoursAgo(3), method_changes: [] as never[] }
  const twice = {
    created_at: hoursAgo(3),
    method_changes: [
      { old: "CASH", new: "CARD", at: "", kind: "full" },
      { old: "CARD", new: "ONLINE", at: "", kind: "partial" },
      { old: "ONLINE", new: "CASH", at: "", kind: "split_from" },
    ] as never[],
  }
  const on = { enabled: true, maxEdits: 2 }

  it("tahrirlar soni: butun va qisman, split_from emas, eski yozuv ham", () => {
    expect(editCount(fresh)).toBe(0)
    expect(editCount(twice)).toBe(2)
    expect(editCount({ method_changes: [{ old: "A", new: "B", at: "" }] as never[] })).toBe(1)
    expect(editCount({ method_changes: null })).toBe(0)
  })

  it("sozlama o'chiq yoki yo'q — qabulxona tahrirlay olmaydi", () => {
    const base = { payment: fresh, isAdmin: false, canForceClose: false, canTakePayments: true, now: NOW }
    expect(paymentEditBlock({ ...base })).toBe("disabled")
    expect(paymentEditBlock({ ...base, reception: { enabled: false, maxEdits: 2 } })).toBe("disabled")
    expect(canEditPaymentMethod({ ...base, reception: on })).toBe(true)
  })

  it("chegara: 2 marta tahrirlangan to'lov yopiq, 3 ruxsat bo'lsa ochiq", () => {
    const base = { payment: twice, isAdmin: false, canForceClose: false, canTakePayments: true, now: NOW }
    expect(paymentEditBlock({ ...base, reception: on })).toBe("limit")
    expect(paymentEditBlock({ ...base, reception: { enabled: true, maxEdits: 3 } })).toBeNull()
    // Menejer va admin chegaraga bog'liq emas
    expect(paymentEditBlock({ ...base, canForceClose: true })).toBeNull()
    expect(paymentEditBlock({ ...base, isAdmin: true })).toBeNull()
  })

  it("oyna: eski to'lov qabulxonaga ham, menejerga ham yopiq", () => {
    const old = { created_at: hoursAgo(MANAGER_EDIT_WINDOW_HOURS + 1), method_changes: [] as never[] }
    expect(paymentEditBlock({ payment: old, isAdmin: false, canForceClose: false, canTakePayments: true, reception: on, now: NOW })).toBe("window")
    expect(paymentEditBlock({ payment: old, isAdmin: false, canForceClose: true, now: NOW })).toBe("window")
  })

  it("to'lov huquqi yo'q xodim — taqiq", () => {
    expect(paymentEditBlock({ payment: fresh, isAdmin: false, canForceClose: false, reception: on, now: NOW })).toBe("forbidden")
  })

  it("qolgan imkoniyat faqat qabulxonaga", () => {
    expect(remainingEdits(fresh, on, true)).toBe(2)
    expect(remainingEdits(twice, on, true)).toBe(0)
    expect(remainingEdits(twice, { enabled: true, maxEdits: 3 }, true)).toBe(1)
    expect(remainingEdits(fresh, on, false)).toBeNull()
    expect(remainingEdits(fresh, { enabled: false, maxEdits: 2 }, true)).toBeNull()
  })
})
