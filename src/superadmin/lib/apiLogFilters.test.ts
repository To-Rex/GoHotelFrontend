import { describe, expect, it } from "vitest"

import {
  buildStatusParam,
  focusCode,
  groupCodes,
  normalizeStatusToken,
  parseMethodsParam,
  parseSinceParam,
  parseStatusParam,
  sameSelection,
  tokenCovers,
  toggleToken,
} from "./apiLogFilters"

describe("so'rovlar jurnali — holat filtri", () => {
  it("bo'lakni tushunadi: kod, sinf, oraliq", () => {
    expect(normalizeStatusToken(" 404 ")).toBe("404")
    expect(normalizeStatusToken("4XX")).toBe("4xx")
    expect(normalizeStatusToken("504 - 500")).toBe("500-504")
    expect(normalizeStatusToken("500-500")).toBe("500")
    for (const bad of ["", "abc", "99", "600", "6xx", "1000", "50-504"]) {
      expect(normalizeStatusToken(bad)).toBeNull()
    }
  })

  it("URL ifodasi ↔ tanlov (ikki tomonga)", () => {
    expect(parseStatusParam("400,401,422")).toEqual({ tokens: ["400", "401", "422"], mode: "include" })
    expect(parseStatusParam("!200,!304")).toEqual({ tokens: ["200", "304"], mode: "exclude" })
    expect(parseStatusParam("")).toEqual({ tokens: [], mode: "include" })
    expect(parseStatusParam(null)).toEqual({ tokens: [], mode: "include" })
    // Eski havolalar (bitta sinf yoki kod) ham ishlaydi
    expect(parseStatusParam("4xx")).toEqual({ tokens: ["4xx"], mode: "include" })
    // Takror va tushunarsiz bo'laklar tashlab yuboriladi
    expect(parseStatusParam("401,401,abc,5xx")).toEqual({ tokens: ["401", "5xx"], mode: "include" })
    // Aralash — "ko'rsatish" qismi
    expect(parseStatusParam("4xx,!401")).toEqual({ tokens: ["4xx"], mode: "include" })

    expect(buildStatusParam({ tokens: ["400", "422"], mode: "include" })).toBe("400,422")
    expect(buildStatusParam({ tokens: ["200", "304"], mode: "exclude" })).toBe("!200,!304")
    expect(buildStatusParam({ tokens: [], mode: "exclude" })).toBe("")
    const sel = { tokens: ["500-504", "401"], mode: "exclude" as const }
    expect(parseStatusParam(buildStatusParam(sel))).toEqual(sel)
  })

  it("qamrov: sinf va oraliq", () => {
    expect(tokenCovers("4xx", 401)).toBe(true)
    expect(tokenCovers("4xx", 500)).toBe(false)
    expect(tokenCovers("500-504", 502)).toBe(true)
    expect(tokenCovers("500-504", 505)).toBe(false)
    expect(tokenCovers("422", 422)).toBe(true)
  })

  it("tanlash va jadvaldagi belgini bosish", () => {
    const a = toggleToken({ tokens: [], mode: "include" }, "401")
    expect(a.tokens).toEqual(["401"])
    expect(toggleToken(a, "401").tokens).toEqual([])
    expect(focusCode({ tokens: ["400"], mode: "include" }, 422)).toEqual({ tokens: ["400", "422"], mode: "include" })
    expect(focusCode({ tokens: ["400", "422"], mode: "include" }, 422)).toEqual({ tokens: ["400"], mode: "include" })
    // Yashirish rejimida — faqat shu kodni ko'rsatishga o'tadi
    expect(focusCode({ tokens: ["200"], mode: "exclude" }, 401)).toEqual({ tokens: ["401"], mode: "include" })
  })

  it("tayyor tanlovni tanish (tartibdan qat'i nazar)", () => {
    expect(sameSelection({ tokens: ["5xx", "4xx"], mode: "include" }, { tokens: ["4xx", "5xx"], mode: "include" })).toBe(true)
    expect(sameSelection({ tokens: ["4xx"], mode: "exclude" }, { tokens: ["4xx"], mode: "include" })).toBe(false)
    expect(sameSelection({ tokens: [], mode: "exclude" }, { tokens: [], mode: "include" })).toBe(true)
  })

  it("kodlar sinf bo'yicha guruhlanadi, tanlangan 0 talik kod ham ko'rinadi", () => {
    const groups = groupCodes({ "200": 310, "201": 4, "401": 12, "422": 5, "500": 1 }, ["404", "3xx"])
    expect(groups.map((g) => g.cls)).toEqual(["2xx", "3xx", "4xx", "5xx"])
    expect(groups[0]).toEqual({ cls: "2xx", total: 314, codes: [{ code: 200, count: 310 }, { code: 201, count: 4 }] })
    expect(groups[1]).toEqual({ cls: "3xx", total: 0, codes: [] })
    expect(groups[2].codes).toEqual([{ code: 401, count: 12 }, { code: 404, count: 0 }, { code: 422, count: 5 }])
    expect(groupCodes(undefined, [])).toEqual([])
  })

  it("metod va davr parametrlari", () => {
    expect(parseMethodsParam(" get,POST,get ")).toEqual(["GET", "POST"])
    expect(parseMethodsParam(null)).toEqual([])
    expect(parseSinceParam("60")).toBe(60)
    expect(parseSinceParam("0")).toBeUndefined()
    expect(parseSinceParam("abc")).toBeUndefined()
    expect(parseSinceParam(null)).toBeUndefined()
  })
})
