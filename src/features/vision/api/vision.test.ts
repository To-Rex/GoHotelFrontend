import { describe, expect, it } from "vitest"

import { OTHER_GUEST_FACE, isOtherGuestsFace } from "./vision"

/* Biriktirishda "bu yuz boshqa mehmonniki" javobi — faqat 409 + shu kod.
   Boshqa 409 (masalan, bron to'qnashuvi) tasdiq oynasini chiqarmaydi. */

describe("isOtherGuestsFace", () => {
  it("409 va FACE_BELONGS_TO_OTHER_GUEST — ha", () => {
    expect(
      isOtherGuestsFace({ response: { status: 409, data: { error_code: OTHER_GUEST_FACE, detail: "..." } } })
    ).toBe(true)
  })

  it("boshqa kod yoki holat — yo'q", () => {
    expect(isOtherGuestsFace({ response: { status: 409, data: { error_code: "CONFLICT" } } })).toBe(false)
    expect(isOtherGuestsFace({ response: { status: 422, data: { error_code: OTHER_GUEST_FACE } } })).toBe(false)
    expect(isOtherGuestsFace(new Error("network"))).toBe(false)
    expect(isOtherGuestsFace(undefined)).toBe(false)
  })
})
