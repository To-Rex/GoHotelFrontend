import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Info,
  Loader2,
  PackageMinus,
  PackageOpen,
  Receipt,
  TrendingDown,
  TrendingUp,
  Warehouse,
  Coins,
} from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SortableHead, TablePager, TableSearch } from "@/components/ui/table-tools"
import { cn } from "@/lib/utils"
import { initialTableState, setSearch, tableView, toggleSort, type TableState } from "@/lib/tableState"
import { tr } from "@/i18n"
import { profitUnavailable, useShopProfit, type ShopProfit, type ShopProfitProduct } from "../api/shopProfit"
import {
  PRODUCT_SEARCH,
  PRODUCT_SORTS,
  PRODUCT_SORT_OPTIONS,
  TONE_TEXT,
  costStatusBadge,
  hasActivity,
  isLossRow,
  lossParts,
  marginText,
  netFormula,
  netUnknown,
  profitUnknown,
  signed,
  toneOf,
} from "../lib/shopProfit"
import { BatchCostDialog } from "./BatchCostDialog"
import { SortSelect } from "./FilterControls"

/* Moliya → Do'kon: foyda va zarar statistikasi.

   Davr — sotuv sanasi (mahsulot qaysi kuni sotilgan bo'lsa); yuqoridagi
   "Do'kon tushumi" esa pul olingan kun bo'yicha — shuning uchun "Sotuv"
   kartasida to'lanmagan qism (bronda) alohida aytiladi.

   Tartib: to'rtta karta (sotuv, tannarx, yalpi foyda, yo'qotishlar), so'ng
   ular xulosasi — "Do'kon sof foydasi" (qayerdan chiqqani bilan), keyin
   ogohlantirishlar (tannarxsiz sotuv, taxminiy tannarx, tannarxidan arzon
   sotuv), ombordagi qoldiq qiymati va mahsulotlar kesimi. Tannarxi yo'q
   partiyalarga do'kon boshqaruvchisi shu yerdan tannarx kiritadi. */

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString()
const som = (n: number) => tr("{{amount}} So'm", { amount: fmt(n) })

function StatCard({
  icon: Icon,
  accent,
  label,
  value,
  valueClass,
  sub,
}: {
  icon: typeof Receipt
  accent: string
  label: string
  value: string
  valueClass?: string
  sub?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-white p-4">
      <span className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg", accent)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn("truncate text-lg font-bold tabular-nums text-gray-900", valueClass)}>{value}</p>
        {sub && <div className="text-[11px] leading-4 text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

function Notice({
  tone,
  icon: Icon,
  children,
  action,
}: {
  tone: "amber" | "sky" | "red"
  icon: typeof Info
  children: React.ReactNode
  action?: React.ReactNode
}) {
  const cls = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    red: "border-red-200 bg-red-50 text-red-700",
  }[tone]
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-xs", cls)}>
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <Icon className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <span className="min-w-0">{children}</span>
      </span>
      {action}
    </div>
  )
}

/** Mahsulot nomi va tannarx holati belgisi */
function ProductName({ row }: { row: ShopProfitProduct }) {
  const badge = costStatusBadge(row.cost_status)
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="truncate font-medium text-gray-900">
        {row.emoji ? `${row.emoji} ` : ""}
        {row.name}
      </span>
      {!row.is_active && (
        <span className="rounded bg-gray-100 px-1 text-[10px] font-medium leading-4 text-gray-500">{tr("nofaol")}</span>
      )}
      {badge && (
        <span
          title={badge.title}
          className={cn("rounded px-1 text-[10px] font-semibold leading-4 ring-1 ring-inset", badge.className)}
        >
          {badge.label}
        </span>
      )}
    </div>
  )
}

/** Yo'qotish katagi: summa va tarkibi (spisaniye / kamomad / ortiqcha) */
function LossCell({ row }: { row: ShopProfitProduct }) {
  const parts: string[] = []
  if (row.writeoff_qty) parts.push(tr("spisaniye {{qty}}", { qty: row.writeoff_qty }))
  if (row.shortage_qty) parts.push(tr("kamomad {{qty}}", { qty: row.shortage_qty }))
  if (row.surplus_qty) parts.push(tr("ortiqcha {{qty}}", { qty: row.surplus_qty }))
  if (parts.length === 0) return <span className="text-gray-300">—</span>
  return (
    <div className="leading-tight">
      <span className={cn("tabular-nums", toneOf(row.losses) === "pos" ? "text-red-600" : "text-emerald-700")}>
        {toneOf(row.losses) === "zero" ? "0" : signed(-row.losses)}
      </span>
      <span className="block text-[10px] text-gray-400">{tr("{{parts}} dona", { parts: parts.join(", ") })}</span>
    </div>
  )
}

