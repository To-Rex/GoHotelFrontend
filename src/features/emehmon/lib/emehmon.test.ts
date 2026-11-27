import { describe, expect, it } from "vitest"

import {
  applyLookup,
  arrivalProblem,
  canLookup,
  citizenFromCode,
  elapsedParts,
  formProblems,
  formatMoment,
  fromLocalInput,
  isLocal,
  money,
  sortCountries,
  stateLabel,
  stateTone,
  toLocalInput,
  withCitizen,
  type EmehmonForm,
} from "./emehmon"
import { checkedInReservationId, promptResolved, touchesStay, useEmehmonUi } from "./store"

/* E-mehmon shakli: vaqt Toshkent vaqtida, «Bazadan tekshirish» natijasi,
   yuborishdan oldingi tekshiruv va kirishni kuzatish. */

const NOW = Date.parse("2026-05-22T12:00:00Z") // Toshkentda 17:00

const form = (over: Partial<EmehmonForm> = {}): EmehmonForm => ({
  surname: "NASIROV",
  firstname: "AXROR",
  lastname: "",
  citizen_id: 173,
  passport_number: "AB1234567",
  passport_type_id: 1,
  passport_date: "2018-07-18",
  passport_issued_by: "",
  birth_date: "1987-08-16",
  sex: "M",
  pinfl: "",
  person_id: "",
  visit_type_id: 2,
  guest_type_id: 1,
  arrival: "2026-05-22T16:00:00+05:00",
  days: 3,
  room: "101",
  amount: null,
  paid: false,
  birth_country_id: null,
  from_country_id: null,
  visa_type_id: null,
  visa_number: "",
  visa_from: null,
  visa_to: null,
  visa_issued_by: "",
  kpp_number: "",
  kpp_date: null,
  children: [],
  ...over,
})

describe("kirish vaqti — doim Toshkent vaqti", () => {
  it("ISO → datetime-local: brauzer zonasidan qat'i nazar +05:00", () => {
    expect(toLocalInput("2026-05-22T14:30:00+05:00")).toBe("2026-05-22T14:30")
    expect(toLocalInput("2026-05-22T09:30:00Z")).toBe("2026-05-22T14:30")
    // Yarim tunda sana ham to'g'ri o'tadi
    expect(toLocalInput("2026-05-22T20:15:00Z")).toBe("2026-05-23T01:15")
    expect(toLocalInput(null)).toBe("")
    expect(toLocalInput("kecha")).toBe("")
  })

  it("datetime-local → ISO: soat o'zgarmaydi, +05:00 qo'shiladi", () => {
    expect(fromLocalInput("2026-05-22T14:30")).toBe("2026-05-22T14:30:00+05:00")
    expect(fromLocalInput("")).toBeNull()
    expect(fromLocalInput("2026-05-22")).toBeNull()
    // Ikki tomonga o'tkazish qiymatni buzmaydi
    expect(toLocalInput(fromLocalInput("2026-12-31T23:59"))).toBe("2026-12-31T23:59")
  })

  it("ko'rsatish: kun.oy.yil soat:daqiqa", () => {
    expect(formatMoment("2026-05-22T09:30:00Z")).toBe("22.05.2026 14:30")
    expect(formatMoment(undefined)).toBe("")
  })

  it("faqat oxirgi 12 soat, kelajak emas", () => {
    expect(arrivalProblem("2026-05-22T16:00:00+05:00", NOW)).toBeNull()
    expect(arrivalProblem("2026-05-22T05:01:00+05:00", NOW)).toBeNull()
    expect(arrivalProblem("2026-05-22T04:59:00+05:00", NOW)).toContain("12 soat")
    expect(arrivalProblem("2026-05-22T17:05:00+05:00", NOW)).toContain("kelajak")
    // Soatlar orasidagi kichik farq xato emas
    expect(arrivalProblem("2026-05-22T17:00:30+05:00", NOW)).toBeNull()
    expect(arrivalProblem(null, NOW)).toContain("ko'rsatilmagan")
  })

  it("kirgandan beri o'tgan vaqt", () => {
    expect(elapsedParts("2026-05-22T13:40:00+05:00", NOW)).toEqual({ hours: 3, minutes: 20 })
    expect(elapsedParts("2026-05-22T18:00:00+05:00", NOW)).toEqual({ hours: 0, minutes: 0 })
    expect(elapsedParts(null, NOW)).toBeNull()
  })
})

