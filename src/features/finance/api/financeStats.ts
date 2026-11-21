import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { isAxiosError } from "axios"

import { api } from "@/lib/api"

/* Moliya → To'lovlar va Hisob-fakturalar statistikasi.

   Server ro'yxat bilan BIR XIL shartlardan hisoblaydi (davr, qidiruv,
   filtrlar): jadvalda nima qolsa — statistika ham shundan
   (`finance_stats_service.py`).

   So'rov kalitlari ro'yxat kalitlari OSTIDA (`paymentsPage` / `invoicesPage`):
   to'lov qabul qilinsa yoki turi tahrirlansa ro'yxat bilan birga statistika
   ham yangilanadi — har joyga alohida yozish shart emas. */

export interface AmountCount {
  amount: number
  count: number
}

export interface PaymentStats {
  count: number
  /** Qaytarimlar ayirilgan */
  total: number
  income: number
  income_count: number
  refunds: number
  refund_count: number
  average: number
  largest: { amount: number; number: string | null; source: string; date: string | null } | null
  /** CASH / CARD / ONLINE / BANK_TRANSFER / MIXED / OTHER */
  methods: Array<{ key: string } & AmountCount>
  /** ROOM / PENALTY / SERVICE / OTHER / EXTRA / SHOP / REFUND (manfiy) */
  purposes: Array<{ key: string; amount: number }>
  sources: Partial<Record<"RESERVATION" | "SHOP", AmountCount>>
  /** Mehmon chiqib ketgandan keyin olingan to'lovlar */
  debt: AmountCount
  edited: number
  staff: Array<{ id: string; name: string | null } & AmountCount>
  staff_total: number
  days: Array<{ date: string } & AmountCount>
}

export interface InvoiceStats {
  count: number
  total: number
  paid: number
  remaining: number
  debt_count: number
  discount: number
  discount_count: number
  average: number
  /** Foiz; faol hujjat bo'lmasa null */
  collection_rate: number | null
  statuses: Array<{ status: string; count: number; total: number; remaining: number }>
  /** Qatorlar tarkibi: ROOM_CHARGE / PENALTY / SERVICE / ... */
  lines: Array<{ kind: string; amount: number }>
  /** 0_7 / 8_30 / 31_90 / 90_plus */
  aging: Array<{ bucket: string } & AmountCount>
  top_debts: Array<{
    id: string
    invoice_number: string
    invoice_date: string | null
    status: string
    total_amount: number
    remaining: number
    days: number | null
    reservation_number?: string | null
    guest_name?: string | null
    room_number?: string | null
  }>
}

type Params = Record<string, string | number | boolean | undefined>

const compact = (params: Params): Params =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== false))

/** Eski server (endpoint yo'q) yoki ruxsat yo'q — panel ko'rinmaydi */
export const statsUnavailable = (error: unknown): boolean =>
  isAxiosError(error) && [403, 404, 405, 422].includes(error.response?.status ?? 0)

const retry = (count: number, error: unknown) => !statsUnavailable(error) && count < 2

export const usePaymentStats = ({
  dateFrom,
  dateTo,
  search,
  filters,
  enabled = true,
}: {
  dateFrom?: string
  dateTo?: string
  search?: string
  /** `paymentFilterParams` — ro'yxat bilan bir xil */
  filters?: Params
  enabled?: boolean
}) => {
  const params = compact({
    date_from: dateFrom,
    date_to: dateTo,
    search: search?.trim() || undefined,
    include_shop: true,
    ...(filters ?? {}),
  })
  return useQuery({
    queryKey: ["paymentsPage", "stats", params],
    queryFn: async () => {
      const { data } = await api.get<PaymentStats>("/finance/payments/stats", { params })
      return data
    },
    enabled,
    retry,
    placeholderData: keepPreviousData,
  })
}

export const useInvoiceStats = ({
  dateFrom,
  dateTo,
  status,
  search,
  filters,
  enabled = true,
}: {
  dateFrom?: string
  dateTo?: string
  status?: string
  search?: string
  /** `invoiceFilterParams` — ro'yxat bilan bir xil */
  filters?: Params
  enabled?: boolean
}) => {
  const params = compact({
    date_from: dateFrom,
    date_to: dateTo,
    status: status || undefined,
    search: search?.trim() || undefined,
    ...(filters ?? {}),
  })
  return useQuery({
    queryKey: ["invoicesPage", "stats", params],
    queryFn: async () => {
      const { data } = await api.get<InvoiceStats>("/finance/invoices/stats", { params })
      return data
    },
    enabled,
    retry,
    placeholderData: keepPreviousData,
  })
}
