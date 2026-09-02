import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Ban, Check, Copy, MonitorSmartphone, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSeo } from "@/lib/seo"
import { describeDevice, getDeviceId } from "@/lib/deviceId"
import { cn } from "@/lib/utils"

/**
 * Qurilma tasdiqlanmagan xodim uchun sahifa.
 *
 * Ilgari bu holat login sahifasidagi qizil xato qatori edi: xodim parolni
 * to'g'ri kiritgan bo'lsa ham nima bo'layotganini tushunmay, qayta-qayta
 * urinardi. Endi alohida sahifa — nima bo'lgani, nima qilish kerakligi va
 * administratorga aytiladigan qurilma raqami bir joyda.
 *
 * Sahifa ochiq (kirishdan tashqarida): bu yerga kelgan odamning hali
 * sessiyasi yo'q.
 */

type Reason = "DEVICE_PENDING" | "DEVICE_BLOCKED" | "DEVICE_UNKNOWN"

interface LocationState {
  code?: Reason
  message?: string
}

const CONTENT: Record<
  Reason,
  { title: string; icon: typeof MonitorSmartphone; tone: string; body: string }
> = {
  DEVICE_PENDING: {
    title: "Qurilma tasdiqlanmagan",
    icon: MonitorSmartphone,
    tone: "bg-amber-50 text-amber-600",
    body:
      "Login va parolingiz to'g'ri. Lekin bu qurilmadan birinchi marta kirilyapti, " +
      "shuning uchun administrator uni tasdiqlashi kerak. So'rovingiz yuborildi.",
  },
  DEVICE_BLOCKED: {
    title: "Bu qurilmadan kirish taqiqlangan",
    icon: Ban,
    tone: "bg-red-50 text-red-600",
    body:
      "Administrator bu qurilmani taqiqlagan. Agar bu xato bo'lsa, unga murojaat qiling.",
  },
  DEVICE_UNKNOWN: {
    title: "Qurilma aniqlanmadi",
    icon: ShieldAlert,
    tone: "bg-red-50 text-red-600",
    body:
      "Brauzer ma'lumot saqlashiga ruxsat bering. Shaxsiy (yashirin) rejimda " +
      "qurilmani aniqlab bo'lmaydi — oddiy oynada oching.",
  },
}

export const DevicePendingPage = () => {
  useSeo({
    title: "Qurilma tasdig'i — GoHotel",
    description: "Bu qurilmadan kirish uchun administrator tasdig'i kerak.",
    canonicalPath: "/device-pending",
  })

  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as LocationState
  /* Sabab ikki yo'l bilan kelishi mumkin: login sahifasidan router state
     bilan, yoki sessiya to'xtatilganda to'liq qayta yuklash orqali —
     o'shanda state saqlanmaydi, shuning uchun manzil qatoridan olinadi. */
  const codeFromQuery = new URLSearchParams(location.search).get("code")
  const reason: Reason =
    state.code ||
    (codeFromQuery === "DEVICE_BLOCKED" ||
    codeFromQuery === "DEVICE_UNKNOWN" ||
    codeFromQuery === "DEVICE_PENDING"
      ? codeFromQuery
      : "DEVICE_PENDING")
  const info = CONTENT[reason]
  const Icon = info.icon

  const deviceId = getDeviceId()
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(deviceId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Xavfsiz bo'lmagan ulanishda clipboard ishlamaydi — raqam baribir
         ekranda turibdi, uni qo'lda ko'chirish mumkin */
    }
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

        {reason === "DEVICE_PENDING" && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Administrator "Qurilmalar" sahifasida tasdiqlagach, shu yerdan
            odatdagidek kira olasiz.
          </p>
        )}

        {/* Administratorga aytiladigan raqam — u ro'yxatda aynan shuni
            ko'radi va qaysi qurilma ekanini adashmasdan topadi */}
        {deviceId && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Qurilma raqami
            </p>
            <p className="mt-1 break-all font-mono text-xs text-zinc-700">
              {deviceId}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              {describeDevice(navigator.userAgent)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-8 text-xs"
              onClick={copyId}
            >
              {copied ? (
                <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="mr-1 h-3.5 w-3.5" />
              )}
              {copied ? "Nusxalandi" : "Nusxalash"}
            </Button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => navigate("/login")}>
            Qayta urinish
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/login">Kirish sahifasi</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
