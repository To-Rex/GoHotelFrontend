import { ArrowRight, History, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import type { Expense, ExpenseEdit } from "@/types/api"
import { paymentMethodLabel } from "@/lib/paymentMethods"
import {
  changeRows,
  editBadgeText,
  editMoment,
  editsOf,
  editsTitle,
  editWho,
  type ChangeRow,
} from "../lib/expenseEdit"
import { partsLabel, type ExpenseGroup } from "../lib/expenseGroups"

/* Xarajat tahrirlari ekranda: jadvaldagi belgi va tarix oynasi.

   Belgi va oyna HAMMAGA ko'rinadi (tahrirlash huquqi bo'lmasa ham):
   xodim o'zi kiritgan xarajat kim tomonidan, qachon va nimadan nimaga
   o'zgartirilganini ko'rishi kerak — to'lov tahrirlaridagi kabi.
   Qoidalar: `lib/expenseEdit.ts`. */

const fmt = (n: number) => Number(n || 0).toLocaleString()

/** "Summa: 100 000 So'm → 85 000 So'm" — eski qiymat xira, yangisi qalin */
export function ChangeList({ rows, className }: { rows: ChangeRow[]; className?: string }) {
  return (
    <ul className={cn("space-y-1", className)}>
      {rows.map((r) => (
        <li key={r.field} className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 text-xs leading-5">
          <span className="text-gray-500">{r.label}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
            <span className="break-words text-gray-400 line-through decoration-gray-300">{r.old}</span>
            <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-400" aria-hidden />
            <span className="break-words font-semibold text-gray-900">{r.new}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Tahrirlar ro'yxati — eng yangisi tepada */
export function ExpenseEditList({ edits }: { edits: ExpenseEdit[] }) {
  const ordered = [...edits].reverse()
  return (
    <ol className="space-y-2.5">
      {ordered.map((edit, i) => (
        <li
          key={`${edit.at}-${i}`}
          className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5"
        >
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-xs font-semibold text-gray-900">{editWho(edit)}</p>
            <p className="text-[11px] tabular-nums text-gray-500">{editMoment(edit.at)}</p>
          </div>
          <ChangeList rows={changeRows(edit.changes)} />
          {edit.note && (
            <p className="mt-1.5 break-words text-[11px] leading-4 text-gray-600">
              <span className="font-medium text-gray-500">{tr("Sabab")}:</span> {edit.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

/** Jadvaldagi belgi: xarajat tahrirlangan. Bosilsa tarix ochiladi. */
export function ExpenseEditedMark({
  expense,
  onOpen,
  className,
}: {
  expense: Pick<Expense, "edit_history">
  onOpen: () => void
  className?: string
}) {
  const edits = editsOf(expense)
  if (edits.length === 0) return null
  const last = edits[edits.length - 1]
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${tr("Xarajat tahrirlangan")}\n${editsTitle(edits)}`}
      aria-label={tr("Xarajat tahrirlangan — tarixni ko'rish")}
      className={cn(
        "inline-flex max-w-full flex-shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-px text-[10px] font-semibold leading-4 text-amber-700 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100",
        className
      )}
    >
      <Pencil className="h-2.5 w-2.5 flex-shrink-0" />
      <span className="max-w-[150px] truncate whitespace-nowrap tabular-nums">{editBadgeText(last)}</span>
      {edits.length > 1 && (
        <span className="flex-shrink-0 font-medium text-amber-600/80">+{edits.length - 1}</span>
      )}
    </button>
  )
}

/** Tahrir tarixi oynasi — faqat ko'rish */
export function ExpenseEditHistoryDialog({
  group,
  onClose,
}: {
  group: ExpenseGroup<Expense> | null
  onClose: () => void
}) {
  if (!group) return null
  const e = group.main
  const edits = editsOf(e)
  const created = editMoment(e.created_at)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-amber-600" />
            {tr("Tahrir tarixi")}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {tr("Kim, qachon va nimani o'zgartirgani. Kim kiritgani va qaysi smenaga tegishli ekani tahrirda o'zgarmaydi.")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3 py-1">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold text-gray-900">{e.title}</p>
              <p className="mt-0.5 break-words text-[11px] text-gray-400">
                {[
                  e.expense_date,
                  e.category ? tr(e.category) : null,
                  tr("Kiritgan: {{name}}", { name: e.created_by_name || tr("Noma'lum") }),
                  created || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="whitespace-nowrap font-bold tabular-nums text-gray-900">
                {tr("{{amount}} So'm", { amount: fmt(group.amount) })}
              </p>
              <p className="max-w-[160px] text-[11px] text-gray-500">
                {group.isSplit ? partsLabel(group) : paymentMethodLabel(e.payment_method)}
              </p>
            </div>
          </div>

          {edits.length > 0 ? (
            <div className="max-h-[50vh] overflow-y-auto pr-0.5">
              <ExpenseEditList edits={edits} />
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">{tr("Bu xarajat tahrirlanmagan")}</p>
          )}
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
