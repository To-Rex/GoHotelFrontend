import { LogOut, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher"
import { HotelContextPicker } from "../components/HotelContextPicker"
import { tr, trc } from "@/i18n"

/* Sozlovchi hali mehmonxona tanlamagan — tizimning boshqa hech bir qismi
   unga ochilmaydi (server ham "Hotel context required" qaytaradi). Shu
   ekranda mehmonxona va filialni tanlaydi, keyin ilova o'sha mehmonxonada
   ochiladi. Keyinroq Navbar'dagi tugma orqali almashtiradi. */

export function ContextPickerScreen() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="flex min-h-dvh items-start justify-center bg-gradient-to-b from-violet-50/70 to-background px-4 py-8 sm:items-center">
      <div className="w-full max-w-[560px] rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-7">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/25">
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground">
              {tr("Salom, {{name}}!", { name: user?.first_name || "" })}
            </h1>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {tr("Sozlovchi sifatida istalgan mehmonxona va filialga o'tib, uni sozlay olasiz. Qaysi mehmonxonada ishlaysiz?")}
            </p>
          </div>
          <LanguageSwitcher />
        </div>

        <HotelContextPicker className="max-h-[60vh]" />

        <div className="mt-4 flex justify-center">
          <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={logout}>
            <LogOut className="mr-1.5 h-4 w-4" />
            {trc("login", "Chiqish")}
          </Button>
        </div>
      </div>
    </div>
  )
}
