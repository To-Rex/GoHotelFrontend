import {
  LayoutDashboard,
  Users,
  DoorOpen,
  CalendarCheck,
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
  type LucideIcon,
} from "lucide-react"

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
  { name: "Boshqaruv", href: "/", icon: LayoutDashboard },
  { name: "Bron qilish", href: "/booking", icon: CalendarDays },
  { name: "Bandlovlar", href: "/reservations", icon: CalendarCheck },
  { name: "Xonalar", href: "/rooms", icon: DoorOpen },
  { name: "Qavatlar", href: "/floors", icon: Layers },
  { name: "Mehmonlar", href: "/guests", icon: Users },
  { name: "Moliya", href: "/finance", icon: Wallet },
  { name: "Xarajatlar", href: "/expenses", icon: TrendingDown },
  { name: "Do'kon", href: "/shop", icon: Store },
  { name: "Kassa hisobotlari", href: "/cash-reports", icon: Banknote },
  { name: "Mening hisobotim", href: "/my-reports", icon: FileBarChart },
  { name: "Xabarlar", href: "/messages", icon: MessageSquare },
  { name: "Sozlamalar", href: "/settings", icon: Settings },
]

/** Boshqaruv (administratsiya) bo'limlari — ruxsati borlarga ko'rinadi */
export const MANAGEMENT_NAV_LINKS: NavLink[] = [
  { name: "Xona turlari", href: "/room-types", icon: BedDouble },
  { name: "Qulayliklar", href: "/amenities", icon: Sparkles },
  { name: "Xizmatlar", href: "/services", icon: ConciergeBell },
  { name: "Ombor", href: "/warehouse", icon: Warehouse },
  { name: "Xo'jalik ishlari", href: "/housekeeping", icon: ClipboardList },
  { name: "Xodimlar", href: "/employees", icon: UserCog },
  { name: "Smenalar", href: "/shifts", icon: History },
  { name: "Ruxsatnomalar", href: "/permissions", icon: ShieldCheck },
]
