import { describe, it, expect } from "vitest"
import type { RoomReservation } from "../api/rooms"
import {
  checkInDateLabel,
  checkOutDateLabel,
  debtOf,
  formatDate,
  formatDateTime,
  hourCount,
  nightCount,
  occupantsOf,
  overpaidOf,
  stayLabel,
  timeOf,
} from "./reservationDetail"

/* Tafsilot oynasidagi hisob va formatlash.

   Nozik joylar: soatlik va kunlik bron muddatni boshqacha saqlaydi, eski
   yozuvlarda sana bo'sh yoki buzuq bo'lishi mumkin, qarz esa manfiy
   chiqmasligi kerak. */

const res = (p: Partial<RoomReservation>): RoomReservation =>
  ({
    id: "r1",
    reservation_number: "RES-1",
    guest_id: "g1",
    room_id: "room1",
    booking_type: p.booking_type || "DAILY",
    check_in_date: p.check_in_date ?? "2026-09-01",
    check_out_date: p.check_out_date ?? "2026-09-03",
    adults: 1,
    children: 0,
    status: "CONFIRMED",
    total_amount: p.total_amount ?? 0,
    paid_amount: p.paid_amount ?? 0,
    payment_status: "UNPAID",
    discount_amount: 0,
    created_at: "2026-09-01T10:00:00Z",
    ...p,
  }) as RoomReservation

describe("formatDate", () => {
  it("sof sanani mintaqa siljishisiz o'qiydi", () => {
    // new Date("2026-09-01") UTC yarim tun — sharqiy mintaqada kun surilib
    // ketishi mumkin edi, shuning uchun bunday qiymat qo'lda ajratiladi
    expect(formatDate("2026-09-01")).toBe("01.09.2026")
    expect(formatDate("2026-12-31")).toBe("31.12.2026")
  })

  it("bo'sh va buzuq qiymatda null", () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate("")).toBeNull()
    expect(formatDate("not-a-date")).toBeNull()
  })
})

describe("formatDateTime", () => {
  it("sana va vaqtni birga beradi", () => {
    const local = new Date(2026, 8, 2, 14, 30).toISOString()
    expect(formatDateTime(local)).toBe("02.09.2026, 14:30")
  })

  it("buzuq qiymatda null — 'Invalid Date' chiqmasin", () => {
    expect(formatDateTime("xyz")).toBeNull()
    expect(formatDateTime(undefined)).toBeNull()
  })
})

describe("timeOf", () => {
  /* Server bron vaqtini foydalanuvchi kiritgan DEVOR SOATI sifatida
     qaytaradi. `new Date()` orqali o'qilsa u mahalliy mintaqaga qayta
     hisoblanib, soat siljib ketardi — 19:17 dagi bron 00:17 bo'lib
     ko'rinardi va sana ham ertangi kunga o'tardi. Aynan shu xato
     ishlab chiqarishda chiqdi. */

  it("soat qiymatdan o'zgarishsiz olinadi", () => {
    expect(timeOf("2026-09-02T09:05:00")).toBe("09:05")
    expect(timeOf("2026-09-02T19:17:00")).toBe("19:17")
  })

  it("mintaqa qo'shimchasi bo'lsa ham siljimaydi", () => {
    expect(timeOf("2026-09-02T19:17:00Z")).toBe("19:17")
    expect(timeOf("2026-09-02T19:17:00+00:00")).toBe("19:17")
  })

  it("bo'sh joyli ajratgich ham qabul qilinadi", () => {
    expect(timeOf("2026-09-02 19:17:00")).toBe("19:17")
  })

  it("yo'q yoki buzuq qiymatda null", () => {
    expect(timeOf(null)).toBeNull()
    expect(timeOf("xyz")).toBeNull()
  })
})

