import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "./api"
import { HOTEL_BLOCK_MESSAGE_KEY } from "./hotelBlock"
import {
  DIALOG_WAIT_MAX_MS,
  DIALOG_WAIT_POLL_MS,
  OFF_HOURS_ROUTE,
  OPEN_DIALOG_SELECTOR,
  OUTSIDE_WORK_HOURS_CODE,
  WORK_HOURS_BLOCK_MESSAGE_KEY,
} from "./workHoursBlock"

/* Umumiy 403 ushlagichi: ish vaqtidan tashqarida.

   So'rov haqiqatan `api` orqali o'tadi (interceptorlar bilan), faqat
   tarmoq o'rniga server javobi soxtalashtiriladi. Tekshiriladi:
   xodim `/off-hours` ga yuboriladi, sessiyasi TOZALANMAYDI, ochiq oyna
   yopilguncha kutiladi, kirish so'rovlari va boshqa 403 lar (mehmonxona,
   qurilma, oddiy ruxsat) avvalgidek o'z yo'li bilan ishlanadi.

   `document` stub qilinmagan testlarda (node muhiti) ochiq oyna yo'q —
   yo'naltirish darhol. */

type MemoryStorage = Storage & { data: Map<string, string> }

const memoryStorage = (initial: Record<string, string> = {}): MemoryStorage => {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get length() {
      return data.size
    },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    clear: () => data.clear(),
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  } as MemoryStorage
}

/** Server shu javobni qaytargandek — so'rov tarmoqqa chiqmaydi. */
const respondWith =
  (status: number, data: unknown): AxiosAdapter =>
  async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      { status, statusText: "", headers: {}, config, data }
    )
  }

const BLOCKED = {
  detail:
    "Ish vaqtingiz emas (09:00–18:00). Ish vaqti boshlanganda tizimdan foydalanishingiz mumkin.",
  error_code: OUTSIDE_WORK_HOURS_CODE,
}

const originalAdapter = api.defaults.adapter
let local: MemoryStorage
let session: MemoryStorage
let replace: ReturnType<typeof vi.fn>
let location: { pathname: string; href: string; replace: typeof replace }

beforeEach(() => {
  local = memoryStorage({ accessToken: "acc", refreshToken: "ref" })
  session = memoryStorage()
  replace = vi.fn()
  location = { pathname: "/housekeeping", href: "", replace }
  vi.stubGlobal("localStorage", local)
  vi.stubGlobal("sessionStorage", session)
  vi.stubGlobal("window", { location })
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.unstubAllGlobals()
})

describe("403 OUTSIDE_WORK_HOURS", () => {
  it("xodim /off-hours ga yuboriladi, sessiyasi saqlanadi", async () => {
    api.defaults.adapter = respondWith(403, BLOCKED)

    const error = await api.get("/tasks").catch((e) => e)

    // So'rov baribir xato bilan tugaydi — chaqirgan joy o'zini yo'qotmaydi
    expect(error).toBeInstanceOf(AxiosError)
    expect(error.response.status).toBe(403)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith(OFF_HOURS_ROUTE)
    // Tokenlar joyida: ish vaqti boshlangach qaytadan kirish shart emas
    expect(local.getItem("accessToken")).toBe("acc")
    expect(local.getItem("refreshToken")).toBe("ref")
    // Server matni to'liq qayta yuklashdan omon qoladi
    expect(session.getItem(WORK_HOURS_BLOCK_MESSAGE_KEY)).toBe(BLOCKED.detail)
  })

  it("o'zgartiruvchi so'rovda ham (POST) xuddi shunday", async () => {
    api.defaults.adapter = respondWith(403, BLOCKED)
    await api.post("/problems", { text: "x" }).catch(() => {})
    expect(replace).toHaveBeenCalledWith(OFF_HOURS_ROUTE)
  })

  it("allaqachon /off-hours da bo'lsa — sahifa qayta yuklanmaydi", async () => {
    location.pathname = OFF_HOURS_ROUTE
    api.defaults.adapter = respondWith(403, BLOCKED)
    await api.get("/tasks").catch(() => {})
    expect(replace).not.toHaveBeenCalled()
  })

  it("kirish/yangilash so'rovlari yo'naltirilmaydi — xato formada ko'rinadi", async () => {
    api.defaults.adapter = respondWith(403, BLOCKED)
    await api.post("/auth/login", {}).catch(() => {})
    await api.post("/auth/refresh", {}).catch(() => {})
    expect(replace).not.toHaveBeenCalled()
    expect(local.getItem("accessToken")).toBe("acc")
  })

  it("faqat 403: boshqa statusdagi shu kod e'tiborsiz", async () => {
    api.defaults.adapter = respondWith(400, BLOCKED)
    await api.get("/tasks").catch(() => {})
    expect(replace).not.toHaveBeenCalled()
  })
})

