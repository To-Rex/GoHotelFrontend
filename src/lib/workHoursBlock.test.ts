import { afterEach, describe, expect, it, vi } from "vitest"

import { isHotelBlockCode } from "./hotelBlock"
import {
  AUTO_RETURN_COOLDOWN_MS,
  AUTO_RETURN_KEY,
  OFF_HOURS_ROUTE,
  OUTSIDE_WORK_HOURS_CODE,
  WORK_HOURS_BLOCK_MESSAGE_KEY,
  canAutoReturn,
  clearWorkHoursBlockMessage,
  markAutoReturn,
  readAutoReturnAt,
  isOutsideWorkHoursCode,
  isOutsideWorkHoursResponse,
  isWorkHoursBlocked,
  readWorkHoursBlockMessage,
  rememberWorkHoursBlockMessage,
  workHoursRange,
} from "./workHoursBlock"

/* Ish vaqtidan tashqarida ishlash taqiqi.

   Qaror serverda: bu yerda faqat server javobini to'g'ri o'qish va uni
   boshqa to'siqlar (mehmonxona, qurilma) bilan adashtirmaslik
   tekshiriladi. */

describe("isOutsideWorkHoursCode", () => {
  it("ish vaqti kodini taniydi", () => {
    expect(isOutsideWorkHoursCode("OUTSIDE_WORK_HOURS")).toBe(true)
    expect(isOutsideWorkHoursCode(OUTSIDE_WORK_HOURS_CODE)).toBe(true)
  })

  it("boshqa xatolarga tegmaydi", () => {
    expect(isOutsideWorkHoursCode("HOTEL_INACTIVE")).toBe(false)
    expect(isOutsideWorkHoursCode("DEVICE_BLOCKED")).toBe(false)
    expect(isOutsideWorkHoursCode("SHIFT_NOT_OPEN")).toBe(false)
    expect(isOutsideWorkHoursCode("FORBIDDEN")).toBe(false)
    expect(isOutsideWorkHoursCode("outside_work_hours")).toBe(false)
    expect(isOutsideWorkHoursCode(null)).toBe(false)
    expect(isOutsideWorkHoursCode(undefined)).toBe(false)
  })

  it("mehmonxona to'xtatilgani deb qabul qilinmaydi", () => {
    // HOTEL_ bilan boshlansa /service-stopped ga yuborilardi
    expect(isHotelBlockCode(OUTSIDE_WORK_HOURS_CODE)).toBe(false)
  })
})

describe("isOutsideWorkHoursResponse", () => {
  it("faqat 403 va aynan shu kod", () => {
    expect(isOutsideWorkHoursResponse(403, "OUTSIDE_WORK_HOURS")).toBe(true)
    expect(isOutsideWorkHoursResponse(401, "OUTSIDE_WORK_HOURS")).toBe(false)
    expect(isOutsideWorkHoursResponse(400, "OUTSIDE_WORK_HOURS")).toBe(false)
    expect(isOutsideWorkHoursResponse(403, "FORBIDDEN")).toBe(false)
    expect(isOutsideWorkHoursResponse(403, undefined)).toBe(false)
    expect(isOutsideWorkHoursResponse(undefined, undefined)).toBe(false)
  })
})

describe("isWorkHoursBlocked", () => {
  it("server aniq aytganda to'silgan", () => {
    expect(isWorkHoursBlocked({ work_hours_blocked: true })).toBe(true)
  })

  it("eski server maydonni qaytarmasa — hech kim to'silmaydi", () => {
    // Avvalgi xatti-harakat saqlanishi shart
    expect(isWorkHoursBlocked({ user_type: "EMPLOYEE" })).toBe(false)
    expect(isWorkHoursBlocked({ work_hours_blocked: false })).toBe(false)
    expect(isWorkHoursBlocked({ work_hours_blocked: "true" })).toBe(false)
    expect(isWorkHoursBlocked({ work_hours_blocked: 1 })).toBe(false)
    expect(isWorkHoursBlocked(null)).toBe(false)
    expect(isWorkHoursBlocked(undefined)).toBe(false)
    expect(isWorkHoursBlocked("blocked")).toBe(false)
  })
})

