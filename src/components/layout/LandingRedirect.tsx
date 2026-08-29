import { Navigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { usePermissions } from "@/lib/permissions"
import { useAuthStore } from "@/store/auth"
import {
  useShiftState,
  shiftRestriction,
  isCashStaff,
  allowedRoutesFor,
} from "@/features/shifts/api/shifts"
import { useNavOrder } from "@/features/settings/api/navOrder"
import { firstSidebarRoute } from "./navLinks"

/** Kirish darvozasi manzili — App.tsx dagi marshrut bilan bir xil */
export const LANDING_GATE_ROUTE = "/start"

/* Tizimga kirgandan keyingi sahifa.

   Oldindan belgilangan sahifa yo'q: xodim yon menyudagi BIRINCHI ochiq
   sahifada turadi. Ya'ni administrator menyu tartibini o'zgartirsa,
   xodimlarning kirish sahifasi ham o'zi bilan siljiydi.

   Tartib serverdan kelguncha yo'naltirilmaydi — aks holda xodim standart
   tartibdagi sahifaga tushib qolar, keyin esa u yerdan qaytarilmasdi
   (o'sha sahifaga ruxsati bor-ku). */
export const LandingRedirect = () => {
  const user = useAuthStore((s) => s.user)
  const { canRoute, firstAllowedRoute } = usePermissions()
  const { data: shiftState, isLoading: shiftLoading } = useShiftState(
    !!user && isCashStaff(user)
  )
  const { data: navOrder, isLoading: navLoading } = useNavOrder()

  if (navLoading || shiftLoading) {
    return (
      <div className="flex h-full items-center justify-center py-20 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  // Menyudagi bilan bir xil filtr: ruxsat va smena cheklovi
  const restriction = shiftRestriction(user, shiftState)
  const openRoutes = allowedRoutesFor(restriction)
  const visible = (href: string) =>
    canRoute(href) && (!restriction || openRoutes.includes(href))

  const target = firstSidebarRoute(visible, navOrder?.order, firstAllowedRoute())

  // Hech bir sahifa ochiq bo'lmasa yo'naltirmaymiz: yo'naltirilgan manzil ham
  // yopiq bo'lsa, u yerdan yana shu darvozaga qaytarilib aylanib qolardi
  if (!canRoute(target)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-center text-gray-500">
        <p className="text-sm font-medium">Sizga hech qanday sahifa ochilmagan</p>
        <p className="text-xs text-gray-400">
          Administratordan ruxsat so'rang.
        </p>
      </div>
    )
  }

  return <Navigate to={target} replace />
}
