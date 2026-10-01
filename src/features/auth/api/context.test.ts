import { describe, expect, it } from "vitest"

import { defaultBranchId, filterHotels, type ContextHotel } from "./context"

/* Sozlovchi: mehmonxona va filial tanlash. */

const hotels: ContextHotel[] = [
  {
    id: "h1",
    name: "Grand Hotel",
    code: "GRD",
    status: "ACTIVE",
    branches: [
      { id: "b2", name: "Chilonzor", is_main: false },
      { id: "b1", name: "Markaz", is_main: true },
    ],
  },
  { id: "h2", name: "Anna Hostel", code: "ANN", status: "SUSPENDED", branches: [] },
  {
    id: "h3",
    name: "Sam Plaza",
    code: null,
    status: "ACTIVE",
    branches: [{ id: "b3", name: "Registon", is_main: false }],
  },
]

describe("filterHotels", () => {
  it("bo'sh qidiruv — hammasi", () => {
    expect(filterHotels(hotels, "  ")).toHaveLength(3)
  })

  it("nomi, kodi va filial nomi bo'yicha, harf katta-kichikligiga qaramay", () => {
    expect(filterHotels(hotels, "grand").map((h) => h.id)).toEqual(["h1"])
    expect(filterHotels(hotels, "ann").map((h) => h.id)).toEqual(["h2"])
    expect(filterHotels(hotels, "REGISTON").map((h) => h.id)).toEqual(["h3"])
    expect(filterHotels(hotels, "yo'q")).toEqual([])
  })
})

describe("defaultBranchId", () => {
  it("asosiy filial, bo'lmasa birinchisi (server bilan bir xil)", () => {
    expect(defaultBranchId(hotels[0])).toBe("b1")
    expect(defaultBranchId(hotels[2])).toBe("b3")
  })

  it("filiali yo'q yoki mehmonxona tanlanmagan", () => {
    expect(defaultBranchId(hotels[1])).toBeNull()
    expect(defaultBranchId(undefined)).toBeNull()
  })
})
