// TPrints (lokal chek print-serveri) bilan integratsiya.
// Kassa kompyuterida TPrints dasturi ishlab turadi (odatda http://127.0.0.1:9100)
// va HTTP JSON qabul qilib chekni termal printerga chiqaradi. Manzil har bir
// kompyuter uchun localStorage'da saqlanadi (kassa qurilmasiga bog'liq sozlama).
import { format } from "date-fns"
import {
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptSettings,
  type ShopSale,
} from "@/features/shop/api/shop"

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

// ---------------------------------------------- TPrints'ni qidirish (skan) --

export interface TPrintsInfo {
  url: string
  app: string
  version: string
  printers: number
  defaultPrinter: string
}

const fetchJson = async (url: string, timeoutMs: number): Promise<any | null> => {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    return await res.json()
  } catch {
    return null
  } finally {
    window.clearTimeout(t)
  }
}

/** Berilgan manzilda TPrints ishlayaptimi — ishlayotgan bo'lsa ma'lumoti */
export const probeTPrints = async (
  url: string,
  timeoutMs = 900
): Promise<TPrintsInfo | null> => {
  const data = await fetchJson(url + "/", timeoutMs)
  // 9100-port oddiy printer porti hamdir — javob aynan TPrints ekaniga ishonch
  if (!data?.ok || !String(data.app || "").toLowerCase().includes("tprint")) return null
  const p = await fetchJson(url + "/printers", 2500)
  return {
    url,
    app: String(data.app),
    version: String(data.version || ""),
    printers: Array.isArray(p?.printers) ? p.printers.length : 0,
    defaultPrinter: String(p?.app_default || ""),
  }
}

/**
 * TPrints serverlarini qidirish:
 *  1) joriy saqlangan manzil va maydondagi manzil;
 *  2) shu kompyuter (127.0.0.1) 9100–9110 portlari;
 *  3) maydonda lokal tarmoq IP'si yozilgan bo'lsa — o'sha subnet (/24) skan.
 * Diqqat: https sahifadan faqat 127.0.0.1 tekshiriladi (brauzer cheklovi).
 */
export const discoverTPrints = async (
  hint: string,
  onProgress?: (done: number, total: number) => void
): Promise<TPrintsInfo[]> => {
  const candidates = new Set<string>()
  candidates.add(getPrinterUrl())
  const hintUrl = hint.trim().replace(/\/+$/, "")
  if (/^https?:\/\//.test(hintUrl)) candidates.add(hintUrl)
  for (let p = 9100; p <= 9110; p++) candidates.add(`http://127.0.0.1:${p}`)
  const m = hintUrl.match(/^http:\/\/(\d+\.\d+\.\d+)\.\d+(?::(\d+))?$/)
  if (m && m[1] !== "127.0.0") {
    const port = m[2] || "9100"
    for (let i = 1; i <= 254; i++) candidates.add(`http://${m[1]}.${i}:${port}`)
  }

  const list = [...candidates]
  const found: TPrintsInfo[] = []
  let done = 0
  const CHUNK = 24
  for (let i = 0; i < list.length; i += CHUNK) {
    await Promise.all(
      list.slice(i, i + CHUNK).map(async (u) => {
        const info = await probeTPrints(u, 800)
        done++
        onProgress?.(done, list.length)
        if (info) found.push(info)
      })
    )
  }
  return found.sort((a, b) => a.url.localeCompare(b.url))
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
  MIXED: "Aralash",
}

/** Chek elementlari — mehmonxonaning saqlangan dizayni bo'yicha quriladi */
const buildReceiptElements = (
  sale: ShopSale,
  hotelName: string,
  guestName: string | null | undefined,
  design: ReceiptSettings
): any[] => {
  const when = sale.created_at ? new Date(sale.created_at) : new Date()
  const elements: any[] = [
    { type: "title", value: design.title.trim() || hotelName || "GoHotel", size: 2 },
  ]
  if (design.subtitle.trim()) {
    elements.push({ type: "text", value: design.subtitle.trim(), align: "center" })
  }
  if (design.header_note.trim()) {
    elements.push({ type: "text", value: design.header_note.trim(), align: "center" })
  }
  elements.push(
    { type: "line" },
    { type: "row", left: "Sana:", right: format(when, "dd.MM.yyyy HH:mm") }
  )
  if (design.show_check_no) {
    elements.push({ type: "row", left: "Chek:", right: `#${sale.id.slice(0, 8).toUpperCase()}` })
  }
  if (design.show_seller && sale.created_by_name) {
    elements.push({ type: "row", left: "Sotuvchi:", right: sale.created_by_name })
  }
  if (design.show_guest) {
    if (sale.reservation_number) {
      elements.push({ type: "row", left: "Bron:", right: sale.reservation_number })
    }
    const guest = guestName || sale.guest_name
    if (guest) {
      elements.push({ type: "row", left: "Mehmon:", right: guest })
    }
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
  )
  // Bo'lib to'lashda har bir usul o'z summasi bilan alohida qatorda chiqadi
  if (sale.status === "PAID" && sale.payments && sale.payments.length > 0) {
    sale.payments.forEach((p, i) => {
      elements.push({
        type: "row",
        left: i === 0 ? "To'lov:" : "",
        right: `${METHOD_LABELS[p.payment_method] || p.payment_method}: ${Number(p.amount).toLocaleString()}`,
      })
    })
  } else {
    elements.push({
      type: "row",
      left: "To'lov:",
      right:
        sale.status === "PAID"
          ? METHOD_LABELS[sale.payment_method || ""] || sale.payment_method || "—"
          : "Bron hisobiga",
    })
  }
  if (sale.status === "PENDING") {
    elements.push({
      type: "text",
      value: "To'lov mehmon chiqishida olinadi",
      align: "center",
    })
  }
  elements.push({ type: "line", style: "dashed" })
  if (design.footer_text.trim()) {
    elements.push({
      type: "text",
      value: design.footer_text.trim(),
      align: "center",
      bold: true,
    })
  }
  if (design.footer_note.trim()) {
    elements.push({ type: "text", value: design.footer_note.trim(), align: "center" })
  }
  if (design.qr_url.trim()) {
    elements.push({ type: "qr", value: design.qr_url.trim(), size: 5 })
  }
  elements.push({ type: "feed", lines: 1 })
  return elements
}

/** Do'kon sotuvi chekini chiqarish (dizayn berilmasa — standart) */
export const printShopReceipt = async (
  sale: ShopSale,
  hotelName: string,
  guestName?: string | null,
  design?: ReceiptSettings | null
): Promise<{ ok: boolean; error?: string }> => {
  const d = design || DEFAULT_RECEIPT_SETTINGS
  const r = await request("/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paper: d.paper,
      elements: buildReceiptElements(sale, hotelName, guestName, d),
    }),
  })
  return { ok: r.ok, error: r.error }
}

