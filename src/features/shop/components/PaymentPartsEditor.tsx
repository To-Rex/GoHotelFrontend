import { X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"

/* To'lov bo'laklari: har qatorda summa va usul (masalan naqd + karta).

   Qisman to'lashda bo'laklar jami `limit` (qoldiq) dan oshmasligi kerak —
   kamroq bo'lsa, qolgani keyingi to'lovga qoladi. "Qoldiq" tugmasi shu
   qatorga qolgan summani yozadi. Haqiqiy tekshiruv serverda. */

export interface PartRow {
  amount: string
  method: string
}

export const emptyPartRows = (): PartRow[] => [
  { amount: "", method: "CASH" },
  { amount: "", method: "CARD" },
]

export const partsOf = (rows: PartRow[]) =>
  rows
    .map((r) => ({ amount: Number(r.amount) || 0, payment_method: r.method }))
    .filter((p) => p.amount > 0)

const fmt = (n: number) => Number(n || 0).toLocaleString()

export function PaymentPartsEditor({
  rows,
  onChange,
  limit,
  methods,
  maxRows = 3,
}: {
  rows: PartRow[]
  onChange: (rows: PartRow[]) => void
  /** Bo'laklar jami shundan oshmaydi (qoldiq yoki savat summasi) */
  limit: number
  methods: Array<{ key: string; label: string }>
  maxRows?: number
}) {
  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const over = sum > limit + 0.01
  const exact = !over && Math.abs(sum - limit) <= 0.01 && sum > 0

  const update = (i: number, patch: Partial<PartRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const fillRemaining = (i: number) => {
    const others = rows.reduce((s, r, idx) => (idx === i ? s : s + (Number(r.amount) || 0)), 0)
    update(i, { amount: String(Math.max(Math.round(limit - others), 0)) })
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            placeholder={tr("Summa")}
            value={row.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
            className="h-9 flex-1 bg-background"
          />
          <button
            type="button"
            onClick={() => fillRemaining(i)}
            title={tr("Qolgan summani shu qatorga yozish")}
            className="flex-shrink-0 rounded-md border border-border bg-background px-1.5 py-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
          >
            {tr("Qoldiq")}
          </button>
          <select
            value={row.method}
            onChange={(e) => update(i, { method: e.target.value })}
            className="flex h-9 flex-shrink-0 items-center rounded-md border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {methods.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="flex-shrink-0 text-muted-foreground hover:text-red-600"
              title={tr("O'chirish")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        {rows.length < maxRows ? (
          <button
            type="button"
            onClick={() => onChange([...rows, { amount: "", method: "BANK_TRANSFER" }])}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {tr("+ Yana usul qo'shish")}
          </button>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "text-[11px] font-semibold tabular-nums",
            over ? "text-red-600" : exact ? "text-emerald-600" : "text-muted-foreground"
          )}
        >
          {fmt(sum)} / {fmt(limit)}
        </span>
      </div>
    </div>
  )
}
