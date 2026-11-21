import { useEffect, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { SortableHead, TablePager, TableSearch } from "@/components/ui/table-tools"
import { cn } from "@/lib/utils"
import { useInvoicesPage } from "../api/finance"
import {
  AmountRange,
  FoundLine,
  OptionSelect,
  ResetFilters,
  SortSelect,
  ToggleFilter,
} from "./FilterControls"
import {
  EMPTY_INVOICE_FILTERS,
  INVOICE_SORT_OPTIONS,
  invoiceFilterCount,
  invoiceFilterParams,
  type InvoiceFilters,
} from "../lib/financeFilters"
import type { Invoice } from "@/types/api"
import {
  PAGE_SIZE,
  clampPage,
  initialTableState,
  pageCount,
  rangeLabel,
  setSearch,
  toggleSort,
} from "@/lib/tableState"
import { tr } from "@/i18n"
import { INVOICE_STATUS_BADGE, INVOICE_STATUS_LABELS } from "../lib/financeStats"
import { InvoiceStatsPanel } from "./InvoiceStatsPanel"

/** Hisob-fakturalar jadvali — sahifalab, qidirib, filtrlab va saralab.

    Qidiruv: hujjat raqami, bron raqami, mehmon ismi yoki xona. Filtrlar
    (serverda): holat (sahifa darajasida — kartalarga ham ta'sir qiladi),
    "Qarzi bor", "Chegirmali", umumiy summa oralig'i. "Topildi" satrida
    butun natija bo'yicha jami summa va qoldiq. Mobilda — saralash tanlagichi. */

// Holat nomlari va ranglari — statistika paneli bilan bir xil (`lib/financeStats`)
const STATUS_LABELS = INVOICE_STATUS_LABELS
const statusBadge = INVOICE_STATUS_BADGE

const fmt = (n: number) => Number(n || 0).toLocaleString()

const remainingOf = (total?: number | null, paid?: number | null) =>
  Math.max(Number(total || 0) - Number(paid || 0), 0)

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

/** Hujjat kimga: "Ali Valiyev" · "Xona 12 · RES-..." (eski serverda bo'sh) */
function Who({ inv }: { inv: Invoice }) {
  const sub = [inv.room_number ? tr("Xona {{room}}", { room: inv.room_number }) : "", inv.reservation_number || ""]
    .filter(Boolean)
    .join(" · ")
  if (!inv.guest_name && !sub) return <span className="text-gray-300">—</span>
  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-[13px] font-medium text-gray-800" title={inv.guest_name || undefined}>
        {inv.guest_name || "—"}
      </p>
      {sub && (
        <p className="truncate text-[11px] text-gray-400" title={sub}>
          {sub}
        </p>
      )}
    </div>
  )
}