describe("workHoursRange", () => {
  it("oddiy kunduzgi jadval", () => {
    expect(workHoursRange({ work_start: "09:00", work_end: "18:00" })).toBe(
      "09:00–18:00"
    )
  })

  it("yarim tundan o'tadigan tungi smena", () => {
    expect(workHoursRange({ work_start: "20:00", work_end: "08:00" })).toBe(
      "20:00–08:00"
    )
  })

  it("bir xonali soat va soniyali yozuv bir xil ko'rinishga keladi", () => {
    expect(workHoursRange({ work_start: "9:00", work_end: "17:30:00" })).toBe(
      "09:00–17:30"
    )
  })

  it("24 soatlik jadvalda oraliq yo'q", () => {
    // Boshlanish = tugash — server bunday xodimni hech qachon to'smaydi
    expect(workHoursRange({ work_start: "08:00", work_end: "08:00" })).toBe(null)
  })

  it("jadval yo'q yoki buzuq bo'lsa — oraliq yo'q", () => {
    expect(workHoursRange(null)).toBe(null)
    expect(workHoursRange(undefined)).toBe(null)
    expect(workHoursRange({})).toBe(null)
    expect(workHoursRange({ work_start: "09:00" })).toBe(null)
    expect(workHoursRange({ work_start: "25:00", work_end: "18:00" })).toBe(null)
    expect(workHoursRange({ work_start: "abc", work_end: "18:00" })).toBe(null)
    expect(workHoursRange({ work_start: 9, work_end: 18 })).toBe(null)
  })
})

describe("server matnini saqlash", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const fakeStorage = () => {
    const data = new Map<string, string>()
    return {
      data,
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
  }

  it("matn saqlanadi, o'qiladi va tozalanadi", () => {
    const storage = fakeStorage()
    vi.stubGlobal("sessionStorage", storage)

    rememberWorkHoursBlockMessage("Ish vaqtingiz emas (09:00–18:00).")
    expect(storage.data.get(WORK_HOURS_BLOCK_MESSAGE_KEY)).toBe(
      "Ish vaqtingiz emas (09:00–18:00)."
    )
    expect(readWorkHoursBlockMessage()).toBe("Ish vaqtingiz emas (09:00–18:00).")

    clearWorkHoursBlockMessage()
    expect(readWorkHoursBlockMessage()).toBe("")
  })

  it("bo'sh yoki matn bo'lmagan qiymat yozilmaydi", () => {
    const storage = fakeStorage()
    vi.stubGlobal("sessionStorage", storage)

    rememberWorkHoursBlockMessage("")
    rememberWorkHoursBlockMessage(undefined)
    rememberWorkHoursBlockMessage({ detail: "x" })
    expect(storage.data.size).toBe(0)
  })

  it("saqlash taqiqlangan muhitda yiqilmaydi", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    })
    expect(() => rememberWorkHoursBlockMessage("matn")).not.toThrow()
    expect(readWorkHoursBlockMessage()).toBe("")
    expect(() => clearWorkHoursBlockMessage()).not.toThrow()
  })
})

describe("canAutoReturn", () => {
  /* Avtomatik qaytish qisqa vaqtda faqat bir marta — server javoblari bir-
     biriga zid bo'lib qolsa, sahifa soniyasiga bir necha marta qayta
     yuklanmasligi uchun. */
  const T = 1_000_000

  it("hali qaytilmagan bo'lsa — qaytadi", () => {
    expect(canAutoReturn(null, T)).toBe(true)
  })

  it("yaqinda qaytgan bo'lsa — kutadi", () => {
    expect(canAutoReturn(T, T + 1_000)).toBe(false)
    expect(canAutoReturn(T, T + AUTO_RETURN_COOLDOWN_MS - 1)).toBe(false)
  })

  it("yetarli vaqt o'tgach — yana qaytadi", () => {
    expect(canAutoReturn(T, T + AUTO_RETURN_COOLDOWN_MS)).toBe(true)
    expect(canAutoReturn(T, T + 60_000)).toBe(true)
  })

  it("soat orqaga ketgan yoki yozuv buzuq bo'lsa — qotib qolmaydi", () => {
    expect(canAutoReturn(T, T - 5_000)).toBe(true)
    expect(canAutoReturn(Number.NaN, T)).toBe(true)
  })

  it("qayta tekshirish oralig'idan qisqa", () => {
    // Aks holda daqiqalik tekshiruv ham to'xtab qolardi
    expect(AUTO_RETURN_COOLDOWN_MS).toBeLessThan(60_000)
  })
})

describe("avtomatik qaytish vaqtini saqlash", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("yoziladi va o'qiladi", () => {
    const data = new Map<string, string>()
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    })
    expect(readAutoReturnAt()).toBe(null)
    markAutoReturn(12345)
    expect(data.get(AUTO_RETURN_KEY)).toBe("12345")
    expect(readAutoReturnAt()).toBe(12345)
  })

  it("buzuq yozuv va taqiqlangan saqlash yiqitmaydi", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => "abc",
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {},
    })
    expect(readAutoReturnAt()).toBe(null)
    expect(() => markAutoReturn(1)).not.toThrow()
  })
})

describe("OFF_HOURS_ROUTE", () => {
  it("mehmonxona to'xtatilgan sahifasidan alohida yo'l", () => {
    expect(OFF_HOURS_ROUTE).toBe("/off-hours")
    expect(OFF_HOURS_ROUTE.startsWith("/service-stopped")).toBe(false)
  })
})
