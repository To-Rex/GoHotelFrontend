import { useMemo, useState } from "react"
import { format } from "date-fns"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { SortableHead, TableSearch } from "@/components/ui/table-tools"
import { cn } from "@/lib/utils"
import {
  PENALTY_KINDS,
  penaltyKindLabel,
  useFinancePenalties,
} from "@/features/reservations/api/penalties"
import {
  filterRows,
  initialTableState,
  setSearch,
  sortRows,
  toggleSort,
  type TableState,
} from "@/lib/tableState"
import {
  AmountRange,
  FoundLine,
  OptionSelect,
  ResetFilters,
} from "./FilterControls"
import {
  EMPTY_PENALTY_FILTERS,
  PENALTY_SEARCH_FIELDS,
  PENALTY_STATUS_OPTIONS,
  applyPenaltyFilters,
  penaltyFilterCount,
  penaltySortAccessors,
  penaltyTotals,
  penaltyUserOptions,
  toggleValue,
  type PenaltyFilters,
  type PenaltyStatus,
} from "../lib/financeFilters"
import { tr } from "@/i18n"

/**
 * Jarimalar: davrda yozilgan kech chiqish, shikast va boshqa jarimalar.
 *
 * Sana — jarima YOZILGAN kun. Bekor qilinganlar ham ro'yxatda (kim va
 * nega bekor qilgani bilan), lekin jamiga kirmaydi. Jarima puli alohida
 * tushum emas: u bron qarziga qo'shiladi va to'langanda odatdagi bron
 * to'lovi bo'lib "To'lovlar" ga tushadi.
 *
 * Ro'yxat davr bo'yicha to'liq keladi — filtr va saralash brauzerda,
 * so'rovsiz: tur (kartalar bosilsa ham — bir nechtasi birga), holat (faol /
 * bekor qilingan), yozgan xodim, summa oralig'i, qidiruv (bron, xona,
 * mehmon, izoh). Kartalardagi summalar butun davr bo'yicha qoladi, filtr
 * natijasi "Topildi" satrida.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

const KIND_ACCENT: Record<string, string> = {
  LATE_CHECKOUT: "bg-amber-50 text-amber-700",
  DAMAGE: "bg-rose-50 text-rose-700",
  OTHER: "bg-gray-100 text-gray-700",
}

const SORT_ACCESSORS = penaltySortAccessors(penaltyKindLabel)
/** Matnli ustunlar birinchi bosishda A dan Z gacha */
const TEXT_SORTS = new Set(["reservation_number", "guest_name", "kind", "created_by_name"])

