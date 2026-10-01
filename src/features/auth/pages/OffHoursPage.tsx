import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Clock, LifeBuoy, Loader2, LogOut, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { apiErrorMessage } from "@/lib/apiError"
import { useSeo } from "@/lib/seo"
import {
  canAutoReturn,
  clearWorkHoursBlockMessage,
  isWorkHoursBlocked,
  markAutoReturn,
  readAutoReturnAt,
  readWorkHoursBlockMessage,
  workHoursRange,
} from "@/lib/workHoursBlock"
import { useAuthStore, type User } from "@/store/auth"
import { tr, trc } from "@/i18n"

/**
 * Ish vaqtidan tashqarida ko'rinadigan sahifa.
 *
 * Mehmonxonada "Ish vaqti nazorati" yoqilgan bo'lsa, server ish vaqti
 * tugagan (yoki hali boshlanmagan) xodimning so'rovlarini 403
 * `OUTSIDE_WORK_HOURS` bilan to'xtatadi. Xodim shu sahifaga keladi:
 * kirishning o'zi ruxsat etilgan, faqat ish qilib bo'lmaydi.
 *
 * Sessiya TOZALANMAYDI: sahifa har daqiqada `/auth/me` ni qayta so'raydi
 * va ish vaqti boshlangach xodimni o'zi ichkariga qaytaradi — qaytadan
 * kirish shart emas. "Chiqish" esa haqiqatan tizimdan chiqaradi.
 *
 * Kassasi ochiq resepshn xodimi bu yerga tushmaydi: server uni to'smaydi,
 * u avvalgidek "Davom etish" bilan ishlaydi.
 */

/** Qayta tekshirish oralig'i. */
const RECHECK_INTERVAL_MS = 60_000

interface LocationState {
  message?: string
}

export const OffHoursPage = () => {
  useSeo({
    title: tr("Ish vaqtingiz emas — GoHotel"),
    description: tr("Tizimdan faqat ish vaqtingizda foydalanishingiz mumkin."),
    canonicalPath: "/off-hours",
    noindex: true,
  })

  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as LocationState
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)

  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sahifa yopilgach kelgan javob holatni o'zgartirmasin
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /* Server hali ham to'syaptimi. `/auth/me` ish vaqti tashqarisida ham
     ochiq va xuddi shu qoida bilan hisoblangan `work_hours_blocked`
     belgisini qaytaradi. To'siq olingan bo'lsa — ichkariga qaytamiz. */
  const check = useCallback(
    async (manual: boolean) => {
      if (manual) {
        setChecking(true)
        setNotice(null)
        setError(null)
      }
      try {
        const { data } = await api.get<User>("/auth/me")
        if (!alive.current) return
        // Jadval o'zgargan bo'lishi mumkin — ekrandagi vaqt yangilansin
        setUser(data)
        if (!isWorkHoursBlocked(data)) {
          const now = Date.now()
          /* Yaqinda avtomatik qaytgan edik va darhol shu yerga qaytib
             keldik — sahifa qayta-qayta yuklanib qolmasligi uchun keyingi
             tekshiruvni kutamiz. Tugma bu cheklovga bo'ysunmaydi. */
          if (!manual && !canAutoReturn(readAutoReturnAt(), now)) return
          markAutoReturn(now)
          clearWorkHoursBlockMessage()
          navigate("/start", { replace: true })
          return
        }
        if (manual) {
          setNotice(tr("Tekshirildi — hozircha hali ish vaqtingiz emas."))
        }
      } catch (e) {
        // Avtomatik tekshiruv xatosi ekranni bezovta qilmaydi; 401 ni
        // api interceptor o'zi hal qiladi
        if (alive.current && manual) setError(apiErrorMessage(e))
      } finally {
        if (alive.current && manual) setChecking(false)
      }
    },
    [navigate, setUser]
  )

  // Ochilganda, har daqiqada va oyna qayta ko'ringanda tekshiriladi
  useEffect(() => {
    if (!isAuthenticated) return
    void check(false)
    const id = window.setInterval(() => void check(false), RECHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(false)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [isAuthenticated, check])

  const signOut = () => {
    clearWorkHoursBlockMessage()
    // Tokenlar ham, saqlangan sessiya ham tozalanadi
    logout()
    navigate("/login", { replace: true })
  }

  // Sessiya yo'q — bu sahifa kerak emas
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const range = workHoursRange(user)
  /* Serverning o'z matni (ish vaqti bilan) — jadval noma'lum bo'lsagina
     ko'rsatiladi; jadval ma'lum bo'lsa, u tarjima qilingan holda yuqorida */
  const serverMessage = range
    ? ""
    : state.message || readWorkHoursBlockMessage()
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ")

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Clock className="h-6 w-6" />
        </span>

        <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900">
          {tr("Ish vaqtingiz emas")}
        </h1>
        {fullName && (
          <p className="mt-0.5 text-xs text-zinc-500">
            {fullName}
            {user?.hotel_name ? ` · ${user.hotel_name}` : ""}
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {tr("Mehmonxonada ish vaqti nazorati yoqilgan: tizimdan faqat o'z ish vaqtingizda foydalana olasiz. Ma'lumotlaringiz joyida — ish vaqti boshlanganda sahifa o'zi ochiladi, qaytadan kirish shart emas.")}
        </p>

        {range && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-xs font-medium text-amber-800">
              {tr("Ish vaqtingiz")}
            </span>
            <span className="text-lg font-bold tabular-nums text-amber-900">
              {range}
            </span>
          </div>
        )}

        {serverMessage && (
          <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-700">
            {serverMessage}
          </p>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
          <LifeBuoy className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            {tr("Ish vaqtidan tashqari ishlashingiz kerak bo'lsa, administratorga murojaat qiling — u sizga ruxsat bera oladi.")}
          </span>
        </div>

        {notice && (
          <p className="mt-3 text-xs font-medium text-amber-700">{notice}</p>
        )}
        {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void check(true)} disabled={checking}>
            {checking ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            {tr("Qayta tekshirish")}
          </Button>
          <Button type="button" variant="outline" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            {trc("login", "Chiqish")}
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-zinc-400">
          {tr("Sahifa har daqiqada o'zi tekshiradi.")}
        </p>
      </div>
    </div>
  )
}