describe("fuqarolik", () => {
  const countries = [
    { id: 76, name: "Germaniya", code: "DEU" },
    { id: 12, name: "Avstriya", code: "AUT" },
    { id: 173, name: "O'zbekiston", code: "UZB" },
  ]

  it("ISO kodi → ma'lumotnoma id'si", () => {
    expect(citizenFromCode("deu", countries)).toBe(76)
    expect(citizenFromCode("UZB", [])).toBe(173) // ma'lumotnomasiz ham
    expect(citizenFromCode("XXX", countries)).toBeNull()
    expect(citizenFromCode(null, countries)).toBeNull()
  })

  it("O'zbekiston ro'yxat boshida, qolganlari alifbo tartibida", () => {
    expect(sortCountries(countries).map((c) => c.code)).toEqual(["UZB", "AUT", "DEU"])
    expect(countries[0].code).toBe("DEU") // asl ro'yxat o'zgarmaydi
  })

  it("mahalliy: O'zbekiston va fuqaroligi yo'q shaxs", () => {
    expect(isLocal(173)).toBe(true)
    expect(isLocal(231)).toBe(true)
    expect(isLocal(76)).toBe(false)
    expect(isLocal(null)).toBe(false)
  })

  it("fuqarolik almashsa boshqasiga tegishli maydon tozalanadi", () => {
    const local = form({ pinfl: "31234567890123" })
    const foreign = withCitizen(local, 76)
    expect(foreign.citizen_id).toBe(76)
    expect(foreign.pinfl).toBe("")
    const back = withCitizen({ ...foreign, person_id: "555" }, 173)
    expect(back.person_id).toBe("")
    expect(withCitizen(local, 173)).toBe(local) // o'zgarmasa — o'sha obyekt
  })
})

describe("«Bazadan tekshirish»", () => {
  it("uchta kalit bo'lsagina ishlaydi", () => {
    expect(canLookup(form())).toBe(true)
    expect(canLookup(form({ passport_number: "  " }))).toBe(false)
    expect(canLookup(form({ birth_date: null }))).toBe(false)
    expect(canLookup(form({ citizen_id: null }))).toBe(false)
  })

  it("rasmiy ma'lumot ustun, bo'sh qiymat hech narsani o'chirmaydi", () => {
    const next = applyLookup(form({ surname: "NOSIROV", passport_issued_by: "eski" }), {
      surname: "NASIROV",
      lastname: "IBRAGIMOVICH",
      pinfl: "31234567890123",
      passport_issued_by: "",
      sex: null,
    } as Partial<EmehmonForm>)
    expect(next.surname).toBe("NASIROV")
    expect(next.lastname).toBe("IBRAGIMOVICH")
    expect(next.pinfl).toBe("31234567890123")
    expect(next.passport_issued_by).toBe("eski")
    expect(next.sex).toBe("M")
  })

  it("notanish maydon shaklga qo'shilmaydi", () => {
    const next = applyLookup(form(), { birth_place: "TOSHKENT" } as unknown as Partial<EmehmonForm>)
    expect("birth_place" in next).toBe(false)
  })
})

describe("yuborishdan oldingi tekshiruv", () => {
  it("to'liq shaklda muammo yo'q", () => {
    expect(formProblems(form(), NOW)).toEqual([])
  })

  it("bo'sh shakl — har majburiy maydon aytiladi", () => {
    const empty = form({
      surname: "",
      firstname: " ",
      citizen_id: null,
      passport_number: "",
      passport_date: null,
      birth_date: null,
      sex: null,
      visit_type_id: null,
      guest_type_id: null,
      arrival: null,
      days: null,
    })
    const problems = formProblems(empty, NOW)
    for (const word of ["Familiya", "Ism", "Fuqarolik", "Pasport seriya", "Tug'ilgan", "berilgan sana", "Jinsi", "Tashrif", "Mehmon turi", "muddati", "Kirish vaqti"]) {
      expect(problems.some((p) => p.includes(word))).toBe(true)
    }
  })

  it("chet ellik — Chegara xizmati identifikatorisiz yuborilmaydi", () => {
    const foreign = form({ citizen_id: 76 })
    expect(formProblems(foreign, NOW)).toHaveLength(1)
    expect(formProblems(foreign, NOW)[0]).toContain("Bazadan tekshirish")
    expect(formProblems({ ...foreign, person_id: "1234567890" }, NOW)).toEqual([])
  })

  it("pasport sanasi, PINFL va kirish vaqti", () => {
    expect(formProblems(form({ passport_date: "1987-08-16" }), NOW)[0]).toContain("tug'ilgan sanadan keyin")
    expect(formProblems(form({ pinfl: "123" }), NOW)[0]).toContain("14 ta raqam")
    expect(formProblems(form({ pinfl: "31234567890123" }), NOW)).toEqual([])
    expect(formProblems(form({ arrival: "2026-05-21T10:00:00+05:00" }), NOW)[0]).toContain("12 soat")
  })
})

