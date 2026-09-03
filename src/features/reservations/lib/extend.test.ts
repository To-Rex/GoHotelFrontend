import { describe, expect, it } from "vitest"

import {
  canResize,
  extendCeiling,
  isExtendable,
  nextBusyStart,
  resizeFloor,
  resizeTarget,
} from "./extend"

const TURNOVER = 15
const DAY = 24 * 60
// Soatlik taxta bugungi kunda ertangi kunning 6 soatini ham chizadi
const WINDOW = 30 * 60
const STEP = 15

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

describe("yuqori chegara — cho'zish", () => {
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

describe("quyi chegara — qisqartirish", () => {
  it("boshlanishdan bir qadam", () => {
    expect(resizeFloor(10 * 60, STEP)).toBe(10 * 60 + STEP)
  })

  it("kunlik: bir kun", () => {
    // Nol kunlik bron bo'lmaydi (bazadagi cheklov)
    expect(resizeFloor(0, 1)).toBe(1)
  })
})

describe("surishdan yangi tugash nuqtasi", () => {
  const start = 10 * 60 // 10:00
  const end = 12 * 60 // 12:00
  const bounds = {
    min: resizeFloor(start, STEP), // 10:15
    max: 14 * 60 + 45, // 14:45
    step: STEP,
  }

  it("15 daqiqaga yaxlitlanadi", () => {
    expect(resizeTarget(end, 37, bounds)).toBe(end + 30)
    expect(resizeTarget(end, 38, bounds)).toBe(end + 45)
  })

  it("yuqori chegaradan oshmaydi", () => {
    expect(resizeTarget(end, 10 * 60, bounds)).toBe(bounds.max)
  })

  it("orqaga surish QISQARTIRADI", () => {
    expect(resizeTarget(end, -60, bounds)).toBe(11 * 60)
    expect(resizeTarget(end, -37, bounds)).toBe(end - 30)
  })

  it("quyi chegaradan pastga tushmaydi", () => {
    expect(resizeTarget(end, -10 * 60, bounds)).toBe(bounds.min)
  })

  it("boshlanishdan oldinga o'tolmaydi", () => {
    expect(resizeTarget(end, -5 * 60, bounds)).toBeGreaterThan(start)
  })

  it("siljish bo'lmasa o'zgarmaydi", () => {
    expect(resizeTarget(end, 0, bounds)).toBe(end)
  })

  it("chegaralar teskari bo'lsa o'zgarish bo'lmaydi", () => {
    // Keyingi bron juda yaqin: tanaffus bilan yuqori chegara quyisidan
    // ham pastga tushib qoladi
    expect(resizeTarget(end, 60, { min: 12 * 60, max: 11 * 60, step: STEP })).toBe(end)
  })

  it("kunlik: kun qadamida yaxlitlanadi", () => {
    // 3-kundan 6-kungacha bron; keyingi bron 9-kunda.
    // Nol nuqta — hozirgi chiqish sanasi, ya'ni siljish kunlarda.
    const dayBounds = { min: -2, max: 3, step: 1 }
    expect(resizeTarget(0, 2.4, dayBounds)).toBe(2)
    expect(resizeTarget(0, 2.6, dayBounds)).toBe(3)
    expect(resizeTarget(0, 5, dayBounds)).toBe(3)
    // Qisqartirish: eng qisqasi bir kunlik bron
    expect(resizeTarget(0, -1, dayBounds)).toBe(-1)
    expect(resizeTarget(0, -9, dayBounds)).toBe(-2)
  })

  it("yarim tundan oshib ketishi mumkin", () => {
    // 23:00 da tugagan bron ertangi 02:00 gacha
    expect(
      resizeTarget(23 * 60, 3 * 60, { min: 20 * 60, max: WINDOW, step: STEP })
    ).toBe(DAY + 2 * 60)
  })
})

describe("dastak ko'rsatiladimi", () => {
  const step = STEP

  it("cho'zishga joy bo'lsa — ha", () => {
    expect(canResize(12 * 60, { min: 12 * 60, max: 12 * 60 + step, step })).toBe(true)
  })

  it("faqat qisqartirishga joy bo'lsa ham — ha", () => {
    // Keyingi bron zich turibdi, lekin bronni qisqartirish mumkin
    expect(canResize(12 * 60, { min: 11 * 60, max: 12 * 60, step })).toBe(true)
  })

  it("ikkala tomonga ham joy bo'lmasa — yo'q", () => {
    // Eng qisqa bron va keyingi bron zich: qimirlatib bo'lmaydi
    expect(canResize(12 * 60, { min: 12 * 60, max: 12 * 60, step })).toBe(false)
  })

  it("bir qadamdan kam joy hisoblanmaydi", () => {
    expect(
      canResize(12 * 60, { min: 12 * 60 - 14, max: 12 * 60 + 14, step })
    ).toBe(false)
  })
})

describe("qaysi bron muddatini o'zgartirish mumkin", () => {
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
