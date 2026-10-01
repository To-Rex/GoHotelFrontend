import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  Warehouse,
  Search,
  Package,
  Coins,
  AlertTriangle,
  Layers,
  PackagePlus,
  PackageMinus,
  ClipboardCheck,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react"
import {
  useShopProducts,
  useAddShopBatch,
  useWriteoffProduct,
  useInventoryProduct,
  useWarehouseMovements,
  type ShopProduct,
} from "../api/shop"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { tr, trc } from "@/i18n"

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString()

// Kam qoldiq chegarasi — shu miqdor va undan oz qolganda ogohlantiriladi
const LOW_STOCK = 5

// Harakat turlari — jurnal chiplari
const MOVE_TYPES: Record<
  string,
  { label: string; chip: string; sign: "in" | "out" | "both" }
> = {
  KIRIM: { label: trc("stock", "Kirim"), chip: "bg-emerald-100 text-emerald-700", sign: "in" },
  SOTUV: { label: tr("Sotuv"), chip: "bg-blue-100 text-blue-700", sign: "out" },
  SPISANIYE: { label: tr("Spisaniye"), chip: "bg-red-100 text-red-600", sign: "out" },
  INVENTAR: { label: tr("Inventarizatsiya"), chip: "bg-violet-100 text-violet-700", sign: "both" },
}

// Mahsulot bo'yicha hisoblangan ombor ko'rsatkichlari
const productStats = (p: ShopProduct) => {
  const batches = p.batches || []
  const lastWithCost = [...batches].reverse().find((b) => b.cost_price !== null)
  const value = batches.reduce(
    (s, b) => s + b.remaining * Number(b.cost_price ?? b.sale_price ?? 0),
    0
  )
  const activeBatches = batches.filter((b) => b.remaining > 0).length
  return {
    lastCost: lastWithCost?.cost_price ?? null,
    value,
    activeBatches,
    totalBatches: batches.length,
  }
}

/* Ombor sahifasi — admin/menejer uchun: qoldiqlar, kirim, spisaniye,
   inventarizatsiya va harakatlar jurnali. /shop (sotuv) sahifasiga tegilmaydi. */
