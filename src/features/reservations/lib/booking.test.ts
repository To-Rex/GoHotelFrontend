import { describe, it, expect } from "vitest"
import {
  DEBT_BAR_CLASS,
  HOURLY_TURNOVER_MIN,
  busyIntervalsFor,
  companionSlots,
  dayIsBlocked,
  debtHint,
  debtLevelOf,
  findFreeSlot,
  firstFreeDate,
  minToTime,
  missingCompanions,
  nextBookingStart,
  reservationDebt,
  timeToMin,
} from "./booking"

/* Bron vaqti hisobi.

   Bu yerdagi qoidalar xonalar sahifasidagi "xona ustiga bosish" ham, bron
   sahifasi ham, "Yangi bandlov" dialogi ham suyanadigan yagona manba —
   shuning uchun ular buzilsa uch joyda birdan buziladi. */

const ROOM = "room-1"

const hourly = (date: string, from: string, to: string, extra: any = {}) => ({
  room_id: ROOM,
  status: "CONFIRMED",
  booking_type: "HOURLY",
  check_in_date: date,
  check_out_date: date,
  check_in_datetime: `${date}T${from}:00`,
  check_out_datetime: `${date}T${to}:00`,
  ...extra,
})

const daily = (from: string, to: string, extra: any = {}) => ({
  room_id: ROOM,
  status: "CONFIRMED",
  booking_type: "DAILY",
  check_in_date: from,
  check_out_date: to,
  ...extra,
})

describe("busyIntervalsFor", () => {
  it("bron tugagach tanaffus ham band hisoblanadi", () => {
    const busy = busyIntervalsFor([hourly("2026-09-01", "10:00", "11:00")], ROOM, "2026-09-01")
    // 11:00 + 15 daqiqa — keyingi mijoz 11:15 dan kiradi
    expect(busy).toEqual([[timeToMin("10:00"), timeToMin("11:00") + HOURLY_TURNOVER_MIN]])
  })

  it("bekor qilingan va chiqib bo'lingan bronlar to'siq emas", () => {
    const list = [
      hourly("2026-09-01", "10:00", "11:00", { status: "CANCELLED" }),
      hourly("2026-09-01", "12:00", "13:00", { status: "CHECKED_OUT" }),
      hourly("2026-09-01", "14:00", "15:00", { status: "NO_SHOW" }),
    ]
    expect(busyIntervalsFor(list, ROOM, "2026-09-01")).toEqual([])
  })

  it("boshqa xonaning broni hisobga olinmaydi", () => {
    const other = { ...hourly("2026-09-01", "10:00", "11:00"), room_id: "room-2" }
    expect(busyIntervalsFor([other], ROOM, "2026-09-01")).toEqual([])
  })

  it("tunab qoluvchi bron kun chegarasida kesiladi", () => {
    const overnight = {
      ...hourly("2026-09-01", "22:00", "02:00"),
      check_out_datetime: "2026-09-02T02:00:00",
      check_out_date: "2026-09-02",
    }
    expect(busyIntervalsFor([overnight], ROOM, "2026-09-01")).toEqual([[22 * 60, 24 * 60]])
    expect(busyIntervalsFor([overnight], ROOM, "2026-09-02")).toEqual([
      [0, 2 * 60 + HOURLY_TURNOVER_MIN],
    ])
  })
})

describe("findFreeSlot", () => {
  it("bo'sh kunda kunduzgi vaqt tanlanadi", () => {
    const slot = findFreeSlot([])
    expect(slot && minToTime(slot[0])).toBe("08:00")
  })

  it("keyingi mijozning vaqtiga kirib ketmaydi", () => {
    // 13:00 dan band: 10:00 dan 2 soatlik bron + tanaffus aynan sig'adi
    const busy = busyIntervalsFor([hourly("2026-09-01", "13:00", "14:00")], ROOM, "2026-09-01")
    const slot = findFreeSlot(busy, [10 * 60])
    expect(slot).toEqual([10 * 60, 12 * 60])
    // Keyingi bron boshlanishidan oldin tanaffus qoladi
    expect(slot![1] + HOURLY_TURNOVER_MIN).toBeLessThanOrEqual(13 * 60)
  })

  it("sig'masa oraliq keyingi bron TUGAGANIDAN keyin olinadi", () => {
    // 12:00-14:00 band; 10:00 dan 2 soat + tanaffus sig'maydi (120 < 135)
    const busy = busyIntervalsFor([hourly("2026-09-01", "12:00", "14:00")], ROOM, "2026-09-01")
    const slot = findFreeSlot(busy, [10 * 60])
    expect(slot).not.toBeNull()
    // Har qanday holatda: yo bandlikdan oldin (tanaffus bilan), yo keyin
    for (const [bs, be] of busy) {
      expect(slot![1] + HOURLY_TURNOVER_MIN <= bs || slot![0] >= be).toBe(true)
    }
  })

  it("hozirgi vaqtdan keyingi bo'sh oraliqni topadi", () => {
    // Xonalar sahifasi shu ko'rinishda chaqiradi: birinchi tanlov — hozir
    const busy = busyIntervalsFor([hourly("2026-09-01", "09:00", "13:00")], ROOM, "2026-09-01")
    const slot = findFreeSlot(busy, [10 * 60, 8 * 60, 0])
    expect(slot).not.toBeNull()
    // 09:00-13:15 band — birinchi bo'sh vaqt 13:15 dan
    expect(slot![0]).toBeGreaterThanOrEqual(13 * 60 + HOURLY_TURNOVER_MIN)
  })

  it("kun to'la band bo'lsa null qaytaradi", () => {
    const slot = findFreeSlot([[0, 24 * 60]])
    expect(slot).toBeNull()
  })
})

