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
import {
  isPartiallyPaid,
  salePaid,
  saleRemaining,
  useShopSalesPage,
  type ShopSale,
} from "@/features/shop/api/shop"
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
import { tr } from "@/i18n"
import {
  AmountRange,
  FoundLine,
  OptionSelect,
  ResetFilters,
  SortSelect,
} from "./FilterControls"
import {
  DEBT_SALE_SORT_OPTIONS,
  EMPTY_SALE_FILTERS,
  METHOD_OPTIONS,
  PAID_SALE_SORT_OPTIONS,
  SALE_LINK_OPTIONS,
  saleFilterCount,
  saleFilterParams,
  type SaleFilters,
  type SaleLink,
} from "../lib/financeFilters"

/**
 * Do'kon: bronga yozilgan qarzlar va davrdagi to'langan savdolar.
 *
 * Ikkala ro'yxat ham sahifalanadi. Qarzlar sanaga bog'lanmaydi — bu
 * joriy qoldiq, davr hodisasi emas; to'langan savdolar esa TO'LOV sanasi
 * bo'yicha, chunki bronga yozilib keyin to'langan sotuv aynan to'langan
 * kun tushumiga tushadi.
 *
 * Har ro'yxatning o'z filtrlari (serverda, sahifalash bilan birga):
 * qidiruv (bron, mehmon, xona, mahsulot), summa oralig'i; to'langan
 * savdolarda yana to'lov turi va "bronga yozilgan / bronsiz". "Topildi"
 * satrida butun natija soni va summasi (qarzlarda — qolgan qarz).
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

const itemsText = (sale: ShopSale) =>
  sale.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")

const stamp = (value?: string | null) =>
  value ? format(new Date(value), "dd.MM.yyyy HH:mm") : "—"

/** Bronga yozilgan savdo kimga: "Xona 12 · Ali Valiyev" (bronsizda bo'sh) */
const buyerText = (sale: ShopSale) =>
  [sale.room_number ? tr("Xona {{room}}", { room: sale.room_number }) : "", sale.guest_name || ""]
    .filter(Boolean)
    .join(" · ")

