import {
  BellRing,
  Briefcase,
  Calculator,
  ClipboardList,
  Eye,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { Permission } from "@/types/api"

/**
 * Rol shablonlari — GoHotelAdmin bilan bir xil to'plam. Moslashtirish
 * ruxsat *kodi* bo'yicha (id emas), shuning uchun shablon turli muhitlarda
 * ishlayveradi va backend keyin qo'shgan kodlarga ham chidamli.
 * Naqshlar: aniq kod ("room.view"), yulduzcha ("housekeeping.*", "*.view", "*").
 */
export interface PermissionTemplate {
  id: string
  name: string
  description: string
  icon: LucideIcon
  /** ikonka chipi uchun ranglar */
  accent: string
  codes: string[]
}

export const PERMISSION_TEMPLATES: PermissionTemplate[] = [
  {
    id: "housekeeper",
    name: "Farrosh",
    description: "Xonalarni tozalash va holatini yangilash",
    icon: Sparkles,
    accent: "bg-sky-50 text-sky-600",
    codes: [
      "room.view",
      "room.status.update",
      "housekeeping.task.update",
      "housekeeping.cleaning.*",
    ],
  },
  {
    id: "housekeepingLead",
    name: "Xo'jalik bo'limi boshlig'i",
    description: "Tozalash vazifalarini yaratish va xodimlarga taqsimlash",
    icon: ClipboardList,
    accent: "bg-teal-50 text-teal-600",
    codes: [
      "housekeeping.*",
      "room.view",
      "room.status.update",
      "room.manage",
      "employee.view",
      "report.view",
    ],
  },
  {
    id: "receptionist",
    name: "Qabulxona xodimi",
    description: "Bandlash, mehmonlar, kirish-chiqish va to'lovlar",
    icon: BellRing,
    accent: "bg-indigo-50 text-indigo-600",
    codes: [
      // reservation.cancel ATAYLAB kiritilmagan — resepshn bronni bekor qila
      // olmaydi; bu huquq faqat menejer va administratorda qoladi
      "reservation.create",
      "reservation.update",
      "reservation.view",
      "guest.*",
      "room.view",
      "room.status.update",
      "service.view",
      "finance.invoice.create",
      "finance.payment.create",
    ],
  },
  {
    id: "manager",
    name: "Menejer",
    description: "Kundalik operatsiyalar, moliya va xodimlarni boshqarish",
    icon: Briefcase,
    accent: "bg-violet-50 text-violet-600",
    codes: [
      "reservation.*",
      "guest.*",
      "room.*",
      "housekeeping.*",
      "service.*",
      "report.*",
      "finance.view",
      "finance.invoice.*",
      "finance.payment.*",
      "expense.*",
      "employee.view",
      "employee.create",
      "employee.update",
    ],
  },
  {
    id: "accountant",
    name: "Buxgalter",
    description: "Hisob-fakturalar, to'lovlar va moliyaviy hisobotlar",
    icon: Calculator,
    accent: "bg-amber-50 text-amber-600",
    codes: [
      "finance.*",
      "report.*",
      "expense.*",
      "reservation.view",
      "guest.view",
      "service.view",
    ],
  },
  {
    id: "maintenance",
    name: "Texnik xizmat",
    description: "Ta'mirlash vazifalari va xona holatini yangilash",
    icon: Wrench,
    accent: "bg-orange-50 text-orange-600",
    codes: [
      "room.view",
      "room.status.update",
      "housekeeping.task.create",
      "housekeeping.task.update",
    ],
  },
  {
    id: "viewer",
    name: "Faqat ko'rish",
    description: "Barcha bo'limlarni o'zgartirishsiz ko'rish",
    icon: Eye,
    accent: "bg-slate-100 text-slate-600",
    codes: ["*.view"],
  },
  {
    id: "fullAccess",
    name: "To'liq huquq",
    description: "Barcha modullar bo'yicha cheklovsiz ruxsat",
    icon: ShieldCheck,
    accent: "bg-emerald-50 text-emerald-600",
    codes: ["*"],
  },
]

function matchesPattern(code: string, pattern: string): boolean {
  if (pattern === code) return true
  if (!pattern.includes("*")) return false
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return new RegExp(`^${source}$`).test(code)
}

/** Shablon berilgan ro'yxatdan qamrab oladigan ruxsatlar. */
export function resolveTemplatePermissions(
  template: PermissionTemplate,
  list: Permission[]
): Permission[] {
  return list.filter((p) => template.codes.some((pattern) => matchesPattern(p.code, pattern)))
}

export function templatePermissionIds(
  template: PermissionTemplate,
  list: Permission[]
): string[] {
  return resolveTemplatePermissions(template, list).map((p) => p.id)
}

/** Tanlangan to'plamga aynan mos keladigan shablon (bo'lmasa null). */
export function findMatchingTemplate(
  selectedIds: string[],
  list: Permission[]
): PermissionTemplate | null {
  if (selectedIds.length === 0) return null
  const selected = new Set(selectedIds)
  return (
    PERMISSION_TEMPLATES.find((template) => {
      const ids = templatePermissionIds(template, list)
      return ids.length === selected.size && ids.every((id) => selected.has(id))
    }) ?? null
  )
}
