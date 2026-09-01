import { describe, it, expect } from "vitest"
import {
  isBlockedAlways,
  isBlockedNow,
  isRestrictedStatus,
  roomBookingBlock,
  windowCoversNow,
} from "./roomBookable"

/* Bu qoida serverdagi `_assert_room_bookable` bilan bir xil bo'lishi kerak.
   Asosiy nozik joy — tozalash bilan ta'mir orasidagi farq: tozalash faqat
   hozirni to'sadi, ta'mir esa hamma vaqtni. */

const now = new Date(2026, 8, 1, 12, 0) // 1-sentabr, soat 12:00
const room = (status: string) => ({ room_number: "101", current_status: status })

describe("holat darajalari", () => {
  it("ta'mir/tekshiruv/xizmatdan tashqari — butunlay yopiq", () => {
    for (const s of ["MAINTENANCE", "INSPECTION", "OUT_OF_SERVICE"]) {
      expect(isBlockedAlways(s)).toBe(true)
      expect(isBlockedNow(s)).toBe(false)
    }
  })

  it("tozalash — faqat hozir uchun yopiq", () => {
    expect(isBlockedAlways("CLEANING")).toBe(false)
    expect(isBlockedNow("CLEANING")).toBe(true)
    expect(isRestrictedStatus("CLEANING")).toBe(true)
  })

  it("oddiy holatlarga tegilmaydi", () => {
    for (const s of ["AVAILABLE", "OCCUPIED", "RESERVED"]) {
      expect(isRestrictedStatus(s)).toBe(false)
    }
  })
})

describe("windowCoversNow", () => {
  it("kunlik: bugun kirib ertaga chiqish hozirni qamraydi", () => {
    expect(
      windowCoversNow(
        {
          bookingType: "DAILY",
          checkInDate: "2026-09-01",
          checkOutDate: "2026-09-02",
        },
        now
      )
    ).toBe(true)
  })

  it("kunlik: ertangi bron hozirni qamramaydi", () => {
    expect(
      windowCoversNow(
        {
          bookingType: "DAILY",
          checkInDate: "2026-09-02",
          checkOutDate: "2026-09-03",
        },
        now
      )
    ).toBe(false)
  })

  it("kunlik: chiqish kuni bugun bo'lsa qamramaydi", () => {
    // Chiqish kuni mehmon ketadi — o'sha kun band hisoblanmaydi
    expect(
      windowCoversNow(
        {
          bookingType: "DAILY",
          checkInDate: "2026-08-30",
          checkOutDate: "2026-09-01",
        },
        now
      )
    ).toBe(false)
  })

  it("soatlik: oraliq ichida", () => {
    expect(
      windowCoversNow(
        {
          bookingType: "HOURLY",
          checkInAt: "2026-09-01T11:00",
          checkOutAt: "2026-09-01T13:00",
        },
        now
      )
    ).toBe(true)
  })

  it("soatlik: keyinroqqa va allaqachon tugaganiga qamramaydi", () => {
    expect(
      windowCoversNow(
        {
          bookingType: "HOURLY",
          checkInAt: "2026-09-01T15:00",
          checkOutAt: "2026-09-01T17:00",
        },
        now
      )
    ).toBe(false)
    expect(
      windowCoversNow(
        {
          bookingType: "HOURLY",
          checkInAt: "2026-09-01T08:00",
          checkOutAt: "2026-09-01T10:00",
        },
        now
      )
    ).toBe(false)
  })

  it("boshlanish payti aniq hozir — qamraydi", () => {
    expect(
      windowCoversNow(
        {
          bookingType: "HOURLY",
          checkInAt: "2026-09-01T12:00",
          checkOutAt: "2026-09-01T14:00",
        },
        now
      )
    ).toBe(true)
  })

  it("sanalar yo'q bo'lsa ogohlantirilmaydi", () => {
    expect(windowCoversNow({ bookingType: "DAILY" }, now)).toBe(false)
    expect(windowCoversNow({ bookingType: "HOURLY" }, now)).toBe(false)
  })

  it("buzuq sana ogohlantirish yasamaydi", () => {
    expect(
      windowCoversNow(
        { bookingType: "HOURLY", checkInAt: "x", checkOutAt: "y" },
        now
      )
    ).toBe(false)
  })
})

describe("roomBookingBlock", () => {
  const daily = (from: string, to: string) => ({
    bookingType: "DAILY" as const,
    checkInDate: from,
    checkOutDate: to,
  })

  it("bo'sh xonaga to'siq yo'q", () => {
    expect(
      roomBookingBlock(room("AVAILABLE"), daily("2026-09-01", "2026-09-02"), now)
    ).toBeNull()
  })

  it("ta'mirdagi xona kelgusi sanaga ham yopiq", () => {
    const msg = roomBookingBlock(
      room("MAINTENANCE"),
      daily("2026-12-01", "2026-12-02"),
      now
    )
    expect(msg).toContain("ta'mirda")
    expect(msg).toContain("hech qanday sanaga")
  })

  it("tozalanayotgan xona hozir uchun yopiq", () => {
    const msg = roomBookingBlock(
      room("CLEANING"),
      daily("2026-09-01", "2026-09-02"),
      now
    )
    expect(msg).toContain("tozalanmoqda")
  })

  it("tozalanayotgan xona kelgusi sanaga OCHIQ", () => {
    // Asosiy farq: tozalash tugaydi, ta'mir esa qachon tugashi noma'lum
    expect(
      roomBookingBlock(room("CLEANING"), daily("2026-09-05", "2026-09-06"), now)
    ).toBeNull()
  })

  it("davr berilmasa faqat butunlay yopiqlar belgilanadi", () => {
    // Ro'yxatlarda sanalar hali ma'lum emas
    expect(roomBookingBlock(room("CLEANING"), null, now)).toBeNull()
    expect(roomBookingBlock(room("MAINTENANCE"), null, now)).not.toBeNull()
  })

  it("xona raqami bo'lmasa ham xabar tushunarli", () => {
    const msg = roomBookingBlock({ current_status: "INSPECTION" }, null, now)
    expect(msg).toContain("Xona tekshiruvda")
  })
})