describe("nextBookingStart", () => {
  it("keyinroqqa bron qilgan mijozning kirish sanasi chegara bo'ladi", () => {
    const list = [daily("2026-09-10", "2026-09-12")]
    expect(nextBookingStart(list, ROOM, "2026-09-05")).toBe("2026-09-10")
  })

  it("eng yaqinini oladi", () => {
    const list = [daily("2026-09-20", "2026-09-22"), daily("2026-09-10", "2026-09-12")]
    expect(nextBookingStart(list, ROOM, "2026-09-05")).toBe("2026-09-10")
  })

  it("kirish kunidan oldingilar chegara emas", () => {
    const list = [daily("2026-09-01", "2026-09-03")]
    expect(nextBookingStart(list, ROOM, "2026-09-05")).toBeNull()
  })

  it("bekor qilingan bron chegara qo'ymaydi", () => {
    const list = [daily("2026-09-10", "2026-09-12", { status: "CANCELLED" })]
    expect(nextBookingStart(list, ROOM, "2026-09-05")).toBeNull()
  })

  it("keyingi soatlik bron ham chegara bo'ladi", () => {
    // Kunlik bron butun kunni egallaydi — o'sha kundagi soatlik bron ham to'siq
    const list = [hourly("2026-09-08", "10:00", "12:00")]
    expect(nextBookingStart(list, ROOM, "2026-09-05")).toBe("2026-09-08")
  })
})

describe("dayIsBlocked", () => {
  it("mehmon turgan kun band", () => {
    const list = [daily("2026-09-05", "2026-09-08")]
    expect(dayIsBlocked(list, ROOM, "2026-09-06")).toBe(true)
  })

  it("chiqish kuni bo'sh — o'sha kuni yangi mehmon kiradi", () => {
    const list = [daily("2026-09-05", "2026-09-08")]
    expect(dayIsBlocked(list, ROOM, "2026-09-08")).toBe(false)
  })

  it("o'sha kundagi soatlik bron kunlik bronni to'sadi", () => {
    const list = [hourly("2026-09-06", "10:00", "12:00")]
    expect(dayIsBlocked(list, ROOM, "2026-09-06")).toBe(true)
  })

  it("bo'sh kun band emas", () => {
    expect(dayIsBlocked([daily("2026-09-05", "2026-09-08")], ROOM, "2026-09-01")).toBe(false)
  })
})

describe("firstFreeDate", () => {
  it("band xona mehmon chiqadigan kuni bo'shaydi", () => {
    const list = [daily("2026-09-05", "2026-09-08")]
    expect(firstFreeDate(list, ROOM, "2026-09-05")).toBe("2026-09-08")
  })

  it("zanjir bo'lsa oxirigacha suriladi", () => {
    // Bir mehmon 8-kuni chiqadi, o'sha kuni ikkinchisi kiradi
    const list = [daily("2026-09-05", "2026-09-08"), daily("2026-09-08", "2026-09-11")]
    expect(firstFreeDate(list, ROOM, "2026-09-05")).toBe("2026-09-11")
  })

  it("bo'sh xona uchun o'sha kunning o'zi", () => {
    expect(firstFreeDate([], ROOM, "2026-09-05")).toBe("2026-09-05")
  })

  it("chiqib bo'lingan bron xonani bandlab turmaydi", () => {
    const list = [daily("2026-09-05", "2026-09-08", { status: "CHECKED_OUT" })]
    expect(firstFreeDate(list, ROOM, "2026-09-05")).toBe("2026-09-05")
  })
})

