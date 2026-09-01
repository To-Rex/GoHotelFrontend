import { describe, it, expect } from "vitest"
import type { RoomReservation } from "../api/rooms"
import { reservationStartMs } from "./roomReservations"

/* Bandlovning vaqt o'lchovi.

   Xato aynan bir kundagi soatlik bronlarda edi: sanasi bir xil bo'lgani
   uchun ular kiritilish tartibida chiqardi. Tartiblashning o'zi endi
   `reservationFilters` da va o'sha yerda sinaladi. */

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
