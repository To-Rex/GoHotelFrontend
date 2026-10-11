import { tr } from "@/i18n"
import { cn } from "@/lib/utils"
import type { ShiftMethodRow } from "../api/shifts"
import { nonCashBuckets } from "../lib/methodSummary"

const fmt = (n: number) => Number(n || 0).toLocaleString()

/* Naqdsiz to'lovlar (smenada) — naqd bo'lmagan turlar bo'yicha tarkib.

   Naqdsiz pul kassaga KIRMAYDI va smenadan smenaga o'tmaydi; bu ko'rsatkich
   shu sessiya oynasiga (created_by + vaqt) bog'langan, shuning uchun har
   yangi smenada tabiiy 0 dan boshlanadi — xuddi naqd kassa kabi. Shu sababli
   usullar 0 bilan ham ko'rsatiladi: xodim "yangi smena noldan boshlanganini"
   bir qarashda ko'radi.

   `compact` — tor joylar uchun bir qatorli ko'rinish (kassa kartasi,
   topshirish dialogi); to'liq ko'rinish — karta/ichki blok. */
export function NonCashMethods({
  rows,
  compact = false,
  className,
}: {
  rows?: ShiftMethodRow[] | null
  compact?: boolean
  className?: string
}) {
  const buckets = nonCashBuckets(rows)
  const line = buckets.map((b) => `${b.label} ${fmt(b.amount)}`).join(" · ")

  if (compact) {
    return (
      <p className={cn("text-[11px] leading-relaxed text-gray-500", className)}>
        {tr("Naqdsiz (kassaga kirmaydi): {{v}}", { v: line })}
      </p>
    )
  }

  return (
    <div className={cn("rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2.5", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700/80">
        {tr("Naqdsiz to'lovlar (smenada)")}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
        {buckets.map((b) => (
          <span key={b.key} className="text-gray-600">
            {b.label}{" "}
            <b className="tabular-nums text-gray-900">{fmt(b.amount)}</b>
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
        {tr("Kassaga kirmaydi — har smenada 0 dan boshlanadi")}
      </p>
    </div>
  )
}
