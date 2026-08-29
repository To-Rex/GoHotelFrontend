import { describe, it, expect } from "vitest"
import { resolveBookingType } from "./bookingDefaults"
import { dailyBookingOn } from "@/features/reservations/lib/booking"

/* "Yangi bandlov" oynasining standart turi.

   Sozlama faqat oyna QAYSI TUR bilan ochilishini belgilaydi — xodim
   oynaning o'zida turni almashtira oladi. Shuning uchun bu yerdagi
   qoidalar hech qachon bron qilishni to'sib qo'ymasligi kerak. */

describe("resolveBookingType", () => {
  it("sozlama kelmagan bo'lsa ham oyna ochilaveradi", () => {
    // Yuklanayotgan paytda ham tur kerak — kunlik standart
    expect(resolveBookingType(undefined)).toBe("DAILY")
  })

  it("soatlik tanlangan bo'lsa soatlik", () => {
    expect(resolveBookingType({ default_type: "HOURLY" })).toBe("HOURLY")
  })

  it("kunlik tanlangan bo'lsa kunlik", () => {
    expect(resolveBookingType({ default_type: "DAILY" })).toBe("DAILY")
  })

  it("notanish qiymat kunlikka qaytadi", () => {
    expect(resolveBookingType({ default_type: "WEEKLY" as any })).toBe("DAILY")
  })
})

describe("xonalar sahifasidagi tur tanlovi", () => {
  const ROOM = "room-1"
  const today = "2026-09-05"

  // Sahifadagi qoida: soatlik afzal, lekin kunlik bron bugungi kunni
  // egallagan bo'lsa soatlik mumkin emas — kunlik rejaga o'tiladi
  const wantsHourly = (list: any[], settings: any, busyCount: number) =>
    (resolveBookingType(settings) === "HOURLY" || busyCount > 0) &&
    !dailyBookingOn(list, ROOM, today)

  const daily = (from: string, to: string, extra: any = {}) => ({
    room_id: ROOM,
    status: "CONFIRMED",
    booking_type: "DAILY",
    check_in_date: from,
    check_out_date: to,
    ...extra,
  })

  it("sozlama soatlik bo'lsa bo'sh xonada ham soatlik ochiladi", () => {
    expect(wantsHourly([], { default_type: "HOURLY" }, 0)).toBe(true)
  })

  it("sozlama kunlik bo'lsa bo'sh xonada kunlik ochiladi", () => {
    expect(wantsHourly([], { default_type: "DAILY" }, 0)).toBe(false)
  })

  it("xona bugun soatlik ishlayotgan bo'lsa sozlamadan qat'i nazar soatlik", () => {
    expect(wantsHourly([], { default_type: "DAILY" }, 2)).toBe(true)
  })

  it("kunlik mehmon turgan xonada soatlik ochilmaydi", () => {
    // Sozlama soatlik bo'lsa ham: bugun kunlik bron bilan band
    const list = [daily("2026-09-04", "2026-09-08")]
    expect(wantsHourly(list, { default_type: "HOURLY" }, 0)).toBe(false)
  })

  it("mehmon chiqadigan kuni soatlik yana mumkin", () => {
    // Chiqish kuni band emas — o'sha kuni yangi mehmon kiradi
    const list = [daily("2026-09-01", today)]
    expect(wantsHourly(list, { default_type: "HOURLY" }, 0)).toBe(true)
  })
})
