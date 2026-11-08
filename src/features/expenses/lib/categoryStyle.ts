import {
  Banknote,
  Bath,
  Bed,
  BriefcaseBusiness,
  Building2,
  Bus,
  Cable,
  Car,
  Coins,
  Droplets,
  Ellipsis,
  Flame,
  Fuel,
  Gift,
  Hammer,
  HeartHandshake,
  Landmark,
  Leaf,
  Lightbulb,
  Megaphone,
  Monitor,
  Package,
  Paintbrush,
  Percent,
  Phone,
  Printer,
  Receipt,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  Tag,
  Thermometer,
  Truck,
  Users,
  Utensils,
  Wallet,
  WashingMachine,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { tr } from "@/i18n"
import type { ExpenseCategory } from "../api/expenseCategories"

/* Xarajat toifasining ko'rinishi: belgi va rang.

   Toifa serverda belgi NOMI (lucide) va rang KALITI bilan saqlanadi —
   bu yerda ular komponent va Tailwind sinflariga aylanadi. Sinflar to'liq
   yozilgan (dinamik yig'ilmagan): Tailwind faqat kodda ko'rgan sinfni
   chiqaradi.

   Ro'yxatda bo'lmagan toifa (eski qo'lda yozilgan nom) ham belgisiz
   qolmaydi: "teg" belgisi va nomdan barqaror tanlangan rang. */

/** Serverdagi `ICONS` bilan bir xil ro'yxat (app/shared/expense_categories.py). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  zap: Zap,
  flame: Flame,
  droplets: Droplets,
  wifi: Wifi,
  utensils: Utensils,
  "shopping-basket": ShoppingBasket,
  "washing-machine": WashingMachine,
  wrench: Wrench,
  car: Car,
  landmark: Landmark,
  megaphone: Megaphone,
  ellipsis: Ellipsis,
  tag: Tag,
  hammer: Hammer,
  paintbrush: Paintbrush,
  truck: Truck,
  phone: Phone,
  "shield-check": ShieldCheck,
  users: Users,
  gift: Gift,
  package: Package,
  bed: Bed,
  sparkles: Sparkles,
  receipt: Receipt,
  banknote: Banknote,
  "building-2": Building2,
  fuel: Fuel,
  lightbulb: Lightbulb,
  thermometer: Thermometer,
  printer: Printer,
  monitor: Monitor,
  scissors: Scissors,
  leaf: Leaf,
  bath: Bath,
  coins: Coins,
  percent: Percent,
  "heart-handshake": HeartHandshake,
  cable: Cable,
  "briefcase-business": BriefcaseBusiness,
  stethoscope: Stethoscope,
  bus: Bus,
  shirt: Shirt,
}

export const ICON_KEYS = Object.keys(CATEGORY_ICONS)
export const FALLBACK_ICON = "tag"

export interface ColorStyle {
  /** Yumshoq chip: fon + matn */
  chip: string
  /** Belgi kvadrati: fon + belgi rangi */
  icon: string
  /** To'q belgi kvadrati (tanlangan holat) */
  solid: string
  /** Kichik nuqta */
  dot: string
  /** Tanlangan karta chegarasi va foni */
  selected: string
  /** Rang tanlagichdagi doira */
  swatch: string
}