describe("ko'rinish", () => {
  it("holat nomi va rangi", () => {
    expect(stateLabel("none")).toBe("Ro'yxatga olinmagan")
    expect(stateLabel("checked_out")).toBe("Chiqarilgan")
    expect(stateTone("failed")).toContain("red")
    expect(stateTone("registered")).toContain("emerald")
  })

  it("so'm bo'shliq bilan", () => {
    expect(money(450000).replace(/\s/g, " ")).toBe("450 000")
    expect(money(null)).toBe("0")
  })
})

describe("kirishni kuzatish", () => {
  const id = "3f2b7c1e-8a4d-4c6a-9e51-6a9b2c4f7d31"

  it("faqat muvaffaqiyatli check-in so'rovi eslatma chiqaradi", () => {
    expect(checkedInReservationId("post", `/reservations/${id}/check-in`)).toBe(id)
    expect(checkedInReservationId("POST", `/reservations/${id}/check-in?hotel_id=1`)).toBe(id)
    expect(checkedInReservationId("get", `/reservations/${id}/check-in`)).toBeNull()
    expect(checkedInReservationId("post", `/reservations/${id}/check-out`)).toBeNull()
    expect(checkedInReservationId("post", `/reservations/${id}/check-inn`)).toBeNull()
    expect(checkedInReservationId("post", undefined)).toBeNull()
  })

  it("mehmonlar o'zgaradigan so'rovlardan keyin navbat yangilanadi", () => {
    expect(touchesStay("post", `/reservations/${id}/check-out`)).toBe(true)
    expect(touchesStay("post", `/reservations/${id}/companions`)).toBe(true)
    expect(touchesStay("get", "/reservations")).toBe(false)
    // O'z so'rovlarimiz o'zimizni qayta chaqirmaydi
    expect(touchesStay("post", `/emehmon/gate/reservations/${id}/register`)).toBe(false)
    expect(touchesStay("post", "/shop/sales")).toBe(false)
  })

  it("eslatma mehmon ro'yxatga olingach yopiladi — eski navbat bilan emas", () => {
    // Navbat eslatmadan OLDIN o'qilgan (hali yangi mehmon yo'q) — yopilmaydi
    expect(promptResolved(id, 1000, 900, [])).toBe(false)
    // Kirishdan keyin darhol o'qilgan navbat: server hali yozib ulgurmagan bo'lishi mumkin
    expect(promptResolved(id, 1000, 1900, [])).toBe(false)
    // Yangi navbatda shu bron bor — hali ro'yxatga olinmagan
    expect(promptResolved(id, 1000, 9000, [id, "boshqa"])).toBe(false)
    // Yangi navbatda shu bron yo'q — ro'yxatga olingan / «kerak emas»
    expect(promptResolved(id, 1000, 9000, ["boshqa"])).toBe(true)
    // Navbat hali yuklanmagan yoki eslatma yo'q
    expect(promptResolved(id, 1000, 9000, undefined)).toBe(false)
    expect(promptResolved(null, 0, 9000, [])).toBe(false)
  })

  it("oyna ochilganda eslatma yopiladi", () => {
    useEmehmonUi.getState().setPrompt(id)
    expect(useEmehmonUi.getState().prompt).toBe(id)
    useEmehmonUi.getState().openReservation(id, "guest-1")
    const state = useEmehmonUi.getState()
    expect(state.reservationId).toBe(id)
    expect(state.focusGuestId).toBe("guest-1")
    expect(state.prompt).toBeNull()
    state.closeReservation()
    expect(useEmehmonUi.getState().reservationId).toBeNull()
    expect(useEmehmonUi.getState().focusGuestId).toBeNull()
  })
})
