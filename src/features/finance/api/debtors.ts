import { useQuery, type QueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Qarzdorlar — to'lovi tugallanmagan bronlar.

   "Qarzdor" deganda XONADAN FOYDALANGAN, lekin pulini to'liq to'lamagan
   mehmon tushuniladi: kirgan yoki chiqib ketgan bronlar. Kelgusidagi
   tasdiqlangan bron hali qarz emas — mehmon kelmagan ham bo'lishi mumkin.
   Ta'rif serverda, `debtor_service` da.

   Har qarzning SABABI ham keladi (`reasons`): to'lovlar haqlarni vaqt
   tartibida yopadi, yopilmay qolgan qismi — sabab (xona, chiqishda qayta
   hisob, xizmat, jarima, do'kon). Hisob `debt_service` da. */

export type DebtReasonKind = "room" | "extension" | "service" | "penalty" | "shop"

/** To'lanmagan haq — qarzning bitta sababi */
export interface DebtReason {
  kind: DebtReasonKind | string
  /** To'lanmagan qismi */
  amount: number
  /** Hisoblangan to'liq summa */
  charged: number
  room_number?: string | null
  nights?: number | null
  unit_price?: number | null
  discount?: number | null
  check_in_date?: string | null
  check_out_date?: string | null
  /** Jarima: LATE_CHECKOUT | DAMAGE | OTHER */
  penalty_kind?: string | null
  note?: string | null
  date?: string | null
  /** Xizmat nomi */
  name?: string | null
  quantity?: number | null
  /** Do'kon: "Cola ×2, Snickers ×1" */
  products?: string | null
  sale_id?: string | null
  created_at?: string | null
  created_by_name?: string | null
}

/** Qarz bilan chiqarilgan: kim, qachon, qancha va nima uchun */
export interface DebtAcknowledgement {
  at: string
  by?: string | null
  by_name?: string | null
  note?: string | null
  amount: number
}

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
  /** Jami qarz: bron + do'kon */
  debt_amount: number
  /* Eski server bu maydonlarni yubormaydi — hammasi ixtiyoriy */
  reservation_debt?: number
  shop_debt?: number
  expected_total?: number
  /** Chiqishda qayta hisoblanadi (uzaytirilgan muddat) */
  projected?: boolean
  reasons?: DebtReason[]
  reason_text?: string
  overdue_days?: number | null
  acknowledged?: DebtAcknowledgement | null
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
  summary: {
    count: number
    guests: number
    total_debt: number
    reservation_debt?: number
    shop_debt?: number
  }
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
  /** Davriy yangilash (ms) — qarzlar ko'z oldida turishi uchun */
  refetchMs?: number
}

/** Pul harakatidan keyin qarz ro'yxatlari va bron hisob varag'i yangilansin */
export const invalidateDebts = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ["debtors"] })
  queryClient.invalidateQueries({ queryKey: ["reservationDebt"] })
}

export const useDebtors = (params: DebtorsParams = {}) => {
  const { dateFrom, dateTo, mine, guestId, enabled = true, refetchMs } = params
  return useQuery({
    queryKey: ["debtors", dateFrom || "", dateTo || "", !!mine, guestId || ""],
    enabled,
    refetchInterval: refetchMs && refetchMs > 0 ? refetchMs : false,
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

/** Bron hisob varag'i: qarz, sabablari, to'lovlar va do'kon savdolari */
export interface ReservationDebt {
  reservation_id: string
  status: string
  total_amount: number
  expected_total: number
  paid_amount: number
  projected: boolean
  reservation_debt: number
  shop_debt: number
  total_debt: number
  /** To'lanmagan haqlar — qarzning sabablari */
  items: DebtReason[]
  /** Barcha hisoblangan haqlar (to'langanlari ham) */
  charges: DebtReason[]
  shop_sales: Array<{
    sale_id: string
    total: number
    paid: number
    remaining: number
    products: string
    created_at?: string | null
    created_by_name?: string | null
  }>
  payments?: Array<{
    amount: number
    method: string
    date: string
    created_at?: string | null
    created_by_name?: string | null
    notes?: string | null
  }>
  overdue_days?: number | null
  acknowledged?: DebtAcknowledgement | null
}

export const reservationDebtKey = (id?: string | null) => ["reservationDebt", id || ""]

export const useReservationDebt = (id?: string | null, enabled = true) =>
  useQuery({
    queryKey: reservationDebtKey(id),
    enabled: !!id && enabled,
    queryFn: async () => {
      const { data } = await api.get<ReservationDebt>(`/reservations/${id}/debt`)
      return data
    },
    // Ochiq oynada ham pul harakati tez aks etsin
    staleTime: 5_000,
    retry: false,
  })
