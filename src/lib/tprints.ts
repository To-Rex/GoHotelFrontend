// TPrints (lokal chek print-serveri) bilan integratsiya.
// Kassa kompyuterida TPrints dasturi ishlab turadi (odatda http://127.0.0.1:9100)
// va HTTP JSON qabul qilib chekni termal printerga chiqaradi. Manzil har bir
// kompyuter uchun localStorage'da saqlanadi (kassa qurilmasiga bog'liq sozlama).
import { format } from "date-fns"
import type { ShopSale } from "@/features/shop/api/shop"

const URL_KEY = "tprints_url"
const AUTO_KEY = "tprints_auto_print"
export const DEFAULT_TPRINTS_URL = "http://127.0.0.1:9100"

export const getPrinterUrl = (): string =>
  (localStorage.getItem(URL_KEY) || DEFAULT_TPRINTS_URL).replace(/\/+$/, "")

export const setPrinterUrl = (url: string) => {
  localStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ""))
}

// Chek avtomatik chiqarilsinmi (kassachi xohlasa o'chirib qo'yadi —
// cheksiz sotish ham to'liq ishlayveradi)
export const getAutoPrint = (): boolean => localStorage.getItem(AUTO_KEY) !== "0"

export const setAutoPrint = (on: boolean) => {
  localStorage.setItem(AUTO_KEY, on ? "1" : "0")
}

// So'rovlar qisqa timeout bilan — printer o'chiq bo'lsa kassa qotib qolmasin
const request = async (
  path: string,
  init?: RequestInit,
  timeoutMs = 7000
): Promise<{ ok: boolean; data?: any; error?: string }> => {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(getPrinterUrl() + path, { ...init, signal: ctrl.signal })
    const data = await res.json().catch(() => null)
    if (!res.ok || (data && data.ok === false)) {
      return { ok: false, data, error: data?.error || `Server xatosi (${res.status})` }
    }
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      error:
        "Print-serverga ulanib bo'lmadi — kassa kompyuterida TPrints ishlab turganini tekshiring",
    }
  } finally {
    window.clearTimeout(t)
  }
}

/** Server holati — sozlash oynasidagi "Tekshirish" uchun */
export const pingPrinter = async (): Promise<{ ok: boolean; msg: string }> => {
  const r = await request("/", { method: "GET" }, 4000)
  if (!r.ok) return { ok: false, msg: r.error || "Ulanib bo'lmadi" }
  const p = await request("/printers", { method: "GET" }, 4000)
  const count = Array.isArray(p.data?.printers) ? p.data.printers.length : 0
  const def = p.data?.app_default ? ` · standart: ${p.data.app_default}` : ""
  return {
    ok: true,
    msg: `${r.data?.app || "TPrints"} ${r.data?.version || ""} ishlamoqda — ${count} ta printer${def}`,
  }
}

/** Sinov cheki (TPrints o'zining namunaviy chekini chiqaradi) */
export const printTest = async (): Promise<{ ok: boolean; error?: string }> => {
  const r = await request("/test", { method: "POST" })
  return { ok: r.ok, error: r.error }
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
}

/** Do'kon sotuvi chekini chiqarish */
export const printShopReceipt = async (
  sale: ShopSale,
  hotelName: string,
  guestName?: string | null
): Promise<{ ok: boolean; error?: string }> => {
  const when = sale.created_at ? new Date(sale.created_at) : new Date()
  const elements: any[] = [
    { type: "title", value: hotelName || "GoHotel", size: 2 },
    { type: "text", value: "Mini-do'kon cheki", align: "center" },
    { type: "line" },
    { type: "row", left: "Sana:", right: format(when, "dd.MM.yyyy HH:mm") },
    { type: "row", left: "Chek:", right: `#${sale.id.slice(0, 8).toUpperCase()}` },
  ]
  if (sale.created_by_name) {
    elements.push({ type: "row", left: "Sotuvchi:", right: sale.created_by_name })
  }
  if (sale.reservation_number) {
    elements.push({ type: "row", left: "Bron:", right: sale.reservation_number })
  }
  const guest = guestName || sale.guest_name
  if (guest) {
    elements.push({ type: "row", left: "Mehmon:", right: guest })
  }
  elements.push(
    { type: "line", style: "dashed" },
    {
      type: "table",
      headers: ["Mahsulot", "Soni", "Summa"],
      widths: [3, 1, 2],
      aligns: ["left", "center", "right"],
      rows: sale.items.map((i) => [
        i.product_name,
        String(i.quantity),
        Number(i.total_price).toLocaleString(),
      ]),
    },
    { type: "line" },
    {
      type: "row",
      left: "JAMI:",
      right: `${Number(sale.total_amount).toLocaleString()} So'm`,
      bold: true,
      size: 2,
    },
    {
      type: "row",
      left: "To'lov:",
      right:
        sale.status === "PAID"
          ? METHOD_LABELS[sale.payment_method || ""] || sale.payment_method || "—"
          : "Bron hisobiga",
    }
  )
  if (sale.status === "PENDING") {
    elements.push({
      type: "text",
      value: "To'lov mehmon chiqishida olinadi",
      align: "center",
    })
  }
  elements.push(
    { type: "line", style: "dashed" },
    { type: "text", value: "Xaridingiz uchun rahmat!", align: "center", bold: true },
    { type: "feed", lines: 1 }
  )

  const r = await request("/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elements }),
  })
  return { ok: r.ok, error: r.error }
}
