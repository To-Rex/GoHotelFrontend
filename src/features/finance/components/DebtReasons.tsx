import { BedDouble, CalendarClock, Gavel, ShoppingBag, Sparkles, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DebtReason } from "../api/debtors"
import { reasonDetail, reasonTitle } from "../lib/debtReasons"

/* Qarz SABABLARI — har to'lanmagan haq alohida qator: nima, qancha,
   qisman to'langan bo'lsa qancha qolgani. `compact` — ro'yxat qatori
   ichida bir qatorli belgilar. */

const ICONS: Record<string, LucideIcon> = {
  room: BedDouble,
  extension: CalendarClock,
  service: Sparkles,
  penalty: Gavel,
  shop: ShoppingBag,
}

const TONES: Record<string, string> = {
  room: "bg-amber-50 text-amber-800 border-amber-200",
  extension: "bg-violet-50 text-violet-800 border-violet-200",
  service: "bg-sky-50 text-sky-800 border-sky-200",
  penalty: "bg-red-50 text-red-700 border-red-200",
  shop: "bg-emerald-50 text-emerald-800 border-emerald-200",
}

const fmt = (n?: number | null) => Number(n || 0).toLocaleString()

export function DebtReasons({
  reasons,
  compact = false,
  className,
}: {
  reasons?: DebtReason[]
  compact?: boolean
  className?: string
}) {
  const list = reasons || []
  if (!list.length) return null

  if (compact) {
    return (
      <div className={cn("flex flex-wrap gap-1", className)}>
        {list.map((reason, index) => {
          const Icon = ICONS[reason.kind] || Gavel
          return (
            <span
              key={`${reason.kind}-${index}`}
              title={reasonDetail(reason) || undefined}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                TONES[reason.kind] || "border-gray-200 bg-gray-50 text-gray-700"
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{reasonTitle(reason)}</span>
              <b className="shrink-0 tabular-nums">{fmt(reason.amount)}</b>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {list.map((reason, index) => {
        const Icon = ICONS[reason.kind] || Gavel
        const detail = reasonDetail(reason)
        return (
          <li
            key={`${reason.kind}-${index}`}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-2.5 py-2",
              TONES[reason.kind] || "border-gray-200 bg-gray-50 text-gray-700"
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{reasonTitle(reason)}</p>
              {detail && <p className="mt-0.5 text-[11px] leading-snug opacity-80">{detail}</p>}
            </div>
            <b className="shrink-0 text-sm tabular-nums">{fmt(reason.amount)}</b>
          </li>
        )
      })}
    </ul>
  )
}
