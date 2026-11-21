import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { ChevronDown, Loader2, Tag, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import { useUpdateBatchPrices, type ShopProduct } from "../api/shop"
import {
  applyToRemaining,
  changedItems,
  formatPrice,
  priceRows,
  rowChanged,
  rowError,
  unitMargin,
  type PriceRow,
} from "../lib/batchPrices"

/* Mahsulot narxi va olish narxini o'zgartirish (kirim narxlari).

   Narx partiyada: sotuv FIFO bo'yicha eng eski qoldiqli partiyadan, o'sha
   partiya narxida ketadi — shuning uchun har partiya o'z qatorida. Tepada
   "Barcha qoldiqli partiyalarga" tez to'ldirish (bitta narx hammasiga).
   Qoldig'i tugagan partiyada faqat olish narxi tahrirlanadi (foyda
   hisobi uchun). Sotuv narxi o'zgarsa KEYINGI sotuvlar yangi narxda
   bo'ladi — o'tgan cheklar o'zgarmaydi; olish narxi o'tgan sotuvlar
   foydasini ham aniqlashtiradi. Hammasi bitta so'rovda saqlanadi,
   o'zgarish audit jurnaliga yoziladi. Faqat do'kon boshqaruvchisi. */

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString()

function PriceInput({
  value,
  onChange,
  disabled,
  placeholder,
  label,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  label: string
  invalid?: boolean
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(formatPrice(e.target.value))}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-lg border bg-white pr-11 pl-2.5 text-sm font-semibold tabular-nums outline-none transition-colors",
          "placeholder:font-normal placeholder:text-gray-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-100",
          "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
          invalid ? "border-red-300" : "border-gray-200"
        )}
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] text-gray-400">
        {tr("So'm")}
      </span>
    </div>
  )
}

