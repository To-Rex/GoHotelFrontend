import { describe, expect, it } from "vitest"

import {
  MANAGER_EDIT_WINDOW_HOURS,
  canEditPaymentMethod,
  isWithinManagerWindow,
  parsePartialAmount,
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
