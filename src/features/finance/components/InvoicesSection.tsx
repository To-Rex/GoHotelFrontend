import { useEffect, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { SortableHead, TablePager, TableSearch } from "@/components/ui/table-tools"
import { cn } from "@/lib/utils"
import { useInvoicesPage } from "../api/finance"
import {
  PAGE_SIZE,
  clampPage,
  initialTableState,
  pageCount,
  rangeLabel,
  setSearch,
  toggleSort,
} from "../lib/tableState"

/** Hisob-fakturalar jadvali — sahifalab, qidirib va saralab. */

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Qoralama",
  ISSUED: "Taqdim etilgan",
  PARTIALLY_PAID: "Qisman to'langan",
  PAID: "To'langan",
  VOID: "Bekor qilingan",
  REFUNDED: "Qaytarilgan",
}

const statusBadge: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  VOID: "bg-red-100 text-red-600",
  REFUNDED: "bg-purple-100 text-purple-700",
}

const selectClass =
  "flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

const fmt = (n: number) => Number(n || 0).toLocaleString()

const remainingOf = (total?: number | null, paid?: number | null) =>
  Math.max(Number(total || 0) - Number(paid || 0), 0)

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

  useEffect(() => {
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }, [dateFrom, dateTo, status])

  const { data, isLoading, isFetching } = useInvoicesPage({
    dateFrom,
    dateTo,
    status: status || undefined,
    state,
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
  const empty = state.search
    ? "Qidiruv bo'yicha hisob-faktura topilmadi"
    : "Tanlangan davrda hisob-fakturalar yo'q"

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
      {/* Sarlavha bo'lim menyusining yonida — bu yerda faqat filtrlar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <TableSearch
          className="w-full sm:w-64"
          value={state.search}
          onChange={(value) => setState((s) => setSearch(s, value))}
          placeholder="Hujjat raqami bo'yicha..."
        />
        <select
          className={cn(selectClass, "w-auto min-w-[170px]")}
          value={status}
          onChange={(e) => onStatus(e.target.value)}
        >
          <option value="">Barcha holatlar</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
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
                          {inv.invoice_date || "-"} · muddati: {inv.due_date || "-"}
                        </p>
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
                        <p className="text-[11px] text-gray-400">Umumiy summa</p>
                        <p className="font-medium text-gray-900">
                          {fmt(inv.total_amount)} So'm
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">To'landi</p>
                        <p className="font-semibold text-green-600">
                          {fmt(inv.paid_amount)} So'm
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Chegirma</p>
                        {Number(inv.discount_amount || 0) > 0 ? (
                          <p className="font-medium text-red-500">
                            −{fmt(inv.discount_amount)} So'm
                          </p>
                        ) : (
                          <p className="text-gray-300">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Qoldiq</p>
                        <p
                          className={cn(
                            "font-semibold",
                            remaining > 0 ? "text-amber-600" : "text-gray-400"
                          )}
                        >
                          {fmt(remaining)} So'm
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
                    Raqami
                  </SortableHead>
                  <SortableHead
                    column="invoice_date"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    Sana
                  </SortableHead>
                  <SortableHead
                    column="due_date"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    Muddati
                  </SortableHead>
                  <SortableHead
                    column="status"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    Holati
                  </SortableHead>
                  <SortableHead
                    column="discount_amount"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    Chegirma
                  </SortableHead>
                  <SortableHead
                    column="total_amount"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    Umumiy summa
                  </SortableHead>
                  <SortableHead
                    column="paid_amount"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    To'landi
                  </SortableHead>
                  <SortableHead
                    column="remaining"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    Qoldiq
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-gray-400">
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
                        <TableCell>{inv.invoice_date || "-"}</TableCell>
                        <TableCell>{inv.due_date || "-"}</TableCell>
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
                              −{fmt(inv.discount_amount)} So'm
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(inv.total_amount)} So'm
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          {fmt(inv.paid_amount)} So'm
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold",
                            remaining > 0 ? "text-amber-600" : "text-gray-400"
                          )}
                        >
                          {fmt(remaining)} So'm
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