export function BatchPricesDialog({
  product,
  onClose,
}: {
  product: ShopProduct | null
  onClose: () => void
}) {
  const update = useUpdateBatchPrices()
  const [rows, setRows] = useState<PriceRow[]>([])
  const [allSale, setAllSale] = useState("")
  const [allCost, setAllCost] = useState("")
  const [note, setNote] = useState("")
  const [showDepleted, setShowDepleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const productId = product?.id ?? null
  // Ro'yxat yangilanib mahsulot obyekti almashsa ham kiritilgan qiymatlar
  // yo'qolmasin — oyna faqat boshqa mahsulot ochilganda qayta to'ldiriladi
  const latest = useRef(product)
  latest.current = product

  useEffect(() => {
    const p = latest.current
    if (!p) return
    setRows(priceRows(p))
    setAllSale("")
    setAllCost("")
    setNote("")
    setShowDepleted(false)
    setError(null)
  }, [productId])

  const items = useMemo(() => changedItems(rows), [rows])
  const invalid = rows.some((r) => rowError(r) !== null)
  const active = rows.filter((r) => !r.depleted)
  const depleted = rows.filter((r) => r.depleted)

  const setRow = (id: string, patch: Partial<PriceRow>) =>
    setRows((list) => list.map((r) => (r.batch.id === id ? { ...r, ...patch } : r)))

  const save = async () => {
    if (!product || items.length === 0 || invalid) return
    setError(null)
    try {
      await update.mutateAsync({ productId: product.id, items, note: note.trim() || undefined })
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const row = (r: PriceRow) => {
    const m = unitMargin(r)
    const changed = rowChanged(r)
    const err = rowError(r)
    return (
      <div
        key={r.batch.id}
        className={cn(
          "rounded-xl border px-3 py-2.5",
          changed ? "border-primary-200 bg-primary-50/30" : "border-gray-200",
          r.depleted && "bg-gray-50/60"
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-medium text-gray-800">
            {r.batch.created_at
              ? tr("Kirim {{date}}", { date: format(new Date(r.batch.created_at), "dd.MM.yyyy HH:mm") })
              : tr("Kirim")}
          </span>
          <span className="text-gray-500">
            {tr("{{qty}} dona, qoldi {{left}}", { qty: r.batch.quantity, left: r.batch.remaining })}
          </span>
          {r.current && (
            <span className="rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold leading-4 text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {tr("hozir sotilmoqda")}
            </span>
          )}
          {r.depleted && (
            <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-medium leading-4 text-gray-500">
              {tr("tugagan")}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[11px] text-gray-500">{tr("Sotish narxi")}</p>
            <PriceInput
              label={tr("Sotish narxi")}
              value={r.sale}
              disabled={r.depleted || update.isPending}
              invalid={err === "sale_required"}
              onChange={(v) => setRow(r.batch.id, { sale: v })}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-gray-500">{tr("Olish narxi")}</p>
            <PriceInput
              label={tr("Olish narxi")}
              value={r.cost}
              disabled={update.isPending}
              placeholder={tr("kiritilmagan")}
              onChange={(v) => setRow(r.batch.id, { cost: v })}
            />
          </div>
        </div>
        <p className="mt-1.5 min-h-4 text-[11px] leading-4 text-gray-500">
          {err === "sale_required" ? (
            <span className="text-red-600">{tr("Sotish narxi 0 dan katta bo'lishi kerak")}</span>
          ) : r.depleted ? (
            tr("Qoldiq yo'q — sotuv narxi endi ta'sir qilmaydi; olish narxi foyda hisobi uchun")
          ) : m ? (
            <span className={m.profit < 0 ? "text-red-600" : "text-emerald-700"}>
              {tr("bir donadan {{profit}} · marja {{margin}}%", {
                profit: fmt(m.profit),
                margin: m.margin.toLocaleString(undefined, { maximumFractionDigits: 1 }),
              })}
            </span>
          ) : (
            tr("Olish narxi kiritilmasa foyda hisoblanmaydi")
          )}
        </p>
      </div>
    )
  }

  return (
    <Dialog open={product !== null} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="min-w-0 border-b border-gray-100 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Tag className="h-4 w-4" />
            </span>
            <span className="min-w-0 truncate">
              {product?.emoji ? `${product.emoji} ` : ""}
              {product?.name}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {tr("Sotish narxi o'zgarsa keyingi sotuvlar yangi narxda bo'ladi — o'tgan cheklar o'zgarmaydi. Olish narxi foyda hisobida ishlatiladi. Miqdor va qoldiq o'zgarmaydi.")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              {tr("Partiyalar yo'q — avval kirim qiling")}
            </p>
          ) : (
            <>
              {active.length > 1 && (
                <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/30 p-2.5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary-800">
                    <Wand2 className="h-3.5 w-3.5" />
                    {tr("Barcha qoldiqli partiyalarga ({{count}} ta)", { count: active.length })}
                  </p>
                  {/* Telefonda tugma alohida qatorda — maydonlar qisilib qolmasin */}
                  <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <PriceInput label={tr("Hammasiga sotish narxi")} value={allSale} onChange={setAllSale} placeholder={tr("Sotish narxi")} />
                    <PriceInput label={tr("Hammasiga olish narxi")} value={allCost} onChange={setAllCost} placeholder={tr("Olish narxi")} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="col-span-2 sm:col-span-1"
                      disabled={!allSale && !allCost}
                      onClick={() => setRows((list) => applyToRemaining(list, allSale, allCost))}
                    >
                      {tr("Qo'llash")}
                    </Button>
                  </div>
                </div>
              )}

              {active.length === 0 && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  {tr("Qoldiqli partiya yo'q — yangi narx bilan kirim qiling. Bu yerda faqat olish narxlarini tuzatish mumkin.")}
                </p>
              )}
              <div className="space-y-2">{active.map(row)}</div>

              {depleted.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDepleted((v) => !v)}
                    aria-expanded={showDepleted}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !showDepleted && "-rotate-90")} />
                    {tr("Tugagan partiyalar ({{count}} ta) — olish narxi", { count: depleted.length })}
                  </button>
                  {showDepleted && <div className="mt-2 space-y-2">{depleted.map(row)}</div>}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="batch-prices-note">
                  {tr("Sabab")}
                  <span className="ml-1 font-normal text-gray-400">({tr("ixtiyoriy")})</span>
                </label>
                <input
                  id="batch-prices-note"
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={tr("Masalan: yetkazib beruvchi narxi oshdi")}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="min-w-0 flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500" aria-live="polite">
            {items.length > 0
              ? tr("{{count}} ta partiya o'zgaradi", { count: items.length })
              : tr("Hali hech narsa o'zgarmadi")}
          </p>
          <div className="flex flex-shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={update.isPending}>
              {tr("Bekor qilish")}
            </Button>
            <Button onClick={save} disabled={update.isPending || items.length === 0 || invalid}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Saqlash")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
