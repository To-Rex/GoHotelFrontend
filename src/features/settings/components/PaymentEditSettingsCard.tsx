import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  DEFAULT_PAYMENT_EDIT_SETTINGS,
  usePaymentEditSettings,
  useSavePaymentEditSettings,
} from "@/features/settings/api/paymentEditSettings"
import { tr } from "@/i18n"

/* Qabulxona to'lov turini tahrirlay oladimi.

   Administrator cheklovsiz, menejer oxirgi 2 kun — bular doim. Qabulxona
   esa shu sozlama bilan: yoqilsa o'sha 2 kunlik oyna va bitta to'lovga
   chegara (1–3 marta, standart 2). Har tahrir "necha puldan necha pulga,
   kim, qachon" bilan tarixda qoladi, to'lovda sariq belgi chiqadi. */

export const PaymentEditSettingsCard = () => {
  const { data: saved } = usePaymentEditSettings()
  const saveMutation = useSavePaymentEditSettings()
  const [enabled, setEnabled] = useState(DEFAULT_PAYMENT_EDIT_SETTINGS.reception_enabled)
  const [maxEdits, setMaxEdits] = useState(DEFAULT_PAYMENT_EDIT_SETTINGS.reception_max_edits)
  const [savedFlag, setSavedFlag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!saved || dirtyRef.current) return
    setEnabled(saved.reception_enabled)
    setMaxEdits(saved.reception_max_edits)
  }, [saved])

  const options = saved?.allowed_max_edits?.length
    ? saved.allowed_max_edits
    : DEFAULT_PAYMENT_EDIT_SETTINGS.allowed_max_edits || []

  const onSave = async () => {
    setError(null)
    setSavedFlag(false)
    try {
      await saveMutation.mutateAsync({ reception_enabled: enabled, reception_max_edits: maxEdits })
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
          {
            key: true,
            title: tr("Yoqiq"),
            text: tr("Qabulxona xodimi oxirgi 2 kunlik to'lovning turini tahrirlay oladi — bitta to'lovni ko'pi bilan quyida tanlangan marta. Har tahrir tarixda qoladi."),
          },
          {
            key: false,
            title: tr("O'chiq (standart)"),
            text: tr("Qabulxona to'lovni tahrirlay olmaydi. To'lov turini faqat administrator va menejer o'zgartiradi."),
          },
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
            {tr("Bitta to'lovni necha marta tahrirlash mumkin")}
          </p>
          <div className="flex flex-wrap gap-2">
            {options.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  dirtyRef.current = true
                  setMaxEdits(n)
                  setSavedFlag(false)
                }}
                aria-pressed={maxEdits === n}
                className={cn(
                  "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                  maxEdits === n
                    ? "border-primary-400 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {tr("{{n}} marta", { n })}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            {tr("Sanoqqa to'lovdagi barcha tahrirlar kiradi (kim qilganidan qat'i nazar). Chegaraga yetgan to'lovni faqat administrator yoki menejer tahrirlaydi.")}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr("Saqlash")}
        </Button>
        {savedFlag && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            {tr("Saqlandi")}
          </span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </>
  )
}
