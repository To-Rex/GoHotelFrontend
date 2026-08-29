import { describe, it, expect } from "vitest"
import { ROUTE_PERMISSIONS, ADMIN_ONLY_ROUTES } from "./permissions"

/* Marshrut ruxsatlari.

   Bu jadval kim qaysi sahifani ko'rishini belgilaydi, shuning uchun undagi
   xato jimgina yuz beradi: sahifa kerak bo'lmagan odamga ochilib qoladi yoki
   kerakligidan yopilib qoladi. Quyidagi testlar shu qarorlarni yozib qo'yadi. */

// Menejer belgisi — butun ilovada shu ruxsat bilan aniqlanadi
const MANAGER = "shift.force_close"

// `usePermissions.canRoute` bilan bir xil qoida (admin bypass alohida)
const employeeCanSee = (path: string, codes: string[]): boolean => {
  if (ADMIN_ONLY_ROUTES.includes(path)) return false
  const required = ROUTE_PERMISSIONS[path] ?? []
  if (required.length === 0) return true
  return required.some((c) => codes.includes(c))
}

const RECEPTION = [
  "reservation.create",
  "reservation.view",
  "reservation.update",
  "guest.view",
  "guest.create",
  "guest.update",
  "room.view",
  "finance.payment.create",
]

const MANAGER_CODES = [...RECEPTION, MANAGER, "report.view", "employee.view"]

describe("Mehmonlar sahifasi", () => {
  it("qabulxona xodimiga ko'rinmaydi", () => {
    // guest.view bo'lsa ham — sahifa menejer va admin uchun
    expect(RECEPTION).toContain("guest.view")
    expect(employeeCanSee("/guests", RECEPTION)).toBe(false)
  })

  it("menejerga ko'rinadi", () => {
    expect(employeeCanSee("/guests", MANAGER_CODES)).toBe(true)
  })

  it("menejer belgisi bilan boshqariladi", () => {
    expect(ROUTE_PERMISSIONS["/guests"]).toEqual([MANAGER])
  })

  it("administrator uchun ochiq (bypass ADMIN_ONLY ro'yxatiga kirmaydi)", () => {
    // `can()` da isAdmin har doim true qaytaradi, shuning uchun bu marshrut
    // faqat adminlar ro'yxatida bo'lmasligi yetarli
    expect(ADMIN_ONLY_ROUTES).not.toContain("/guests")
  })
})

describe("Qabulxona xodimining ishi cheklanmaydi", () => {
  it("bron qilish sahifasi ochiq qoladi", () => {
    // Mehmon qidirish/qo'shish "Yangi bandlov" oynasida — shu sahifada
    expect(employeeCanSee("/booking", RECEPTION)).toBe(true)
  })

  it("xonalar sahifasi ochiq qoladi", () => {
    expect(employeeCanSee("/rooms", RECEPTION)).toBe(true)
  })

  it("kassa va shaxsiy hisobot ochiq qoladi", () => {
    expect(employeeCanSee("/cash-reports", RECEPTION)).toBe(true)
    expect(employeeCanSee("/my-reports", RECEPTION)).toBe(true)
  })

  it("xarajatlar va xabarlar hammaga ochiq", () => {
    expect(employeeCanSee("/expenses", RECEPTION)).toBe(true)
    expect(employeeCanSee("/messages", RECEPTION)).toBe(true)
  })
})

describe("Menejer marshrutlari bir xil belgida", () => {
  it("smenalar tarixi ham menejer belgisida", () => {
    expect(ROUTE_PERMISSIONS["/shifts"]).toEqual([MANAGER])
    expect(employeeCanSee("/shifts", RECEPTION)).toBe(false)
    expect(employeeCanSee("/shifts", MANAGER_CODES)).toBe(true)
  })

  it("sozlamalar faqat administrator uchun", () => {
    expect(ADMIN_ONLY_ROUTES).toContain("/settings")
    expect(employeeCanSee("/settings", MANAGER_CODES)).toBe(false)
  })
})