/** Dizayn sahifasidagi "Sinov chek" — namunaviy sotuv bilan chiqaradi */
export const printSampleReceipt = async (
  design: ReceiptSettings,
  hotelName: string
): Promise<{ ok: boolean; error?: string }> => {
  const sample: ShopSale = {
    id: "namuna01-0000-0000-0000-000000000000",
    reservation_id: null,
    reservation_number: "RES-NAMUNA",
    guest_name: "Jasur Toshmatov",
    total_amount: 57000,
    payment_method: "CASH",
    status: "PAID",
    paid_at: null,
    created_by: "",
    created_by_name: "Aziza Karimova",
    created_at: new Date().toISOString(),
    items: [
      { product_id: "1", product_name: "Coca-Cola 0.5", quantity: 2, unit_price: 12000, total_price: 24000 },
      { product_id: "2", product_name: "Shokolad", quantity: 1, unit_price: 18000, total_price: 18000 },
      { product_id: "3", product_name: "Suv 1L", quantity: 3, unit_price: 5000, total_price: 15000 },
    ],
  }
  return printShopReceipt(sample, hotelName, null, design)
}

/* ------------------------------------------------------------ bron cheki */

/** Bron cheki uchun kerakli ma'lumot.
 *
 *  Ataylab minimal: eski bronlarda ham shu maydonlar mavjud, shuning uchun
 *  chek istalgan bron uchun — bugungisi ham, arxivdagisi ham — chiqadi. */
export interface ReservationReceiptData {
  reservation_number: string
  guest_name?: string | null
  room_number?: string | null
  room_type?: string | null
  check_in: string
  check_out: string
  /** Sutkalar (yoki soatlik bronda soatlar) soni */
  nights?: number | null
  booking_type?: string | null
  adults?: number | null
  children?: number | null
  total_amount: number
  paid_amount: number
  discount_amount?: number | null
  /** Bronga yozilgan xizmatlar/qo'shimchalar */
  services?: Array<{ name: string; quantity?: number | null; amount: number }>
  created_at?: string | null
  created_by_name?: string | null
  status?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CHECKED_IN: "Kirilgan",
  CHECKED_OUT: "Chiqilgan",
  CANCELLED: "Bekor qilingan",
  NO_SHOW: "Kelmagan",
}

const money = (n: number) => Number(n || 0).toLocaleString()

