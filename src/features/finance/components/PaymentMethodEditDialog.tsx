import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Loader2, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/apiError"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/paymentMethods"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import type { PaymentRecord } from "@/types/api"
import { useUpdatePaymentMethod } from "../api/finance"
import { parsePartialAmount } from "../lib/paymentEdit"

/* To'lov turini tahrirlash oynasi — BUTUN summa yoki QISMAN.

   Qisman: summaning bir qismi yangi to'lov qatori bo'lib boshqa turga
   o'tadi (masalan 100 000 naqd → 50 000 naqd + 50 000 online), qolgani
   avvalgi turda qoladi. Summa yig'indisi o'zgarmaydi. Har tahrir
   `method_changes` tarixida (nimadan nimaga, qancha, kim, qachon, izoh)
   va audit jurnalida qoladi. Huquq va 2 kunlik menejer oynasi serverda
   qayta tekshiriladi. */

const fmt = (n: number) => Number(n || 0).toLocaleString()

export function PaymentMethodEditDialog({
  payment,
  onClose,
}: {
  payment: PaymentRecord | null
  onClose: () => void
}) {
  const mutation = useUpdatePaymentMethod()
  const [method, setMethod] = useState("")
  const [note, setNote] = useState("")
  const [partial, setPartial] = useState(false)
  const [amountStr, setAmountStr] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!payment) return
    setMethod(payment.payment_method)
    setNote("")
    setPartial(false)
    setAmountStr("")
    setError(null)
  }, [payment])

  if (!payment) return null

  const total = Number(payment.amount || 0)
  const changed = method !== "" && method !== payment.payment_method
  const parsed = partial && total > 0 ? parsePartialAmount(total, amountStr) : { amount: null, error: null }
  const partialReady = !partial || parsed.error === null
  const canSave = changed && partialReady && !mutation.isPending
  const history = payment.method_changes ?? []

  const save = async () => {
    if (!canSave) return
    setError(null)
    try {
      await mutation.mutateAsync({
        id: payment.id,
        payment_method: method,
        note: note.trim() || undefined,
        amount: partial && parsed.amount !== null ? parsed.amount : undefined,
      })
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary-600" />
            {tr("To'lov turini tahrirlash")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm">
            <div>
              <p className="font-semibold text-gray-900">{payment.payment_number}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                {[payment.payment_date, payment.notes || payment.reference]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <p className="font-bold tabular-nums text-gray-900">
              {tr("{{amount}} So'm", { amount: fmt(total) })}
            </p>
          </div>

          <p className="text-xs leading-relaxed text-gray-500">
            {tr("Har tahrir (nimadan nimaga, qancha, kim, qachon) saqlanadi — hech narsa o'chirilmaydi.")}
          </p>

          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-600">
              {tr("Yangi to'lov turi")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                    method === m.value
                      ? "border-primary-400 bg-primary-50/50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {total > 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={partial}
                  onCheckedChange={(v) => {
                    setPartial(v === true)
                    if (v !== true) setAmountStr("")
                  }}
                />
                {tr("Qisman o'tkazish")}
              </label>
              {partial && (
                <div className="mt-2 space-y-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={total}
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder={tr("Masalan: 50 000")}
                    autoFocus
                  />
                  {parsed.error === "range" ? (
                    <p className="text-[11px] font-medium text-red-600">
                      {tr("Summa to'lov summasidan kichik bo'lishi kerak")}
                    </p>
                  ) : partial && parsed.amount !== null ? (
                    <p className="text-[11px] leading-relaxed text-gray-500">
                      {tr("Qoladi: {{amount}} So'm — avvalgi turda", {
                        amount: fmt(total - parsed.amount),
                      })}{" "}
                      ·{" "}
                      {tr("{{new}} usulida yangi to'lov qatori yaratiladi", {
                        new: PAYMENT_METHOD_LABELS[method] || method,
                      })}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      {tr("Summaning bir qismi yangi turga o'tadi (masalan, 100 000 dan 50 000)")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              {tr("Izoh (ixtiyoriy)")}
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr("Masalan: xato bosilgan")}
            />
          </div>

          {history.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700/80">
                {tr("Tahrir tarixi")}
              </p>
              <ul className="mt-1 space-y-1 text-xs text-gray-600">
                {history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-1.5">
                    <b className="font-medium">
                      {tr("{{old}} → {{new}}", {
                        old: PAYMENT_METHOD_LABELS[h.old || ""] || h.old || "—",
                        new: PAYMENT_METHOD_LABELS[h.new] || h.new,
                      })}
                    </b>
                    {h.amount ? (
                      <span className="font-medium">
                        · {tr("{{amount}} So'm", { amount: fmt(h.amount) })}
                      </span>
                    ) : null}
                    {h.kind === "partial" && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        {tr("qisman")}
                      </span>
                    )}
                    <span className="text-gray-400">
                      {h.by_name || ""}
                      {h.by_name && h.at ? " · " : ""}
                      {h.at ? format(new Date(h.at), "dd.MM HH:mm") : ""}
                    </span>
                    {h.note && <span className="text-gray-400">· {h.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tr("Saqlash")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
