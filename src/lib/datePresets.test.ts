import { describe, it, expect } from "vitest"
import {
  buildDatePresets,
  isRangeInverted,
  resolveDateRange,
} from "./datePresets"

/* Testlarning asosiy qismi bitta xato haqida: "Shu oy" tugmasi oyning
   ayrim kunlarida ishlamayotgandek ko'rinardi. Sabab — tanlangan davr
   sanalarga qarab topilardi, sanalar esa har doim ham yagona emas. */

const key = (k: string) => (p: { key: string }) => p.key === k
const get = (presets: ReturnType<typeof buildDatePresets>, k: string) =>
  presets.find(key(k))!

describe("buildDatePresets", () => {
  it("oyning 1-kunida 'Shu oy' va 'Bugun' sanalari bir xil bo'ladi", () => {
    // Aynan shu holat xatoni keltirib chiqargan edi.
    const presets = buildDatePresets(new Date(2026, 8, 1))
    const today = get(presets, "today")
    const month = get(presets, "month")

    expect(month.from).toBe("2026-09-01")
    expect(month.to).toBe("2026-09-01")
    expect([month.from, month.to]).toEqual([today.from, today.to])
    // Sanalar bir xil bo'lsa ham kalitlar ajralib turadi
    expect(month.key).not.toBe(today.key)
  })

  it("oyning 7-kunida 'Shu oy' 'Oxirgi 7 kun' bilan mos tushadi", () => {
    const presets = buildDatePresets(new Date(2026, 8, 7))
    expect([get(presets, "month").from, get(presets, "month").to]).toEqual([
      get(presets, "week").from,
      get(presets, "week").to,
    ])
  })

  it("oy o'rtasida davrlar farq qiladi", () => {
    const presets = buildDatePresets(new Date(2026, 8, 15))
    expect(get(presets, "month").from).toBe("2026-09-01")
    expect(get(presets, "week").from).toBe("2026-09-09")
    expect(get(presets, "today").from).toBe("2026-09-15")
  })

  it("'Barcha davr' bo'sh sanalar beradi — server filtrsiz so'raladi", () => {
    const all = get(buildDatePresets(new Date(2026, 8, 15)), "all")
    expect(all.from).toBe("")
    expect(all.to).toBe("")
  })

  it("'Kecha' faqat so'ralganda qo'shiladi", () => {
    const without = buildDatePresets(new Date(2026, 8, 15))
    const with_ = buildDatePresets(new Date(2026, 8, 15), { withYesterday: true })

    expect(without.some(key("yesterday"))).toBe(false)
    expect(get(with_, "yesterday").from).toBe("2026-09-14")
    expect(get(with_, "yesterday").to).toBe("2026-09-14")
  })

  it("oy boshidan oldingi kunga o'tganda oldingi oyni oladi", () => {
    // 1-sentabrda "Oxirgi 7 kun" avgustdan boshlanadi
    const presets = buildDatePresets(new Date(2026, 8, 1))
    expect(get(presets, "week").from).toBe("2026-08-26")
  })

  it("yil boshida ham to'g'ri — 1-yanvar", () => {
    const presets = buildDatePresets(new Date(2026, 0, 1))
    expect(get(presets, "month").from).toBe("2026-01-01")
    expect(get(presets, "week").from).toBe("2025-12-26")
  })

  it("kalitlar takrorlanmaydi", () => {
    const keys = buildDatePresets(new Date(2026, 8, 1), {
      withYesterday: true,
    }).map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("resolveDateRange", () => {
  const presets = buildDatePresets(new Date(2026, 8, 1))
  const custom = { from: "2026-01-01", to: "2026-01-31" }

  it("sanalari 'Bugun' bilan bir xil bo'lsa ham 'Shu oy' ni tanlaydi", () => {
    // Eski kod bu yerda "Bugun" ni qaytarardi va tugma o'lik ko'rinardi.
    expect(resolveDateRange(presets, "month", custom)).toEqual({
      from: "2026-09-01",
      to: "2026-09-01",
    })
  })

  it("tugma tanlanmagan bo'lsa qo'lda kiritilgan oraliq ishlatiladi", () => {
    expect(resolveDateRange(presets, null, custom)).toEqual(custom)
  })

  it("'Barcha davr' bo'sh oraliq qaytaradi", () => {
    expect(resolveDateRange(presets, "all", custom)).toEqual({
      from: "",
      to: "",
    })
  })

  it("noma'lum kalitda oraliq yo'qolmaydi", () => {
    expect(resolveDateRange(presets, "yesterday", custom)).toEqual(custom)
  })
})

describe("isRangeInverted", () => {
  it("boshlanish tugashdan keyin bo'lsa aniqlaydi", () => {
    expect(isRangeInverted("2026-09-10", "2026-09-01")).toBe(true)
  })

  it("to'g'ri va teng oraliqlarda false", () => {
    expect(isRangeInverted("2026-09-01", "2026-09-10")).toBe(false)
    expect(isRangeInverted("2026-09-01", "2026-09-01")).toBe(false)
  })

  it("bo'sh sana 'Barcha davr' degani — teskari emas", () => {
    expect(isRangeInverted("", "")).toBe(false)
    expect(isRangeInverted("2026-09-01", "")).toBe(false)
    expect(isRangeInverted("", "2026-09-01")).toBe(false)
  })
})
