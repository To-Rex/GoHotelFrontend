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

  const daily = (from: string, to: string, extra: any = {}) => ({
    room_id: ROOM,
    status: "CONFIRMED",
    booking_type: "DAILY",
    check_in_date: from,
    check_out_date: to,
    ...extra,
  })

  /* Sahifadagi qoida: turni odatda DIALOG hal qiladi (sozlama bo'yicha).
     Sahifa faqat bitta holatda turni o'zi majburlaydi — xona bugun
     allaqachon soatlik ishlayotgan bo'lsa.

     Nega shunday: sozlama javobi xona bosilgan ONDA hali kelmagan bo'lishi
     mumkin. Ilgari tur shu yerda hisoblanardi va o'sha paytda sozlama
     bo'lmasa "kunlik" bo'lib qotib qolardi — sozlamada soatlik turgan
     bo'lsa ham. */
  const forcedType = (list: any[], busyTodayCount: number) =>
    busyTodayCount > 0 && !dailyBookingOn(list, ROOM, today) ? "HOURLY" : undefined

  it("bo'sh xonada turni dialog hal qiladi", () => {
    // undefined — ya'ni sahifa majburlamaydi, sozlama qo'llanadi
    expect(forcedType([], 0)).toBeUndefined()
  })

  it("bugun soatlik ishlayotgan xonada soatlik majburlanadi", () => {
    expect(forcedType([], 2)).toBe("HOURLY")
  })

  it("kunlik mehmon turgan xonada soatlik majburlanmaydi", () => {
    const list = [daily("2026-09-04", "2026-09-08")]
    expect(forcedType(list, 2)).toBeUndefined()
  })

  it("mehmon chiqadigan kuni soatlik yana majburlanadi", () => {
    // Chiqish kuni band emas — o'sha kuni yangi mehmon kiradi
    const list = [daily("2026-09-01", today)]
    expect(forcedType(list, 1)).toBe("HOURLY")
  })

  it("sozlama kelmaguncha kunlik ko'rinadi, kelgach soatlikka o'tadi", () => {
    // Dialog aynan shu qiymatlarga tayanadi: yuklanayotganda kunlik,
    // javob kelgach sozlamadagi tur
    expect(resolveBookingType(undefined)).toBe("DAILY")
    expect(resolveBookingType({ default_type: "HOURLY" })).toBe("HOURLY")
  })
})
