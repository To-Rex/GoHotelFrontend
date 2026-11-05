import { describe, expect, it } from "vitest"

import { formatHotelMoment, formatWallClock, hotelClock, wallClock } from "./hotelTime"

describe("hotelClock — UTC daqiqa → mehmonxona (+05:00) soati", () => {
  it("Z va +00:00 belgili vaqt 5 soat oldinga suriladi, kompyuter zonasidan qat'i nazar", () => {
    expect(formatHotelMoment("2026-11-05T09:07:00Z")).toBe("05.11.2026 14:07")
    expect(formatHotelMoment("2026-11-05T09:07:00+00:00")).toBe("05.11.2026 14:07")
    expect(formatHotelMoment("2026-11-05T09:07:00.123456+00:00", false)).toBe("05.11.2026")
  })

  it("boshqa zonadagi belgi ham to'g'ri o'tkaziladi", () => {
    expect(formatHotelMoment("2026-11-05T14:07:00+05:00")).toBe("05.11.2026 14:07")
    expect(formatHotelMoment("2026-11-05T12:07:00+03:00")).toBe("05.11.2026 14:07")
  })

  it("tun — kun almashadi", () => {
    expect(hotelClock("2026-11-05T21:30:00Z")).toEqual({
      date: "06.11.2026", short: "06.11", time: "02:30", ymd: "2026-11-06",
    })
  })

  it("zonasiz matn UTC deb olinadi; Date ham qabul qilinadi", () => {
    expect(formatHotelMoment("2026-11-05T09:00:00")).toBe("05.11.2026 14:00")
    expect(formatHotelMoment(new Date("2026-11-05T09:00:00Z"))).toBe("05.11.2026 14:00")
  })

  it("bo'sh yoki xato — null / bo'sh matn", () => {
    expect(hotelClock(null)).toBeNull()
    expect(hotelClock("")).toBeNull()
    expect(hotelClock("bugun")).toBeNull()
    expect(formatHotelMoment(undefined)).toBe("")
  })
})

describe("wallClock — devor soati, zona belgisi e'tiborsiz", () => {
  it("soatlik bron vaqti serverdan '+00:00' bilan qaytsa ham o'zgarmaydi", () => {
    expect(formatWallClock("2026-11-05T14:00:00+00:00", true)).toBe("05.11.2026 14:00")
    expect(formatWallClock("2026-11-05T14:00:00Z", true)).toBe("05.11.2026 14:00")
    expect(formatWallClock("2026-11-05T14:00:00", true)).toBe("05.11.2026 14:00")
  })

  it("faqat sana — vaqt so'ralsa ham sana", () => {
    expect(formatWallClock("2026-11-05", true)).toBe("05.11.2026")
    expect(formatWallClock("2026-11-05")).toBe("05.11.2026")
    expect(wallClock("2026-11-05")).toEqual({ date: "05.11.2026", short: "05.11", time: null, ymd: "2026-11-05" })
  })

  it("bo'sh yoki xato — null / bo'sh matn", () => {
    expect(wallClock(null)).toBeNull()
    expect(wallClock("05.11.2026")).toBeNull()
    expect(formatWallClock("x", true)).toBe("")
  })
})
