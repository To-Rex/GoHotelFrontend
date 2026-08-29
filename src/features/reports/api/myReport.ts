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

/** Hisobot ustunlari — server bilan bir xil guruhlash.
 *
 *  Bazadagi kodlar (CREDIT_CARD, BANK_TRANSFER, ONLINE...) shu ustunlarga
 *  yig'iladi; tanilmagani "other" da qoladi va yo'qolib ketmaydi. */
export interface MethodBreakdown {
  cash: number
  card: number
  transfer: number
  online: number
  other: number
}

/** Ustunlar tartibi va nomlari — sahifada shu tartibda ko'rsatiladi */
export const METHOD_COLUMNS: Array<{ key: keyof MethodBreakdown; label: string }> = [
  { key: "cash", label: "Naqd" },
  { key: "card", label: "Karta" },
  { key: "transfer", label: "O'tkazma" },
  { key: "online", label: "Onlayn" },
  { key: "other", label: "Boshqa" },
]

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
