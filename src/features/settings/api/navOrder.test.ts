import { describe, it, expect } from "vitest"
import { applyNavOrder } from "./navOrder"
import { MAIN_NAV_LINKS, MANAGEMENT_NAV_LINKS } from "@/components/layout/navLinks"

const hrefs = (list: Array<{ href: string }>) => list.map((l) => l.href)

describe("applyNavOrder", () => {
  const links = [{ href: "/a" }, { href: "/b" }, { href: "/c" }]

  it("tartib bo'lmasa standart holicha qoladi", () => {
    expect(applyNavOrder(links, undefined)).toEqual(links)
    expect(applyNavOrder(links, [])).toEqual(links)
  })

  it("saqlangan tartibga soladi", () => {
    expect(hrefs(applyNavOrder(links, ["/c", "/a", "/b"]))).toEqual([
      "/c",
      "/a",
      "/b",
    ])
  })

  it("tartibda yo'q sahifa yo'qolmaydi — oxirida qoladi", () => {
    // Yangi versiyada qo'shilgan sahifa eski saqlangan tartibda bo'lmaydi
    const withNew = [...links, { href: "/yangi" }]
    const result = hrefs(applyNavOrder(withNew, ["/c", "/a", "/b"]))
    expect(result).toEqual(["/c", "/a", "/b", "/yangi"])
  })

  it("tartibda yo'qlar o'zaro standart ketma-ketligini saqlaydi", () => {
    const result = hrefs(applyNavOrder(links, ["/c"]))
    expect(result).toEqual(["/c", "/a", "/b"])
  })

  it("boshqa guruhning manzillari ta'sir qilmaydi", () => {
    // Tartib ikkala guruh uchun umumiy ro'yxat — har bir guruh o'zinikini oladi
    const order = ["/x", "/b", "/y", "/a", "/z"]
    expect(hrefs(applyNavOrder(links, order))).toEqual(["/b", "/a", "/c"])
  })

  it("hech bir sahifa tushib qolmaydi va takrorlanmaydi", () => {
    const order = [...hrefs(MANAGEMENT_NAV_LINKS), ...hrefs(MAIN_NAV_LINKS)]
    const result = applyNavOrder(MAIN_NAV_LINKS, order)
    expect(result).toHaveLength(MAIN_NAV_LINKS.length)
    expect(new Set(hrefs(result)).size).toBe(MAIN_NAV_LINKS.length)
  })

  it("menyu ro'yxatlarida takroriy manzil yo'q", () => {
    const all = [...hrefs(MAIN_NAV_LINKS), ...hrefs(MANAGEMENT_NAV_LINKS)]
    expect(new Set(all).size).toBe(all.length)
  })
})
