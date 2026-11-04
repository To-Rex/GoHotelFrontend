import { describe, expect, it } from "vitest"

import type { PaymentRecord } from "@/types/api"
import {
  bookingLink,
  formatReportDate,
  humanNote,
  purposeBadges,
  purposeDetail,
  purposeTitle,
  reportDateDiffers,
  shopItemsText,
  stayText,
} from "./paymentPurpose"

const base: PaymentRecord = {
  id: "p1",
  hotel_id: "h1",
  invoice_id: "i1",
  payment_number: "PAY-1",
  amount: 250000,
  payment_method: "CASH",
  payment_date: "2026-11-03",
  created_at: "2026-11-03T18:49:00Z",
  source: "RESERVATION",
  parts: [{ kind: "ROOM", amount: 250000, label: "Room charge: 12" }],
  after_checkout: false,
  reservation_id: "r1",
  reservation_number: "RES-77",
  reservation_status: "CHECKED_IN",
  booking_type: "HOURLY",
  check_in_date: "2026-11-03",
  check_out_date: "2026-11-04",
  room_number: "12",
  guest_name: "Ali Valiyev",
}

describe("purposeBadges", () => {
  it("bitta haq — faqat nomi, summasiz", () => {
    expect(purposeBadges(base).map((b) => b.label)).toEqual(["Xona"])
  })

  it("xona + jarima — ikkala belgi summasi bilan, jarima turi sarlavhada", () => {
    const badges = purposeBadges({
      ...base,
      parts: [
        { kind: "ROOM", amount: 100000 },
        { kind: "PENALTY", amount: 50000, label: "Jarima: Kech chiqish" },
      ],
    })
    expect(badges.map((b) => b.label)).toEqual(["Xona 100,000", "Jarima 50,000"])
    expect(badges[1].title).toBe("Jarima: Kech chiqish")
    expect(badges[1].tone).toBe("penalty")
  })

  it("qarz to'lovi belgisi birinchi turadi", () => {
    const badges = purposeBadges({ ...base, after_checkout: true })
    expect(badges.map((b) => b.key)).toEqual(["DEBT", "ROOM"])
    expect(badges[0].tone).toBe("debt")
  })

  it("manfiy summa — faqat Qaytarim", () => {
    const badges = purposeBadges({ ...base, amount: -30000, parts: [{ kind: "REFUND", amount: 30000 }], after_checkout: true })
    expect(badges.map((b) => b.key)).toEqual(["REFUND"])
  })

  it("do'kon to'lovi qismlarsiz ham Do'kon belgisini oladi", () => {
    expect(purposeBadges({ ...base, source: "SHOP", parts: [] }).map((b) => b.key)).toEqual(["SHOP"])
  })

  it("eski server (qismlar yo'q) — belgisiz, lekin yiqilmaydi", () => {
    expect(purposeBadges({ ...base, parts: undefined, after_checkout: undefined })).toEqual([])
  })
})

describe("purposeTitle / purposeDetail", () => {
  it("bron: xona va mehmon; raqam va muddat ikkinchi qatorda", () => {
    expect(purposeTitle(base)).toBe("Xona 12 · Ali Valiyev")
    expect(purposeDetail(base)).toBe("RES-77 · 03.11–04.11 (soatlik)")
  })

  it("kunlik bron — muddat belgisiz", () => {
    expect(purposeDetail({ ...base, booking_type: "DAILY" })).toBe("RES-77 · 03.11–04.11")
  })

  it("soatlik bron aniq soatlar bilan — bir kunda va kun almashganda", () => {
    const from = new Date(2026, 10, 3, 14, 0).toISOString()
    expect(stayText({ ...base, check_in_datetime: from, check_out_datetime: new Date(2026, 10, 3, 17, 0).toISOString() })).toBe(
      "03.11 14:00–17:00 (soatlik)"
    )
    expect(stayText({ ...base, check_in_datetime: new Date(2026, 10, 3, 22, 0).toISOString(), check_out_datetime: new Date(2026, 10, 4, 2, 0).toISOString() })).toBe(
      "03.11 22:00–04.11 02:00 (soatlik)"
    )
    expect(formatReportDate("2026-11-03")).toBe("03.11.2026")
  })

  it("do'kon: mahsulotlar sarlavhada, bron bo'lsa ikkinchi qatorda", () => {
    const shop: PaymentRecord = {
      ...base,
      source: "SHOP",
      items: [
        { product_name: "Coca-Cola", quantity: 2 },
        { product_name: "Suv", quantity: 1 },
      ],
    }
    expect(shopItemsText(shop.items)).toBe("Coca-Cola ×2, Suv")
    expect(purposeTitle(shop)).toBe("Do'kon: Coca-Cola ×2, Suv")
    expect(purposeDetail(shop)).toBe("Xona 12 · Ali Valiyev · RES-77")
    expect(purposeTitle({ ...shop, items: [] })).toBe("Do'kon savdosi")
  })

  it("ma'lumot bo'lmasa — bron raqami yoki umumiy nom", () => {
    expect(purposeTitle({ ...base, room_number: null, guest_name: null })).toBe("RES-77")
    expect(purposeTitle({ ...base, room_number: null, guest_name: null, reservation_number: null })).toBe("Bron to'lovi")
  })
})

describe("humanNote", () => {
  it("avtomatik izohlar qisqa o'zbekcha", () => {
    expect(humanNote("Payment at reservation creation")).toBe("Bron qilinganda to'langan")
    expect(humanNote("Qo'shimcha to'lov (bron balansi bo'yicha)")).toBe("Qo'shimcha to'lov")
    expect(humanNote("Qo'shimcha to'lov (bron balansi bo'yicha) — bo'lib to'lash 1/2")).toBe(
      "Qo'shimcha to'lov, bo'lib to'lash 1/2"
    )
  })

  it("qo'lda yozilgan izoh o'z holicha", () => {
    expect(humanNote("  Mehmon kechikdi ")).toBe("Mehmon kechikdi")
    expect(humanNote(null)).toBe("")
  })
})

describe("reportDateDiffers", () => {
  it("hisobot sanasi qabul qilingan mahalliy kundan farq qilsa true", () => {
    const local = new Date(2026, 10, 3, 23, 49).toISOString()
    expect(reportDateDiffers({ created_at: local, payment_date: "2026-11-03" })).toBe(false)
    expect(reportDateDiffers({ created_at: local, payment_date: "2026-11-02" })).toBe(true)
    expect(reportDateDiffers({ created_at: "", payment_date: "2026-11-02" })).toBe(false)
  })
})

describe("bookingLink", () => {
  it("faqat ochiq bronlar uchun havola", () => {
    expect(bookingLink(base)).toBe("/booking?reservation=r1")
    expect(bookingLink({ ...base, reservation_status: "CHECKED_OUT" })).toBeNull()
    expect(bookingLink({ ...base, reservation_id: null })).toBeNull()
  })
})
