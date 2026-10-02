import { describe, expect, it } from "vitest"

import {
  PENALTY_KINDS,
  PENALTY_STATUSES,
  lateDurationLabel,
  penaltyKindLabel,
  resolvePenaltySettings,
} from "./penalties"

/* Bron jarimalari: server bilan bir xil qoidalar (reservation_penalty_service).
   Standart — kech chiqish taklifi o'chiq. */

describe("resolvePenaltySettings", () => {
  it("standart — o'chiq", () => {
    expect(resolvePenaltySettings(undefined)).toEqual({ late_hourly_amount: 0, grace_minutes: 0 })
    expect(resolvePenaltySettings("x")).toEqual({ late_hourly_amount: 0, grace_minutes: 0 })
  })

  it("buzuq qiymatlar chegaraga keltiriladi", () => {
    expect(
      resolvePenaltySettings({ late_hourly_amount: -5, grace_minutes: 9999 })
    ).toEqual({ late_hourly_amount: 0, grace_minutes: 600 })
    expect(
      resolvePenaltySettings({ late_hourly_amount: "50000", grace_minutes: 30.7, checkout_hour: 12 })
    ).toEqual({ late_hourly_amount: 50000, grace_minutes: 30, checkout_hour: 12 })
  })
})

describe("jarima turlari va holatlari", () => {
  it("server bilan bir xil", () => {
    expect(PENALTY_KINDS).toEqual(["LATE_CHECKOUT", "DAMAGE", "OTHER"])
    expect(PENALTY_STATUSES).toEqual(["CHECKED_IN", "CHECKED_OUT"])
  })

  it("noma'lum tur o'zi ko'rinadi", () => {
    expect(penaltyKindLabel("LATE_CHECKOUT")).toBeTruthy()
    expect(penaltyKindLabel("DAMAGE")).not.toBe("DAMAGE")
    expect(penaltyKindLabel("SOMETHING")).toBe("SOMETHING")
  })
})

describe("lateDurationLabel", () => {
  it("soat va daqiqa", () => {
    expect(lateDurationLabel(130)).toBe("2 soat 10 daqiqa")
    expect(lateDurationLabel(120)).toBe("2 soat")
    expect(lateDurationLabel(45)).toBe("45 daqiqa")
    expect(lateDurationLabel(-3)).toBe("0 daqiqa")
  })
})
