import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Qarzdorlar — to'lovi tugallanmagan bronlar.

   "Qarzdor" deganda XONADAN FOYDALANGAN, lekin pulini to'liq to'lamagan
   mehmon tushuniladi: kirgan yoki chiqib ketgan bronlar. Kelgusidagi
   tasdiqlangan bron hali qarz emas — mehmon kelmagan ham bo'lishi mumkin.
   Ta'rif serverda, `debtor_service` da. */

export interface DebtorReservation {
  id: string
  reservation_number: string
  guest_id?: string | null
  guest_name?: string | null
  guest_phone?: string | null
  room_number?: string | null
  branch_name?: string | null
  booking_type: string
  check_in_date: string
  check_out_date: string
  status: string
  total_amount: number
  paid_amount: number
  debt_amount: number
  created_by?: string | null
  created_by_name?: string | null
}

export interface DebtorGuest {
  guest_id?: string | null
  guest_name?: string | null
  guest_phone?: string | null
  reservations: number
  debt_amount: number
  oldest_check_out?: string | null
}

export interface DebtorsResponse {
  summary: { count: number; guests: number; total_debt: number }
  items: DebtorReservation[]
  guests: DebtorGuest[]
}

export interface DebtorsParams {
  dateFrom?: string
  dateTo?: string
  /** Faqat so'rovchi xodim ochgan bronlar — shaxsiy hisobot uchun */
  mine?: boolean
  guestId?: string
  enabled?: boolean
}

export const useDebtors = (params: DebtorsParams = {}) => {
  const { dateFrom, dateTo, mine, guestId, enabled = true } = params
  return useQuery({
    queryKey: ["debtors", dateFrom || "", dateTo || "", !!mine, guestId || ""],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<DebtorsResponse>("/finance/debtors", {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          mine: mine || undefined,
          guest_id: guestId || undefined,
        },
      })
      return data
    },
  })
}
