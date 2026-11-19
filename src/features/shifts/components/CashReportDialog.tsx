import { useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import type { ShiftSession } from "../api/shifts"
import type { CountState } from "../lib/cashCount"
import { NonCashMethods } from "./NonCashMethods"

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString()
const stamp = (iso: string) => format(new Date(iso), "dd.MM HH:mm")

type Outcome = Exclude<CountState, "empty">

const OUTCOME_TONE: Record<Outcome, string> = {
  match: "bg-emerald-50 text-emerald-700",
  short: "bg-red-50 text-red-600",
  over: "bg-amber-50 text-amber-700",
}

/* Kassa topshirilgandan (yoki smena tugallangandan) keyingi hisobot.

   Eng muhimi tepada, bir qarashda: kassa mos keldimi, kamomadmi, ortiqchami.
   Pastda — kutilgan va sanalgan summa, kunlik kesim bo'yicha topshirilgan
   bo'lsa qaysi davr uchun ekani va kassada nima qolgani. Smena kunlik
   kesimda yopilgan bo'lsa — qaysi kunlar kesimda yopilgani. */
export function CashReportDialog({
  report,
  onClose,
}: {
  /** `null` — yopiq */
  report: ShiftSession | null
  onClose: () => void
}) {
  // Yopilish animatsiyasi davomida oxirgi hisobot ko'rinib turadi
  const [shown, setShown] = useState(report)
  if (report && report !== shown) setShown(report)
  const r = report ?? shown

  // Farq serverda hisoblangan (sanalgan − kutilgan)
  const diff = Number(r?.cash_diff || 0)
  const outcome: Outcome = Math.abs(diff) < 1 ? "match" : diff < 0 ? "short" : "over"
  // "Faqat oldingi smenalar" rejimida topshirilgan: oldingi smenalardan
  // qolgan pul; xodimning o'z tushumi kassada qolgan
  const prevShift = r?.prev_shift_cash === true
  // Kunlik kesim bo'yicha topshirilgan — sessiya kesim momentida yopilgan
  const byCut = !prevShift && !!(r?.handed_at && r.started_at && r.ended_at)
  const carried = Number(r?.carried_cash || 0)
  // Smena kunlik kesimda yopilgan ("faqat yopilgan kunlar" rejimi): yopilgan
  // kunlar alohida sessiya, hisobotning o'zi — kesimdan keyingi qism
  const closedDays = r?.closed_days

  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[440px]">
        <DialogHeader className="min-w-0 border-b border-gray-100 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2.5 pr-8">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-[18px] w-[18px]" />
            </span>
            {tr("Kassa hisoboti")}
          </DialogTitle>
        </DialogHeader>

        {r && (
          <div className="min-w-0 space-y-3 px-5 py-4">
            {/* Natija — bir qarashda */}
            <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3", OUTCOME_TONE[outcome])}>
              {outcome === "match" ? (
                <CheckCircle2 className="h-7 w-7 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-7 w-7 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-base font-bold leading-snug">
                  {outcome === "match"
                    ? tr("Kassa mos keldi")
                    : outcome === "short"
                      ? tr("Kamomad: {{v}} so'm", { v: fmt(Math.abs(diff)) })
                      : tr("Ortiqcha: {{v}} so'm", { v: fmt(Math.abs(diff)) })}
                </p>
                <p className="text-xs leading-relaxed opacity-80">
                  {outcome === "match"
                    ? tr("Sanalgan summa kutilgan summaga teng.")
                    : tr("Farq sizning hisobingizga yozildi.")}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
              {/* Kunlik kesim bo'yicha topshirildi — qaysi davr uchun */}
              {byCut && r.started_at && r.ended_at && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3.5 py-2.5">
                  <dt className="text-gray-500">{tr("Kunlik kesim bo'yicha")}</dt>
                  <dd className="font-semibold tabular-nums text-sky-700">
                    {stamp(r.started_at)} → {stamp(r.ended_at)}
                  </dd>
                </div>
              )}
              {/* Oldingi smenalar puli topshirildi */}
              {prevShift && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3.5 py-2.5">
                  <dt className="text-gray-500">{tr("Topshirildi")}</dt>
                  <dd className="font-semibold text-sky-700">{tr("Oldingi smenalar puli")}</dd>
                </div>
              )}
              {/* Smena kunlik kesimda yopildi — qaysi kunlar */}
              {closedDays?.started_at && closedDays.ended_at && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3.5 py-2.5">
                  <dt className="text-gray-500">{tr("Kunlik kesimda yopildi")}</dt>
                  <dd className="font-semibold tabular-nums text-sky-700">
                    {stamp(closedDays.started_at)} → {stamp(closedDays.ended_at)}
                  </dd>
                </div>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3.5 py-2.5">
                <dt className="text-gray-500">{tr("Kutilgan summa")}</dt>
                <dd className="font-semibold tabular-nums text-gray-900">
                  {tr("{{expected_cash}} so'm", { expected_cash: fmt(r.expected_cash) })}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3.5 py-2.5">
                <dt className="text-gray-500">{tr("Siz sanagan summa")}</dt>
                <dd className="font-bold tabular-nums text-gray-900">
                  {tr("{{counted_cash}} so'm", { counted_cash: fmt(r.counted_cash) })}
                </dd>
              </div>
              {(byCut || prevShift) && carried > 0 && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3.5 py-2.5">
                  <dt className="text-gray-500">{tr("Kassada qoldirildi")}</dt>
                  <dd className="font-semibold tabular-nums text-amber-700">
                    {tr("{{v}} so'm", { v: fmt(carried) })}
                  </dd>
                </div>
              )}
            </dl>

            {/* Smenada qabul qilingan naqdsiz to'lovlar — kassaga kirmaydi */}
            {/* Oldingi smenalar pulida to'lov usullari yo'q — u qabul qilingan naqd */}
            {r.methods && !prevShift && <NonCashMethods rows={r.methods} compact className="px-1" />}

            {byCut && (
              <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-700">
                <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                {tr("Kesimdan keyingi tushum kassada qoldi — u yangi kassa hisobida davom etadi.")}
              </p>
            )}
            {prevShift && (
              <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-700">
                <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                {tr("Smenangizdagi tushum kassada qoldi — smena tugagach keyingi xodimga o'tadi.")}
              </p>
            )}
            {closedDays && (
              <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-700">
                <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                {tr("Smena kunlik kesim bo'yicha yopildi. Kassadagi pul keyingi xodimga o'tadi; bugungi tushum kunlik kesimdan keyin topshiriladi.")}
              </p>
            )}
            {/* Tasdiq rejimi: sessiya hali yopilmagan — tasdiq kutadi */}
            {r.pending_approval && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                <ShieldCheck className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                {tr("Admin yoki menejer tasdig'i kutilmoqda — tasdiqlanguncha ishlab bo'lmaydi.")}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-gray-100 bg-gray-50/60 px-5 py-3.5">
          <Button onClick={onClose} className="w-full sm:w-auto">
            {tr("Yopish")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