/** Serverdagi `COLORS` bilan bir xil kalitlar. */
export const CATEGORY_COLORS: Record<string, ColorStyle> = {
  gray: {
    chip: "bg-gray-100 text-gray-700",
    icon: "bg-gray-100 text-gray-600",
    solid: "bg-gray-600 text-white",
    dot: "bg-gray-400",
    selected: "border-gray-500 bg-gray-50 ring-gray-200",
    swatch: "bg-gray-400",
  },
  slate: {
    chip: "bg-slate-100 text-slate-700",
    icon: "bg-slate-100 text-slate-600",
    solid: "bg-slate-600 text-white",
    dot: "bg-slate-500",
    selected: "border-slate-500 bg-slate-50 ring-slate-200",
    swatch: "bg-slate-500",
  },
  red: {
    chip: "bg-red-50 text-red-700",
    icon: "bg-red-50 text-red-600",
    solid: "bg-red-500 text-white",
    dot: "bg-red-500",
    selected: "border-red-400 bg-red-50 ring-red-200",
    swatch: "bg-red-500",
  },
  orange: {
    chip: "bg-orange-50 text-orange-700",
    icon: "bg-orange-50 text-orange-600",
    solid: "bg-orange-500 text-white",
    dot: "bg-orange-500",
    selected: "border-orange-400 bg-orange-50 ring-orange-200",
    swatch: "bg-orange-500",
  },
  amber: {
    chip: "bg-amber-50 text-amber-700",
    icon: "bg-amber-50 text-amber-600",
    solid: "bg-amber-500 text-white",
    dot: "bg-amber-500",
    selected: "border-amber-400 bg-amber-50 ring-amber-200",
    swatch: "bg-amber-500",
  },
  lime: {
    chip: "bg-lime-50 text-lime-700",
    icon: "bg-lime-50 text-lime-600",
    solid: "bg-lime-600 text-white",
    dot: "bg-lime-500",
    selected: "border-lime-500 bg-lime-50 ring-lime-200",
    swatch: "bg-lime-500",
  },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700",
    icon: "bg-emerald-50 text-emerald-600",
    solid: "bg-emerald-600 text-white",
    dot: "bg-emerald-500",
    selected: "border-emerald-500 bg-emerald-50 ring-emerald-200",
    swatch: "bg-emerald-500",
  },
  teal: {
    chip: "bg-teal-50 text-teal-700",
    icon: "bg-teal-50 text-teal-600",
    solid: "bg-teal-600 text-white",
    dot: "bg-teal-500",
    selected: "border-teal-500 bg-teal-50 ring-teal-200",
    swatch: "bg-teal-500",
  },
  sky: {
    chip: "bg-sky-50 text-sky-700",
    icon: "bg-sky-50 text-sky-600",
    solid: "bg-sky-600 text-white",
    dot: "bg-sky-500",
    selected: "border-sky-500 bg-sky-50 ring-sky-200",
    swatch: "bg-sky-500",
  },
  indigo: {
    chip: "bg-indigo-50 text-indigo-700",
    icon: "bg-indigo-50 text-indigo-600",
    solid: "bg-indigo-600 text-white",
    dot: "bg-indigo-500",
    selected: "border-indigo-500 bg-indigo-50 ring-indigo-200",
    swatch: "bg-indigo-500",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700",
    icon: "bg-violet-50 text-violet-600",
    solid: "bg-violet-600 text-white",
    dot: "bg-violet-500",
    selected: "border-violet-500 bg-violet-50 ring-violet-200",
    swatch: "bg-violet-500",
  },
  fuchsia: {
    chip: "bg-fuchsia-50 text-fuchsia-700",
    icon: "bg-fuchsia-50 text-fuchsia-600",
    solid: "bg-fuchsia-600 text-white",
    dot: "bg-fuchsia-500",
    selected: "border-fuchsia-500 bg-fuchsia-50 ring-fuchsia-200",
    swatch: "bg-fuchsia-500",
  },
  rose: {
    chip: "bg-rose-50 text-rose-700",
    icon: "bg-rose-50 text-rose-600",
    solid: "bg-rose-500 text-white",
    dot: "bg-rose-500",
    selected: "border-rose-400 bg-rose-50 ring-rose-200",
    swatch: "bg-rose-500",
  },
}

export const COLOR_KEYS = Object.keys(CATEGORY_COLORS)
export const FALLBACK_COLOR = "gray"

/** Noma'lum toifa uchun rang tanlashda ishlatiladigan ranglar (kulrang emas —
 *  u "toifasiz" degan ma'noni beradi) */
const HASH_COLORS = COLOR_KEYS.filter((k) => k !== "gray" && k !== "slate")

/** Nom taqqoslash kaliti: bo'shliqlar yig'ilgan, harf kattaligi farqsiz —
 *  serverdagi `name_key` bilan bir xil. */
export const nameKey = (name?: string | null): string =>
  String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/** Nomdan barqaror rang: bir xil nom — har safar bir xil rang. */
export function hashColor(name?: string | null): string {
  const key = nameKey(name)
  if (!key) return FALLBACK_COLOR
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return HASH_COLORS[h % HASH_COLORS.length]
}

/** Ro'yxatdan nom bo'yicha toifa (arxivdagi ham) */
export function findCategory(
  name: string | null | undefined,
  categories: readonly ExpenseCategory[]
): ExpenseCategory | undefined {
  const key = nameKey(name)
  if (!key) return undefined
  return categories.find((c) => nameKey(c.name) === key)
}

