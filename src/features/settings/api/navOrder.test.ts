import { describe, it, expect } from "vitest"
import { applyNavOrder } from "./navOrder"
import {
  MAIN_NAV_LINKS,
  MANAGEMENT_NAV_LINKS,
  firstSidebarRoute,
} from "@/components/layout/navLinks"

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

  it("olib tashlangan sahifa saqlangan tartibda qolsa ham buzilmaydi", () => {
    // Admin saqlagan tartibda endi mavjud bo'lmagan sahifa turishi mumkin
    // (masalan olib tashlangan "/reservations") — qolganlar joyida qoladi
    const result = hrefs(applyNavOrder(links, ["/c", "/olib-tashlangan", "/a"]))
    expect(result).toEqual(["/c", "/a", "/b"])
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

describe("firstSidebarRoute", () => {
  // Sahifa ochiqligini soxtalashtirish uchun oddiy ruxsat to'plami
  const only = (...hrefs: string[]) => (href: string) => hrefs.includes(href)

  it("tartib bo'lmasa menyudagi birinchi ochiq sahifa", () => {
    const visible = only("/booking", "/rooms", "/guests")
    // Standart tartibda "Bron qilish" "Xonalar"dan oldin turadi
    expect(firstSidebarRoute(visible, undefined, "/")).toBe("/booking")
  })

  it("admin tartibni o'zgartirsa kirish sahifasi ham siljiydi", () => {
    const visible = only("/booking", "/rooms", "/guests")
    expect(firstSidebarRoute(visible, ["/rooms", "/booking"], "/")).toBe("/rooms")
  })

  it("ruxsati yo'q sahifa birinchi bo'lib qolmaydi", () => {
    // Tartibda birinchi turgan "/" xodimga yopiq — keyingisi olinadi
    const visible = only("/rooms", "/guests")
    expect(firstSidebarRoute(visible, ["/", "/rooms"], "/")).toBe("/rooms")
  })

  it("boshqaruv bandi asosiy sahifalardan tepaga chiqmaydi", () => {
    // Menyuda "Administratsiya" sarlavhasi ostida turadi, tartibda oldinda
    // ko'rsatilgan bo'lsa ham
    const visible = only("/rooms", "/employees")
    expect(firstSidebarRoute(visible, ["/employees", "/rooms"], "/")).toBe("/rooms")
  })

  it("faqat boshqaruv sahifasi ochiq bo'lsa o'sha olinadi", () => {
    expect(firstSidebarRoute(only("/employees"), undefined, "/")).toBe("/employees")
  })

  it("hech narsa ochiq bo'lmasa zaxira manzil qaytadi", () => {
    expect(firstSidebarRoute(() => false, undefined, "/zaxira")).toBe("/zaxira")
  })

  it("smena cheklovi paytida ochiq qolgan sahifa olinadi", () => {
    // Cheklov filtri ham shu `visible` orqali keladi — kassa sahifasi
    const visible = only("/cash-reports", "/my-reports")
    expect(firstSidebarRoute(visible, undefined, "/")).toBe("/cash-reports")
  })
})