describe("xonalar sahifasidagi bron so'rovi", () => {
  // Sahifa aynan shu ketma-ketlikda hisoblaydi: bo'shash kuni -> chegara
  const plan = (list: any[], today: string) => {
    const start = dayIsBlocked(list, ROOM, today) ? firstFreeDate(list, ROOM, today) : today
    const limit = nextBookingStart(list, ROOM, start)
    const wanted = `${start.slice(0, 8)}${String(Number(start.slice(8)) + 1).padStart(2, "0")}`
    return { start, checkOut: limit && wanted > limit ? limit : wanted }
  }

  it("bo'sh xona bugundan bron qilinadi", () => {
    expect(plan([], "2026-09-05")).toEqual({ start: "2026-09-05", checkOut: "2026-09-06" })
  })

  it("band xona bo'shagan kunidan bron qilinadi", () => {
    const list = [daily("2026-09-05", "2026-09-08")]
    expect(plan(list, "2026-09-05").start).toBe("2026-09-08")
  })

  it("chiqish sanasi keyingi mijozning kuniga o'tib ketmaydi", () => {
    // 8-kuni bo'shaydi, lekin 9-kuni boshqa mijoz kiradi
    const list = [daily("2026-09-05", "2026-09-08"), daily("2026-09-09", "2026-09-12")]
    const { start, checkOut } = plan(list, "2026-09-05")
    expect(start).toBe("2026-09-08")
    expect(checkOut).toBe("2026-09-09")
  })
})

describe("hamrohlar hisobi", () => {
  it("bitta mehmon uchun hamroh kerak emas", () => {
    expect(companionSlots(1)).toBe(0)
    expect(missingCompanions(1, 0)).toBe(0)
  })

  it("3 kishi bo'lsa yana 2 ta mehmon kerak", () => {
    expect(companionSlots(3)).toBe(2)
    expect(missingCompanions(3, 0)).toBe(2)
    expect(missingCompanions(3, 1)).toBe(1)
    expect(missingCompanions(3, 2)).toBe(0)
  })

  it("mehmonlar soni kamaytirilsa ortiqcha tanlov hisobga olinmaydi", () => {
    // 3 kishi tanlangan edi, keyin 2 ga tushirildi — kamomad chiqmaydi
    expect(missingCompanions(2, 3)).toBe(0)
  })

  it("noto'g'ri qiymatlar hisobni buzmaydi", () => {
    expect(companionSlots(0)).toBe(0)
    expect(companionSlots(NaN)).toBe(0)
    expect(missingCompanions(NaN, 0)).toBe(0)
    expect(missingCompanions(3, -1)).toBe(2)
  })
})

describe("qarz ko'rsatkichi", () => {
  const res = (extra: any = {}) => ({
    status: "CONFIRMED",
    total_amount: 500000,
    paid_amount: 500000,
    ...extra,
  })

  it("to'liq to'langan bronda qarz yo'q", () => {
    expect(reservationDebt(res())).toBe(0)
    expect(debtLevelOf(res())).toBe("none")
    expect(DEBT_BAR_CLASS[debtLevelOf(res())]).toBe("")
  })

  it("qisman to'langan bron qarzli", () => {
    const r = res({ paid_amount: 200000 })
    expect(reservationDebt(r)).toBe(300000)
    expect(debtLevelOf(r)).toBe("partial")
  })

  it("mehmon chiqib ketgan va to'lamagan — eng jiddiy holat", () => {
    const r = res({ status: "CHECKED_OUT", paid_amount: 0 })
    expect(debtLevelOf(r)).toBe("overdue")
    // Butunlay qizil: holat rangi almashtiriladi
    expect(DEBT_BAR_CLASS.overdue).toContain("bg-red-600")
  })

  it("chiqib ketgan, lekin to'lagan bron qizarmaydi", () => {
    expect(debtLevelOf(res({ status: "CHECKED_OUT" }))).toBe("none")
  })

  it("bekor qilingan bronda qarz hisoblanmaydi", () => {
    // Hisob-faktura ham bekor qilinadi — bu pul talab qilinmaydi
    const r = res({ status: "CANCELLED", paid_amount: 0 })
    expect(reservationDebt(r)).toBe(0)
    expect(debtLevelOf(r)).toBe("none")
  })

  it("ortiqcha to'langan bron qarzli hisoblanmaydi", () => {
    expect(reservationDebt(res({ paid_amount: 900000 }))).toBe(0)
  })

  it("qarzli bron holat rangini saqlaydi, ustiga qizil halqa oladi", () => {
    // Kirgan mehmon yashil bo'lib qoladi — bron turi ham ko'rinishi kerak
    expect(DEBT_BAR_CLASS.partial).toContain("ring-red-500")
    expect(DEBT_BAR_CLASS.partial).not.toContain("bg-")
  })

  it("izoh summani aytadi", () => {
    expect(debtHint(res({ paid_amount: 200000 }))).toContain("Qarz")
    expect(debtHint(res({ status: "CHECKED_OUT", paid_amount: 0 }))).toContain(
      "Chiqib ketgan"
    )
    expect(debtHint(res())).toBe("")
  })
})
