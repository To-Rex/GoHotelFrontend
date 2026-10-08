import { describe, expect, it } from "vitest"

import { needsReloadForToken, tokenBranchId, tokenClaims, tokenHotelId } from "./tokenClaims"

/* Boshqa tabda mehmonxona almashtirilganda shu tab o'zini yangilaydi. */

const b64url = (value: string) =>
  btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

const jwt = (payload: Record<string, unknown>) =>
  `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.signature`

describe("tokenClaims", () => {
  it("payload o'qiladi (base64url, o'zbekcha harflar ham)", () => {
    const claims = tokenClaims(jwt({ sub: "u1", hotel_id: "h1", name: "Sardor O'g'li" }))
    expect(claims?.sub).toBe("u1")
    expect(claims?.name).toBe("Sardor O'g'li")
  })

  it("buzuq token — null", () => {
    expect(tokenClaims(null)).toBeNull()
    expect(tokenClaims("abc")).toBeNull()
    expect(tokenClaims("a.!!!.c")).toBeNull()
  })
})

describe("tokenHotelId", () => {
  it("mehmonxona bor / yo'q / o'qilmaydi", () => {
    expect(tokenHotelId(jwt({ hotel_id: "h1" }))).toBe("h1")
    expect(tokenHotelId(jwt({ hotel_id: null }))).toBeNull()
    expect(tokenHotelId("buzuq")).toBeUndefined()
  })
})

describe("tokenBranchId", () => {
  it("filial bor / yo'q / o'qilmaydi", () => {
    expect(tokenBranchId(jwt({ branch_id: "b1" }))).toBe("b1")
    expect(tokenBranchId(jwt({ hotel_id: "h1" }))).toBeNull()
    expect(tokenBranchId("buzuq")).toBeUndefined()
  })
})

describe("needsReloadForToken", () => {
  const tokenX = jwt({ hotel_id: "x" })
  const tokenY = jwt({ hotel_id: "y" })

  it("boshqa tab boshqa mehmonxonaga o'tdi — qayta yuklash", () => {
    expect(needsReloadForToken("accessToken", tokenY, "x")).toBe(true)
    expect(needsReloadForToken("accessToken", jwt({ hotel_id: null }), "x")).toBe(true)
  })

  it("odatiy token yangilanishi (o'sha mehmonxona) — yo'q", () => {
    expect(needsReloadForToken("accessToken", tokenX, "x")).toBe(false)
    expect(needsReloadForToken("accessToken", jwt({ hotel_id: null }), null)).toBe(false)
  })

  it("administrator boshqa tabda filialni almashtirdi — qayta yuklash", () => {
    const a1 = jwt({ hotel_id: "x", branch_id: "a1" })
    const a2 = jwt({ hotel_id: "x", branch_id: "a2" })
    expect(needsReloadForToken("accessToken", a2, "x", "a1")).toBe(true)
    expect(needsReloadForToken("accessToken", a1, "x", "a1")).toBe(false)
    // Tokenda filial yo'q (eski token) yoki joriy filial noma'lum — yo'q
    expect(needsReloadForToken("accessToken", tokenX, "x", "a1")).toBe(false)
    expect(needsReloadForToken("accessToken", a2, "x")).toBe(false)
  })

  it("boshqa kalit, o'chirilgan yoki buzuq token — yo'q", () => {
    expect(needsReloadForToken("lang", tokenY, "x")).toBe(false)
    expect(needsReloadForToken("accessToken", null, "x")).toBe(false)
    expect(needsReloadForToken("accessToken", "buzuq", "x")).toBe(false)
  })
})
