import { useEffect, useState } from "react"
import { format } from "date-fns"
import { CheckCircle2, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/apiError"
import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"
import { cn } from "@/lib/utils"
import {
  partsProblem,
  salePaid,
  saleRemaining,
  usePayShopSale,
  type ShopSale,
} from "../api/shop"
import { PaymentPartsEditor, emptyPartRows, partsOf, type PartRow } from "./PaymentPartsEditor"
import { tr } from "@/i18n"

/* Bronga yozilgan savdo bo'yicha to'lov — to'liq yoki QISMAN, bitta yoki
   bir nechta usulda (masalan naqd + karta). Qoldiq qolsa oyna ochiq
   turadi va yangi qoldiq bilan davom etish mumkin — istalgancha marta.
   Avvalgi to'lovlar (qachon, qaysi usulda, kim qabul qilgan) ko'rinadi. */

const fmt = (n: number) => Number(n || 0).toLocaleString()

export function ShopPayDialog({
  open,
  onOpenChange,
  sale,
  methods,
  onPaid,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: ShopSale | null
  methods: Array<{ key: string; label: string; icon: LucideIcon }>
  /** Server qaytargan yangilangan savdo; `full` — to'liq to'landi */
  onPaid: (updated: ShopSale, full: boolean) => void
}) {
  const paySale = usePayShopSale()
  const [amount, setAmount] = useState("")
  const [split, setSplit] = useState(false)
  const [rows, setRows] = useState<PartRow[]>(emptyPartRows)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const total = Number(sale?.total_amount || 0)
  const paid = sale ? salePaid(sale) : 0
  const remaining = sale ? saleRemaining(sale) : 0

  // Oyna ochilganda / boshqa savdo — hammasi boshidan
  useEffect(() => {
    if (!open) return
    setSplit(false)
    setRows(emptyPartRows())
    setError(null)
    setNotice(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sale?.id])

  // Qoldiq o'zgarsa (qisman to'lovdan keyin) summa yangi qoldiqqa
  useEffect(() => {
    if (open) setAmount(remaining > 0 ? String(Math.round(remaining)) : "")
  }, [open, sale?.id, remaining])

  const finish = (updated: ShopSale, paidNow: number) => {
    const left = saleRemaining(updated)
    const full = updated.status === "PAID" || left <= 0.01
    onPaid(updated, full)
    if (!full) {
      setRows(emptyPartRows())
      setNotice(
        tr("{{paid}} so'm qabul qilindi — qoldiq {{left}} so'm", {
          paid: fmt(paidNow),
          left: fmt(left),
        })
      )
    }
  }

  const paySingle = async (method: string) => {
    if (!sale) return
    const value = amount.trim() === "" ? remaining : Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError(tr("To'lov summasini kiriting"))
      return
    }
    if (value > remaining + 0.01) {
      setError(tr("Summa qoldiqdan ({{left}} so'm) oshmasligi kerak", { left: fmt(remaining) }))
      return
    }
    setError(null)
    setNotice(null)
    try {
      // To'liq qoldiq — summasiz (avvalgi so'rov aynan shunday)
      const partial = value < remaining - 0.01
      const updated = await paySale.mutateAsync({
        id: sale.id,
        payment_method: method,
        amount: partial ? Math.round(value * 100) / 100 : null,
      })
      finish(updated, value)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const paySplit = async () => {
    if (!sale) return
    const parts = partsOf(rows)
    const problem = partsProblem(parts, remaining)
    if (problem === "empty") {
      setError(tr("To'lov summasini kiriting"))
      return
    }
    if (problem === "exceeds") {
      setError(tr("Summa qoldiqdan ({{left}} so'm) oshmasligi kerak", { left: fmt(remaining) }))
      return
    }
    setError(null)
    setNotice(null)
    try {
      const updated = await paySale.mutateAsync({
        id: sale.id,
        payment_method: parts[0].payment_method,
        payments: parts,
      })
      finish(updated, parts.reduce((s, p) => s + p.amount, 0))
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const history = (sale?.payments || []).filter((p) => Number(p.amount) > 0)
  const half = Math.round(remaining / 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("To'lovni qabul qilish")}</DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="space-y-3">
            {sale.reservation_number && (
              <p className="text-sm text-muted-foreground">
                {tr("Bron:")}{" "}<b className="text-foreground">{sale.reservation_number}</b>
                {sale.guest_name ? ` · ${sale.guest_name}` : ""}
              </p>
            )}

            {/* Jami / to'langan / qoldiq */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                <p className="text-[10px] text-muted-foreground">{tr("Jami")}</p>
                <p className="text-sm font-semibold tabular-nums">{fmt(total)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                <p className="text-[10px] text-emerald-700">{tr("To'langan")}</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-700">{fmt(paid)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                <p className="text-[10px] text-amber-700">{tr("Qoldiq")}</p>
                <p className="text-sm font-bold tabular-nums text-amber-700">{fmt(remaining)}</p>
              </div>
            </div>

            {/* Avvalgi to'lovlar */}
            {history.length > 0 && (
              <div className="rounded-lg border border-border px-2.5 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">{tr("To'lovlar tarixi")}</p>
                <ul className="mt-1 space-y-0.5">
                  {history.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-muted-foreground">
                        {[
                          p.paid_at ? format(new Date(p.paid_at), "dd.MM HH:mm") : null,
                          PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method,
                          p.created_by_name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="flex-shrink-0 font-semibold tabular-nums">{fmt(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {notice && (
              <p className="flex items-start gap-1.5 rounded-md bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                {notice}
              </p>
            )}

            {!split ? (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {tr("Hozir to'lanadigan summa")}
                  </label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-9 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setAmount(String(Math.round(remaining)))}
                      className={cn(
                        "flex-shrink-0 rounded-md border px-2 py-1.5 text-[11px] font-semibold",
                        Number(amount) === Math.round(remaining)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {tr("Qoldiq")}
                    </button>
                    {half > 0 && half < remaining && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(half))}
                        className="flex-shrink-0 rounded-md border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                      >
                        {tr("Yarmi")}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {tr("Kamroq summa kiritilsa — qisman to'lov, qolgani bron hisobida qoladi")}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {methods.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => paySingle(m.key)}
                      disabled={paySale.isPending}
                      className="flex flex-col items-center gap-1 rounded-lg border border-border px-2 py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                    >
                      <m.icon size={16} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <PaymentPartsEditor rows={rows} onChange={setRows} limit={remaining} methods={methods} />
                <Button size="sm" className="w-full gap-1.5" disabled={paySale.isPending} onClick={paySplit}>
                  {paySale.isPending && <Loader2 size={14} className="animate-spin" />}
                  {tr("Qabul qilish")}
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setSplit((v) => !v)
                setError(null)
              }}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              {split
                ? tr("← Bitta usulda to'lash")
                : tr("Aralash to'lash (naqd + karta + o'tkazma)")}
            </button>

            {error && <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-600">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
