import { describe, expect, it } from "vitest"

import {
  canExtendTo,
  extendCeiling,
  extendTarget,
  isExtendable,
  nextBusyStart,
} from "./extend"

const TURNOVER = 15
const DAY = 24 * 60
// Soatlik taxta bugungi kunda ertangi kunning 6 soatini ham chizadi
const WINDOW = 30 * 60

describe("keyingi band oraliq", () => {
  const busy = [
    { start: 8 * 60, end: 10 * 60 },
    { start: 15 * 60, end: 17 * 60 },
    { start: 20 * 60, end: 22 * 60 },
  ]

  it("eng yaqinini topadi", () => {
    expect(nextBusyStart(busy, 12 * 60)).toBe(15 * 60)
  })

  it("o'tmishdagilarni hisobga olmaydi", () => {
    expect(nextBusyStart(busy, 18 * 60)).toBe(20 * 60)
  })

  it("aynan shu paytda boshlanadigan ham hisoblanadi", () => {
    expect(nextBusyStart(busy, 15 * 60)).toBe(15 * 60)
  })

  it("keyingisi yo'q bo'lsa cheksiz", () => {
    expect(nextBusyStart(busy, 23 * 60)).toBe(Infinity)
  })

  it("bo'sh ro'yxat", () => {
    expect(nextBusyStart([], 0)).toBe(Infinity)
  })
})

describe("cho'zish chegarasi", () => {
  it("soatlik: keyingi brondan tanaffus ayiriladi", () => {
    expect(
      extendCeiling(15 * 60, { turnover: TURNOVER, hourly: true, ceiling: WINDOW })
    ).toBe(15 * 60 - TURNOVER)
  })

  it("kunlik: tanaffus ayirilmaydi", () => {
    // Chiqish kuni keyingi mehmonning kirish kuni bo'la oladi
    expect(extendCeiling(5, { turnover: 1, hourly: false, ceiling: 40 })).toBe(5)
  })

  it("keyingi bron yo'q — oynaning oxirigacha", () => {
    expect(
      extendCeiling(Infinity, { turnover: TURNOVER, hourly: true, ceiling: WINDOW })
    ).toBe(WINDOW)
  })

  it("keyingi bron oynadan tashqarida bo'lsa ham oyna cheklaydi", () => {
    expect(
      extendCeiling(40 * 60, { turnover: TURNOVER, hourly: true, ceiling: WINDOW })
    ).toBe(WINDOW)
  })
})

describe("surishdan yangi tugash nuqtasi", () => {
  const end = 12 * 60 // 12:00
  const limit = 14 * 60 + 45 // 14:45

  it("15 daqiqaga yaxlitlanadi", () => {
    expect(extendTarget(end, 37, limit, 15)).toBe(end + 30)
    expect(extendTarget(end, 38, limit, 15)).toBe(end + 45)
  })

  it("chegaradan oshmaydi", () => {
    expect(extendTarget(end, 10 * 60, limit, 15)).toBe(limit)
  })

  it("orqaga surish qisqartirmaydi", () => {
    // Bu amal faqat cho'zadi — serverdagi qoida ham shunday
    expect(extendTarget(end, -120, limit, 15)).toBe(end)
  })

  it("siljish bo'lmasa o'zgarmaydi", () => {
    expect(extendTarget(end, 0, limit, 15)).toBe(end)
  })

  it("chegara tugashdan oldinda bo'lsa umuman cho'zilmaydi", () => {
    // Keyingi bron juda yaqin: tanaffus bilan chegara ortga tushib qoladi
    expect(extendTarget(end, 60, end - 15, 15)).toBe(end)
  })

  it("kunlik: kun qadamida yaxlitlanadi", () => {
    // 3-kundan 6-kungacha bron; keyingi bron 9-kunda
    expect(extendTarget(6, 2.4, 9, 1)).toBe(8)
    expect(extendTarget(6, 2.6, 9, 1)).toBe(9)
    expect(extendTarget(6, 5, 9, 1)).toBe(9)
  })

  it("yarim tundan oshib ketishi mumkin", () => {
    // 23:00 da tugagan bron ertangi 02:00 gacha
    expect(extendTarget(23 * 60, 3 * 60, WINDOW, 15)).toBe(DAY + 2 * 60)
  })
})

describe("dastak ko'rsatiladimi", () => {
  it("joy bo'lsa — ha", () => {
    expect(canExtendTo(12 * 60, 12 * 60 + 15, 15)).toBe(true)
  })

  it("bir qadamga ham joy bo'lmasa — yo'q", () => {
    expect(canExtendTo(12 * 60, 12 * 60 + 14, 15)).toBe(false)
    expect(canExtendTo(12 * 60, 12 * 60, 15)).toBe(false)
  })

  it("chegara ortda bo'lsa — yo'q", () => {
    expect(canExtendTo(12 * 60, 11 * 60, 15)).toBe(false)
  })
})

describe("qaysi bronni cho'zish mumkin", () => {
  it("faol bronlar", () => {
    expect(isExtendable("CONFIRMED")).toBe(true)
    expect(isExtendable("CHECKED_IN")).toBe(true)
    expect(isExtendable("PENDING")).toBe(true)
  })

  it("yakunlangan bronlar", () => {
    expect(isExtendable("CHECKED_OUT")).toBe(false)
    expect(isExtendable("CANCELLED")).toBe(false)
    expect(isExtendable("NO_SHOW")).toBe(false)
  })

  it("noma'lum holat to'sib qo'ymaydi", () => {
    expect(isExtendable(undefined)).toBe(true)
  })
})
