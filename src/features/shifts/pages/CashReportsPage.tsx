import { Banknote } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { ShiftPanel } from "../components/ShiftPanel"
import { AcceptedShiftReport } from "../components/AcceptedShiftReport"

/* Kassa hisobotlari — smena va kassa bilan ishlashning yagona joyi.

   Ilgari bu panellar shaxsiy hisobot sahifasining tepasida turardi va o'sha
   sahifaning asosiy mazmunini pastga surib yuborardi. Ular boshqa-boshqa
   savolga javob beradi: bu yerda "kassada qancha pul bor va uni kim
   topshiradi", "Mening hisobotim"da esa "men bugun qancha ish qildim".

   Smena ochish, davom ettirish, kassani topshirish, smenani tugallash, keyingi
   xodimning parol bilan qabul qilishi va qabul qilingan smena hisoboti —
   hammasi shu yerda. */
export const CashReportsPage = () => {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/25">
          <Banknote className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Kassa hisobotlari</h1>
          <p className="text-sm text-muted-foreground">
            {user?.first_name} {user?.last_name} — smena va kassa harakati
          </p>
        </div>
      </div>

      {/* Smena va kassa paneli (faqat kassali rejimda ko'rinadi) */}
      <ShiftPanel />

      {/* Qabul qilingan smena hisoboti — avvalgi xodim hisobida,
          joriy xodim summalariga qo'shilmaydi */}
      <AcceptedShiftReport />
    </div>
  )
}
