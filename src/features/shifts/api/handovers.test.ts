import { describe, expect, it } from "vitest"

import { handoverMismatch, isForbiddenError, type ShiftHandover } from "./shifts"

/* Smenadan smenaga o'tgan pullar va kassalar holati — yordamchilar. */

const handover = (over: Partial<ShiftHandover> = {}): ShiftHandover => ({
  id: "h1",
  kind: "HANDOVER",
  from_user_id: "u1",
  opening_cash: 0,
  force_closed: false,
  corrected: false,
  counted_cash: 1_200_000,
  received_opening_cash: 1_200_000,
  ...over,
})

describe("handoverMismatch", () => {
  it("zanjir uzilmagan — farq yo'q", () => {
    expect(handoverMismatch(handover())).toBeNull()
    // 1 so'mgacha yaxlitlash farqi hisobga olinmaydi
    expect(handoverMismatch(handover({ received_opening_cash: 1_200_000.4 }))).toBeNull()
  })

  it("sanalgan summa keyin tuzatilgan — qabul qiluvchi boshqa summa bilan boshlagan", () => {
    expect(handoverMismatch(handover({ counted_cash: 1_150_000 }))).toBe(50_000)
  })

  it("faqat qabul qilingan topshirishda tekshiriladi", () => {
    expect(handoverMismatch(handover({ kind: "CASH_OUT", received_opening_cash: 0 }))).toBeNull()
    expect(handoverMismatch(handover({ received_opening_cash: null }))).toBeNull()
  })
})

describe("isForbiddenError", () => {
  it("faqat 403", () => {
    expect(isForbiddenError({ response: { status: 403 } })).toBe(true)
    expect(isForbiddenError({ response: { status: 500 } })).toBe(false)
    expect(isForbiddenError(null)).toBe(false)
    expect(isForbiddenError(new Error("x"))).toBe(false)
  })
})
