import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildReservationElements } from "@/lib/tprints"
import { DEFAULT_RECEIPT_SETTINGS } from "@/features/shop/api/shop"
import {
  BOOKING_AUTO_PRINT_KEY,
  buildReservationReceiptData,
  getBookingAutoPrint,
  receiptDuration,
  setBookingAutoPrint,
  shouldPrintAfterPayment,
  summarizePayments,
  type ReceiptReservation,
} from "./receipt"

const base: ReceiptReservation = {
  reservation_number: "R-1001",
  booking_type: "DAILY",
  check_in_date: "2026-10-10",
  check_out_date: "2026-10-13",
  adults: 2,
  children: 1,
  total_amount: 900_000,
  paid_amount: 500_000,
  discount_amount: 50_000,
  move_discount_amount: 20_000,
  penalty_amount: 0,
  created_at: "2026-10-10T09:00:00",
  status: "CHECKED_IN",
}

describe("receiptDuration", () => {
  it("kunlik — sutka, soatlik — soat", () => {
    expect(receiptDuration("2026-10-10", "2026-10-13", false)).toBe(3)
    expect(receiptDuration("2026-10-10T10:00:00", "2026-10-10T13:00:00", true)).toBe(3)
  })

  it("noto'g'ri yoki nol davomiylik — null", () => {
    expect(receiptDuration("x", "2026-10-13", false)).toBeNull()
    expect(receiptDuration("2026-10-10", "2026-10-10", false)).toBeNull()
  })
})

describe("summarizePayments", () => {
  it("usul bo'yicha yig'adi, eski kodlarni kanonik nomga keltiradi, nolni tashlaydi", () => {
    expect(
      summarizePayments([
        { method: "CASH", amount: 300_000 },
        { method: "CARD", amount: 100_000 },
        { method: "CREDIT_CARD", amount: 100_000 },
        { method: "ONLINE", amount: 0 },
      ])
    ).toEqual([
      { label: "Naqd pul", amount: 300_000 },
      { label: "Bank kartasi", amount: 200_000 },
    ])
  })
})

describe("buildReservationReceiptData", () => {
  it("chegirmaga ko'chirish chegirmasi qo'shiladi, to'lovlar nomlanadi", () => {
    const data = buildReservationReceiptData(base, {
      guestName: "Ali Valiyev",
      roomNumber: "101",
      payments: [{ method: "CASH", amount: 500_000 }],
    })
    expect(data.discount_amount).toBe(70_000)
    expect(data.nights).toBe(3)
    expect(data.check_in).toBe("10.10.2026")
    expect(data.payments).toEqual([{ label: "Naqd pul", amount: 500_000 }])
    expect(data.payments_now).toBe(false)
  })

  it("to'lovsiz — payments yo'q (tugma bilan chiqarilgan eski chek o'zgarmaydi)", () => {
    const data = buildReservationReceiptData(base)
    expect(data.payments).toBeUndefined()
    expect(data.payments_now).toBeUndefined()
  })
})

describe("chek elementlari", () => {
  const rows = (els: any[]) => els.filter((e) => e.type === "row").map((e) => [e.left, e.right])

  it("bitta to'lov — 'To'lov turi' qatori", () => {
    const els = buildReservationElements(
      buildReservationReceiptData(base, { payments: [{ method: "CARD", amount: 500_000 }] }),
      "Grand",
      DEFAULT_RECEIPT_SETTINGS
    )
    expect(rows(els)).toContainEqual(["To'lov turi:", "Bank kartasi"])
  })

  it("qo'shimcha to'lov — 'Shu to'lov' summasi va usuli", () => {
    const els = buildReservationElements(
      buildReservationReceiptData(base, {
        payments: [{ method: "CASH", amount: 200_000 }],
        paymentsNow: true,
      }),
      "Grand",
      DEFAULT_RECEIPT_SETTINGS
    )
    const r = rows(els)
    expect(r.find(([l]) => l === "Shu to'lov:")?.[1]).toContain((200_000).toLocaleString())
    expect(r).toContainEqual(["To'lov turi:", "Naqd pul"])
  })

  it("bo'lib to'lov — har usul alohida qator", () => {
    const els = buildReservationElements(
      buildReservationReceiptData(base, {
        payments: [
          { method: "CASH", amount: 300_000 },
          { method: "CARD", amount: 200_000 },
        ],
      }),
      "Grand",
      DEFAULT_RECEIPT_SETTINGS
    )
    const labels = rows(els).map(([l]) => l)
    expect(labels).toContain("  Naqd pul:")
    expect(labels).toContain("  Bank kartasi:")
    expect(labels).not.toContain("To'lov turi:")
  })
})

describe("to'lovdan keyin chek sozlamasi", () => {
  // Testlar node muhitida — localStorage o'rniga oddiy xarita
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("localStorage yopiq bo'lsa ham yiqilmaydi (sukut — yoqilgan)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    })
    expect(getBookingAutoPrint()).toBe(true)
    expect(() => setBookingAutoPrint(false)).not.toThrow()
  })

  it("sozlama kaliti o'zgarmas", () => {
    expect(BOOKING_AUTO_PRINT_KEY).toBe("tprints_booking_auto_print")
  })

  it("sukut — yoqilgan; o'chirilsa saqlanadi", () => {
    expect(getBookingAutoPrint()).toBe(true)
    setBookingAutoPrint(false)
    expect(getBookingAutoPrint()).toBe(false)
    setBookingAutoPrint(true)
    expect(getBookingAutoPrint()).toBe(true)
  })

  it("chek faqat pul olinganda va sozlama yoqilganda", () => {
    expect(shouldPrintAfterPayment(true, 100)).toBe(true)
    expect(shouldPrintAfterPayment(true, 0)).toBe(false)
    expect(shouldPrintAfterPayment(false, 100)).toBe(false)
  })
})
