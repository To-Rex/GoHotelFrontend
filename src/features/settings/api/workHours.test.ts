import { describe, expect, it } from "vitest"

import { resolveWorkHoursSettings } from "./workHours"

/* Ish vaqti nazorati sozlamasi.

   Standart holat — o'chiq: sozlama yoqilmaguncha hech kim to'silmaydi.
   Shuning uchun faqat aniq `true` "yoqilgan" deb o'qiladi. */

describe("resolveWorkHoursSettings", () => {
  it("yoqilgan sozlama", () => {
    expect(resolveWorkHoursSettings({ enforce: true })).toEqual({ enforce: true })
  })

  it("o'chirilgan sozlama", () => {
    expect(resolveWorkHoursSettings({ enforce: false })).toEqual({ enforce: false })
  })

  it("javob bo'lmasa yoki buzuq bo'lsa — o'chiq", () => {
    expect(resolveWorkHoursSettings(undefined)).toEqual({ enforce: false })
    expect(resolveWorkHoursSettings(null)).toEqual({ enforce: false })
    expect(resolveWorkHoursSettings({})).toEqual({ enforce: false })
    expect(resolveWorkHoursSettings({ enforce: "true" })).toEqual({ enforce: false })
    expect(resolveWorkHoursSettings({ enforce: 1 })).toEqual({ enforce: false })
    expect(resolveWorkHoursSettings("yes")).toEqual({ enforce: false })
  })
})