describe("nightCount / hourCount", () => {
  it("kunlik bronda kechalar sanaladi", () => {
    expect(nightCount(res({ check_in_date: "2026-09-01", check_out_date: "2026-09-03" }))).toBe(2)
  })

  it("soatlik bronda kecha yo'q", () => {
    expect(nightCount(res({ booking_type: "HOURLY" }))).toBe(0)
  })

  it("soatlik bronda davomiylik soatlarda", () => {
    /* Davomiylik ikki payt AYIRMASI, ya'ni ikkalasi bir xil siljigan
       bo'lsa ham natija to'g'ri qoladi — bu yerda `new Date()` xavfsiz. */
    const r = res({
      booking_type: "HOURLY",
      check_in_datetime: "2026-09-01T10:00:00Z",
      check_out_datetime: "2026-09-01T13:30:00Z",
    })
    expect(hourCount(r)).toBe(3.5)
  })

  it("kunlik bronda soat hisoblanmaydi", () => {
    expect(hourCount(res({}))).toBe(0)
  })

  it("vaqti yo'q soatlik bron 0 beradi, xato emas", () => {
    expect(hourCount(res({ booking_type: "HOURLY" }))).toBe(0)
  })

  it("teskari sanalarda manfiy chiqmaydi", () => {
    expect(
      nightCount(res({ check_in_date: "2026-09-05", check_out_date: "2026-09-01" }))
    ).toBe(0)
  })
})

describe("stayLabel", () => {
  it("kunlik: sanadan sanaga", () => {
    expect(stayLabel(res({}))).toBe("01.09.2026 → 03.09.2026")
  })

  it("soatlik: sana va aniq oralig'i", () => {
    expect(
      stayLabel(
        res({
          booking_type: "HOURLY",
          check_in_date: "2026-09-01",
          check_in_datetime: "2026-09-01T10:00:00",
          check_out_datetime: "2026-09-01T13:00:00",
        })
      )
    ).toBe("01.09.2026, 10:00 – 13:00")
  })

  it("kechqurungi bron ertangi kunga surilmaydi", () => {
    // 19:17 dagi bron mintaqa tufayli 00:17 bo'lib ko'rinardi
    expect(
      stayLabel(
        res({
          booking_type: "HOURLY",
          check_in_date: "2026-09-02",
          check_out_date: "2026-09-03",
          check_in_datetime: "2026-09-02T19:17:00Z",
          check_out_datetime: "2026-09-02T21:17:00Z",
        })
      )
    ).toBe("02.09.2026, 19:17 – 21:17")
  })

  it("soatlik bronda vaqt yo'q bo'lsa sana qoladi", () => {
    expect(stayLabel(res({ booking_type: "HOURLY" }))).toBe("01.09.2026")
  })

  it("tunni kesib o'tgan soatlik bronda ikkala kun ham ko'rinadi", () => {
    const r = res({
      booking_type: "HOURLY",
      check_in_date: "2026-09-02",
      check_out_date: "2026-09-03",
      check_in_datetime: "2026-09-02T22:00:00",
      check_out_datetime: "2026-09-03T02:00:00",
    })
    expect(stayLabel(r)).toBe("02.09.2026, 22:00 – 03.09.2026, 02:00")
  })

  it("buzuq sanada yozuv yo'qolmaydi — xom qiymat chiqadi", () => {
    expect(stayLabel(res({ check_in_date: "xx", check_out_date: "yy" }))).toBe(
      "xx → yy"
    )
  })
})

describe("checkInDateLabel / checkOutDateLabel", () => {
  /* Soatlik bronda `check_out_date` HAQIQIY sana emas: bazada
     check_out_date > check_in_date cheklovi bor, shuning uchun bir kunlik
     soatlik bron uchun server u yerga ertangi kunni yozib qo'yadi.
     Aynan shu sabab "19:56–21:56" bronida chiqish sanasi ertaga bo'lib
     ko'rinardi. */

  it("kunlik bronda sana maydonlaridan olinadi", () => {
    const r = res({ check_in_date: "2026-09-01", check_out_date: "2026-09-03" })
    expect(checkInDateLabel(r)).toBe("01.09.2026")
    expect(checkOutDateLabel(r)).toBe("03.09.2026")
  })

  it("soatlik bronda ertangi kun EMAS, haqiqiy chiqish sanasi", () => {
    const r = res({
      booking_type: "HOURLY",
      check_in_date: "2026-09-02",
      // Server cheklov tufayli ertangi kunni yozib qo'ygan
      check_out_date: "2026-09-03",
      check_in_datetime: "2026-09-02T19:56:00",
      check_out_datetime: "2026-09-02T21:56:00",
    })
    expect(checkInDateLabel(r)).toBe("02.09.2026")
    expect(checkOutDateLabel(r)).toBe("02.09.2026")
  })

  it("tunni kesib o'tgan soatlik bronda chiqish ertangi kun", () => {
    const r = res({
      booking_type: "HOURLY",
      check_in_date: "2026-09-02",
      check_out_date: "2026-09-03",
      check_in_datetime: "2026-09-02T22:00:00",
      check_out_datetime: "2026-09-03T02:00:00",
    })
    expect(checkOutDateLabel(r)).toBe("03.09.2026")
  })

  it("vaqti yo'q soatlik bronda sana maydoniga tushiladi", () => {
    const r = res({ booking_type: "HOURLY", check_out_date: "2026-09-03" })
    expect(checkOutDateLabel(r)).toBe("03.09.2026")
  })
})

