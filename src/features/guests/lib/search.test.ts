import { describe, expect, it } from "vitest"

import type { Guest } from "@/types/api"
import { guestSearchRank } from "./search"

const guest = (overrides: Partial<Guest>): Guest =>
  ({
    id: "g1",
    first_name: "Alisher",
    last_name: "Haydarov",
    phone: "+998 99 534 03 13",
    ...overrides,
  }) as Guest

describe("guestSearchRank", () => {
  it("ism boshidan mos kelsa birinchi o'rin", () => {
    expect(guestSearchRank(guest({}), "ali")).toBe(0)
    expect(guestSearchRank(guest({}), "hayd")).toBe(0)
  })

  it("ism ichida mos kelsa ikkinchi o'rin", () => {
    expect(guestSearchRank(guest({ first_name: "Valisher" }), "ali")).toBe(1)
  })

  it("telefon bo'shliq/kod bilan yozilgan bo'lsa ham topadi", () => {
    expect(guestSearchRank(guest({}), "995340313")).toBe(0)
    expect(guestSearchRank(guest({}), "+998995340313")).toBe(0)
  })

  it("mos kelmasa 2", () => {
    expect(guestSearchRank(guest({}), "Dilshod")).toBe(2)
    expect(guestSearchRank(guest({}), "")).toBe(2)
  })

  it("passport faqat so'ralganda qidiriladi", () => {
    const g = guest({ passport_number: "AA1234567" })
    expect(guestSearchRank(g, "AA12")).toBe(2)
    expect(guestSearchRank(g, "AA12", { passport: true })).toBe(0)
  })
})
