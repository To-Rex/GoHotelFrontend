import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Mehmonning turish tarixi: qachon, qaysi xonada, kim bilan.

   Bandlovlar ro'yxatidan farqi — bu yerda mehmon HAMROH bo'lib turgan
   bronlar ham bor. Ularsiz "kim bilan kelgan" savoli chala javob olardi:
   birga kelgan ikki kishidan faqat bittasining tarixi ko'rinardi. */

export interface StayPerson {
  guest_id?: string | null
  name?: string | null
  phone?: string | null
  is_primary: boolean
  is_self: boolean
}

export interface GuestStay {
  id: string
  reservation_number: string
  /** MAIN — bronni shu mehmon ochgan; COMPANION — hamroh bo'lib turgan */
  role: "MAIN" | "COMPANION"
  booking_type: string
  check_in_date: string
  check_out_date: string
  check_in_datetime?: string | null
  check_out_datetime?: string | null
  status: string
  room_id?: string | null
  room_number?: string | null
  room_type_name?: string | null
  floor_number?: number | null
  branch_name?: string | null
  adults: number
  children: number
  total_amount: number
  paid_amount: number
  payment_status?: string | null
  people: StayPerson[]
  created_at: string
}

export interface GuestStaySummary {
  total_stays: number
  completed_stays: number
  total_nights: number
  total_paid: number
  first_stay?: string | null
  last_stay?: string | null
  favourite_room?: string | null
}

export interface GuestHistory {
  summary: GuestStaySummary
  stays: GuestStay[]
}

export const useGuestHistory = (guestId?: string) =>
  useQuery({
    queryKey: ["guestHistory", guestId],
    // Faqat oyna ochilganda so'raladi — mehmonlar ro'yxati og'irlashmasin
    enabled: !!guestId,
    queryFn: async () => {
      const { data } = await api.get<GuestHistory>(`/guests/${guestId}/history`)
      return data
    },
  })
