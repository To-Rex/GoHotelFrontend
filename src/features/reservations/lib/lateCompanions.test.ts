import { describe, expect, it } from "vitest"

import {
  canExpectCompanion,
  companionAddCheck,
  companionStatusLabel,
  expectedCompanions,
  freeSeats,
} from "./companions"
import { lateCompanionPayload, newLateCompanion } from "./lateCompanions"

/* Kechikib keladigan hamrohlar: joy band qiladi, kelganda biriktiriladi.
   Qoidalar serverdagi companion_ops bilan bir xil. */

const late = { id: "e1", name: "Bobur", created_at: "2026-10-10T09:00:00+05:00" }

describe("kutilayotgan hamroh joy egallaydi", () => {
  it("bo'sh joy kutilayotganlarni ham ayiradi", () => {
    expect(freeSeats({ adults: 3, companions: [], expected_companions: [late] })).toBe(1)
    expect(freeSeats({ adults: 2, companions: [], expected_companions: [late] })).toBe(0)
    // eski bron (maydon yo'q) — avvalgidek
    expect(freeSeats({ adults: 2, companions: [] })).toBe(1)
  })

  it("bo'sh yozuvlar hisobga olinmaydi", () => {
    expect(expectedCompanions({ expected_companions: [late, null as any, { id: "" } as any] })).toEqual([late])
  })
})

describe("hamroh qo'shish / kechikib keladi tugmalari", () => {
  const full = { status: "CHECKED_IN", adults: 2, companions: [], expected_companions: [late] }

  it("joy faqat kutilgan hisobiga band — qo'shish mumkin (kelgan odam o'sha hamroh)", () => {
    expect(companionAddCheck(full).ok).toBe(true)
  })

  it("haqiqatan to'la xona — qo'shib bo'lmaydi", () => {
    const res = { status: "CHECKED_IN", adults: 2, companions: [{ guest_id: "a" }] }
    expect(companionAddCheck(res).ok).toBe(false)
  })

  it("yana kechikib keladi deb belgilash — faqat bo'sh joy bo'lsa", () => {
    expect(canExpectCompanion(full)).toBe(false)
    expect(canExpectCompanion({ ...full, adults: 3 })).toBe(true)
    expect(canExpectCompanion({ ...full, adults: 3, status: "CHECKED_OUT" })).toBe(false)
    expect(canExpectCompanion({ ...full, adults: 3, checkout_requested_at: "2026-10-10T12:00:00" })).toBe(false)
  })
})

describe("kechikib kelgan hamroh belgisi", () => {
  it("'Kechikib keldi · vaqt'", () => {
    const now = new Date(2026, 9, 10, 18, 0)
    const label = companionStatusLabel(
      { guest_id: "x", added_at: new Date(2026, 9, 10, 17, 5).toISOString(), arrived_late: true },
      now
    )
    expect(label).toBe("Kechikib keldi · 17:05")
  })
})

describe("yangi bandlov — kechikib keladigan qator", () => {
  it("bo'sh maydonlar null bo'lib ketadi, kalit serverga ketmaydi", () => {
    const a = { ...newLateCompanion(), name: "  Bobur ", phone: "" }
    const b = newLateCompanion()
    expect(a.key).not.toBe(b.key)
    expect(lateCompanionPayload([a, b])).toEqual([
      { name: "Bobur", phone: null, note: null },
      { name: null, phone: null, note: null },
    ])
  })
})
