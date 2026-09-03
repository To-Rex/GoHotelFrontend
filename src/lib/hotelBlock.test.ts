import { describe, expect, it } from "vitest"

import { hotelBlockReason, isHotelBlockCode } from "./hotelBlock"

describe("isHotelBlockCode", () => {
  it("mehmonxona kodlarini tanidi", () => {
    expect(isHotelBlockCode("HOTEL_INACTIVE")).toBe(true)
    expect(isHotelBlockCode("HOTEL_SUSPENDED")).toBe(true)
  })

  it("kelajakdagi yangi HOTEL_ kodi ham to'siq deb qaraladi", () => {
    expect(isHotelBlockCode("HOTEL_ARCHIVED")).toBe(true)
  })

  it("boshqa xatolarga tegmaydi", () => {
    // Qurilma va smena to'siqlari o'z yo'llari bilan ishlanadi
    expect(isHotelBlockCode("DEVICE_BLOCKED")).toBe(false)
    expect(isHotelBlockCode("SHIFT_NOT_OPEN")).toBe(false)
    expect(isHotelBlockCode(null)).toBe(false)
    expect(isHotelBlockCode(undefined)).toBe(false)
    expect(isHotelBlockCode(403)).toBe(false)
  })
})

describe("hotelBlockReason", () => {
  it("ma'lum sababni qaytaradi", () => {
    expect(hotelBlockReason("HOTEL_SUSPENDED")).toBe("HOTEL_SUSPENDED")
    expect(hotelBlockReason("HOTEL_NOT_FOUND")).toBe("HOTEL_NOT_FOUND")
  })

  it("birinchi ma'lum nomzod ustun", () => {
    // Router state manzil qatoridan aniqroq
    expect(hotelBlockReason("HOTEL_SUSPENDED", "HOTEL_INACTIVE")).toBe(
      "HOTEL_SUSPENDED"
    )
  })

  it("bo'sh nomzoddan keyingisiga o'tadi", () => {
    expect(hotelBlockReason(undefined, "HOTEL_SUSPENDED")).toBe(
      "HOTEL_SUSPENDED"
    )
    expect(hotelBlockReason(null, null, "HOTEL_NOT_FOUND")).toBe(
      "HOTEL_NOT_FOUND"
    )
  })

  it("noma'lum kod umumiy matnga tushadi", () => {
    expect(hotelBlockReason("HOTEL_ARCHIVED")).toBe("HOTEL_INACTIVE")
    expect(hotelBlockReason("")).toBe("HOTEL_INACTIVE")
    expect(hotelBlockReason()).toBe("HOTEL_INACTIVE")
  })
})
