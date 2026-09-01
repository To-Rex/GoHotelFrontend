import { describe, it, expect } from "vitest"
import type { RoomReservation } from "../api/rooms"
import {
  EMPTY_FILTERS,
  applyFilters,
  hasActiveFilters,
  matchesFilters,
  matchesSearch,
  sortReservations,
  stayOverlaps,
  summarize,
  type ReservationFilters,
} from "./reservationFilters"

/* Filtr va tartib.

   Eng ko'p adashiladigan joy — sana oralig'i: u KESISHISH bo'yicha
   ishlashi kerak, boshlanish sanasi bo'yicha emas. Aks holda davrdan
   oldin kirgan mehmon ro'yxatdan tushib qolardi. */

const res = (p: Partial<RoomReservation>): RoomReservation =>
  ({
    id: p.id || "r1",
    reservation_number: p.reservation_number || "RES-1",
    guest_id: "g1",
    room_id: "room1",
    booking_type: p.booking_type || "DAILY",
    check_in_date: p.check_in_date ?? "2026-09-01",
    check_out_date: p.check_out_date ?? "2026-09-03",
    adults: 1,
    children: 0,
    status: p.status || "CONFIRMED",
    total_amount: p.total_amount ?? 0,
    paid_amount: p.paid_amount ?? 0,
    payment_status: p.payment_status || "UNPAID",
    discount_amount: 0,
    created_at: p.created_at || "2026-09-01T10:00:00Z",
    ...p,
  }) as RoomReservation

const filters = (p: Partial<ReservationFilters>): ReservationFilters => ({
  ...EMPTY_FILTERS,
  ...p,
})

describe("stayOverlaps", () => {
  // 25-avgustda kirib 5-sentabrda chiqqan mehmon
  const long = res({ check_in_date: "2026-08-25", check_out_date: "2026-09-05" })

  it("davrdan oldin boshlangan turish ham topiladi", () => {
    // Aynan shu holat boshlanish sanasi bo'yicha filtrda yo'qolardi
    expect(stayOverlaps(long, "2026-09-01", "2026-09-15")).toBe(true)
  })

  it("davrdan keyin boshlangan turish topilmaydi", () => {
    expect(stayOverlaps(long, "2026-09-10", "2026-09-15")).toBe(false)
  })

  it("davrdan oldin tugagan turish topilmaydi", () => {
    expect(stayOverlaps(long, "2026-09-06", "2026-09-15")).toBe(false)
  })

  it("chegarada turgan kunlar kiradi", () => {
    expect(stayOverlaps(long, "2026-09-05", "2026-09-15")).toBe(true)
    expect(stayOverlaps(long, "2026-08-01", "2026-08-25")).toBe(true)
  })

  it("bo'sh chegara — o'sha tomondan cheklov yo'q", () => {
    expect(stayOverlaps(long, "", "2026-08-01")).toBe(false)
    expect(stayOverlaps(long, "", "2026-09-01")).toBe(true)
    expect(stayOverlaps(long, "2026-12-01", "")).toBe(false)
    expect(stayOverlaps(long, "", "")).toBe(true)
  })

  it("soatlik bronda chiqish sanasi bir xil bo'lsa ham topiladi", () => {
    const hourly = res({
      booking_type: "HOURLY",
      check_in_date: "2026-09-02",
      check_out_date: "2026-09-02",
    })
    expect(stayOverlaps(hourly, "2026-09-02", "2026-09-02")).toBe(true)
    expect(stayOverlaps(hourly, "2026-09-03", "2026-09-04")).toBe(false)
  })
})

describe("matchesSearch", () => {
  const r = res({
    reservation_number: "RES-00313",
    guest_name: "Dilshodjon Haydarov",
    guest_phone: "+998901234567",
  })

  it("raqam, ism va telefon bo'yicha topadi", () => {
    expect(matchesSearch(r, "00313")).toBe(true)
    expect(matchesSearch(r, "haydarov")).toBe(true)
    expect(matchesSearch(r, "9012345")).toBe(true)
  })

  it("katta-kichik harf farq qilmaydi", () => {
    expect(matchesSearch(r, "DILSHODJON")).toBe(true)
  })

  it("bo'sh so'rov hammasini o'tkazadi", () => {
    expect(matchesSearch(r, "   ")).toBe(true)
  })

  it("topilmasa false", () => {
    expect(matchesSearch(r, "karimov")).toBe(false)
  })
})

