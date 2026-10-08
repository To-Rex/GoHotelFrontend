import { afterEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { hasScanImages, linkScanToGuest, saveScanImages, type ScanImages } from "./documentImages"

/* Skanerlangan hujjat suratini saqlash yordamchilari. Asosiy qoida: ular
   HECH QACHON xato tashlamaydi — mehmon/bron saqlash surat tufayli
   to'xtamasligi kerak. */

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" })
const idCard = (): ScanImages => ({ documentType: "ID_CARD", images: { front: jpeg(), back: jpeg() } })

afterEach(() => vi.restoreAllMocks())

describe("hasScanImages", () => {
  it("kamida bitta tomon bo'lsa", () => {
    expect(hasScanImages(idCard())).toBe(true)
    expect(hasScanImages({ images: { passport: jpeg() } })).toBe(true)
    expect(hasScanImages({ images: {} })).toBe(false)
    expect(hasScanImages(null)).toBe(false)
    expect(hasScanImages(undefined)).toBe(false)
  })
})

describe("saveScanImages", () => {
  it("tomonlarni multipart bilan mehmonga yuboradi", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { stored: [{}, {}], disabled: false } })
    expect(await saveScanImages("g-1", idCard())).toBe("saved")
    const [url, form] = post.mock.calls[0] as [string, FormData]
    expect(url).toBe("/guests/g-1/document-images")
    expect(form.get("front")).toBeInstanceOf(Blob)
    expect(form.get("back")).toBeInstanceOf(Blob)
    expect(form.get("passport")).toBeNull()
    expect(form.get("document_type")).toBe("ID_CARD")
  })

  it("sozlamada o'chirilgan bo'lsa — disabled", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { stored: [], disabled: true } })
    expect(await saveScanImages("g-1", idCard())).toBe("disabled")
  })

  it("xato tashlamaydi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(api, "post").mockRejectedValue(new Error("503"))
    expect(await saveScanImages("g-1", idCard())).toBe("failed")
  })

  it("mehmon yoki surat bo'lmasa so'rov yuborilmaydi", async () => {
    const post = vi.spyOn(api, "post")
    expect(await saveScanImages(null, idCard())).toBe("empty")
    expect(await saveScanImages("g-1", { images: {} })).toBe("empty")
    expect(post).not.toHaveBeenCalled()
  })
})

describe("linkScanToGuest", () => {
  it("telefon skanini yangi mehmonga bog'laydi", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { linked: 2 } })
    expect(await linkScanToGuest("s-1", "g-1")).toBe(true)
    expect(post).toHaveBeenCalledWith("/reception/scans/s-1/link-guest", { guest_id: "g-1" })
  })

  it("xato tashlamaydi, bo'sh qiymatda chaqirmaydi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const post = vi.spyOn(api, "post").mockRejectedValue(new Error("404"))
    expect(await linkScanToGuest("s-1", "g-1")).toBe(false)
    expect(await linkScanToGuest(undefined, "g-1")).toBe(false)
    expect(post).toHaveBeenCalledTimes(1)
  })
})