describe("ochiq oyna yopilguncha kutiladi", () => {
  /* Resepshn xodimi ish vaqtidan keyin smenani topshiradi: server
     topshirishni qabul qiladi, lekin smena holatini qayta o'qish endi 403.
     O'sha paytda sanash oynasi ochiq, so'ng kassa hisoboti oynasi
     chiqadi — xodim farqni ko'rib ulgurishi kerak. */
  let dialogOpen: boolean

  beforeEach(() => {
    vi.useFakeTimers()
    dialogOpen = true
    vi.stubGlobal("document", {
      querySelector: (selector: string) =>
        dialogOpen && selector === OPEN_DIALOG_SELECTOR ? {} : null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("oyna yopilgach bir marta yo'naltiriladi", async () => {
    api.defaults.adapter = respondWith(403, BLOCKED)
    await api.get("/shifts/state").catch(() => {})
    // Fondagi boshqa so'rovlar ham to'siladi — bitta kutishga qo'shiladi
    await api.get("/staff-messages").catch(() => {})

    vi.advanceTimersByTime(DIALOG_WAIT_POLL_MS * 4)
    expect(replace).not.toHaveBeenCalled()
    // Xabar darhol saqlanadi
    expect(session.getItem(WORK_HOURS_BLOCK_MESSAGE_KEY)).toBe(BLOCKED.detail)

    dialogOpen = false
    vi.advanceTimersByTime(DIALOG_WAIT_POLL_MS)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith(OFF_HOURS_ROUTE)

    // Kutish tugagan — keyingi taymerlar qayta yubormaydi
    vi.advanceTimersByTime(DIALOG_WAIT_POLL_MS * 4)
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it("oyna yopilmasa ham cheksiz kutilmaydi", async () => {
    api.defaults.adapter = respondWith(403, BLOCKED)
    await api.get("/tasks").catch(() => {})
    vi.advanceTimersByTime(DIALOG_WAIT_MAX_MS - DIALOG_WAIT_POLL_MS)
    expect(replace).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DIALOG_WAIT_POLL_MS * 2)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith(OFF_HOURS_ROUTE)
  })

  it("kutish paytida chiqib ketgan bo'lsa — yo'naltirilmaydi", async () => {
    api.defaults.adapter = respondWith(403, BLOCKED)
    await api.get("/tasks").catch(() => {})
    local.removeItem("accessToken")
    local.removeItem("refreshToken")
    dialogOpen = false
    vi.advanceTimersByTime(DIALOG_WAIT_POLL_MS * 2)
    expect(replace).not.toHaveBeenCalled()
  })

  it("oyna bo'lmasa — darhol", async () => {
    dialogOpen = false
    api.defaults.adapter = respondWith(403, BLOCKED)
    await api.get("/tasks").catch(() => {})
    expect(replace).toHaveBeenCalledTimes(1)
  })
})

describe("boshqa 403 lar avvalgidek", () => {
  it("mehmonxona to'xtatilgani ustun — /service-stopped ga", async () => {
    api.defaults.adapter = respondWith(403, {
      detail: "Xizmat to'xtatilgan",
      error_code: "HOTEL_INACTIVE",
    })
    await api.get("/tasks").catch(() => {})
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith("/service-stopped?code=HOTEL_INACTIVE")
    expect(session.getItem(HOTEL_BLOCK_MESSAGE_KEY)).toBe("Xizmat to'xtatilgan")
    expect(session.getItem(WORK_HOURS_BLOCK_MESSAGE_KEY)).toBe(null)
  })

  it("qurilma taqiqlangan — sessiya tozalanadi (o'zgarmagan)", async () => {
    api.defaults.adapter = respondWith(403, {
      detail: "Qurilma taqiqlangan",
      error_code: "DEVICE_BLOCKED",
    })
    await api.get("/tasks").catch(() => {})
    expect(replace).toHaveBeenCalledWith("/device-pending?code=DEVICE_BLOCKED")
    expect(local.getItem("accessToken")).toBe(null)
  })

  it("oddiy ruxsat va smena xatolari hech qayerga yubormaydi", async () => {
    for (const code of ["FORBIDDEN", "SHIFT_NOT_OPEN", undefined]) {
      api.defaults.adapter = respondWith(403, { detail: "Ruxsat yo'q", error_code: code })
      await api.get("/finance").catch(() => {})
    }
    expect(replace).not.toHaveBeenCalled()
    expect(local.getItem("accessToken")).toBe("acc")
    expect(session.getItem(WORK_HOURS_BLOCK_MESSAGE_KEY)).toBe(null)
  })
})
