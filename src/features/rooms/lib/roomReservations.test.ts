import { describe, it, expect } from "vitest"
import type { RoomReservation } from "../api/rooms"
import { reservationStartMs, sortRoomReservations } from "./roomReservations"

/* Xona bandlovlari tartibi.

   Xato aynan bir kundagi soatlik bronlarda edi: sanasi bir xil bo'lgani
   uchun ular kiritilish tartibida chiqardi. Shuning uchun testlarning
   ko'pi shu holat haqida. */

const make = (p: Partial<RoomReservation>): RoomReservation =>
  ({
    id: p.id || "x",
    reservation_number: p.reservation_number || "R1",
    guest_id: "g",
    room_id: "r",
    booking_type: p.booking_type || "DAILY",
    check_in_date: p.check_in_date || "2026-09-01",
    check_out_date: p.check_out_date || "2026-09-02",
    check_in_datetime: p.check_in_datetime ?? null,
    check_out_datetime: null,
    adults: 1,
    children: 0,
    status: "CONFIRMED",
    total_amount: 0,
    paid_amount: 0,
    payment_status: "UNPAID",
    discount_amount: 0,
    created_at: p.created_at || "2026-09-01T00:00:00Z",
  }) as RoomReservation

describe("sortRoomReservations", () => {
  it("bir kundagi soatlik bronlarni vaqt bo'yicha qo'yadi", () => {
    // Kiritilish tartibi ataylab teskari: ertalabki bron keyin kiritilgan.
    const evening = make({
      id: "evening",
      booking_type: "HOURLY",
      check_in_datetime: "2026-09-01T22:00:00Z",
      created_at: "2026-09-01T08:00:00Z",
    })
    const morning = make({
      id: "morning",
      booking_type: "HOURLY",
      check_in_datetime: "2026-09-01T09:00:00Z",
      created_at: "2026-09-01T20:00:00Z",
    })

    expect(sortRoomReservations([morning, evening]).map((r) => r.id)).toEqual([
      "evening",
      "morning",
    ])
  })

  it("turli kunlarni yangisidan eskisiga", () => {
    const older = make({ id: "older", check_in_date: "2026-08-28" })
    const newer = make({ id: "newer", check_in_date: "2026-09-05" })

    expect(sortRoomReservations([older, newer]).map((r) => r.id)).toEqual([
      "newer",
      "older",
    ])
  })

  it("boshlanish payti teng bo'lsa keyin kiritilgani yuqorida", () => {
    const first = make({ id: "first", created_at: "2026-09-01T08:00:00Z" })
    const second = make({ id: "second", created_at: "2026-09-01T09:00:00Z" })

    expect(sortRoomReservations([first, second]).map((r) => r.id)).toEqual([
      "second",
      "first",
    ])
  })

  it("kirish massivini o'zgartirmaydi", () => {
    const a = make({ id: "a", check_in_date: "2026-08-01" })
    const b = make({ id: "b", check_in_date: "2026-09-01" })
    const input = [a, b]

    sortRoomReservations(input)

    expect(input.map((r) => r.id)).toEqual(["a", "b"])
  })

  it("bo'sh ro'yxat", () => {
    expect(sortRoomReservations([])).toEqual([])
  })
})

describe("reservationStartMs", () => {
  it("soatlik bronda aniq vaqt olinadi, sana emas", () => {
    const hourly = make({
      booking_type: "HOURLY",
      check_in_date: "2026-09-01",
      check_in_datetime: "2026-09-01T15:30:00Z",
    })
    expect(reservationStartMs(hourly)).toBe(Date.parse("2026-09-01T15:30:00Z"))
  })

  it("kunlik bronda sana ishlatiladi", () => {
    const daily = make({ check_in_date: "2026-09-01", check_in_datetime: null })
    expect(reservationStartMs(daily)).toBe(Date.parse("2026-09-01"))
  })

  it("buzuq sana yozuvni yo'qotmaydi — 0 qaytaradi", () => {
    const broken = make({ check_in_date: "not-a-date", check_in_datetime: null })
    expect(reservationStartMs(broken)).toBe(0)
  })
})
