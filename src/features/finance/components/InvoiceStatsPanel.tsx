import { AlertCircle, CircleDollarSign, FileText, Percent } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import { statsUnavailable, useInvoiceStats } from "../api/financeStats"
import {
  INVOICE_STATUS_BADGE,
  agingLabel,
  invoiceStatusLabel,
  lineLabel,
  percentText,
  shareRows,
} from "../lib/financeStats"
import { invoiceFilterParams, type InvoiceFilters } from "../lib/financeFilters"
import { ShareBars, StatTile, StatsBlock } from "./StatsBits"

/* Moliya → Hisob-fakturalar: statistika.

   Ro'yxat bilan BIR XIL shartlar (davr, holat, qidiruv, filtrlar). Holat
   bosilsa — jadvalga holat filtri; eng katta qarzli hujjat bosilsa — uning
   raqami qidiruvga yoziladi. Bekor qilingan / qaytarilgan hujjat qarz emas
   va yig'ilish foiziga kirmaydi (server qoidasi). */

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString()
const som = (n: number) => tr("{{amount}} So'm", { amount: fmt(n) })

export function InvoiceStatsPanel({
  dateFrom,
  dateTo,
  status,
  onStatus,
  search,
  onSearch,
  filters,
  filtering,
}: {
  dateFrom?: string
  dateTo?: string
  status: string
  onStatus: (value: string) => void
  search: string
  onSearch: (value: string) => void
  filters: InvoiceFilters
  filtering: boolean
}) {
  const { data: s, isLoading, isError, error, isFetching } = useInvoiceStats({
    dateFrom,
    dateTo,
    status: status || undefined,
    search,
    filters: invoiceFilterParams(filters),
  })

  if (isError && statsUnavailable(error)) return null
  if (isError) return null

  const rate = s?.collection_rate ?? null

  return (
    <StatsBlock id="invoices" title={tr("Hisob-fakturalar statistikasi")} filtered={filtering} busy={isFetching && !isLoading}>
      {isLoading || !s ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[74px] rounded-lg" />
          ))}
        </div>
      ) : s.count === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          {filtering ? tr("Filtr bo'yicha hujjat topilmadi") : tr("Tanlangan davrda hisob-fakturalar yo'q")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={FileText}
              accent="bg-blue-50 text-blue-600"
              label={tr("Hujjatlar")}
              value={tr("{{count}} ta", { count: s.count })}
              sub={tr("o'rtacha {{amount}} So'm", { amount: fmt(s.average) })}
            />
            <StatTile
              icon={CircleDollarSign}
              accent="bg-violet-50 text-violet-600"
              label={tr("Umumiy summa")}
              value={som(s.total)}
              sub={
                s.discount > 0
                  ? tr("chegirma −{{amount}} ({{count}} ta hujjat)", { amount: fmt(s.discount), count: s.discount_count })
                  : tr("chegirma yo'q")
              }
            />
            <StatTile
              icon={Percent}
              accent="bg-emerald-50 text-emerald-600"
              label={tr("To'langan")}
              value={som(s.paid)}
              sub={
                rate !== null ? (
                  <span className="block">
                    {tr("yig'ilgan {{rate}}", { rate: percentText(rate) })}
                    {/* Yig'ilish foizi — ingichka chiziq */}
                    <span className="mt-1 block h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(Math.max(rate, 0), 100)}%` }}
                      />
                    </span>
                  </span>
                ) : (
                  tr("faol hujjat yo'q")
                )
              }
            />
            <StatTile
              icon={AlertCircle}
              accent="bg-amber-50 text-amber-600"
              label={tr("Qarz (qoldiq)")}
              value={som(s.remaining)}
              valueClass={s.remaining > 0 ? "text-amber-600" : undefined}
              sub={tr("{{count}} ta hujjatda", { count: s.debt_count })}
            />
          </div>

          {/* Holatlar — bosilsa jadvalga holat filtri */}
          <div>
            <h4 className="mb-2 text-xs font-semibold text-gray-600">{tr("Holatlar bo'yicha")}</h4>
            <div className="flex flex-wrap gap-2">
              {s.statuses.map((st) => {
                const value = st.status === "CANCELLED" ? "VOID" : st.status
                const active = status === value
                return (
                  <button
                    key={st.status}
                    type="button"
                    onClick={() => onStatus(active ? "" : value)}
                    aria-pressed={active}
                    title={active ? tr("Filtrni olib tashlash") : tr("Faqat shularni ko'rsatish")}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                      active ? "border-primary-300 bg-primary-50/60 ring-1 ring-primary-200" : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        INVOICE_STATUS_BADGE[value] || "bg-gray-100 text-gray-600"
                      )}
                    >
                      {invoiceStatusLabel(st.status)}
                    </span>
                    <span className="text-xs leading-tight">
                      <b className="font-semibold tabular-nums text-gray-800">{st.count}</b>
                      <span className="ml-1 tabular-nums text-gray-500">{fmt(st.total)}</span>
                      {st.remaining > 0 && !["VOID", "CANCELLED", "REFUNDED"].includes(st.status) && (
                        <span className="ml-1 tabular-nums text-amber-600">
                          {tr("qarz {{amount}}", { amount: fmt(st.remaining) })}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <ShareBars
              title={tr("Hujjatlar tarkibi")}
              rows={shareRows(s.lines.map((l) => ({ key: l.kind, amount: l.amount })), lineLabel)}
              empty={tr("Qatorlar yo'q")}
            />
            <ShareBars
              title={tr("Qarz yoshi (hujjat sanasidan)")}
              rows={shareRows(
                s.aging.map((a) => ({ key: a.bucket, amount: a.amount, count: a.count })),
                agingLabel
              )}
              countLabel={(n) => tr("{{count}} ta", { count: n })}
            />
          </div>

          {s.top_debts.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-gray-600">{tr("Eng katta qarzlar")}</h4>
              <ul className="divide-y rounded-lg border">
                {s.top_debts.map((d) => {
                  const active = search.trim() === d.invoice_number
                  const who = [d.guest_name, d.room_number ? tr("Xona {{room}}", { room: d.room_number }) : null]
                    .filter(Boolean)
                    .join(" · ")
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => onSearch(active ? "" : d.invoice_number)}
                        aria-pressed={active}
                        title={active ? tr("Qidiruvni tozalash") : tr("Jadvalda shu hujjatni ko'rsatish")}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50",
                          active && "bg-primary-50/60"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">{d.invoice_number}</span>
                          <span className="block truncate text-[11px] text-gray-400">
                            {[who, d.days !== null ? tr("{{days}} kun oldin", { days: d.days }) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="flex-shrink-0 text-right">
                          <span className="block text-sm font-semibold tabular-nums text-amber-600">{fmt(d.remaining)}</span>
                          <span className="block text-[11px] tabular-nums text-gray-400">
                            {tr("jami {{total}}", { total: fmt(d.total_amount) })}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </StatsBlock>
  )
}
