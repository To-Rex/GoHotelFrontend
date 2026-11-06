import { History, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { paymentMethodLabel } from "@/lib/paymentMethods"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import type { PaymentRecord } from "@/types/api"
import {
  editBadgeText,
  editDetail,
  editExtra,
  editMeta,
  editsTitle,
  paymentEdits,
  type PaymentEdit,
} from "../lib/paymentEdits"
import { formatMoment, humanNote, paymentMoment, purposeTitle } from "../lib/paymentPurpose"

/* To'lov tahrirlari ekranda: jadvaldagi belgi, tarix ro'yxati va tarix
   oynasi. Belgi va oyna HAMMAGA ko'rinadi (tahrirlash huquqi bo'lmasa
   ham) — pul necha puldan necha pulga, qaysi turdan qaysi turga, kim va
   qachon o'zgartirgani yashirin qolmasin. Hisob-kitob: `lib/paymentEdits`. */

const fmt = (n: number) => Number(n || 0).toLocaleString()

/** Tahrirlar ro'yxati — tahrirlash oynasi va tarix oynasida bir xil. */
export function PaymentEditList({ edits }: { edits: PaymentEdit[] }) {
  return (
    <ul className="space-y-2">
      {edits.map((edit, i) => {
        const extra = editExtra(edit)
        const meta = editMeta(edit)
        return (
          <li key={i} className="text-xs leading-5">
            <p className="font-medium text-gray-900">
              {editDetail(edit)}
              {edit.kind !== "full" && (
                <span className="ml-1.5 inline-block rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold leading-4 text-amber-700">
                  {tr("qisman")}
                </span>
              )}
            </p>
            {extra && <p className="text-[11px] leading-4 text-gray-500">{extra}</p>}
            {meta && <p className="text-[11px] leading-4 text-gray-400">{meta}</p>}
          </li>
        )
      })}
    </ul>
  )
}

/** Jadvaldagi belgi: to'lov tahrirlangan. Oxirgi tahrir qisqa ko'rinadi
 *  ("100,000 → 50,000" yoki "Naqd → Online"), bosilsa to'liq tarix ochiladi. */
export function EditedMark({
  payment,
  onOpen,
  className,
}: {
  payment: PaymentRecord
  onOpen: () => void
  className?: string
}) {
  const edits = paymentEdits(payment)
  if (edits.length === 0) return null
  const last = edits[edits.length - 1]
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${tr("To'lov tahrirlangan")}\n${editsTitle(edits)}`}
      aria-label={tr("To'lov tahrirlangan")}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded bg-amber-50 px-1.5 py-px text-[10px] font-semibold leading-4 text-amber-700 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100",
        className
      )}
    >
      <Pencil className="h-2.5 w-2.5 flex-shrink-0" />
      <span className="truncate whitespace-nowrap tabular-nums">{editBadgeText(last)}</span>
      {edits.length > 1 && (
        <span className="flex-shrink-0 font-medium text-amber-600/80">+{edits.length - 1}</span>
      )}
    </button>
  )
}

/** Tahrir tarixi oynasi — faqat ko'rish; jadvaldagi belgidan ochiladi. */
export function PaymentEditHistoryDialog({
  payment,
  onClose,
}: {
  payment: PaymentRecord | null
  onClose: () => void
}) {
  if (!payment) return null
  const edits = paymentEdits(payment)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-amber-600" />
            {tr("Tahrir tarixi")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold text-gray-900">{payment.payment_number}</p>
              <p className="mt-0.5 break-words text-[11px] text-gray-400">
                {[
                  formatMoment(paymentMoment(payment)),
                  payment.room_number || payment.guest_name ? purposeTitle(payment) : null,
                  humanNote(payment.notes) || payment.reference,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="whitespace-nowrap font-bold tabular-nums text-gray-900">
                {tr("{{amount}} So'm", { amount: fmt(Number(payment.amount || 0)) })}
              </p>
              <p className="text-[11px] text-gray-500">{paymentMethodLabel(payment.payment_method)}</p>
            </div>
          </div>

          {edits.length > 0 ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
              <PaymentEditList edits={edits} />
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">{tr("Bu to'lov tahrirlanmagan")}</p>
          )}

          <p className="text-xs leading-relaxed text-gray-500">
            {tr("Pul qabul qilingan vaqt va sana tahrirda o'zgarmaydi — to'lov o'z kunida qoladi.")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tr("Yopish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