function ProductsTable({ profit }: { profit: ShopProfit }) {
  const [state, setState] = useState<TableState>(() => initialTableState("net", "desc"))
  const view = useMemo(
    () => tableView(profit.products, state, { search: PRODUCT_SEARCH, sort: PRODUCT_SORTS }, 20),
    [profit.products, state]
  )
  // Davr almashsa sahifa boshiga
  useEffect(() => {
    setState((s) => (s.page === 0 ? s : { ...s, page: 0 }))
  }, [profit.date_from, profit.date_to])

  const sort = (column: string) =>
    setState((s) => toggleSort(s, column, column === "name" ? "asc" : "desc"))
  const head = (column: string, label: string, align: "left" | "right" = "right") => (
    <SortableHead column={column} active={state.sortBy} dir={state.sortDir} onSort={sort} align={align}>
      {label}
    </SortableHead>
  )
  const pager =
    view.total > 0 ? (
      <TablePager
        page={view.page}
        pageCount={view.pageCount}
        label={view.label}
        onPage={(page) => setState((s) => ({ ...s, page }))}
      />
    ) : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-800">{tr("Mahsulotlar bo'yicha")}</h3>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <TableSearch
            className="w-full sm:w-60"
            value={state.search}
            onChange={(v) => setState((s) => setSearch(s, v))}
            placeholder={tr("Mahsulot nomi...")}
          />
          <SortSelect
            sortBy={state.sortBy}
            sortDir={state.sortDir}
            options={PRODUCT_SORT_OPTIONS}
            onChange={({ sortBy, sortDir }) => setState((s) => ({ ...s, sortBy, sortDir, page: 0 }))}
          />
        </div>
      </div>

      {/* MOBIL: kartalar */}
      <div className="space-y-2 md:hidden">
        {view.total === 0 ? (
          <div className="rounded-2xl border border-dashed py-8 text-center text-sm text-gray-400">
            {tr("Mahsulot topilmadi")}
          </div>
        ) : (
          view.rows.map((r) => (
            <div
              key={r.product_id}
              className={cn("rounded-2xl border bg-white p-3.5", isLossRow(r) && "border-red-200 bg-red-50/40")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <ProductName row={r} />
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {tr("{{qty}} dona · sotuv {{revenue}} · tannarx {{cost}}", {
                      qty: r.sold_qty,
                      revenue: fmt(r.revenue),
                      cost: profitUnknown(r) ? "—" : fmt(r.cost),
                    })}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={cn("font-semibold tabular-nums", TONE_TEXT[toneOf(r.net)])}>
                    {netUnknown(r) ? "—" : signed(r.net)}
                  </p>
                  <p className="text-[11px] text-gray-400">{tr("marja {{m}}", { m: marginText(r.margin) })}</p>
                </div>
              </div>
              {(r.writeoff_qty || r.shortage_qty || r.surplus_qty) > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 text-xs">
                  <span className="text-gray-500">{tr("Yo'qotish")}</span>
                  <LossCell row={r} />
                </div>
              )}
            </div>
          ))
        )}
        {pager && <div className="overflow-hidden rounded-2xl border bg-white">{pager}</div>}
      </div>

      {/* DESKTOP: jadval */}
      <div className="hidden overflow-hidden rounded-md border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {head("name", tr("Mahsulot"), "left")}
              {head("sold_qty", tr("Sotildi"))}
              {head("revenue", tr("Sotuv"))}
              {head("cost", tr("Tannarx"))}
              {head("profit", tr("Foyda"))}
              {head("margin", tr("Marja"))}
              {head("losses", tr("Yo'qotish"))}
              {head("net", tr("Natija"))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.total === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-gray-400">
                  {tr("Mahsulot topilmadi")}
                </TableCell>
              </TableRow>
            ) : (
              view.rows.map((r) => (
                <TableRow key={r.product_id} className={cn(isLossRow(r) && "bg-red-50/40")}>
                  <TableCell className="max-w-[260px]">
                    <ProductName row={r} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.sold_qty || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.revenue ? fmt(r.revenue) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-gray-600">
                    {r.cost ? fmt(r.cost) : "—"}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", TONE_TEXT[toneOf(r.profit)])}>
                    {r.sold_qty && !profitUnknown(r) ? signed(r.profit) : "—"}
                    {r.below_cost_qty > 0 && (
                      <span className="block text-[10px] text-red-500">
                        {tr("{{qty}} dona tannarxidan arzon", { qty: r.below_cost_qty })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-gray-600">{marginText(r.margin)}</TableCell>
                  <TableCell className="text-right">
                    <LossCell row={r} />
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold tabular-nums", TONE_TEXT[toneOf(r.net)])}>
                    {netUnknown(r) ? "—" : signed(r.net)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {pager}
      </div>
    </div>
  )
}

export function ShopProfitPanel({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { data: profit, isLoading, isError, error, isFetching, refetch } = useShopProfit(dateFrom, dateTo)
  const [costOpen, setCostOpen] = useState(false)

  // Ruxsat yo'q (oddiy sotuvchi) yoki eski server — panel ko'rinmaydi
  if (isError && profitUnavailable(error)) return null

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !profit) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {tr("Do'kon foydasini yuklab bo'lmadi")}
        <button type="button" onClick={() => refetch()} className="text-xs font-semibold underline">
          {tr("Qayta urinish")}
        </button>
      </div>
    )
  }

  const net = profit.net_profit
  const netTone = toneOf(net)
  const active = hasActivity(profit)
  const losses = lossParts(profit)
  const missing = profit.missing_cost_batches
  const costButton =
    profit.can_edit_cost && missing.length > 0 ? (
      <button
        type="button"
        onClick={() => setCostOpen(true)}
        className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 transition-colors hover:bg-amber-100"
      >
        <PackageOpen className="h-3.5 w-3.5" />
        {tr("Tannarxni kiritish ({{count}})", { count: missing.length })}
      </button>
    ) : null

  return (
    <section className="space-y-4" aria-labelledby="shop-profit-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="shop-profit-title" className="flex items-center gap-2 text-base font-bold tracking-tight text-gray-800">
            {tr("Foyda va zarar")}
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {tr("Davrda sotilgan mahsulotlar bo'yicha (bronga yozilganlari ham). Tannarx — mahsulot kirimidagi partiya narxi.")}
          </p>
        </div>
      </div>

      {!active ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-gray-400">
          {tr("Tanlangan davrda do'kon sotuvi va ombor tuzatishlari yo'q")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Receipt}
              accent="bg-violet-50 text-violet-600"
              label={tr("Sotuv")}
              value={som(profit.sales.revenue)}
              sub={
                <>
                  {tr("{{count}} ta chek · {{qty}} dona", { count: profit.sales.count, qty: profit.sales.items_qty })}
                  {profit.sales.unpaid > 0 && (
                    <span className="block text-amber-600">
                      {tr("to'lanmagan (bronda): {{amount}}", { amount: fmt(profit.sales.unpaid) })}
                    </span>
                  )}
                </>
              }
            />
            <StatCard
              icon={Coins}
              accent="bg-slate-100 text-slate-600"
              label={tr("Tannarx")}
              value={som(profit.cost.total)}
              sub={
                profit.cost.estimated > 0
                  ? tr("shundan taxminiy {{amount}}", { amount: fmt(profit.cost.estimated) })
                  : tr("sotilgan mahsulotlar olish narxi")
              }
            />
            <StatCard
              icon={toneOf(profit.gross_profit) === "neg" ? TrendingDown : TrendingUp}
              accent={toneOf(profit.gross_profit) === "neg" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}
              label={tr("Yalpi foyda")}
              value={som(profit.gross_profit)}
              valueClass={TONE_TEXT[toneOf(profit.gross_profit)]}
              sub={tr("marja {{m}}", { m: marginText(profit.margin) })}
            />
            <StatCard
              icon={PackageMinus}
              accent="bg-rose-50 text-rose-600"
              label={tr("Yo'qotishlar")}
              value={som(profit.losses)}
              valueClass={profit.losses > 0 ? "text-red-600" : undefined}
              sub={losses.length > 0 ? losses.join(" · ") : tr("spisaniye va kamomad yo'q")}
            />
          </div>

          {/* SOF FOYDA — kartalar xulosasi, qayerdan chiqqani bilan */}
          <div
            className={cn(
              "rounded-xl border-2 p-4 sm:p-5",
              netTone === "neg" ? "border-red-200 bg-red-50/60" : "border-emerald-200 bg-emerald-50/60"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
                    netTone === "neg" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                  )}
                >
                  {netTone === "neg" ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-600">
                    {netTone === "neg" ? tr("Do'kon zarari") : tr("Do'kon sof foydasi")}
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold leading-tight tabular-nums",
                      netTone === "neg" ? "text-red-700" : "text-emerald-700"
                    )}
                  >
                    {som(net)}
                  </p>
                </div>
              </div>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-600">
                {netFormula(profit).map((part, i) => (
                  <span key={i} className="whitespace-nowrap">
                    {part.sign === "minus" ? "− " : part.sign === "plus" ? "+ " : ""}
                    {part.label}{" "}
                    <b className="font-semibold tabular-nums text-gray-800">{fmt(part.value)}</b>
                  </span>
                ))}
              </p>
            </div>
          </div>

          {/* Ogohlantirishlar */}
          <div className="space-y-2">
            {profit.uncovered.revenue > 0 && (
              <Notice tone="amber" icon={AlertTriangle} action={costButton}>
                {tr("{{amount}} So'mlik sotuvda ({{products}} ta mahsulot, {{qty}} dona) tannarx kiritilmagan — u foydaga kirmagan.", {
                  amount: fmt(profit.uncovered.revenue),
                  products: profit.uncovered.products,
                  qty: profit.uncovered.qty,
                })}
              </Notice>
            )}
            {profit.cost.estimated > 0 && (
              <Notice tone="sky" icon={Info}>
                {tr("{{amount}} So'm tannarx taxminiy: partiyada tannarx yo'q, shu mahsulotning o'rtacha tannarxi olindi.", {
                  amount: fmt(profit.cost.estimated),
                })}
              </Notice>
            )}
            {(profit.writeoff.estimated || profit.shortage.estimated) && (
              <Notice tone="sky" icon={Info}>
                {tr("Ba'zi eski spisaniyelar tannarxi taxminiy — o'sha paytda qaysi partiyadan chiqqani saqlanmagan, o'rtacha tannarx olindi.")}
              </Notice>
            )}
            {profit.writeoff.unknown_qty + profit.shortage.unknown_qty > 0 && (
              <Notice tone="amber" icon={AlertTriangle}>
                {tr("{{qty}} dona yo'qotishning tannarxi noma'lum — zararga kirmagan.", {
                  qty: profit.writeoff.unknown_qty + profit.shortage.unknown_qty,
                })}
              </Notice>
            )}
            {profit.below_cost.qty > 0 && (
              <Notice tone="red" icon={TrendingDown}>
                {tr("{{qty}} dona tannarxidan arzon sotilgan ({{products}} ta mahsulot) — {{amount}} So'm zarar. Sotuv narxini tekshiring.", {
                  qty: profit.below_cost.qty,
                  products: profit.below_cost.products,
                  amount: fmt(profit.below_cost.loss),
                })}
              </Notice>
            )}
            {profit.uncovered.revenue === 0 && costButton && (
              <Notice tone="amber" icon={PackageOpen} action={costButton}>
                {tr("Ombordagi {{count}} ta partiyada tannarx yo'q — ular sotilganda foyda hisoblanmaydi.", {
                  count: missing.length,
                })}
              </Notice>
            )}
          </div>
        </>
      )}

      {/* Ombordagi qoldiq — joriy holat */}
      {profit.stock.qty > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-white px-3.5 py-2.5 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800">
            <Warehouse className="h-3.5 w-3.5 text-gray-500" />
            {tr("Omborda hozir: {{qty}} dona", { qty: profit.stock.qty })}
          </span>
          <span>
            {tr("tannarxi")} <b className="font-semibold tabular-nums text-gray-800">{fmt(profit.stock.cost_value)}</b>
          </span>
          <span>
            {tr("sotuv narxida")} <b className="font-semibold tabular-nums text-gray-800">{fmt(profit.stock.sale_value)}</b>
          </span>
          <span>
            {tr("kutilayotgan foyda")}{" "}
            <b className={cn("font-semibold tabular-nums", TONE_TEXT[toneOf(profit.stock.potential_profit)])}>
              {fmt(profit.stock.potential_profit)}
            </b>
          </span>
          {profit.stock.unknown_cost_qty > 0 &&
            (profit.can_edit_cost && missing.length > 0 ? (
              // Boshqaruvchi — shu yerdan ham tannarx kiritadi (davrda sotuv bo'lmasa ham)
              <button
                type="button"
                onClick={() => setCostOpen(true)}
                className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-800"
              >
                {tr("{{qty}} donasida tannarx yo'q", { qty: profit.stock.unknown_cost_qty })}
              </button>
            ) : (
              <span className="text-amber-700">
                {tr("{{qty}} donasida tannarx yo'q", { qty: profit.stock.unknown_cost_qty })}
              </span>
            ))}
        </div>
      )}

      {active && profit.products.length > 0 && <ProductsTable profit={profit} />}

      {profit.can_edit_cost && (
        <BatchCostDialog open={costOpen} onClose={() => setCostOpen(false)} batches={missing} />
      )}
    </section>
  )
}
