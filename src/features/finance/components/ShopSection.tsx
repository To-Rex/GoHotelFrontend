import { useEffect, useState } from "react"
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
import { SortableHead, TablePager, TableSearch } from "@/components/ui/table-tools"
import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"
import { useShopSalesPage, type ShopSale } from "@/features/shop/api/shop"
import {
  PAGE_SIZE,
  clampPage,
  initialTableState,
  pageCount,
  rangeLabel,
  setSearch,
  toggleSort,
  type TableState,
} from "@/lib/tableState"

/**
 * Do'kon: bronga yozilgan qarzlar va davrdagi to'langan savdolar.
 *
 * Ikkala ro'yxat ham sahifalanadi. Qarzlar sanaga bog'lanmaydi — bu
 * joriy qoldiq, davr hodisasi emas; to'langan savdolar esa TO'LOV sanasi
 * bo'yicha, chunki bronga yozilib keyin to'langan sotuv aynan to'langan
 * kun tushumiga tushadi.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

const itemsText = (sale: ShopSale) =>
  sale.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")

const stamp = (value?: string | null) =>
  value ? format(new Date(value), "dd.MM.yyyy HH:mm") : "—"

/** Bir ro'yxatning holati va so'rovi — ikkala jadval uchun bir xil. */
function useSalesTable(opts: {
  dateFrom?: string
  dateTo?: string
  status: "PAID" | "PENDING"
  dateBy?: "created" | "paid"
  defaultSort: string
  resetKey: string
}) {
  const [state, setState] = useState<TableState>(() =>
    initialTableState(opts.defaultSort)
  )

  useEffect(() => {
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }, [opts.resetKey])

  const { data, isLoading, isFetching } = useShopSalesPage({
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    status: opts.status,
    dateBy: opts.dateBy,
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

  return {
    state,
    setState,
    rows,
    total,
    isLoading,
    isFetching,
    pages: pageCount(total),
    sort: (column: string) => setState((s) => toggleSort(s, column)),
    pager: (
      <TablePager
        page={state.page}
        pageCount={pageCount(total)}
        busy={isFetching}
        label={rangeLabel(state.page, rows.length, total)}
        onPage={(page) =>
          setState((s) => ({ ...s, page: clampPage(page, total, PAGE_SIZE) }))
        }
      />
    ),
  }
}

export function ShopSection({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string
  dateTo?: string
}) {
  // Qarzlar davrga bog'lanmaydi — shuning uchun sana berilmaydi va
  // davr o'zgarganda sahifa ham tiklanmaydi
  const debts = useSalesTable({
    status: "PENDING",
    defaultSort: "created_at",
    resetKey: "",
  })
  const paid = useSalesTable({
    dateFrom,
    dateTo,
    status: "PAID",
    dateBy: "paid",
    defaultSort: "paid_at",
    resetKey: `${dateFrom || ""}|${dateTo || ""}`,
  })

  if (debts.isLoading && paid.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Do'kon qarzlari — bronga yozilgan, hali to'lanmagan sotuvlar.

          Qarz umuman bo'lmasa bo'lim ko'rsatilmaydi (avvalgidek). Lekin
          qidiruv natija bermaganda ham `total` nolga tushadi — o'shanda
          bo'limni yashirish qidiruv maydonini ham olib ketardi va uni
          tozalashning iloji qolmasdi. */}
      {(debts.total > 0 || debts.state.search) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold tracking-tight text-gray-800">
              Do'kon qarzlari (bronga yozilgan)
            </h2>
            <TableSearch
              className="w-full sm:w-72"
              value={debts.state.search}
              onChange={(value) => debts.setState((s) => setSearch(s, value))}
              placeholder="Bron raqami yoki mahsulot..."
            />
          </div>

          {/* MOBIL: qarzlar karta ko'rinishida (jadval planshet/desktopda) */}
          <div className="space-y-2.5 md:hidden">
            {debts.rows.map((s) => (
              <div key={s.id} className="rounded-2xl border bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight text-gray-900">
                      {s.reservation_number || "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                      {stamp(s.created_at)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 font-semibold text-amber-600">
                    {fmt(s.total_amount)} So'm
                  </span>
                </div>
                <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
                  {itemsText(s)}
                </p>
              </div>
            ))}
          </div>

          {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bron</TableHead>
                  <SortableHead
                    column="created_at"
                    active={debts.state.sortBy}
                    dir={debts.state.sortDir}
                    onSort={debts.sort}
                  >
                    Vaqt
                  </SortableHead>
                  <TableHead>Mahsulotlar</TableHead>
                  <SortableHead
                    column="total_amount"
                    active={debts.state.sortBy}
                    dir={debts.state.sortDir}
                    onSort={debts.sort}
                    align="right"
                  >
                    Summa
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-gray-400">
                      Qidiruv bo'yicha qarz topilmadi
                    </TableCell>
                  </TableRow>
                ) : (
                  debts.rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.reservation_number || "—"}
                      </TableCell>
                      <TableCell>{stamp(s.created_at)}</TableCell>
                      <TableCell className="text-gray-500 max-w-[320px] truncate">
                        {itemsText(s)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">
                        {fmt(s.total_amount)} So'm
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {debts.pager}
          </div>
          <div className="overflow-hidden rounded-2xl border md:hidden">
            {debts.pager}
          </div>

          <p className="text-[11px] text-gray-400">
            To'lov Do'kon sahifasidagi "To'lash" tugmasi orqali qabul qilinadi —
            shundan so'ng summa tanlangan kun tushumiga qo'shiladi.
          </p>
        </div>
      )}

      {/* Do'kon sotuvlari (to'langan) — davr bo'yicha */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight text-gray-800">Do'kon sotuvlari</h2>
          <TableSearch
            className="w-full sm:w-72"
            value={paid.state.search}
            onChange={(value) => paid.setState((s) => setSearch(s, value))}
            placeholder="Bron raqami yoki mahsulot..."
          />
        </div>

        {/* MOBIL: sotuvlar karta ko'rinishida (jadval planshet/desktopda) */}
        <div className="space-y-2.5 md:hidden">
          {paid.rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
              {paid.state.search
                ? "Qidiruv bo'yicha sotuv topilmadi"
                : "Tanlangan davrda sotuv yo'q"}
            </div>
          ) : (
            paid.rows.map((s) => (
              <div key={s.id} className="rounded-2xl border bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight text-gray-900">
                      {stamp(s.paid_at)}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                      Bron: {s.reservation_number || "—"}
                    </p>
                  </div>
                  <span className="flex-shrink-0 font-semibold text-green-600">
                    {fmt(s.total_amount)} So'm
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {PAYMENT_METHOD_LABELS[s.payment_method || ""] ||
                      s.payment_method ||
                      "—"}
                  </span>
                </div>
                <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
                  {itemsText(s)}
                </p>
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
                  column="paid_at"
                  active={paid.state.sortBy}
                  dir={paid.state.sortDir}
                  onSort={paid.sort}
                >
                  To'langan vaqt
                </SortableHead>
                <TableHead>Mahsulotlar</TableHead>
                <TableHead>To'lov turi</TableHead>
                <TableHead>Bron</TableHead>
                <SortableHead
                  column="total_amount"
                  active={paid.state.sortBy}
                  dir={paid.state.sortDir}
                  onSort={paid.sort}
                  align="right"
                >
                  Summa
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paid.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                    {paid.state.search
                      ? "Qidiruv bo'yicha sotuv topilmadi"
                      : "Tanlangan davrda sotuv yo'q"}
                  </TableCell>
                </TableRow>
              ) : (
                paid.rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{stamp(s.paid_at)}</TableCell>
                    <TableCell className="text-gray-500 max-w-[320px] truncate">
                      {itemsText(s)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {PAYMENT_METHOD_LABELS[s.payment_method || ""] ||
                          s.payment_method ||
                          "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {s.reservation_number || "—"}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      {fmt(s.total_amount)} So'm
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {paid.pager}
        </div>
        <div className="overflow-hidden rounded-2xl border md:hidden">{paid.pager}</div>
      </div>
    </div>
  )
}
