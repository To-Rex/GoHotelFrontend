import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DB_CONFLICT_CODE, api, dbConflictRetry, isDbConflictResponse } from "./api"

/* 409 DB_CONFLICT — so'rov o'zi qaytadan ketadi.

   Server tranzaksiyani butunlay bekor qilgan (hech narsa saqlanmagan), shuning
   uchun aynan o'sha so'rovni qaytarish xavfsiz. Tekshiriladi: ziddiyat o'tib
   ketsa natija qaytadi (xodim xato ko'rmaydi), urinishlar tugasa xato
   avvalgidek, boshqa 409 lar ("xona band") va boshqa kodlar qaytarilmaydi,
   qayta yuborishda tana va manzil o'zgarmaydi. */

const CONFLICT = {
  detail: "Bir vaqtda bajarilgan so'rovlar to'qnashdi — o'zgarishlar saqlanmadi. Iltimos, qaytadan urinib ko'ring.",
  error_code: DB_CONFLICT_CODE,
}

const fail = (config: InternalAxiosRequestConfig, status: number, data: unknown) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    { status, statusText: "", headers: {}, config, data }
  )

/** Avval `failures` marta berilgan xato, keyin 200. Har chaqiruv yoziladi. */
const flaky = (failures: number, status = 409, data: unknown = CONFLICT) => {
  const calls: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config)
    if (calls.length <= failures) throw fail(config, status, data)
    return { data: { id: "res-1" }, status: 200, statusText: "OK", headers: {}, config }
  }
  return { calls, adapter }
}

const originalAdapter = api.defaults.adapter
const originalDelay = dbConflictRetry.delayMs

beforeEach(() => {
  dbConflictRetry.delayMs = 1
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
  vi.stubGlobal("window", { location: { pathname: "/booking", href: "" } })
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  dbConflictRetry.delayMs = originalDelay
  vi.unstubAllGlobals()
})

describe("409 DB_CONFLICT — avtomatik qayta urinish", () => {
  it("bitta ziddiyat — xodim sezmaydi, ikkinchi urinish natijani qaytaradi", async () => {
    const { calls, adapter } = flaky(1)
    api.defaults.adapter = adapter
    const { data } = await api.post("/reservations/", { room_id: "r1" })
    expect(data).toEqual({ id: "res-1" })
    expect(calls).toHaveLength(2)
  })

  it("qayta yuborishda manzil va tana aynan o'sha", async () => {
    const { calls, adapter } = flaky(2)
    api.defaults.adapter = adapter
    await api.post("/reservations/", { room_id: "r1", guest_id: "g1" })
    expect(calls).toHaveLength(3)
    expect(new Set(calls.map((c) => c.url))).toEqual(new Set(["/reservations/"]))
    expect(new Set(calls.map((c) => c.data))).toEqual(new Set([JSON.stringify({ room_id: "r1", guest_id: "g1" })]))
  })

  it("urinishlar tugasa — xato avvalgidek chaqiruvchiga boradi", async () => {
    const { calls, adapter } = flaky(10)
    api.defaults.adapter = adapter
    const error = await api.post("/reservations/", {}).catch((e) => e)
    expect(error).toBeInstanceOf(AxiosError)
    expect(error.response.status).toBe(409)
    expect(error.response.data.error_code).toBe(DB_CONFLICT_CODE)
    expect(calls).toHaveLength(1 + dbConflictRetry.attempts)
  })

  it("boshqa 409 (xona band) — haqiqiy javob, qaytarilmaydi", async () => {
    const { calls, adapter } = flaky(1, 409, { detail: "Room 12 is already booked", error_code: "ROOM_ALREADY_BOOKED" })
    api.defaults.adapter = adapter
    const error = await api.post("/reservations/", {}).catch((e) => e)
    expect(error.response.status).toBe(409)
    expect(calls).toHaveLength(1)
  })

  it("boshqa kodlar (500, 503) qaytarilmaydi", async () => {
    for (const status of [500, 503]) {
      const { calls, adapter } = flaky(1, status, { detail: "x", error_code: "INTERNAL_ERROR" })
      api.defaults.adapter = adapter
      const error = await api.get("/rooms").catch((e) => e)
      expect(error.response.status).toBe(status)
      expect(calls).toHaveLength(1)
    }
  })

  it("isDbConflictResponse — faqat 409 + DB_CONFLICT", () => {
    expect(isDbConflictResponse(409, DB_CONFLICT_CODE)).toBe(true)
    expect(isDbConflictResponse(409, "ROOM_ALREADY_BOOKED")).toBe(false)
    expect(isDbConflictResponse(500, DB_CONFLICT_CODE)).toBe(false)
    expect(isDbConflictResponse(undefined, undefined)).toBe(false)
  })
})