describe("matchesFilters", () => {
  const r = res({
    status: "CHECKED_IN",
    payment_status: "PARTIALLY_PAID",
    booking_type: "HOURLY",
    guest_name: "Aziz Karimov",
  })

  it("bo'sh filtr hammasini o'tkazadi", () => {
    expect(matchesFilters(r, EMPTY_FILTERS)).toBe(true)
  })

  it("holat bo'yicha", () => {
    expect(matchesFilters(r, filters({ status: "CHECKED_IN" }))).toBe(true)
    expect(matchesFilters(r, filters({ status: "CANCELLED" }))).toBe(false)
  })

  it("to'lov holati bo'yicha", () => {
    expect(matchesFilters(r, filters({ paymentStatus: "PARTIALLY_PAID" }))).toBe(true)
    expect(matchesFilters(r, filters({ paymentStatus: "PAID" }))).toBe(false)
  })

  it("bron turi bo'yicha — katta-kichik harfdan qat'i nazar", () => {
    expect(matchesFilters(r, filters({ bookingType: "HOURLY" }))).toBe(true)
    expect(matchesFilters(r, filters({ bookingType: "DAILY" }))).toBe(false)
    const lower = res({ booking_type: "hourly" })
    expect(matchesFilters(lower, filters({ bookingType: "HOURLY" }))).toBe(true)
  })

  it("filtrlar birga ishlaydi — bittasi mos kelmasa tushib qoladi", () => {
    expect(
      matchesFilters(r, filters({ status: "CHECKED_IN", search: "karimov" }))
    ).toBe(true)
    expect(
      matchesFilters(r, filters({ status: "CHECKED_IN", search: "yo'q odam" }))
    ).toBe(false)
  })
})

describe("sortReservations", () => {
  const a = res({
    id: "a",
    check_in_date: "2026-09-01",
    total_amount: 300000,
    paid_amount: 300000,
    guest_name: "Aziz",
  })
  const b = res({
    id: "b",
    check_in_date: "2026-09-10",
    total_amount: 100000,
    paid_amount: 0,
    guest_name: "Zafar",
  })
  const c = res({
    id: "c",
    check_in_date: "2026-09-05",
    total_amount: 500000,
    paid_amount: 200000,
    guest_name: "Malika",
  })
  const list = [a, b, c]

  it("yangilaridan eskilariga", () => {
    expect(sortReservations(list, "newest").map((r) => r.id)).toEqual(["b", "c", "a"])
  })

  it("bir kundagi soatlik bronlarni aniq vaqti bo'yicha qo'yadi", () => {
    /* Sanasi bir xil bo'lgani uchun ular kiritilish tartibida chiqardi:
       09:00 dagi bron 22:00 dagisidan keyin turishi mumkin edi. Kiritilish
       tartibi ataylab teskari. */
    const evening = res({
      id: "evening",
      booking_type: "HOURLY",
      check_in_date: "2026-09-01",
      check_in_datetime: "2026-09-01T22:00:00Z",
      created_at: "2026-09-01T08:00:00Z",
    })
    const morning = res({
      id: "morning",
      booking_type: "HOURLY",
      check_in_date: "2026-09-01",
      check_in_datetime: "2026-09-01T09:00:00Z",
      created_at: "2026-09-01T20:00:00Z",
    })
    expect(sortReservations([morning, evening], "newest").map((r) => r.id)).toEqual([
      "evening",
      "morning",
    ])
  })

  it("boshlanish payti teng bo'lsa keyin kiritilgani yuqorida", () => {
    const first = res({ id: "first", created_at: "2026-09-01T08:00:00Z" })
    const second = res({ id: "second", created_at: "2026-09-01T09:00:00Z" })
    expect(sortReservations([first, second], "newest").map((r) => r.id)).toEqual([
      "second",
      "first",
    ])
  })

  it("eskilaridan yangilariga", () => {
    expect(sortReservations(list, "oldest").map((r) => r.id)).toEqual(["a", "c", "b"])
  })

  it("summa bo'yicha ikki yo'nalishda", () => {
    expect(sortReservations(list, "amount_desc").map((r) => r.id)).toEqual(["c", "a", "b"])
    expect(sortReservations(list, "amount_asc").map((r) => r.id)).toEqual(["b", "a", "c"])
  })

  it("qarzi ko'plari oldinda", () => {
    // a to'liq to'langan (qarzi 0), b 100000, c 300000
    expect(sortReservations(list, "debt").map((r) => r.id)).toEqual(["c", "b", "a"])
  })

  it("mehmon ismi bo'yicha", () => {
    expect(sortReservations(list, "guest").map((r) => r.id)).toEqual(["a", "c", "b"])
  })

  it("kirish massivi o'zgarmaydi", () => {
    const input = [a, b, c]
    sortReservations(input, "amount_desc")
    expect(input.map((r) => r.id)).toEqual(["a", "b", "c"])
  })

  it("teng qiymatlarda tartib barqaror — boshlanish payti hal qiladi", () => {
    const x = res({ id: "x", check_in_date: "2026-09-01", total_amount: 100 })
    const y = res({ id: "y", check_in_date: "2026-09-09", total_amount: 100 })
    expect(sortReservations([x, y], "amount_desc").map((r) => r.id)).toEqual(["y", "x"])
    expect(sortReservations([y, x], "amount_desc").map((r) => r.id)).toEqual(["y", "x"])
  })

  it("bo'sh ro'yxat", () => {
    expect(sortReservations([], "newest")).toEqual([])
  })
})