describe("debtOf / overpaidOf", () => {
  it("qarz hisoblanadi", () => {
    expect(debtOf(res({ total_amount: 500000, paid_amount: 200000 }))).toBe(300000)
  })

  it("ortiqcha to'langanda qarz manfiy emas, nol", () => {
    expect(debtOf(res({ total_amount: 500000, paid_amount: 600000 }))).toBe(0)
    expect(overpaidOf(res({ total_amount: 500000, paid_amount: 600000 }))).toBe(100000)
  })

  it("to'liq to'langanda ikkalasi ham nol", () => {
    const r = res({ total_amount: 500000, paid_amount: 500000 })
    expect(debtOf(r)).toBe(0)
    expect(overpaidOf(r)).toBe(0)
  })
})

describe("occupantsOf", () => {
  it("server yuborgan kartochkalarni o'zgartirmasdan qaytaradi", () => {
    const r = res({
      guest_name: "Dilshodjon Haydarov",
      occupants: [
        {
          guest_id: "g1",
          name: "Dilshodjon Haydarov",
          is_primary: true,
          passport_number: "AA1234567",
          nationality: "O'zbekiston",
        },
        { guest_id: "g2", name: "Aziz Karimov", is_primary: false },
      ],
    })
    const list = occupantsOf(r)
    expect(list).toHaveLength(2)
    expect(list[0].passport_number).toBe("AA1234567")
    expect(list[1].is_primary).toBe(false)
  })

  /* Quyidagilar zaxira yo'l uchun: server `occupants` ni yubormasa (eski
     javob yoki keshdagi eski yozuv) oyna bo'sh qolmasligi kerak. */

  it("occupants kelmasa bron yozuvidan yig'iladi", () => {
    const r = res({
      guest_id: "g1",
      guest_name: "Dilshodjon Haydarov",
      guest_phone: "+998901234567",
      companions: [
        { guest_id: "g2", name: "Aziz Karimov" },
        { guest_id: "g3", name: "Nodira Yusupova" },
      ],
    })
    expect(occupantsOf(r).map((p) => p.name)).toEqual([
      "Dilshodjon Haydarov",
      "Aziz Karimov",
      "Nodira Yusupova",
    ])
    expect(occupantsOf(r)[0].is_primary).toBe(true)
    expect(occupantsOf(r)[0].phone).toBe("+998901234567")
  })

  it("bo'sh occupants ro'yxati ham zaxira yo'lga o'tadi", () => {
    const r = res({ guest_name: "Kimdir", occupants: [] })
    expect(occupantsOf(r).map((p) => p.name)).toEqual(["Kimdir"])
  })

  it("ismsiz hamroh ro'yxatga tushmaydi", () => {
    const r = res({
      guest_name: "Dilshodjon Haydarov",
      companions: [{ guest_id: "g2", name: null }, { guest_id: "g3", name: "  " }],
    })
    expect(occupantsOf(r).map((p) => p.name)).toEqual(["Dilshodjon Haydarov"])
  })

  it("mehmoni ko'rsatilmagan bron bo'sh ro'yxat beradi", () => {
    expect(occupantsOf(res({}))).toEqual([])
  })
})