export function PenaltiesSection({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { data, isLoading, isError } = useFinancePenalties(dateFrom, dateTo)

  const [filters, setFilters] = useState<PenaltyFilters>(EMPTY_PENALTY_FILTERS)
  const [table, setTable] = useState<TableState>(() => initialTableState("created_at"))

  const items = useMemo(() => data?.items ?? [], [data])
  const filtered = useMemo(() => applyPenaltyFilters(items, filters), [items, filters])
  const visible = useMemo(
    () =>
      sortRows(
        filterRows(filtered, table.search, PENALTY_SEARCH_FIELDS),
        table.sortBy,
        table.sortDir,
        SORT_ACCESSORS
      ),
    [filtered, table]
  )
  const users = useMemo(() => penaltyUserOptions(items), [items])
  const filterCount = penaltyFilterCount(filters) + (table.search.trim() ? 1 : 0)
  const filtering = filterCount > 0
  const found = penaltyTotals(visible)

  const sort = (column: string) =>
    setTable((t) => toggleSort(t, column, TEXT_SORTS.has(column) ? "asc" : "desc"))
  const toggleKind = (kind: string) => setFilters((f) => ({ ...f, kinds: toggleValue(f.kinds, kind) }))
  const toggleUser = (id?: string | null) => {
    if (!id) return
    setFilters((f) => ({ ...f, user: f.user === id ? null : id }))
  }
  const reset = () => {
    setFilters(EMPTY_PENALTY_FILTERS)
    setTable((t) => setSearch(t, ""))
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }
  if (isError || !data) {
    return <div className="text-sm text-red-600">{tr("Xatolik yuz berdi. Iltimos qayta urining.")}</div>
  }

  const { summary } = data

  const head = (column: string, label: string, align?: "left" | "right") => (
    <SortableHead
      column={column}
      active={table.sortBy}
      dir={table.sortDir}
      onSort={sort}
      align={align}
    >
      {label}
    </SortableHead>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* "Jami" kartasi bosilsa — tur tanlovi olib tashlanadi */}
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, kinds: [] }))}
          aria-pressed={filters.kinds.length === 0}
          title={tr("Barcha turlar")}
          className={cn(
            "rounded-lg border-2 border-rose-200 bg-rose-50/60 p-4 text-left transition-shadow hover:shadow-sm",
            filters.kinds.length > 0 && "opacity-70"
          )}
        >
          <p className="text-xs font-medium text-rose-700">{tr("Jami jarimalar")}</p>
          <p className="text-xl font-bold tabular-nums text-rose-800">
            {tr("{{total}} So'm", { total: fmt(summary.total) })}
          </p>
          <p className="text-[11px] text-rose-600/80">
            {tr("{{count}} ta jarima", { count: summary.count })}
          </p>
        </button>
        {PENALTY_KINDS.map((k) => {
          const row = summary.by_kind[k] ?? { total: 0, count: 0 }
          const active = filters.kinds.includes(k)
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggleKind(k)}
              aria-pressed={active}
              title={active ? tr("Filtrni olib tashlash") : tr("Faqat shu turdagi jarimalar")}
              className={cn(
                "rounded-lg border bg-white p-4 text-left transition-shadow hover:shadow-sm",
                active && "border-primary-300 ring-2 ring-primary-200",
                filters.kinds.length > 0 && !active && "opacity-60"
              )}
            >
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", KIND_ACCENT[k])}>
                  {penaltyKindLabel(k)}
                </span>
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                {tr("{{total}} So'm", { total: fmt(row.total) })}
              </p>
              <p className="text-[11px] text-gray-400">{tr("{{count}} ta jarima", { count: row.count })}</p>
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-lg font-bold tracking-tight">{tr("Yozilgan jarimalar")}</h2>
          <span className="text-xs text-gray-400">
            {tr("to'langanda bron to'lovi bo'lib tushumga kiradi")}
          </span>
        </div>

        {/* Qidiruv va filtrlar */}
        <div className="space-y-2 border-b bg-gray-50/60 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <TableSearch
              className="w-full sm:w-64"
              value={table.search}
              onChange={(v) => setTable((t) => setSearch(t, v))}
              placeholder={tr("Bron, xona, mehmon yoki izoh...")}
            />
            <OptionSelect
              label={tr("Holati")}
              allLabel={tr("Faol va bekor qilingan")}
              options={PENALTY_STATUS_OPTIONS.filter((o) => o.value !== "all")}
              value={filters.status === "all" ? "" : filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: (v || "all") as PenaltyStatus }))}
            />
            {users.length > 0 && (
              <OptionSelect
                label={tr("Kim yozdi")}
                allLabel={tr("Barcha xodimlar")}
                options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.count})` }))}
                value={filters.user ?? ""}
                onChange={(v) => setFilters((f) => ({ ...f, user: v || null }))}
              />
            )}
            <AmountRange
              min={filters.minAmount}
              max={filters.maxAmount}
              onChange={({ min, max }) => setFilters((f) => ({ ...f, minAmount: min, maxAmount: max }))}
            />
            <ResetFilters count={filterCount} onReset={reset} />
          </div>
          {filtering && (
            <FoundLine
              count={found.count}
              amount={found.total}
              extra={<span className="text-gray-400">{tr("(bekor qilinganlar summaga kirmaydi)")}</span>}
            />
          )}
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                {head("created_at", tr("Sana"))}
                {head("reservation_number", tr("Bron"))}
                {head("guest_name", tr("Mehmon"))}
                {head("kind", tr("Turi"))}
                <TableHead>{tr("Izoh")}</TableHead>
                {head("created_by_name", tr("Kim yozdi"))}
                {head("amount", tr("Summa"), "right")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-gray-400">
                    {filtering ? tr("Filtr bo'yicha jarima topilmadi") : tr("Tanlangan davrda jarima yozilmagan")}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((p) => {
                  const voided = !!p.voided_at
                  const kindActive = filters.kinds.includes(String(p.kind))
                  const userActive = !!p.created_by && filters.user === p.created_by
                  return (
                    <TableRow key={p.id} className={cn(voided && "bg-gray-50/70 text-gray-400")}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {p.created_at ? format(new Date(p.created_at), "dd.MM.yyyy HH:mm") : p.penalty_date || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        <span className="font-medium text-gray-800">{p.reservation_number || "—"}</span>
                        {p.room_number && (
                          <span className="block text-[11px] text-gray-400">
                            {tr("Xona {{room}}", { room: p.room_number })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{p.guest_name || "—"}</TableCell>
                      <TableCell>
                        {/* Tur belgisi bosilsa — faqat shu turdagi jarimalar */}
                        <button
                          type="button"
                          onClick={() => toggleKind(String(p.kind))}
                          aria-pressed={kindActive}
                          title={kindActive ? tr("Filtrni olib tashlash") : tr("Faqat shu turdagi jarimalar")}
                          className={cn(
                            "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium transition-shadow hover:ring-2 hover:ring-gray-200",
                            KIND_ACCENT[p.kind] || KIND_ACCENT.OTHER,
                            kindActive && "ring-2 ring-gray-900/30"
                          )}
                        >
                          {penaltyKindLabel(p.kind)}
                        </button>
                        {voided && (
                          <span className="mt-1 block text-[11px] text-gray-500">
                            {tr("Bekor qilingan")}
                            {p.voided_by_name ? ` · ${p.voided_by_name}` : ""}
                            {p.void_reason ? ` · ${p.void_reason}` : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] break-words text-xs">{p.note || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {p.created_by && p.created_by_name ? (
                          <button
                            type="button"
                            onClick={() => toggleUser(p.created_by)}
                            aria-pressed={userActive}
                            title={userActive ? tr("Filtrni olib tashlash") : tr("Faqat shu xodim yozganlari")}
                            className={cn(
                              "-mx-1 rounded px-1 transition-colors hover:bg-gray-100 hover:text-gray-900",
                              userActive && "bg-primary-50 text-primary-800 ring-1 ring-primary-200"
                            )}
                          >
                            {p.created_by_name}
                          </button>
                        ) : (
                          p.created_by_name || "—"
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-semibold tabular-nums",
                          voided ? "text-gray-400 line-through" : "text-rose-700"
                        )}
                      >
                        {fmt(p.amount)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
