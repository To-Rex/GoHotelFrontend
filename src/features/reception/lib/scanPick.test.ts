import { describe, expect, it } from "vitest"

import type { DocumentScan } from "../api/scans"
import { pickAutoOpen } from "./scanPick"

const scan = (over: Partial<DocumentScan> & { id: string }): DocumentScan => ({
  document_type: "PASSPORT",
  document_number: "AA1234567",
  full_name: "TOSHMATOV JASUR",
  guest_id: null,
  guest_name: null,
  matched: false,
  verified: true,
  document: {},
  created_at: "2026-09-04T10:00:00+00:00",
  acknowledged: false,
  ...over,
})

const SINCE = new Date("2026-09-04T09:00:00+00:00").getTime()
const none = new Set<string>()

describe("pickAutoOpen", () => {
  it("yangi skan oynani ochadi", () => {
    expect(pickAutoOpen([scan({ id: "a" })], { since: SINCE, opened: none })?.id).toBe(
      "a"
    )
  })

  it("bo'sh ro'yxat", () => {
    expect(pickAutoOpen([], { since: SINCE, opened: none })).toBeNull()
  })

  it("yopilgan yozuv ochilmaydi", () => {
    const rows = [scan({ id: "a", acknowledged: true })]
    expect(pickAutoOpen(rows, { since: SINCE, opened: none })).toBeNull()
  })

  it("allaqachon ochilgan yozuv ikkinchi marta ochilmaydi", () => {
    // Yopish so'rovi hali yetib bormagan bo'lsa ro'yxat o'sha yozuv
    // bilan yana kelishi mumkin
    const rows = [scan({ id: "a" })]
    expect(pickAutoOpen(rows, { since: SINCE, opened: new Set(["a"]) })).toBeNull()
  })

  it("kuzatuvdan oldingi skan o'zi ochilmaydi", () => {
    const rows = [scan({ id: "old", created_at: "2026-09-04T08:00:00+00:00" })]
    expect(pickAutoOpen(rows, { since: SINCE, opened: none })).toBeNull()
  })

  it("eski va yangi aralash bo'lsa — faqat yangisi", () => {
    const rows = [
      scan({ id: "old", created_at: "2026-09-04T08:30:00+00:00" }),
      scan({ id: "new", created_at: "2026-09-04T10:00:00+00:00" }),
    ]
    expect(pickAutoOpen(rows, { since: SINCE, opened: none })?.id).toBe("new")
  })

  it("bir nechta yangi bo'lsa — eng oxirgisi", () => {
    const rows = [
      scan({ id: "birinchi", created_at: "2026-09-04T10:00:00+00:00" }),
      scan({ id: "ikkinchi", created_at: "2026-09-04T10:02:00+00:00" }),
    ]
    expect(pickAutoOpen(rows, { since: SINCE, opened: none })?.id).toBe("ikkinchi")
    // Server tartibiga tayanmaymiz
    expect(pickAutoOpen(rows.reverse(), { since: SINCE, opened: none })?.id).toBe(
      "ikkinchi"
    )
  })

  it("aniq vaqtdagi yozuv ham hisobga olinadi", () => {
    const rows = [scan({ id: "a", created_at: "2026-09-04T09:00:00+00:00" })]
    expect(pickAutoOpen(rows, { since: SINCE, opened: none })?.id).toBe("a")
  })

  it("vaqtsiz yozuv ochilmaydi", () => {
    // Vaqti yo'q yozuvning yangiligini aniqlab bo'lmaydi — menyuda qoladi
    const rows = [scan({ id: "a", created_at: null })]
    expect(pickAutoOpen(rows, { since: SINCE, opened: none })).toBeNull()
  })
})
