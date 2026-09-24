import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

/**
 * Xodimning shaxsiy hisoboti — serverda hisoblanadi.
 *
 * Ilgari sahifa butun mehmonxonaning eng yangi 500 ta bronini yuklab, ularni
 * brauzerda filtrlar edi. Bunda uchta muammo bor edi: 500 tadan keyingi
 * yozuvlar jimgina tushib qolardi, "bugun" turli bo'limlarda turli ma'noni
 * bildirardi, va pul bronni KIM YARATGANIGA qarab yozilardi — kim qabul
 * qilganiga emas.
 *
 * Endi hammasi bitta so'rovda, serverda: pul to'lovning o'zidan olinadi
 * (kassa hisobidagi ta'rif bilan bir xil), sana chegarasi mahalliy kun
 * bo'yicha belgilanadi.
 */

/** Hisobot ustunlari — ilovadagi to'rtta to'lov usuli.
 *
 *  Xodim shu to'rttadan birini tanlaydi, shuning uchun hisobot ham aynan
 *  shularni ko'rsatadi. Bazadagi eski kodlar (CREDIT_CARD, MOBILE_PAYMENT...)
 *  serverda o'z kanonik ustuniga yig'iladi — eski yozuvlar yo'qolmaydi. */
export interface MethodBreakdown {
  cash: number
  card: number
  online: number
  bank_transfer: number
  other: number
}

/** Ustunlar tartibi va nomlari — to'lov oynasidagi nomlar bilan bir xil */
export const METHOD_COLUMNS: Array<{ key: keyof MethodBreakdown; label: string }> = [
  { key: "cash", label: "Naqd pul" },
  { key: "card", label: "Bank kartasi" },
  { key: "online", label: "Online to'lov" },
  { key: "bank_transfer", label: "Bank o'tkazmasi" },
  { key: "other", label: "Boshqa" },
]

/** Usul kodi → to'lov oynasidagi nomi ("cash" → "Naqd pul") */
export const METHOD_LABEL: Record<string, string> = Object.fromEntries(
  METHOD_COLUMNS.map((c) => [c.key, c.label])
)

/** Bron bo'yicha bitta to'lov usuli va shu usulda to'langan summa */
export interface ReservationPaymentMethod {
  method: keyof MethodBreakdown
  amount: number
}

export interface MyReportReservationRow {
  id: string
  reservation_number: string | null
  guest_name: string | null
  room_number: string | null
  status: string
  total_amount: number
  paid_amount: number
  check_in_date: string | null
  check_out_date: string | null
  created_at: string
  /** To'lov turi(lari) — summasi kattasi birinchi; to'lanmagan bron — bo'sh.
   *  `paid_amount` bilan bir xil manba: bronning barcha to'lovlari.
   *  Eski backend bu maydonni bermasa — undefined, ustunda "—" ko'rinadi. */
  payment_methods?: ReservationPaymentMethod[]
}

/** "To'lov turi" matni: bitta usul — nomi; bir nechta — "Naqd pul · Bank
 *  kartasi" (summa kattasi birinchi); to'lov yo'q — null. Jadvaldagi
 *  qidiruv va saralash ham shu matn bo'yicha. */
export function paymentMethodsLabel(
  row: Pick<MyReportReservationRow, "payment_methods">
): string | null {
  const list = row.payment_methods ?? []
  if (list.length === 0) return null
  return list.map((p) => METHOD_LABEL[p.method] ?? p.method).join(" · ")
}

export interface MyReportExpenseRow {
  id: string
  title: string | null
  category: string | null
  notes: string | null
  amount: number
  payment_method: string | null
  expense_date: string | null
}

export interface MyReportSummary {
  date_from: string
  date_to: string
  reservations: {
    /** Xodim yaratgan bronlar soni (bekor qilinganlar ham kiradi) */
    count: number
    cancelled_count: number
    /** Bekor qilinmagan bronlarning shartnoma qiymati — bu PUL EMAS */
    total_amount: number
    items: MyReportReservationRow[]
  }
  payments: {
    count: number
    /** Xodim qabul qilgan pul; qaytarimlar manfiy bo'lib shu yerda hisobga olingan */
    total: number
    refunds: number
    by_method: MethodBreakdown
  }
  shop: {
    count: number
    total: number
    by_method: MethodBreakdown
    unpaid_count: number
    unpaid_total: number
  }
  expenses: {
    count: number
    total: number
    by_method: MethodBreakdown
    items: MyReportExpenseRow[]
  }
  /** Jami tushum: bron to'lovlari + do'kon savdosi (qaytarimlar ayirilgan) */
  income: {
    total: number
    by_method: MethodBreakdown
  }
  /** Sof natija: tushumdan xarajat ayirilgan. Musbat — foyda, manfiy — zarar */
  net: {
    total: number
    profit: number
    loss: number
    by_method: MethodBreakdown
  }
  /** Kassaga tushgan sof naqd: naqd to'lovlar + do'kon naqdi − naqd xarajatlar */
  net_cash: number
}

export const useMyReport = (dateFrom: string, dateTo: string) =>
  useQuery({
    queryKey: ["myReport", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<MyReportSummary>("/reports/my-summary", {
        params: { date_from: dateFrom, date_to: dateTo },
      })
      return data
    },
    enabled: Boolean(dateFrom && dateTo),
  })
