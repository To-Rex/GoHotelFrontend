import { useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Banknote, Loader2, LogOut, MessageSquareWarning } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ReservationDebt } from "@/features/finance/api/debtors"
import { DebtReasons } from "@/features/finance/components/DebtReasons"
import { hasDebt } from "@/features/finance/lib/debtReasons"
import { tr } from "@/i18n"

/* Bron oynasidagi QARZ: qancha, nima uchun, kim qarz bilan chiqargan.
   Oyna ochilishi bilan ko'rinadi — xodim pul olishni unutmasin. */

const fmt = (n?: number | null) => Number(n || 0).toLocaleString()

const fmtDateTime = (value?: string | null) => {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ReservationDebtPanel({
  debt,
  canPay,
  onPay,
  className,
}: {
  debt?: ReservationDebt | null
  canPay?: boolean
  /** Balans paneliga o'tish */
  onPay?: () => void
  className?: string
}) {
  if (!hasDebt(debt)) return null
  const d = debt as ReservationDebt
  const left = d.status === "CHECKED_OUT"

  return (
    <div className={cn("space-y-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {left ? tr("Mehmon qarz bilan chiqib ketgan") : tr("Mehmonning qarzi bor")}
            </p>
            <p className="text-[11px] text-red-700/80">
              {d.overdue_days
                ? tr("{{days}} kundan beri to'lanmagan", { days: d.overdue_days })
                : left
                  ? tr("Mehmon bilan bog'lanib, qarzni undiring")
                  : tr("Mehmon ketmasidan oldin to'lovni oling")}
            </p>
          </div>
        </div>
        <p className="text-lg font-bold tabular-nums text-red-700">
          {fmt(d.total_debt)} <span className="text-xs font-medium">{tr("So'm")}</span>
        </p>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-red-800/70">
          {tr("Nima uchun")}
        </p>
        <DebtReasons reasons={d.items} />
      </div>

      {d.projected && (
        <p className="text-[11px] leading-snug text-violet-800">
          {tr("Muddat uzaytirilgani uchun summa mehmon chiqqanda qayta hisoblanadi — hozir olinsa, chiqishda qarz qolmaydi.")}
        </p>
      )}

      {d.acknowledged && (
        <p className="flex items-start gap-1.5 rounded-md bg-white/70 px-2 py-1.5 text-[11px] leading-snug text-red-800">
          <MessageSquareWarning className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            {tr("Qarz bilan chiqarilgan")}
            {d.acknowledged.by_name ? ` · ${d.acknowledged.by_name}` : ""}
            {d.acknowledged.at ? ` · ${fmtDateTime(d.acknowledged.at)}` : ""}
            {d.acknowledged.note ? ` — ${d.acknowledged.note}` : ""}
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canPay && onPay && d.reservation_debt > 0.5 && (
          <Button type="button" size="sm" className="h-8 bg-red-600 text-xs hover:bg-red-700" onClick={onPay}>
            <Banknote className="mr-1.5 h-3.5 w-3.5" />
            {tr("To'lovni qabul qilish")}
          </Button>
        )}
        {d.shop_debt > 0.5 && (
          <Link
            to="/shop"
            className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-white px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            {tr("Do'kon qarzi: {{v}} so'm — do'konda to'lash", { v: fmt(d.shop_debt) })}
          </Link>
        )}
      </div>
    </div>
  )
}

/** Qarzdor mehmonni chiqarishdan oldin: to'lov yoki sababi bilan davom etish */
export function DebtCheckoutDialog({
  open,
  debt,
  pending,
  error,
  canPay,
  onPay,
  onConfirm,
  onClose,
}: {
  open: boolean
  debt?: ReservationDebt | null
  pending?: boolean
  error?: string | null
  canPay?: boolean
  onPay: () => void
  onConfirm: (note: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState("")
  const [touched, setTouched] = useState(false)
  const tooShort = note.trim().length < 3

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setNote("")
          setTouched(false)
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            {tr("Mehmonning qarzi bor")}
          </DialogTitle>
        </DialogHeader>
        {debt && (
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-gray-700">
              {tr("Chiqishdan oldin to'lanmagan summa:")}{" "}
              <b className="tabular-nums text-red-700">{tr("{{v}} So'm", { v: fmt(debt.total_debt) })}</b>
            </p>
            <DebtReasons reasons={debt.items} />
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                {tr("Qarz bilan chiqarish sababi (majburiy)")}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => setTouched(true)}
                rows={2}
                maxLength={1000}
                placeholder={tr("Masalan: ertaga keltiradi, telefon raqami ...")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              {touched && tooShort && (
                <p className="text-[11px] text-red-600">{tr("Sababni yozing (kamida 3 ta belgi)")}</p>
              )}
              <p className="text-[11px] text-gray-500">
                {tr("Kim, qachon va nima uchun chiqargani saqlanadi, rahbariyatga xabar boradi. Qarz ro'yxatda qolaveradi.")}
              </p>
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Bekor qilish")}
          </Button>
          {canPay && (debt?.reservation_debt || 0) > 0.5 && (
            <Button type="button" variant="outline" className="border-emerald-300 text-emerald-700" onClick={onPay}>
              <Banknote className="mr-1.5 h-4 w-4" />
              {tr("To'lovni qabul qilish")}
            </Button>
          )}
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700"
            disabled={pending}
            onClick={() => {
              setTouched(true)
              if (!tooShort) onConfirm(note.trim())
            }}
          >
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}
            {tr("Qarz bilan chiqarish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
