import { useMemo } from "react"
import { Hash, Pencil, Trophy, Undo2, Wallet, CalendarClock, Store } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import { statsUnavailable, usePaymentStats } from "../api/financeStats"
import {
  METHOD_FILTER_KEYS,
  PURPOSE_FILTER_KINDS,
  dayBars,
  methodLabel,
  purposeLabel,
  shareRows,
} from "../lib/financeStats"
import { paymentFilterParams, toggleValue, type PaymentFilters } from "../lib/financeFilters"
import { DayColumns, ShareBars, StatTile, StatsBlock } from "./StatsBits"

/* Moliya → To'lovlar: statistika.

   Ro'yxat bilan BIR XIL shartlar (davr, qidiruv, filtrlar) — xodim "Jarima"
   ni tanlasa statistika ham jarima to'lovlari bo'yicha. Har kesim bosilsa
   jadvalga o'sha filtr qo'yiladi (to'lov turi, nima uchun, xodim, qarz
   to'lovi, do'kon, tahrirlangan) — qayta bosilsa olib tashlanadi. */

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString()
const som = (n: number) => tr("{{amount}} So'm", { amount: fmt(n) })

function Chip({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Wallet
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? tr("Filtrni olib tashlash") : tr("Faqat shularni ko'rsatish")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary-300 bg-primary-50 text-primary-800"
          : "border-gray-200 text-gray-600 hover:bg-gray-50"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}

export function PaymentStatsPanel({
  dateFrom,
  dateTo,
  search,
  filters,
  setFilters,
  filtering,
}: {
  dateFrom?: string
  dateTo?: string
  search: string
  filters: PaymentFilters
  setFilters: (update: (f: PaymentFilters) => PaymentFilters) => void
  filtering: boolean
}) {
  const { data: s, isLoading, isError, error, isFetching } = usePaymentStats({
    dateFrom,
    dateTo,
    search,
    filters: paymentFilterParams(filters),
  })
  const bars = useMemo(() => (s ? dayBars(s.days, dateFrom, dateTo) : []), [s, dateFrom, dateTo])

  // Eski server yoki ruxsat yo'q — panel umuman ko'rinmaydi
  if (isError && statsUnavailable(error)) return null
  if (isError) return null

  const kinds = new Set(filters.kinds)
  const toggleKind = (key: string) => setFilters((f) => ({ ...f, kinds: toggleValue(f.kinds, key) }))

  return (
    <StatsBlock id="payments" title={tr("To'lovlar statistikasi")} filtered={filtering} busy={isFetching && !isLoading}>
      {isLoading || !s ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[74px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      ) : s.count === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          {filtering ? tr("Filtr bo'yicha to'lov topilmadi") : tr("Tanlangan davrda to'lovlar yo'q")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={Wallet}
              accent="bg-emerald-50 text-emerald-600"
              label={tr("Jami tushum")}
              value={som(s.total)}
              sub={
                s.refunds > 0
                  ? tr("kirim {{income}} · qaytarim −{{refunds}}", { income: fmt(s.income), refunds: fmt(s.refunds) })
                  : tr("qaytarimlar yo'q")
              }
            />
            <StatTile
              icon={Hash}
              accent="bg-blue-50 text-blue-600"
              label={tr("To'lovlar soni")}
              value={tr("{{count}} ta", { count: s.count })}
              sub={tr("o'rtacha {{amount}} So'm", { amount: fmt(s.average) })}
            />
            <StatTile
              icon={Trophy}
              accent="bg-amber-50 text-amber-600"
              label={tr("Eng katta to'lov")}
              value={s.largest ? som(s.largest.amount) : "—"}
              sub={
                s.largest
                  ? [s.largest.number || (s.largest.source === "SHOP" ? tr("Do'kon") : ""), s.largest.date]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
            />
            <StatTile
              icon={Undo2}
              accent="bg-rose-50 text-rose-600"
              label={tr("Qaytarilgan")}
              value={som(s.refunds)}
              valueClass={s.refunds > 0 ? "text-red-600" : undefined}
              sub={tr("{{count}} ta qaytarim", { count: s.refund_count })}
            />
          </div>

          {/* Tez filtrlar: qarz to'lovlari, do'kon, tahrirlangan */}
          {(s.debt.count > 0 || (s.sources.SHOP?.count ?? 0) > 0 || s.edited > 0 || kinds.has("DEBT") || kinds.has("SHOP") || filters.edited) && (
            <div className="flex flex-wrap gap-2">
              {(s.debt.count > 0 || kinds.has("DEBT")) && (
                <Chip icon={CalendarClock} active={kinds.has("DEBT")} onClick={() => toggleKind("DEBT")}>
                  {tr("Qarz to'lovlari: {{amount}} ({{count}} ta)", { amount: fmt(s.debt.amount), count: s.debt.count })}
                </Chip>
              )}
              {((s.sources.SHOP?.count ?? 0) > 0 || kinds.has("SHOP")) && (
                <Chip icon={Store} active={kinds.has("SHOP")} onClick={() => toggleKind("SHOP")}>
                  {tr("Do'kon: {{amount}} ({{count}} ta)", {
                    amount: fmt(s.sources.SHOP?.amount ?? 0),
                    count: s.sources.SHOP?.count ?? 0,
                  })}
                </Chip>
              )}
              {(s.edited > 0 || filters.edited) && (
                <Chip icon={Pencil} active={filters.edited} onClick={() => setFilters((f) => ({ ...f, edited: !f.edited }))}>
                  {tr("Tahrirlangan: {{count}} ta", { count: s.edited })}
                </Chip>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <ShareBars
              title={tr("To'lov turlari bo'yicha")}
              rows={shareRows(s.methods, methodLabel)}
              activeKeys={new Set(filters.method ? [filters.method] : [])}
              onPick={(key) => setFilters((f) => ({ ...f, method: f.method === key ? null : key }))}
              pickable={(key) => METHOD_FILTER_KEYS.has(key)}
              countLabel={(n) => tr("{{count}} ta", { count: n })}
            />
            <ShareBars
              title={tr("Nima uchun to'langan")}
              rows={shareRows(s.purposes, purposeLabel)}
              activeKeys={kinds}
              onPick={toggleKind}
              pickable={(key) => PURPOSE_FILTER_KINDS.has(key)}
            />
          </div>

          <DayColumns
            bars={bars}
            title={bars.length > 0 && bars[0].key.length === 7 ? tr("Oylar bo'yicha") : tr("Kunlar bo'yicha")}
          />

          {s.staff.length > 0 && (
            <div>
              <ShareBars
                title={tr("Kim qabul qilgan")}
                rows={shareRows(
                  s.staff.map((u) => ({ key: u.id, amount: u.amount, count: u.count })),
                  (id) => s.staff.find((u) => u.id === id)?.name || tr("Noma'lum")
                )}
                activeKeys={new Set(filters.user ? [filters.user] : [])}
                onPick={(id) => setFilters((f) => ({ ...f, user: f.user === id ? null : id }))}
                countLabel={(n) => tr("{{count}} ta", { count: n })}
              />
              {s.staff_total > s.staff.length && (
                <p className="mt-1 text-[11px] text-gray-400">
                  {tr("va yana {{count}} xodim", { count: s.staff_total - s.staff.length })}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </StatsBlock>
  )
}
