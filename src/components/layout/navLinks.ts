import {
  LayoutDashboard,
  Users,
  DoorOpen,
  CalendarDays,
  Wallet,
  Settings,
  Layers,
  TrendingDown,
  Store,
  FileBarChart,
  Banknote,
  BedDouble,
  Sparkles,
  ConciergeBell,
  ClipboardList,
  UserCog,
  ShieldCheck,
  History,
  Warehouse,
  MessageSquare,
  MonitorSmartphone,
  AppWindow,
  BookOpenText,
  type LucideIcon,
} from "lucide-react"
import { applyNavOrder } from "@/features/settings/api/navOrder"
import { tr, trc } from "@/i18n"

/* Yon menyu sahifalari — YAGONA ro'yxat.

   Uni ikki joy o'qiydi: yon menyuning o'zi va sozlamalardagi "Menyu tartibi"
   kartasi. Ro'yxat bitta bo'lgani uchun yangi sahifa qo'shilsa, u ikkalasida
   ham darhol paydo bo'ladi — tartiblash oynasi menyudan ortda qolmaydi. */

export interface NavLink {
  name: string
  href: string
  icon: LucideIcon
  /** Jonli ko'rsatkich (masalan ochiq so'rovlar soni) — menyuda qo'shiladi */
  badge?: number
}

/** Asosiy ish sahifalari */
export const MAIN_NAV_LINKS: NavLink[] = [
  { name: tr("Boshqaruv"), href: "/", icon: LayoutDashboard },
  // Sahifa nomi ("Booking"/"Бронирование"), "Bron qilish" amali emas
  { name: trc("nav", "Bron qilish"), href: "/booking", icon: CalendarDays },
  { name: tr("Xonalar"), href: "/rooms", icon: DoorOpen },
  { name: tr("Qavatlar"), href: "/floors", icon: Layers },
  { name: tr("Mehmonlar"), href: "/guests", icon: Users },
  { name: tr("Moliya"), href: "/finance", icon: Wallet },
  { name: tr("Xarajatlar"), href: "/expenses", icon: TrendingDown },
  { name: tr("Do'kon"), href: "/shop", icon: Store },
  { name: tr("Kassa hisobotlari"), href: "/cash-reports", icon: Banknote },
  { name: tr("Mening hisobotim"), href: "/my-reports", icon: FileBarChart },
  { name: tr("Xabarlar"), href: "/messages", icon: MessageSquare },
  { name: tr("Taklif va shikoyatlar"), href: "/feedback", icon: BookOpenText },
  { name: tr("Qurilmalar"), href: "/devices", icon: MonitorSmartphone },
  { name: tr("Ilovalar"), href: "/apps", icon: AppWindow },
  { name: tr("Sozlamalar"), href: "/settings", icon: Settings },
]

/** Boshqaruv (administratsiya) bo'limlari — ruxsati borlarga ko'rinadi */
export const MANAGEMENT_NAV_LINKS: NavLink[] = [
  { name: tr("Xona turlari"), href: "/room-types", icon: BedDouble },
  { name: tr("Qulayliklar"), href: "/amenities", icon: Sparkles },
  { name: tr("Xizmatlar"), href: "/services", icon: ConciergeBell },
  { name: tr("Ombor"), href: "/warehouse", icon: Warehouse },
  { name: tr("Xo'jalik ishlari"), href: "/housekeeping", icon: ClipboardList },
  { name: tr("Xodimlar"), href: "/employees", icon: UserCog },
  { name: tr("Smenalar"), href: "/shifts", icon: History },
  { name: tr("Ruxsatnomalar"), href: "/permissions", icon: ShieldCheck },
]

/**
 * Yon menyudagi BIRINCHI ochiq sahifa.
 *
 * Tizimga kirgan xodim aynan shu sahifada turishi kerak — oldindan
 * belgilangan sahifada emas. Hisob yon menyuning o'zi bilan bir xil
 * qoidada: avval ko'rinadiganlar ajratiladi (ruxsat va smena cheklovi),
 * so'ng administrator belgilagan tartib qo'llanadi. Guruhlar alohida
 * saralanadi, chunki menyuda ular orasida "Administratsiya" sarlavhasi
 * turadi va boshqaruv bandi hech qachon asosiy sahifalardan tepaga
 * chiqmaydi.
 *
 * `visible` — menyudagi bilan bir xil filtr; `fallback` esa hech bir
 * sahifa ochiq bo'lmaganda (yoki ruxsatlar hali kelmaganda) qaytariladi.
 */
export const firstSidebarRoute = (
  visible: (href: string) => boolean,
  order: string[] | undefined,
  fallback: string
): string => {
  // Saralash menyu bilan BIR XIL funksiyada — ikkinchi nusxa yozilsa,
  // vaqt o'tib ikkalasi bir-biridan chetga chiqib ketardi
  const firstOf = (links: NavLink[]): string | undefined =>
    applyNavOrder(links.filter((l) => visible(l.href)), order)[0]?.href

  return firstOf(MAIN_NAV_LINKS) ?? firstOf(MANAGEMENT_NAV_LINKS) ?? fallback
}