/** Bron katagi: raqami, ostida xona va mehmon */
function BookingCell({ sale }: { sale: ShopSale }) {
  const buyer = buyerText(sale)
  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate">{sale.reservation_number || "—"}</p>
      {buyer && (
        <p className="truncate text-[11px] font-normal text-gray-400" title={buyer}>
          {buyer}
        </p>
      )}
    </div>
  )
}

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
  const [filters, setFiltersState] = useState<SaleFilters>(EMPTY_SALE_FILTERS)
  const setFilters = (update: (f: SaleFilters) => SaleFilters) => {
    setFiltersState(update)
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }
  const filterCount = saleFilterCount(filters) + (state.search.trim() ? 1 : 0)

  useEffect(() => {
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }, [opts.resetKey])

  const { data, isLoading, isFetching } = useShopSalesPage({
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    status: opts.status,
    dateBy: opts.dateBy,
    state,
    filters: saleFilterParams(filters),
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
    filters,
    setFilters,
    filterCount,
    filtering: filterCount > 0,
    reset: () => {
      setFiltersState(EMPTY_SALE_FILTERS)
      setState((s) => setSearch(s, ""))
    },
    /** Filtrdan o'tgan barcha savdolar summasi / qoldig'i (eski serverda null) */
    amount: data?.amount ?? null,
    remaining: data?.remaining ?? null,
    rows,
    total,
    isLoading,
    isFetching,
    pages: pageCount(total),
    // Bron raqami birinchi bosishda A dan Z gacha
    sort: (column: string) =>
      setState((s) => toggleSort(s, column, column === "reservation_number" || column === "payment_method" ? "asc" : "desc")),
    setSort: ({ sortBy, sortDir }: { sortBy: string; sortDir: TableState["sortDir"] }) =>
      setState((s) => ({ ...s, sortBy, sortDir, page: 0 })),
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
      {(debts.total > 0 || debts.filtering) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold tracking-tight text-gray-800">
              {tr("Do'kon qarzlari (bronga yozilgan)")}
            </h2>
            <TableSearch
              className="w-full sm:w-72"
              value={debts.state.search}
              onChange={(value) => debts.setState((s) => setSearch(s, value))}
              placeholder={tr("Bron, mehmon, xona yoki mahsulot...")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AmountRange
              min={debts.filters.minAmount}
              max={debts.filters.maxAmount}
              onChange={({ min, max }) => debts.setFilters((f) => ({ ...f, minAmount: min, maxAmount: max }))}
            />
            <SortSelect
              sortBy={debts.state.sortBy}
              sortDir={debts.state.sortDir}
              options={DEBT_SALE_SORT_OPTIONS}
              onChange={debts.setSort}
            />
            <ResetFilters count={debts.filterCount} onReset={debts.reset} />
            {debts.filtering && (
              <FoundLine
                count={debts.total}
                busy={debts.isFetching}
                extra={
                  debts.remaining !== null ? (
                    <span>
                      {tr("qarz")}{" "}
                      <b className="font-semibold tabular-nums text-amber-600">
                        {tr("{{amount}} So'm", { amount: fmt(debts.remaining) })}
                      </b>
                    </span>
                  ) : null
                }
              />
            )}
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
                      {[stamp(s.created_at), buyerText(s)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-right font-semibold text-amber-600">
                    {/* Qarz — to'lanmagan qoldiq (qisman to'langan bo'lsa) */}
                    {tr("{{total_amount}} So'm", { total_amount: fmt(saleRemaining(s)) })}
                    {isPartiallyPaid(s) && (
                      <span className="block text-[11px] font-normal text-gray-400">
                        {tr("jami {{total}} · to'langan {{paid}}", { total: fmt(s.total_amount), paid: fmt(salePaid(s)) })}
                      </span>
                    )}
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
                  <SortableHead
                    column="reservation_number"
                    active={debts.state.sortBy}
                    dir={debts.state.sortDir}
                    onSort={debts.sort}
                  >
                    {tr("Bron")}
                  </SortableHead>
                  <SortableHead
                    column="created_at"
                    active={debts.state.sortBy}
                    dir={debts.state.sortDir}
                    onSort={debts.sort}
                  >
                    {tr("Vaqt")}
                  </SortableHead>
                  <TableHead>{tr("Mahsulotlar")}</TableHead>
                  {/* Ustunda qolgan qarz ko'rinadi — saralash ham shu bo'yicha */}
                  <SortableHead
                    column="remaining"
                    active={debts.state.sortBy}
                    dir={debts.state.sortDir}
                    onSort={debts.sort}
                    align="right"
                  >
                    {tr("Summa")}
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-gray-400">
                      {tr("Filtr bo'yicha qarz topilmadi")}
                    </TableCell>
                  </TableRow>
                ) : (
                  debts.rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-[220px] font-medium">
                        <BookingCell sale={s} />
                      </TableCell>
                      <TableCell>{stamp(s.created_at)}</TableCell>
                      <TableCell className="text-gray-500 max-w-[320px] truncate">
                        {itemsText(s)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">
                        {/* Qarz — to'lanmagan qoldiq (qisman to'langan bo'lsa) */}
                        {tr("{{total_amount}} So'm", { total_amount: fmt(saleRemaining(s)) })}
                        {isPartiallyPaid(s) && (
                          <span className="block text-[11px] font-normal text-gray-400">
                            {tr("jami {{total}} · to'langan {{paid}}", { total: fmt(s.total_amount), paid: fmt(salePaid(s)) })}
                          </span>
                        )}
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
            {tr("To'lov Do'kon sahifasidagi \"To'lash\" tugmasi orqali qabul qilinadi — shundan so'ng summa tanlangan kun tushumiga qo'shiladi.")}
          </p>
        </div>
      )}

      {/* Do'kon sotuvlari (to'langan) — davr bo'yicha */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight text-gray-800">{tr("Do'kon sotuvlari")}</h2>
          <TableSearch
            className="w-full sm:w-72"
            value={paid.state.search}
            onChange={(value) => paid.setState((s) => setSearch(s, value))}
            placeholder={tr("Bron, mehmon, xona yoki mahsulot...")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OptionSelect
            label={tr("To'lov turi")}
            allLabel={tr("Barcha to'lov turlari")}
            options={METHOD_OPTIONS}
            value={paid.filters.method ?? ""}
            onChange={(v) => paid.setFilters((f) => ({ ...f, method: v || null }))}
          />
          <OptionSelect
            label={tr("Kimga sotilgan")}
            allLabel={tr("Bronli va bronsiz")}
            options={SALE_LINK_OPTIONS}
            value={paid.filters.linked}
            onChange={(v) => paid.setFilters((f) => ({ ...f, linked: v as SaleLink }))}
          />
          <AmountRange
            min={paid.filters.minAmount}
            max={paid.filters.maxAmount}
            onChange={({ min, max }) => paid.setFilters((f) => ({ ...f, minAmount: min, maxAmount: max }))}
          />
          <SortSelect
            sortBy={paid.state.sortBy}
            sortDir={paid.state.sortDir}
            options={PAID_SALE_SORT_OPTIONS}
            onChange={paid.setSort}
          />
          <ResetFilters count={paid.filterCount} onReset={paid.reset} />
        </div>
        {paid.filtering && !paid.isLoading && (
          <FoundLine count={paid.total} amount={paid.amount} busy={paid.isFetching} />
        )}

        {/* MOBIL: sotuvlar karta ko'rinishida (jadval planshet/desktopda) */}
        <div className="space-y-2.5 md:hidden">
          {paid.rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
              {paid.filtering
                ? tr("Filtr bo'yicha sotuv topilmadi")
                : tr("Tanlangan davrda sotuv yo'q")}
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
                      {tr("Bron: {{v}}", { v: s.reservation_number || "—" })}
                      {buyerText(s) ? ` · ${buyerText(s)}` : ""}
                    </p>
                  </div>
                  <span className="flex-shrink-0 font-semibold text-green-600">
                    {tr("{{total_amount}} So'm", { total_amount: fmt(s.total_amount) })}
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
                  {tr("To'langan vaqt")}
                </SortableHead>
                <TableHead>{tr("Mahsulotlar")}</TableHead>
                <SortableHead
                  column="payment_method"
                  active={paid.state.sortBy}
                  dir={paid.state.sortDir}
                  onSort={paid.sort}
                >
                  {tr("To'lov turi")}
                </SortableHead>
                <SortableHead
                  column="reservation_number"
                  active={paid.state.sortBy}
                  dir={paid.state.sortDir}
                  onSort={paid.sort}
                >
                  {tr("Bron")}
                </SortableHead>
                <SortableHead
                  column="total_amount"
                  active={paid.state.sortBy}
                  dir={paid.state.sortDir}
                  onSort={paid.sort}
                  align="right"
                >
                  {tr("Summa")}
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paid.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                    {paid.filtering
                      ? tr("Filtr bo'yicha sotuv topilmadi")
                      : tr("Tanlangan davrda sotuv yo'q")}
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
                    <TableCell className="max-w-[220px] text-gray-500">
                      <BookingCell sale={s} />
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      {tr("{{total_amount}} So'm", { total_amount: fmt(s.total_amount) })}
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
