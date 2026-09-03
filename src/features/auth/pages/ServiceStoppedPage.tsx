import { useLocation, useNavigate } from "react-router-dom"
import { LifeBuoy, PauseCircle, PowerOff, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  HOTEL_BLOCK_MESSAGE_KEY,
  hotelBlockReason,
  type HotelBlockReason,
} from "@/lib/hotelBlock"
import { useSeo } from "@/lib/seo"
import { cn } from "@/lib/utils"

/**
 * Mehmonxona xizmati to'xtatilgan holat.
 *
 * Ilgari bu holat hech qanday ko'rinishga ega emasdi: panel obyektni
 * to'xtatgach xodim kiraverardi, lekin har bir so'rov 403 bilan
 * qaytardi va ekran cheksiz skelet holatida qolardi — dastur buzilgandek
 * ko'rinardi. Endi sabab aniq aytiladi.
 *
 * Sessiya TOZALANMAYDI: xizmat tiklangach xodim shu yerdan "Qayta
 * tekshirish" bilan ishini davom ettiradi, qaytadan kirishi shart emas.
 */

interface LocationState {
  code?: string
  message?: string
}

const CONTENT: Record<
  HotelBlockReason,
  { title: string; icon: typeof PowerOff; tone: string; body: string }
> = {
  HOTEL_INACTIVE: {
    title: "Xizmat to'xtatilgan",
    icon: PowerOff,
    tone: "bg-red-50 text-red-600",
    body:
      "Mehmonxonangiz uchun tizim vaqtincha o'chirib qo'yilgan. Bu dasturdagi " +
      "nosozlik emas — barcha bronlar, to'lovlar va hisobotlar joyida turibdi " +
      "va xizmat tiklangan zahoti hammasi avvalgidek ochiladi.",
  },
  HOTEL_SUSPENDED: {
    title: "Xizmat vaqtincha to'xtatilgan",
    icon: PauseCircle,
    tone: "bg-amber-50 text-amber-600",
    body:
      "Mehmonxonangiz uchun tizim vaqtincha to'xtatib turilgan. Ma'lumotlaringiz " +
      "saqlanmoqda; xizmat tiklangach ishni shu yerdan davom ettirasiz.",
  },
  HOTEL_NOT_FOUND: {
    title: "Mehmonxona topilmadi",
    icon: PowerOff,
    tone: "bg-red-50 text-red-600",
    body:
      "Hisobingiz bog'langan mehmonxona tizimda topilmadi. Tizim ma'muriga " +
      "murojaat qiling.",
  },
}

export const ServiceStoppedPage = () => {
  useSeo({
    title: "Xizmat to'xtatilgan — GoHotel",
    description: "Mehmonxona uchun tizim vaqtincha to'xtatilgan.",
    canonicalPath: "/service-stopped",
    noindex: true,
  })

  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as LocationState

  /* Sabab ikki yo'l bilan keladi: kirish sahifasidan router state bilan,
     yoki ochiq sessiya to'xtaganda to'liq qayta yuklash orqali — o'shanda
     state saqlanmaydi va manzil qatoridagi kod ishlatiladi. */
  const codeFromQuery = new URLSearchParams(location.search).get("code")
  const info = CONTENT[hotelBlockReason(state.code, codeFromQuery)]
  const Icon = info.icon

  /* Serverning o'z matni (mehmonxona nomi bilan) — u qayta yuklashdan
     omon qolishi uchun sessiyaga yozilgan */
  const serverMessage =
    state.message || sessionStorage.getItem(HOTEL_BLOCK_MESSAGE_KEY) || ""

  const retry = () => {
    // Manzilga qaytamiz: xizmat tiklangan bo'lsa sahifa odatdagidek
    // ochiladi, tiklanmagan bo'lsa so'rov bizni shu yerga qaytaradi
    window.location.replace("/")
  }

  const signOut = () => {
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    sessionStorage.removeItem(HOTEL_BLOCK_MESSAGE_KEY)
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            info.tone
          )}
        >
          <Icon className="h-6 w-6" />
        </span>

        <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900">
          {info.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{info.body}</p>

        {serverMessage && (
          <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-700">
            {serverMessage}
          </p>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
          <LifeBuoy className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Xizmatni tiklash uchun tizim ma'muriga murojaat qiling. Tiklangach
            "Qayta tekshirish" tugmasi ishni davom ettiradi — qaytadan kirish
            shart emas.
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={retry}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Qayta tekshirish
          </Button>
          <Button type="button" variant="outline" onClick={signOut}>
            Chiqish
          </Button>
        </div>
      </div>
    </div>
  )
}