export interface CategoryVisual {
  Icon: LucideIcon
  colorKey: string
  color: ColorStyle
  /** Ro'yxatda bor toifa (belgi va rang serverdan) */
  known: boolean
}

export const iconFor = (icon?: string | null): LucideIcon =>
  CATEGORY_ICONS[icon || ""] || CATEGORY_ICONS[FALLBACK_ICON]

export const colorFor = (color?: string | null): ColorStyle =>
  CATEGORY_COLORS[color || ""] || CATEGORY_COLORS[FALLBACK_COLOR]

/** Toifa yozuvining ko'rinishi (ro'yxatdagi qator uchun). */
export function visualOf(category: Pick<ExpenseCategory, "icon" | "color">): CategoryVisual {
  const colorKey = category.color && CATEGORY_COLORS[category.color] ? category.color : FALLBACK_COLOR
  return { Icon: iconFor(category.icon), colorKey, color: CATEGORY_COLORS[colorKey], known: true }
}

/** Xarajatdagi toifa NOMI bo'yicha ko'rinish: ro'yxatda bo'lsa — uniki,
 *  bo'lmasa teg belgisi va nomdan tanlangan rang. */
export function categoryVisual(
  name: string | null | undefined,
  categories: readonly ExpenseCategory[] = []
): CategoryVisual {
  const found = findCategory(name, categories)
  if (found) return visualOf(found)
  const colorKey = nameKey(name) ? hashColor(name) : FALLBACK_COLOR
  return {
    Icon: CATEGORY_ICONS[FALLBACK_ICON],
    colorKey,
    color: CATEGORY_COLORS[colorKey],
    known: false,
  }
}

/* --- Summa maydoni --------------------------------------------------- */

/** Kiritilayotgan summa: faqat raqamlar, minglik bo'shliq bilan
 *  ("150000" → "150 000"). Bo'sh yoki raqamsiz — bo'sh satr. */
export function formatAmountInput(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  if (!digits) return ""
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

/** Formatlangan satrdan son; bo'sh yoki 0 — null. */
export function parseAmountInput(raw: string): number | null {
  const digits = String(raw ?? "").replace(/\D/g, "")
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Tez qo'shish tugmalari (So'm) */
export const QUICK_AMOUNTS = [10_000, 50_000, 100_000, 500_000, 1_000_000] as const

/* --- Nom maslahatlari ----------------------------------------------- */

/* Standart toifalar nomi — serverdagi DEFAULT_CATEGORIES bilan bir xil.
   Ekranda tr(nom) bilan tarjima qilinadi; ro'yxat shu yerda tarjima
   tekshiruvi uchun turadi (i18n:keys). */
// i18n:keys
export const DEFAULT_CATEGORY_NAMES = [
  "Ish haqi",
  "Elektr energiyasi",
  "Gaz",
  "Suv",
  "Internet va aloqa",
  "Oziq-ovqat",
  "Xo'jalik buyumlari",
  "Kir yuvish",
  "Ta'mirlash",
  "Transport",
  "Soliqlar",
  "Reklama",
  "Boshqa",
] as const

/** Toifaga mos nom namunasi — maydon bo'sh turganda ko'rsatiladi. */
export function titlePlaceholder(categoryName?: string | null): string {
  switch (nameKey(categoryName)) {
    case "ish haqi":
      return tr("Masalan: Noyabr oyligi — Aziz")
    case "elektr energiyasi":
      return tr("Masalan: Oktyabr uchun elektr")
    case "gaz":
      return tr("Masalan: Oktyabr uchun gaz")
    case "suv":
      return tr("Masalan: Suv hisobi")
    case "internet va aloqa":
      return tr("Masalan: Internet, noyabr")
    case "oziq-ovqat":
      return tr("Masalan: Nonushta mahsulotlari")
    case "xo'jalik buyumlari":
      return tr("Masalan: Kir yuvish vositalari")
    case "kir yuvish":
      return tr("Masalan: Choyshablar kimyoviy tozalash")
    case "ta'mirlash":
      return tr("Masalan: 12-xona kran ta'miri")
    case "transport":
      return tr("Masalan: Mehmonni kutib olish, taksi")
    case "soliqlar":
      return tr("Masalan: Mulk solig'i")
    case "reklama":
      return tr("Masalan: Instagram reklamasi")
    default:
      return tr("Masalan: Kir yuvish vositalari")
  }
}
