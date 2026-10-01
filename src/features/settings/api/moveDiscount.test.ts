import { describe, expect, it } from "vitest"

import {
  carryOverMoveDiscount,
  clampMoveDiscount,
  discountBaseline,
  maxMoveDiscount,
  netIncrease,
  moveDiscountProblem,
  resolveMoveDiscountSettings,
  type MoveDiscountSettings,
} from "./moveDiscount"
import { moveRoomBody } from "@/features/reservations/api/reservations"

/* Xona almashtirishda chegirma.

   Hisob server (move_discount_policy) bilan bir xil bo'lishi shart: "Eng
   ko'p" tugmasi bosilganda server rad etmasligi kerak. Standart — o'chiq. */

const on = (over: Partial<MoveDiscountSettings> = {}): MoveDiscountSettings => ({
  enabled: true,
  max_percent: 0,
  max_amount: 0,
  ...over,
})
const OFF = resolveMoveDiscountSettings(undefined)

describe("resolveMoveDiscountSettings", () => {
  it("standart — o'chiq, cheklovsiz", () => {
    expect(OFF).toEqual({ enabled: false, max_percent: 0, max_amount: 0 })
    expect(resolveMoveDiscountSettings(null)).toEqual(OFF)
    expect(resolveMoveDiscountSettings("ha")).toEqual(OFF)
  })

  it("faqat aniq true yoqadi", () => {
    expect(resolveMoveDiscountSettings({ enabled: "true" }).enabled).toBe(false)
    expect(resolveMoveDiscountSettings({ enabled: 1 }).enabled).toBe(false)
    expect(resolveMoveDiscountSettings({ enabled: true }).enabled).toBe(true)
  })

  it("buzuq chegaralar 0 ga, foiz 100 dan oshmaydi", () => {
    expect(resolveMoveDiscountSettings({ max_percent: -5, max_amount: "x" })).toEqual(OFF)
    expect(resolveMoveDiscountSettings({ max_percent: 500 }).max_percent).toBe(100)
  })
})

describe("maxMoveDiscount", () => {
  it("o'chiq bo'lsa xodimga 0, administratorga — butun farq", () => {
    expect(maxMoveDiscount(OFF, 100_000, false)).toBe(0)
    expect(maxMoveDiscount(undefined, 100_000, false)).toBe(0)
    expect(maxMoveDiscount(OFF, 100_000, true)).toBe(100_000)
  })

  it("arzonroq yoki teng xonada 0", () => {
    expect(maxMoveDiscount(on(), 0, true)).toBe(0)
    expect(maxMoveDiscount(on(), -50_000, true)).toBe(0)
  })

  it("foiz — narx farqidan, summa — alohida chegara", () => {
    expect(maxMoveDiscount(on({ max_percent: 50 }), 100_000, false)).toBe(50_000)
    expect(maxMoveDiscount(on({ max_amount: 30_000 }), 100_000, false)).toBe(30_000)
    expect(maxMoveDiscount(on({ max_percent: 50, max_amount: 30_000 }), 40_000, false)).toBe(20_000)
    expect(maxMoveDiscount(on(), 100_000, false)).toBe(100_000)
  })

  it("server kabi pastga yaxlitlanadi", () => {
    expect(maxMoveDiscount(on({ max_percent: 33 }), 100_001, false)).toBe(33_000)
  })
})

describe("moveDiscountProblem", () => {
  it("chegirma bo'lmasa — muammo yo'q", () => {
    expect(moveDiscountProblem(OFF, -10, false, 0)).toBeNull()
  })

  it("qoidadan tashqari holatlar", () => {
    expect(moveDiscountProblem(on(), 0, true, 1_000)).not.toBeNull()
    expect(moveDiscountProblem(OFF, 100_000, false, 1_000)).not.toBeNull()
    expect(moveDiscountProblem(on({ max_percent: 50 }), 100_000, false, 50_001)).not.toBeNull()
    expect(moveDiscountProblem(on(), 100_000, true, 100_001)).not.toBeNull()
  })

  it("chegara ichida", () => {
    expect(moveDiscountProblem(on({ max_percent: 50 }), 100_000, false, 50_000)).toBeNull()
    expect(moveDiscountProblem(OFF, 100_000, true, 100_000)).toBeNull()
  })
})

describe("carryOverMoveDiscount", () => {
  it("arzonroq xonaga qaytilsa avval chegirma kamayadi", () => {
    expect(carryOverMoveDiscount(30_000, 50_000)).toBe(30_000)
    expect(carryOverMoveDiscount(30_000, 0)).toBe(30_000)
    expect(carryOverMoveDiscount(30_000, -20_000)).toBe(10_000)
    expect(carryOverMoveDiscount(30_000, -50_000)).toBe(0)
  })
})

describe("moveRoomBody", () => {
  it("chegirmasiz so'rov avvalgidek", () => {
    expect(moveRoomBody("r1")).toEqual({ new_room_id: "r1" })
    expect(moveRoomBody("r1", 0)).toEqual({ new_room_id: "r1" })
  })

  it("chegirma bilan", () => {
    expect(moveRoomBody("r1", 25_000)).toEqual({ new_room_id: "r1", discount_amount: 25_000 })
  })
})

describe("netIncrease / clampMoveDiscount / discountBaseline (server bilan bir xil)", () => {
  it("bron chegirmasi foizda — farq ham kamayadi", () => {
    expect(netIncrease(100_000, 10)).toBe(90_000)
    expect(netIncrease(100_000, 0)).toBe(100_000)
    expect(netIncrease(100_000, null)).toBe(100_000)
  })

  it("chegirma boshlang'ich xona narxi farqidan oshmaydi", () => {
    expect(clampMoveDiscount(80_000, 300_000, 200_000)).toBe(80_000)
    expect(clampMoveDiscount(80_000, 150_000, 100_000)).toBe(50_000)
    expect(clampMoveDiscount(80_000, 100_000, 150_000)).toBe(0)
    expect(clampMoveDiscount(80_000, 300_000, null)).toBe(80_000)
    expect(clampMoveDiscount(100_000, 300_000, 200_000, 10)).toBe(90_000)
  })

  it("boshlang'ich narx — oxirgi yozuvdan", () => {
    expect(discountBaseline(null)).toBeNull()
    expect(discountBaseline([])).toBeNull()
    expect(discountBaseline([{ discount_baseline_price: 100_000 }, { discount_baseline_price: null }])).toBeNull()
    expect(discountBaseline([{ discount_baseline_price: 120_000 }])).toBe(120_000)
  })
})