export function InvoicesSection({
  dateFrom,
  dateTo,
  status,
  onStatus,
}: {
  dateFrom?: string
  dateTo?: string
  /* Holat filtri sahifa darajasida: u kartalardagi raqamlarga ham
     ta'sir qiladi, shuning uchun bu yerda saqlanmaydi */
  status: string
  onStatus: (value: string) => void
}) {
  const [state, setState] = useState(() => initialTableState("invoice_date"))
  const [filters, setFiltersState] = useState<InvoiceFilters>(EMPTY_INVOICE_FILTERS)
  const setFilters = (update: (f: InvoiceFilters) => InvoiceFilters) => {
    setFiltersState(update)
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }
  const filterCount = invoiceFilterCount(filters) + (status ? 1 : 0) + (state.search.trim() ? 1 : 0)
  const filtering = filterCount > 0
  const resetFilters = () => {
    setFiltersState(EMPTY_INVOICE_FILTERS)
    setState((s) => setSearch(s, ""))
    if (status) onStatus("")
  }

  useEffect(() => {
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }, [dateFrom, dateTo, status])

  const { data, isLoading, isFetching } = useInvoicesPage({
    dateFrom,
    dateTo,
    status: status || undefined,
    state,
    filters: invoiceFilterParams(filters),
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  // Yozuvlar kamayib ketsa (davr o'zgardi, qidiruv toraydi) joriy sahifa
  // chegaradan chiqib qolishi mumkin — o'shanda oxirgi mavjud sahifaga
  // tushiriladi, aks holda xodim bo'sh jadval oldida qolardi
  useEffect(() => {
    setState((s) => {
      const next = clampPage(s.page, total)
      return next === s.page ? s : { ...s, page: next }
    })
  }, [total])

  const pages = pageCount(total)
  const sort = (column: string) => setState((s) => toggleSort(s, column))
  const empty = filtering
    ? tr("Filtr bo'yicha hisob-faktura topilmadi")
    : tr("Tanlangan davrda hisob-fakturalar yo'q")

  const pager = (
    <TablePager
      page={state.page}
      pageCount={pages}
      busy={isFetching}
      label={rangeLabel(state.page, rows.length, total)}
      onPage={(page) =>
        setState((s) => ({ ...s, page: clampPage(page, total, PAGE_SIZE) }))
      }
    />
  )

  return (
    <div className="space-y-2">
      {/* Statistika — jadval bilan bir xil davr, holat, qidiruv va filtrlar */}
      <div className="pb-2">
        <InvoiceStatsPanel
          dateFrom={dateFrom}
          dateTo={dateTo}
          status={status}
          onStatus={onStatus}
          search={state.search}
          onSearch={(value) => setState((s) => setSearch(s, value))}
          filters={filters}
          filtering={filtering}
        />
      </div>
      {/* Sarlavha bo'lim menyusining yonida — bu yerda faqat filtrlar */}
      <div className="space-y-2 rounded-xl border bg-gray-50/60 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch
            className="w-full sm:w-72"
            value={state.search}
            onChange={(value) => setState((s) => setSearch(s, value))}
            placeholder={tr("Hujjat, bron raqami, mehmon yoki xona...")}
          />
          <OptionSelect
            label={tr("Holati")}
            allLabel={tr("Barcha holatlar")}
            options={STATUS_OPTIONS}
            value={status}
            onChange={onStatus}
          />
          <ToggleFilter
            checked={filters.debtOnly}
            onChange={(debtOnly) => setFilters((f) => ({ ...f, debtOnly }))}
          >
            {tr("Qarzi bor")}
          </ToggleFilter>
          <ToggleFilter
            checked={filters.discountOnly}
            onChange={(discountOnly) => setFilters((f) => ({ ...f, discountOnly }))}
          >
            {tr("Chegirmali")}
          </ToggleFilter>
          <AmountRange
            min={filters.minAmount}
            max={filters.maxAmount}
            onChange={({ min, max }) => setFilters((f) => ({ ...f, minAmount: min, maxAmount: max }))}
          />
          <SortSelect
            sortBy={state.sortBy}
            sortDir={state.sortDir}
            options={INVOICE_SORT_OPTIONS}
            onChange={({ sortBy, sortDir }) => setState((s) => ({ ...s, sortBy, sortDir, page: 0 }))}
          />
          <ResetFilters count={filterCount} onReset={resetFilters} />
        </div>
        {filtering && !isLoading && (
          <FoundLine
            count={total}
            amount={data?.amount}
            busy={isFetching}
            extra={
              data?.remaining !== null && data?.remaining !== undefined ? (
                <span>
                  {tr("qoldiq")}{" "}
                  <b className={cn("font-semibold tabular-nums", data.remaining > 0 ? "text-amber-600" : "text-gray-500")}>
                    {tr("{{remaining}} So'm", { remaining: fmt(data.remaining) })}
                  </b>
                </span>
              ) : null
            }
          />
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {/* MOBIL: hisob-fakturalar karta ko'rinishida (jadval planshet/desktopda) */}
          <div className="space-y-2.5 md:hidden">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
                {empty}
              </div>
            ) : (
              rows.map((inv) => {
                const remaining = remainingOf(inv.total_amount, inv.paid_amount)
                return (
                  <div key={inv.id} className="rounded-2xl border bg-white p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium leading-tight text-gray-900">
                          {inv.invoice_number}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                          {tr("{{v}} · muddati: {{v2}}", { v: inv.invoice_date || "-", v2: inv.due_date || "-" })}
                        </p>
                        {(inv.guest_name || inv.room_number) && (
                          <div className="mt-1.5">
                            <Who inv={inv} />
                          </div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                          statusBadge[inv.status] || statusBadge.DRAFT
                        )}
                      >
                        {STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-2.5 text-sm">
                      <div>
                        <p className="text-[11px] text-gray-400">{tr("Umumiy summa")}</p>
                        <p className="font-medium text-gray-900">
                          {tr("{{total_amount}} So'm", { total_amount: fmt(inv.total_amount) })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">{tr("To'landi")}</p>
                        <p className="font-semibold text-green-600">
                          {tr("{{paid_amount}} So'm", { paid_amount: fmt(inv.paid_amount) })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">{tr("Chegirma")}</p>
                        {Number(inv.discount_amount || 0) > 0 ? (
                          <p className="font-medium text-red-500">
                            {tr("−{{discount_amount}} So'm", { discount_amount: fmt(inv.discount_amount) })}
                          </p>
                        ) : (
                          <p className="text-gray-300">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">{tr("Qoldiq")}</p>
                        <p
                          className={cn(
                            "font-semibold",
                            remaining > 0 ? "text-amber-600" : "text-gray-400"
                          )}
                        >
                          {tr("{{remaining}} So'm", { remaining: fmt(remaining) })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    column="invoice_number"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("Raqami")}
                  </SortableHead>
                  <TableHead className="min-w-[140px]">{tr("Mehmon / bron")}</TableHead>
                  <SortableHead
                    column="invoice_date"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("Sana")}
                  </SortableHead>
                  {/* Muddati alohida ustun faqat keng ekranda; undan torida
                      sana ostida — aks holda "Qoldiq" ekrandan chiqib ketardi */}
                  <SortableHead
                    column="due_date"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    className="hidden 2xl:table-cell"
                  >
                    {tr("Muddati")}
                  </SortableHead>
                  <SortableHead
                    column="status"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("Holati")}
                  </SortableHead>
                  <SortableHead
                    column="discount_amount"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    {tr("Chegirma")}
                  </SortableHead>
                  <SortableHead
                    column="total_amount"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    {tr("Umumiy summa")}
                  </SortableHead>
                  <SortableHead
                    column="paid_amount"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    {tr("To'landi")}
                  </SortableHead>
                  <SortableHead
                    column="remaining"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    {tr("Qoldiq")}
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6 text-gray-400">
                      {empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((inv) => {
                    const remaining = remainingOf(inv.total_amount, inv.paid_amount)
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.invoice_number}
                        </TableCell>
                        <TableCell className="max-w-[180px] py-1.5">
                          <Who inv={inv} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {inv.invoice_date || "-"}
                          {inv.due_date && (
                            <span className="block text-[11px] text-gray-400 2xl:hidden">
                              {tr("muddati: {{date}}", { date: inv.due_date })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden 2xl:table-cell">{inv.due_date || "-"}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              statusBadge[inv.status] || statusBadge.DRAFT
                            )}
                          >
                            {STATUS_LABELS[inv.status] || inv.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(inv.discount_amount || 0) > 0 ? (
                            <span className="font-medium text-red-500">
                              {tr("−{{discount_amount}} So'm", { discount_amount: fmt(inv.discount_amount) })}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {tr("{{total_amount}} So'm", { total_amount: fmt(inv.total_amount) })}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          {tr("{{paid_amount}} So'm", { paid_amount: fmt(inv.paid_amount) })}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold",
                            remaining > 0 ? "text-amber-600" : "text-gray-400"
                          )}
                        >
                          {tr("{{remaining}} So'm", { remaining: fmt(remaining) })}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            {pager}
          </div>

          {/* MOBIL: sahifalagich kartalar ostida */}
          <div className="overflow-hidden rounded-2xl border md:hidden">{pager}</div>
        </>
      )}
    </div>
  )
}
