import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { CheckCircle2, Loader2, PackageOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatAmountInput } from "@/features/expenses/lib/categoryStyle"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import { useUpdateBatchCost, type MissingCostBatch } from "../api/shopProfit"
import { marginText, orderMissing, toneOf, TONE_TEXT, unitPreview } from "../lib/shopProfit"

/* Tannarxi kiritilmagan partiyalar — tannarxni shu yerning o'zida kiritish.

   Kirimda tannarx ixtiyoriy bo'lgani uchun ko'p partiyalar usiz kiritilgan
   bo'lishi mumkin; ularning sotuvi foydaga kirmaydi. Bu yerda tannarx
   kiritilsa o'tgan sotuvlar foydasi ham darhol aniqlashadi (hisobot
   sotuvni o'z partiyasi narxi bilan hisoblaydi). Faqat do'kon
   boshqaruvchisiga (server ham tekshiradi). Sotuv narxi, miqdor va qoldiq
   o'zgarmaydi. Bo'sh qoldirilgan qator tegilmaydi. */

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString()

/** Tannarx maydoni: 0 ham to'g'ri qiymat (bepul olingan mahsulot) */
const parseCost = (raw: string): number | null => {
  const digits = String(raw ?? "").replace(/\D/g, "")
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

export function BatchCostDialog({
  open,
  onClose,
  batches,
}: {
  open: boolean
  onClose: () => void
  batches: MissingCostBatch[]
}) {
  const update = useUpdateBatchCost()
  const ordered = useMemo(() => orderMissing(batches), [batches])
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    if (!open) return
    setValues({})
    setError(null)
    setSavedCount(0)
  }, [open])

  const filled = ordered.filter((b) => parseCost(values[b.batch_id] || "") !== null)

  const save = async () => {
    if (filled.length === 0) return
    setSaving(true)
    setError(null)
    let done = 0
    try {
      // Ketma-ket: bitta xato qolganlarini to'xtatadi, saqlanganlari saqlangan
      for (const b of filled) {
        await update.mutateAsync({ batchId: b.batch_id, costPrice: parseCost(values[b.batch_id] || "") })
        done += 1
        setValues((v) => {
          const next = { ...v }
          delete next[b.batch_id]
          return next
        })
      }
      setSavedCount(done)
      onClose()
    } catch (e) {
      setSavedCount(done)
      setError(apiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[640px]">
        <DialogHeader className="min-w-0 border-b border-gray-100 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <PackageOpen className="h-4 w-4" />
            </span>
            {tr("Tannarxni kiritish")}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {tr("Bu partiyalar kirimida tannarx yozilmagan — ularning sotuvi foydaga kirmaydi. Bir donaning olish narxini kiriting: o'tgan sotuvlar foydasi ham darhol hisoblanadi. Sotuv narxi va qoldiq o'zgarmaydi.")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 max-h-[60vh] space-y-2 overflow-y-auto px-5 py-4">
          {ordered.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {tr("Barcha partiyalarda tannarx bor")}
            </p>
          ) : (
            ordered.map((b) => {
              const raw = values[b.batch_id] || ""
              const cost = parseCost(raw)
              const preview = unitPreview(cost, b.sale_price)
              return (
                <div
                  key={b.batch_id}
                  className={cn(
                    "grid min-w-0 grid-cols-1 gap-2 rounded-xl border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-center",
                    cost !== null ? "border-primary-200 bg-primary-50/30" : "border-gray-200"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {b.emoji ? `${b.emoji} ` : ""}
                      {b.product_name}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-gray-500">
                      {[
                        b.created_at ? tr("kirim {{date}}", { date: format(new Date(b.created_at), "dd.MM.yyyy") }) : null,
                        tr("{{qty}} dona, qoldi {{left}}", { qty: b.quantity, left: b.remaining }),
                        tr("sotuv narxi {{price}}", { price: fmt(b.sale_price) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {b.sold_in_period > 0 && (
                      <p className="mt-0.5 text-[11px] font-medium leading-4 text-amber-700">
                        {tr("Shu davrda {{qty}} dona sotilgan — foydaga kirmagan", { qty: b.sold_in_period })}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={tr("{{name}} — bir dona tannarxi", { name: b.product_name })}
                        value={raw}
                        disabled={saving}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [b.batch_id]: formatAmountInput(e.target.value) }))
                        }
                        placeholder={tr("Tannarx")}
                        className={cn(
                          "h-9 w-full rounded-lg border bg-white pr-12 pl-2.5 text-sm font-semibold tabular-nums outline-none transition-colors",
                          "placeholder:font-normal placeholder:text-gray-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-100",
                          cost !== null ? "border-primary-300" : "border-gray-200"
                        )}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] text-gray-400">
                        {tr("So'm")}
                      </span>
                    </div>
                    {preview && (
                      <p className={cn("mt-1 text-[11px] font-medium tabular-nums", TONE_TEXT[toneOf(preview.profit)])}>
                        {tr("bir donadan {{profit}} · marja {{margin}}", {
                          profit: fmt(preview.profit),
                          margin: marginText(preview.margin),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {savedCount > 0
                ? tr("{{count}} ta saqlandi, keyingisi saqlanmadi: {{error}}", { count: savedCount, error })
                : error}
            </p>
          )}
        </div>

        <DialogFooter className="min-w-0 flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            {filled.length > 0
              ? tr("{{count}} ta partiyaga tannarx kiritildi", { count: filled.length })
              : tr("Kerakli partiyalarga tannarx yozing")}
          </p>
          <div className="flex flex-shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {tr("Yopish")}
            </Button>
            <Button onClick={save} disabled={saving || filled.length === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Saqlash")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
