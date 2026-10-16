import { useEffect, useState } from "react"
import { Pencil } from "lucide-react"

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
import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"
import { usePermissions } from "@/lib/permissions"
import { usePaymentsPage } from "../api/finance"
import { canEditPaymentMethod } from "../lib/paymentEdit"
import { PaymentMethodEditDialog } from "./PaymentMethodEditDialog"
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
import type { PaymentRecord } from "@/types/api"

/**
 * To'lovlar jadvali — sahifalab, qidirib va saralab.
 *
 * Ilgari davrning barcha to'lovlari bir vaqtda chizilardi. Kunlik
 * hisobotda bu sezilmasdi, lekin "Shu oy" yoki "Barcha davr" tanlanganda
 * jadval bir necha ming qatorga cho'zilib ketardi va sahifadan
 * foydalanib bo'lmasdi.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

export function PaymentsSection({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string
  dateTo?: string
}) {
  const [state, setState] = useState(() => initialTableState("payment_date"))

  // To'lov turini tahrirlash: admin cheklovsiz, menejer faqat oxirgi
  // 2 kunlik to'lovlarda (server ham xuddi shunday tekshiradi)
  const { isAdmin, can } = usePermissions()
  const canEdit = isAdmin || can("shift.force_close")
  const [editTarget, setEditTarget] = useState<PaymentRecord | null>(null)
  const methodEditable = (p: PaymentRecord) =>
    canEditPaymentMethod({ payment: p, isAdmin, canForceClose: canEdit })
  const editTitle = (p: PaymentRecord) =>
    canEdit
      ? methodEditable(p)
        ? tr("To'lov turini tahrirlash")
        : tr("Menejer faqat oxirgi 2 kunlik to'lovlarni tahrirlay oladi")
      : ""

  // Davr o'zgarsa birinchi sahifaga qaytiladi: 7-sahifada turib boshqa
  // oyga o'tgan odam bo'sh ekran ko'rmasligi kerak
  useEffect(() => {
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }, [dateFrom, dateTo])

  const { data, isLoading, isFetching } = usePaymentsPage({
    dateFrom,
    dateTo,
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

  // Bir xil sahifalagich ikki joyda: jadval ostida (desktop) va kartalar
  // ostida (mobil) — ikkalasi bir xil holatni boshqaradi
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
      {/* Sarlavha bo'lim menyusining yonida yoziladi — bu yerda takrorlash
          o'rniga faqat qidiruv turadi */}
      <div className="flex justify-end">
        <TableSearch
          className="w-full sm:w-72"
          value={state.search}
          onChange={(value) => setState((s) => setSearch(s, value))}
          placeholder={tr("Raqam yoki izoh bo'yicha...")}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {/* MOBIL: to'lovlar karta ko'rinishida (jadval planshet/desktopda) */}
          <div className="space-y-2.5 md:hidden">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
                {state.search
                  ? tr("Qidiruv bo'yicha to'lov topilmadi")
                  : tr("Tanlangan davrda to'lovlar yo'q")}
              </div>
            ) : (
              rows.map((p) => (
                <div key={p.id} className="rounded-2xl border bg-white p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight text-gray-900">
                        {p.payment_number}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                        {p.payment_date || "-"}
                      </p>
                    </div>
                    <span className="flex-shrink-0 font-semibold text-green-600">
                      {tr("{{amount}} So'm", { amount: fmt(p.amount) })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditTarget(p)}
                        disabled={!methodEditable(p)}
                        title={editTitle(p)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {tr("Tahrirlash")}
                      </button>
                    )}
                  </div>
                  {(p.notes || p.reference) && (
                    <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
                      {p.notes || p.reference}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    column="payment_number"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("Raqami")}
                  </SortableHead>
                  <SortableHead
                    column="payment_date"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("Sana")}
                  </SortableHead>
                  <SortableHead
                    column="payment_method"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                  >
                    {tr("To'lov turi")}
                  </SortableHead>
                  <TableHead>{tr("Izoh")}</TableHead>
                  <SortableHead
                    column="amount"
                    active={state.sortBy}
                    dir={state.sortDir}
                    onSort={sort}
                    align="right"
                  >
                    {tr("Summa")}
                  </SortableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-gray-400">
                      {state.search
                        ? tr("Qidiruv bo'yicha to'lov topilmadi")
                        : tr("Tanlangan davrda to'lovlar yo'q")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.payment_number}</TableCell>
                      <TableCell>{p.payment_date || "-"}</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 max-w-[240px] truncate">
                        {p.notes || p.reference || "-"}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-semibold">
                        {tr("{{amount}} So'm", { amount: fmt(p.amount) })}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditTarget(p)}
                            disabled={!methodEditable(p)}
                            title={editTitle(p)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {pager}
          </div>

          {/* MOBIL: sahifalagich jadval kartalari ostida */}
          <div className="overflow-hidden rounded-2xl border md:hidden">{pager}</div>
        </>
      )}

      <PaymentMethodEditDialog
        payment={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}