export const WarehousePage = () => {
  const { data: products = [], isLoading } = useShopProducts(true)
  const { data: movements = [], isLoading: movesLoading } = useWarehouseMovements(100)

  const addBatchMutation = useAddShopBatch()
  const writeoffMutation = useWriteoffProduct()
  const inventoryMutation = useInventoryProduct()

  const [search, setSearch] = useState("")
  const [onlyLow, setOnlyLow] = useState(false)

  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          // Kategoriya ekranda tarjima qilingan nomi bilan ko'rinadi — qidiruv ham shu nom bo'yicha
          tr(p.category || "").toLowerCase().includes(q)
      )
    }
    if (onlyLow) list = list.filter((p) => p.stock <= LOW_STOCK)
    return list
  }, [products, search, onlyLow])

  // Umumiy statistika
  const totalUnits = products.reduce((s, p) => s + p.stock, 0)
  const totalValue = products.reduce((s, p) => s + productStats(p).value, 0)
  const lowCount = products.filter((p) => p.stock <= LOW_STOCK).length

  // --- Dialoglar ---
  const [batchesFor, setBatchesFor] = useState<ShopProduct | null>(null)

  const [kirimFor, setKirimFor] = useState<ShopProduct | null>(null)
  const [kQty, setKQty] = useState("")
  const [kSale, setKSale] = useState("")
  const [kCost, setKCost] = useState("")
  const [kError, setKError] = useState<string | null>(null)

  const [writeoffFor, setWriteoffFor] = useState<ShopProduct | null>(null)
  const [wQty, setWQty] = useState("")
  const [wReason, setWReason] = useState("")
  const [wError, setWError] = useState<string | null>(null)

  const [invFor, setInvFor] = useState<ShopProduct | null>(null)
  const [invCounted, setInvCounted] = useState("")
  const [invError, setInvError] = useState<string | null>(null)
  const [invResult, setInvResult] = useState<number | null>(null)

  const openKirim = (p: ShopProduct) => {
    setKirimFor(p)
    setKQty("")
    // Oxirgi partiya narxlari taklif sifatida
    const last = p.batches[p.batches.length - 1]
    setKSale(last ? String(last.sale_price) : "")
    setKCost(last?.cost_price !== null && last ? String(last.cost_price) : "")
    setKError(null)
  }

  const submitKirim = async () => {
    if (!kirimFor) return
    const qty = parseInt(kQty, 10)
    const sale = Number(kSale)
    if (Number.isNaN(qty) || qty <= 0) {
      setKError(tr("Miqdorni to'g'ri kiriting"))
      return
    }
    if (kSale.trim() === "" || Number.isNaN(sale) || sale <= 0) {
      setKError(tr("Sotish narxini kiriting"))
      return
    }
    const cost = kCost.trim() === "" ? undefined : Number(kCost)
    if (cost !== undefined && (Number.isNaN(cost) || cost < 0)) {
      setKError(tr("Tannarx noto'g'ri"))
      return
    }
    try {
      await addBatchMutation.mutateAsync({
        productId: kirimFor.id,
        quantity: qty,
        sale_price: sale,
        cost_price: cost,
      })
      setKirimFor(null)
    } catch (e) {
      setKError(apiErrorMessage(e))
    }
  }

  const openWriteoff = (p: ShopProduct) => {
    setWriteoffFor(p)
    setWQty("")
    setWReason("")
    setWError(null)
  }

  const submitWriteoff = async () => {
    if (!writeoffFor) return
    const qty = parseInt(wQty, 10)
    if (Number.isNaN(qty) || qty <= 0) {
      setWError(tr("Miqdorni to'g'ri kiriting"))
      return
    }
    if (qty > writeoffFor.stock) {
      setWError(tr("Omborda faqat {{stock}} ta bor", { stock: writeoffFor.stock }))
      return
    }
    if (wReason.trim().length < 3) {
      setWError(tr("Sababni yozing (majburiy)"))
      return
    }
    try {
      await writeoffMutation.mutateAsync({
        productId: writeoffFor.id,
        quantity: qty,
        reason: wReason.trim(),
      })
      setWriteoffFor(null)
    } catch (e) {
      setWError(apiErrorMessage(e))
    }
  }

  const openInv = (p: ShopProduct) => {
    setInvFor(p)
    setInvCounted("")
    setInvError(null)
    setInvResult(null)
  }

  const submitInv = async () => {
    if (!invFor) return
    if (invCounted.trim() === "") {
      setInvError(tr("Sanalgan miqdorni kiriting"))
      return
    }
    const counted = parseInt(invCounted, 10)
    if (Number.isNaN(counted) || counted < 0) {
      setInvError(tr("Miqdor noto'g'ri"))
      return
    }
    try {
      const res = await inventoryMutation.mutateAsync({
        productId: invFor.id,
        counted,
      })
      setInvResult(res.diff)
    } catch (e) {
      setInvError(apiErrorMessage(e))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{tr("Ombor")}</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const stats = [
    {
      icon: Package,
      accent: "bg-primary-50 text-primary-600",
      label: tr("Mahsulot turlari"),
      value: tr("{{count}} ta", { count: products.length }),
      sub: tr("{{count}} ta ko'rsatilmoqda", { count: filtered.length }),
    },
    {
      icon: Layers,
      accent: "bg-sky-50 text-sky-600",
      label: tr("Umumiy qoldiq"),
      value: tr("{{totalUnits}} dona", { totalUnits: fmt(totalUnits) }),
      sub: tr("barcha mahsulotlar bo'yicha"),
    },
    {
      icon: Coins,
      accent: "bg-emerald-50 text-emerald-600",
      label: tr("Ombor qiymati"),
      value: tr("{{totalValue}} So'm", { totalValue: fmt(totalValue) }),
      sub: tr("tannarx bo'yicha (yo'q bo'lsa narxda)"),
    },
    {
      icon: AlertTriangle,
      accent: lowCount ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-400",
      label: tr("Kam qoldiq"),
      value: tr("{{lowCount}} ta", { lowCount }),
      sub: tr("{{LOW_STOCK}} ta va undan oz qolganlar", { LOW_STOCK }),
    },
  ]

  const renderActions = (p: ShopProduct) => (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openKirim(p)
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
      >
        <PackagePlus className="h-3 w-3" />{" "}{trc("stock", "Kirim")}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openWriteoff(p)
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
      >
        <PackageMinus className="h-3 w-3" />{" "}{tr("Spisaniye")}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openInv(p)
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
      >
        <ClipboardCheck className="h-3 w-3" />{" "}{tr("Inventar")}
      </button>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
            <Warehouse className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{tr("Ombor")}</h1>
            <p className="text-sm text-gray-500">
              {tr("Qoldiqlar, kirim, spisaniye va inventarizatsiya")}
            </p>
          </div>
        </div>
      </div>

      {/* Statistika */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-white p-3.5">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                  s.accent
                )}
              >
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-gray-400">
                  {s.label}
                </p>
                <p className="truncate text-sm font-bold text-gray-900">{s.value}</p>
                <p className="truncate text-[11px] text-gray-500">{s.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Qidiruv + kam qoldiq filtri */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-9"
            placeholder={tr("Mahsulot yoki kategoriya bo'yicha qidirish...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyLow((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            onlyLow
              ? "bg-red-600 text-white"
              : "bg-red-50 text-red-600 hover:bg-red-100"
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          {tr("Kam qoldiq")}
        </button>
      </div>

      {/* MOBIL: mahsulot kartalari */}
      <div className="space-y-2.5 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
            {tr("Mahsulotlar topilmadi")}
          </div>
        ) : (
          filtered.map((p) => {
            const st = productStats(p)
            const low = p.stock <= LOW_STOCK
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setBatchesFor(p)}
                onKeyDown={(e) => e.key === "Enter" && setBatchesFor(p)}
                className={cn(
                  "cursor-pointer rounded-2xl border bg-white p-3.5",
                  low && "border-red-200"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
                      {p.emoji || "📦"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold leading-tight text-gray-900">
                        {p.name}
                        {!p.is_active && (
                          <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                            {tr("nofaol")}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {tr("{{v}} · {{activeBatches}} partiya", { v: p.category ? tr(p.category) : tr("Kategoriyasiz"), activeBatches: st.activeBatches })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                      low
                        ? "bg-red-100 text-red-600"
                        : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {tr("{{stock}} ta", { stock: p.stock })}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-gray-50 px-1 py-1.5">
                    <p className="text-[10px] text-gray-400">{tr("Narx")}</p>
                    <p className="truncate text-xs font-bold tabular-nums text-gray-800">
                      {p.current_price !== null ? fmt(p.current_price) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-1 py-1.5">
                    <p className="text-[10px] text-gray-400">{tr("Tannarx")}</p>
                    <p className="truncate text-xs font-bold tabular-nums text-gray-800">
                      {st.lastCost !== null ? fmt(st.lastCost) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-1 py-1.5">
                    <p className="text-[10px] text-gray-400">{tr("Qiymat")}</p>
                    <p className="truncate text-xs font-bold tabular-nums text-gray-800">
                      {fmt(st.value)}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 border-t border-gray-100 pt-2.5">
                  {renderActions(p)}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* DESKTOP: mahsulotlar jadvali */}
      <div className="hidden rounded-2xl border bg-white overflow-hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr("Mahsulot")}</TableHead>
                <TableHead>{tr("Kategoriya")}</TableHead>
                <TableHead className="text-right">{trc("stock", "Qoldiq")}</TableHead>
                <TableHead className="text-right">{tr("Partiyalar")}</TableHead>
                <TableHead className="text-right">{tr("Joriy narx")}</TableHead>
                <TableHead className="text-right">{tr("Oxirgi tannarx")}</TableHead>
                <TableHead className="text-right">{tr("Ombor qiymati")}</TableHead>
                <TableHead className="text-right">{tr("Amallar")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-gray-400">
                    {tr("Mahsulotlar topilmadi")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const st = productStats(p)
                  const low = p.stock <= LOW_STOCK
                  return (
                    <TableRow
                      key={p.id}
                      onClick={() => setBatchesFor(p)}
                      className={cn(
                        "cursor-pointer",
                        low ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-gray-50"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-base">
                            {p.emoji || "📦"}
                          </span>
                          <span className="font-medium text-gray-900">
                            {p.name}
                            {!p.is_active && (
                              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                {tr("nofaol")}
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {p.category ? tr(p.category) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                            low
                              ? "bg-red-100 text-red-600"
                              : "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {low && <AlertTriangle className="h-3 w-3" />}
                          {tr("{{stock}} ta", { stock: p.stock })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-gray-600">
                        {st.activeBatches} / {st.totalBatches}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-gray-600">
                        {p.current_price !== null ? fmt(p.current_price) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-gray-600">
                        {st.lastCost !== null ? fmt(st.lastCost) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-gray-800">
                        {fmt(st.value)}
                      </TableCell>
                      <TableCell className="text-right">{renderActions(p)}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Harakatlar jurnali */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <p className="border-b bg-gray-50/70 px-4 py-2.5 text-xs font-semibold text-gray-600">
          {tr("Harakatlar jurnali (oxirgi {{count}} ta)", { count: movements.length })}
        </p>
        {movesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : movements.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            {tr("Harakatlar hali yo'q")}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {movements.map((m, i) => {
              const t = MOVE_TYPES[m.type] || MOVE_TYPES.KIRIM
              const inbound = m.quantity > 0
              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
                      inbound
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-500"
                    )}
                  >
                    {inbound ? (
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      t.chip
                    )}
                  >
                    {t.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-900">
                    {m.product_name}
                  </span>
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      inbound ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {tr("{{v}}{{quantity}} ta", { v: inbound ? "+" : "", quantity: m.quantity })}
                  </span>
                  {m.amount !== null && (
                    <span className="tabular-nums text-gray-500">
                      {tr("{{amount}} So'm", { amount: fmt(m.amount) })}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {m.user_name}
                    {m.created_at &&
                      ` · ${format(new Date(m.created_at), "dd.MM HH:mm")}`}
                  </span>
                  {m.note && (
                    <span
                      className="w-full truncate pl-9 text-xs text-gray-400"
                      title={m.note}
                    >
                      {m.note}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Partiyalar tafsiloti */}
      <Dialog open={!!batchesFor} onOpenChange={(o) => !o && setBatchesFor(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {batchesFor?.emoji || "📦"} {batchesFor?.name}{" "}{tr("— partiyalar")}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2">
            {batchesFor && batchesFor.batches.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">
                {tr("Partiyalar yo'q — \"Kirim\" orqali qo'shing")}
              </p>
            )}
            {batchesFor &&
              [...batchesFor.batches].reverse().map((b) => (
                <div
                  key={b.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm",
                    b.remaining === 0 && "opacity-50"
                  )}
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {tr("{{remaining}} / {{quantity}} ta qoldi", { remaining: b.remaining, quantity: b.quantity })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {b.created_at
                        ? format(new Date(b.created_at), "dd.MM.yyyy HH:mm")
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold tabular-nums text-gray-800">
                      {tr("Narx: {{sale_price}} So'm", { sale_price: fmt(b.sale_price) })}
                    </p>
                    <p className="tabular-nums text-gray-500">
                      {tr("Tannarx: {{v}}", { v: b.cost_price !== null ? tr("{{cost_price}} So'm", { cost_price: fmt(b.cost_price) }) : "—" })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setBatchesFor(null)}>{tr("Yopish")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kirim dialogi */}
      <Dialog open={!!kirimFor} onOpenChange={(o) => !o && setKirimFor(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-emerald-600" />
              {tr("Kirim —")}{" "}{kirimFor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{tr("Miqdor (dona) *")}</label>
              <Input
                type="number"
                min={1}
                value={kQty}
                onChange={(e) => setKQty(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">
                  {tr("Sotish narxi *")}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={kSale}
                  onChange={(e) => setKSale(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{tr("Tannarx")}</label>
                <Input
                  type="number"
                  min={0}
                  value={kCost}
                  onChange={(e) => setKCost(e.target.value)}
                  placeholder={tr("Ixtiyoriy")}
                />
              </div>
            </div>
            {kError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {kError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKirimFor(null)}>
              {tr("Bekor qilish")}
            </Button>
            <Button onClick={submitKirim} disabled={addBatchMutation.isPending}>
              {addBatchMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tr("Qo'shish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spisaniye dialogi */}
      <Dialog open={!!writeoffFor} onOpenChange={(o) => !o && setWriteoffFor(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageMinus className="h-4 w-4 text-red-500" />
              {tr("Spisaniye —")}{" "}{writeoffFor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600">
              {tr("Omborda hozir:")}{" "}<b>{writeoffFor?.stock}{" "}{tr("ta")}</b>{tr(". Chiqarilgan mahsulot FIFO tartibida (eng eski partiyadan) yechiladi va jurnalga yoziladi.")}
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{tr("Miqdor (dona) *")}</label>
              <Input
                type="number"
                min={1}
                max={writeoffFor?.stock}
                value={wQty}
                onChange={(e) => setWQty(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{tr("Sabab *")}</label>
              <Input
                value={wReason}
                onChange={(e) => setWReason(e.target.value)}
                placeholder={tr("Masalan: muddati o'tgan, singan...")}
              />
            </div>
            {wError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {wError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteoffFor(null)}>
              {tr("Bekor qilish")}
            </Button>
            <Button
              variant="destructive"
              onClick={submitWriteoff}
              disabled={writeoffMutation.isPending}
            >
              {writeoffMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tr("Spisaniye qilish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventarizatsiya dialogi */}
      <Dialog open={!!invFor} onOpenChange={(o) => !o && setInvFor(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-violet-600" />
              {tr("Inventarizatsiya —")}{" "}{invFor?.name}
            </DialogTitle>
          </DialogHeader>
          {invResult === null ? (
            <div className="space-y-3 py-2">
              <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600">
                {tr("Tizim bo'yicha qoldiq:")}{" "}<b>{invFor?.stock}{" "}{tr("ta")}</b>{tr(". Omborda haqiqiy sanab chiqilgan miqdorni kiriting — farq avtomatik tuzatiladi va jurnalga yoziladi.")}
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">
                  {tr("Sanalgan miqdor (dona) *")}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={invCounted}
                  onChange={(e) => setInvCounted(e.target.value)}
                  autoFocus
                />
              </div>
              {invError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {invError}
                </p>
              )}
            </div>
          ) : (
            <div className="py-2">
              <div
                className={cn(
                  "rounded-xl px-4 py-3 text-sm font-medium",
                  invResult === 0
                    ? "bg-emerald-50 text-emerald-700"
                    : invResult < 0
                      ? "bg-red-50 text-red-600"
                      : "bg-amber-50 text-amber-700"
                )}
              >
                {invResult === 0
                  ? tr("Farq yo'q — qoldiq tizim bilan mos keldi.")
                  : invResult < 0
                    ? tr("Kamomad: {{v}} ta ombordan chiqarildi.", { v: -invResult })
                    : tr("Ortiqcha: {{invResult}} ta qoldiqqa qo'shildi.", { invResult })}
              </div>
            </div>
          )}
          <DialogFooter>
            {invResult === null ? (
              <>
                <Button variant="outline" onClick={() => setInvFor(null)}>
                  {tr("Bekor qilish")}
                </Button>
                <Button onClick={submitInv} disabled={inventoryMutation.isPending}>
                  {inventoryMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {tr("Tasdiqlash")}
                </Button>
              </>
            ) : (
              <Button onClick={() => setInvFor(null)}>{tr("Yopish")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