const buildReservationElements = (
  data: ReservationReceiptData,
  hotelName: string,
  design: ReceiptSettings
): any[] => {
  const when = data.created_at ? new Date(data.created_at) : new Date()
  const elements: any[] = [
    { type: "title", value: design.title.trim() || hotelName || "GoHotel", size: 2 },
  ]
  // Do'kon cheki uchun yozilgan quyi sarlavha bronda o'rinsiz — bu yerda
  // hujjatning o'z nomi turadi, qolgan dizayn esa umumiy
  elements.push({ type: "text", value: "Yashash uchun chek", align: "center" })
  if (design.header_note.trim()) {
    elements.push({ type: "text", value: design.header_note.trim(), align: "center" })
  }
  elements.push(
    { type: "line" },
    { type: "row", left: "Sana:", right: format(when, "dd.MM.yyyy HH:mm") },
    { type: "row", left: "Bron:", right: data.reservation_number }
  )
  if (design.show_seller && data.created_by_name) {
    elements.push({ type: "row", left: "Qabul qildi:", right: data.created_by_name })
  }
  if (design.show_guest && data.guest_name) {
    elements.push({ type: "row", left: "Mehmon:", right: data.guest_name })
  }
  if (data.room_number) {
    elements.push({
      type: "row",
      left: "Xona:",
      right: data.room_type ? `${data.room_number} · ${data.room_type}` : data.room_number,
    })
  }
  const guests = [
    data.adults ? `${data.adults} kattalar` : "",
    data.children ? `${data.children} bolalar` : "",
  ]
    .filter(Boolean)
    .join(", ")
  if (guests) {
    elements.push({ type: "row", left: "Mehmonlar:", right: guests })
  }
  elements.push({ type: "line", style: "dashed" })

  const hourly = (data.booking_type || "").toUpperCase() === "HOURLY"
  elements.push(
    { type: "row", left: "Kirish:", right: data.check_in },
    { type: "row", left: "Chiqish:", right: data.check_out }
  )
  if (data.nights) {
    elements.push({
      type: "row",
      left: hourly ? "Soat:" : "Sutka:",
      right: String(data.nights),
    })
  }

  if (data.services && data.services.length > 0) {
    elements.push(
      { type: "line", style: "dashed" },
      {
        type: "table",
        headers: ["Xizmat", "Soni", "Summa"],
        widths: [3, 1, 2],
        aligns: ["left", "center", "right"],
        rows: data.services.map((s) => [
          s.name,
          s.quantity ? String(s.quantity) : "1",
          money(s.amount),
        ]),
      }
    )
  }

  elements.push({ type: "line" })
  if (data.discount_amount && data.discount_amount > 0) {
    elements.push({ type: "row", left: "Chegirma:", right: `−${money(data.discount_amount)}` })
  }
  elements.push({
    type: "row",
    left: "JAMI:",
    right: `${money(data.total_amount)} So'm`,
    bold: true,
    size: 2,
  })
  elements.push({ type: "row", left: "To'langan:", right: `${money(data.paid_amount)} So'm` })

  // Qoldiq har doim ko'rsatiladi: mehmon nima to'lagani va nima qolganini
  // chekdan ko'rishi kerak. Ortiqcha to'lov ham yashirilmaydi.
  const balance = Number(data.total_amount || 0) - Number(data.paid_amount || 0)
  if (balance > 0) {
    elements.push({
      type: "row",
      left: "Qoldiq:",
      right: `${money(balance)} So'm`,
      bold: true,
    })
  } else if (balance < 0) {
    elements.push({
      type: "row",
      left: "Ortiqcha:",
      right: `${money(-balance)} So'm`,
      bold: true,
    })
  } else {
    elements.push({ type: "text", value: "To'liq to'langan", align: "center" })
  }

  if (data.status && data.status !== "CHECKED_OUT") {
    elements.push({
      type: "row",
      left: "Holat:",
      right: STATUS_LABELS[data.status] || data.status,
    })
  }

  elements.push({ type: "line", style: "dashed" })
  if (design.footer_text.trim()) {
    elements.push({
      type: "text",
      value: design.footer_text.trim(),
      align: "center",
      bold: true,
    })
  }
  if (design.footer_note.trim()) {
    elements.push({ type: "text", value: design.footer_note.trim(), align: "center" })
  }
  if (design.qr_url.trim()) {
    elements.push({ type: "qr", value: design.qr_url.trim(), size: 5 })
  }
  elements.push({ type: "feed", lines: 1 })
  return elements
}

/** Bron chekini chiqarish (dizayn berilmasa — standart) */
export const printReservationReceipt = async (
  data: ReservationReceiptData,
  hotelName: string,
  design?: ReceiptSettings | null
): Promise<{ ok: boolean; error?: string }> => {
  const d = design || DEFAULT_RECEIPT_SETTINGS
  const r = await request("/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paper: d.paper,
      elements: buildReservationElements(data, hotelName, d),
    }),
  })
  return { ok: r.ok, error: r.error }
}
