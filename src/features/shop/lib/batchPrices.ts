import type { BatchPriceChange, ShopBatch, ShopProduct } from "../api/shop"

/* "Narx va olish narxi" oynasi qoidalari (sof funksiyalar).

   Narx mahsulotda emas, PARTIYADA (kirimda): sotuv FIFO bo'yicha eng eski
   qoldiqli partiyadan, o'sha partiya narxida ketadi. Shuning uchun oyna
   partiyalar ro'yxati: har birida sotuv narxi va olish narxi (ixtiyoriy).
   Qoldig'i tugagan partiyaning sotuv narxi endi hech narsaga ta'sir
   qilmaydi — faqat olish narxi (foyda hisobi) tahrirlanadi. Serverga
   faqat O'ZGARGAN qiymatlar ketadi. */

export interface PriceRow {
  batch: ShopBatch
  /** Formatlangan maydon qiymatlari ("12 000"); olish narxi bo'sh — yo'q */
  sale: string
  cost: string
  /** FIFO bo'yicha hozir sotilayotgan partiya */
  current: boolean
  /** Qoldig'i tugagan — sotuv narxi tahrirlanmaydi */
  depleted: boolean
}

const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")

/** Maydondan son: bo'sh — null, raqamsiz qismlar tashlanadi (0 ham son) */
export function parsePrice(raw: string): number | null {
  const digits = String(raw ?? "").replace(/\D/g, "")
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

/** Kiritilayotgan narx: faqat raqam, minglik bo'shliq bilan */
export function formatPrice(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""
}

/** Partiyalar FIFO tartibida (eskisi birinchi), qoldiqlilari tepada */
export function priceRows(product: Pick<ShopProduct, "batches">): PriceRow[] {
  const ordered = [...product.batches].sort((a, b) =>
    String(a.created_at || "").localeCompare(String(b.created_at || ""))
  )
  const currentId = ordered.find((b) => b.remaining > 0)?.id
  const rows = ordered.map((b) => ({
    batch: b,
    sale: group(Number(b.sale_price)),
    cost: b.cost_price === null || b.cost_price === undefined ? "" : group(Number(b.cost_price)),
    current: b.id === currentId,
    depleted: b.remaining <= 0,
  }))
  return [...rows.filter((r) => !r.depleted), ...rows.filter((r) => r.depleted)]
}

export type RowError = "sale_required" | null

export const rowError = (row: PriceRow): RowError =>
  row.depleted ? null : (parsePrice(row.sale) ?? 0) > 0 ? null : "sale_required"

/** O'zgargan qatorlar — serverga yuboriladigan ro'yxat */
export function changedItems(rows: ReadonlyArray<PriceRow>): BatchPriceChange[] {
  const items: BatchPriceChange[] = []
  for (const row of rows) {
    const b = row.batch
    const item: BatchPriceChange = { batch_id: b.id }
    const sale = parsePrice(row.sale)
    if (!row.depleted && sale !== null && sale > 0 && sale !== Number(b.sale_price)) {
      item.sale_price = sale
    }
    const cost = parsePrice(row.cost)
    const oldCost = b.cost_price === null || b.cost_price === undefined ? null : Number(b.cost_price)
    if (cost !== oldCost) item.cost_price = cost
    if ("sale_price" in item || "cost_price" in item) items.push(item)
  }
  return items
}

/** "Barcha qoldiqli partiyalarga" — bo'sh maydon tegilmaydi */
export function applyToRemaining(rows: ReadonlyArray<PriceRow>, sale: string, cost: string): PriceRow[] {
  const s = formatPrice(sale)
  const c = formatPrice(cost)
  return rows.map((r) =>
    r.depleted ? r : { ...r, sale: s ? s : r.sale, cost: c ? c : r.cost }
  )
}

/** Bir dona foydasi va marjasi (oldindan ko'rish) */
export function unitMargin(row: PriceRow): { profit: number; margin: number } | null {
  const sale = parsePrice(row.sale)
  const cost = parsePrice(row.cost)
  if (sale === null || sale <= 0 || cost === null) return null
  return { profit: sale - cost, margin: ((sale - cost) / sale) * 100 }
}

/** Qator o'zgarganmi (ajratib ko'rsatish uchun) */
export const rowChanged = (row: PriceRow): boolean => changedItems([row]).length > 0