describe("applyFilters", () => {
  it("filtrlab, so'ng tartiblaydi", () => {
    const items = [
      res({ id: "eski", check_in_date: "2026-08-01", check_out_date: "2026-08-03" }),
      res({ id: "yangi", check_in_date: "2026-09-10", check_out_date: "2026-09-12" }),
      res({ id: "orta", check_in_date: "2026-09-02", check_out_date: "2026-09-04" }),
    ]
    const out = applyFilters(
      items,
      filters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" }),
      "oldest"
    )
    expect(out.map((r) => r.id)).toEqual(["orta", "yangi"])
  })
})

describe("hasActiveFilters", () => {
  it("bo'sh filtrda false", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it("faqat bo'shliqdan iborat qidiruv filtr hisoblanmaydi", () => {
    expect(hasActiveFilters(filters({ search: "   " }))).toBe(false)
  })

  it("har bir maydon alohida yoqadi", () => {
    for (const key of [
      "search",
      "status",
      "paymentStatus",
      "bookingType",
      "dateFrom",
      "dateTo",
    ] as const) {
      expect(hasActiveFilters(filters({ [key]: "x" }))).toBe(true)
    }
  })
})

describe("summarize", () => {
  it("bekor qilingan va kelmagan bronlar pul hisobiga kirmaydi", () => {
    const items = [
      res({ status: "CHECKED_OUT", total_amount: 500000, paid_amount: 500000 }),
      res({ status: "CHECKED_IN", total_amount: 300000, paid_amount: 100000 }),
      res({ status: "CANCELLED", total_amount: 900000, paid_amount: 900000 }),
      res({ status: "NO_SHOW", total_amount: 700000, paid_amount: 700000 }),
    ]
    const s = summarize(items)
    expect(s.total).toBe(4)
    expect(s.active).toBe(1)
    expect(s.income).toBe(600000)
    expect(s.debt).toBe(200000)
  })

  it("ortiqcha to'langan bron qarzni kamaytirmaydi", () => {
    const items = [
      res({ status: "CHECKED_OUT", total_amount: 100000, paid_amount: 400000 }),
      res({ status: "CHECKED_IN", total_amount: 500000, paid_amount: 0 }),
    ]
    expect(summarize(items).debt).toBe(500000)
  })

  it("bo'sh ro'yxat", () => {
    expect(summarize([])).toEqual({ total: 0, active: 0, income: 0, debt: 0 })
  })
})
