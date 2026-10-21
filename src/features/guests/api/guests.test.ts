import { afterEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import {
  GUESTS_PAGE_SIZE,
  fetchGuest,
  guestsPageHasMore,
  searchGuests,
} from "./guests"

afterEach(() => vi.restoreAllMocks())

describe("guestsPageHasMore", () => {
  it("to'liq sahifa yana borligini bildiradi", () => {
    expect(guestsPageHasMore(GUESTS_PAGE_SIZE)).toBe(true)
    expect(guestsPageHasMore(GUESTS_PAGE_SIZE - 1)).toBe(false)
    expect(guestsPageHasMore(0)).toBe(false)
  })
})

describe("searchGuests", () => {
  it("server qidiruviga query yuboradi", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: [{ id: "g1" }] })
    expect(await searchGuests("+998 99 534 03 13")).toEqual([{ id: "g1" }])
    expect(get).toHaveBeenCalledWith("/guests/", {
      params: { page: 1, page_size: 20, query: "+998 99 534 03 13" },
    })
  })

  it("items bilan o'ralgan javobni ham qabul qiladi", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { items: [{ id: "g2" }] } })
    expect(await searchGuests("Ali")).toEqual([{ id: "g2" }])
  })
})

describe("fetchGuest", () => {
  it("mehmonni id bo'yicha oladi", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValue({ data: { id: "g1", first_name: "Ali" } })
    expect((await fetchGuest("g1")).id).toBe("g1")
    expect(get).toHaveBeenCalledWith("/guests/g1")
  })
})
