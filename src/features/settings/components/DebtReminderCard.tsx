import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  DEFAULT_DEBT_SETTINGS,
  useDebtSettings,
  useSaveDebtSettings,
} from "@/features/settings/api/debtSettings"
import { tr } from "@/i18n"

/* Qarz eslatmalari — qanchalik tez-tez eslatilsin.

   Davriy ro'yxat (push + veb eslatmasi) tanlangan oraliqda, faqat kunduzi.
   "Qarz bilan chiqib ketdi", "bugun chiqadi, qarzi bor" va "qarz bilan
   chiqarildi" xabarlari oraliqqa bog'liq emas — darhol ketadi. */

const intervalLabel = (minutes: number) =>
  minutes < 60
    ? tr("{{m}} daqiqa", { m: minutes })
    : tr("{{h}} soat", { h: minutes / 60 })

export const DebtReminderCard = () => {
  const { data: saved } = useDebtSettings()
  const saveMutation = useSaveDebtSettings()
  const [enabled, setEnabled] = useState(DEFAULT_DEBT_SETTINGS.enabled)
  const [interval, setIntervalMinutes] = useState(DEFAULT_DEBT_SETTINGS.interval_minutes)
  const [savedFlag, setSavedFlag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!saved || dirtyRef.current) return
    setEnabled(saved.enabled)
    setIntervalMinutes(saved.interval_minutes)
  }, [saved])

  const options = saved?.allowed_intervals?.length
    ? saved.allowed_intervals
    : DEFAULT_DEBT_SETTINGS.allowed_intervals || []

  const onSave = async () => {
    setError(null)
    setSavedFlag(false)
    try {
      await saveMutation.mutateAsync({ enabled, interval_minutes: interval })
      dirtyRef.current = false
      setSavedFlag(true)
      window.setTimeout(() => setSavedFlag(false), 3000)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {[
          { key: true, title: tr("Yoqiq (tavsiya etiladi)"), text: tr("Administrator va to'lov qabul qiluvchi xodimlarga qarzdorlar ro'yxati telefon va saytda eslatib turiladi.") },
          { key: false, title: tr("O'chiq"), text: tr("Davriy eslatma yuborilmaydi. Qarz baribir hamma joyda ko'rinadi, chiqishda tekshiriladi.") },
        ].map((option) => (
          <button
            key={String(option.key)}
            type="button"
            onClick={() => {
              dirtyRef.current = true
              setEnabled(option.key)
              setSavedFlag(false)
            }}
            className={cn(
              "relative rounded-xl border p-3.5 text-left transition-all",
              enabled === option.key
                ? "border-primary-400 bg-primary-50/40 ring-2 ring-primary-400/30"
                : "border-gray-200 hover:border-primary-200 hover:bg-gray-50"
            )}
          >
            {enabled === option.key && (
              <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary-600" />
            )}
            <p className="pr-6 text-sm font-semibold text-gray-900">{option.title}</p>
            <p className="mt-1 text-xs leading-snug text-gray-600">{option.text}</p>
          </button>
        ))}
      </div>

      {enabled && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {tr("Qanchalik tez-tez")}
          </p>
          <div className="flex flex-wrap gap-2">
            {options.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => {
                  dirtyRef.current = true
                  setIntervalMinutes(minutes)
                  setSavedFlag(false)
                }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  interval === minutes
                    ? "border-primary-400 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {tr("har {{v}}", { v: intervalLabel(minutes) })}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-gray-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {tr("Qanday ishlaydi")}
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-gray-600">
          <li>{tr("Qarzdor mehmonni chiqarishda tizim to'xtatadi: avval to'lov olinadi yoki sababi yozilib, qarz bilan chiqariladi (kim, qachon — saqlanadi).")}</li>
          <li>{tr("Mehmon qarz bilan chiqib ketsa, chiqish kuni qarzi bo'lsa va qarz bilan chiqarilganda — darhol xabar keladi.")}</li>
          <li>{tr("Davriy ro'yxat faqat 08:00 dan 22:00 gacha yuboriladi; har qarzning sababi (xona, jarima, do'kon...) ko'rsatiladi.")}</li>
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <Button onClick={onSave} disabled={saveMutation.isPending} className="min-w-[120px]">
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr("Saqlash")}
        </Button>
        {savedFlag && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />{" "}{tr("Saqlandi")}
          </span>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </>
  )
}
