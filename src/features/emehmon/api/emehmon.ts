import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getLang } from "@/i18n"
import { api } from "@/lib/api"
import type { DictItem, EmehmonForm, EmehmonState } from "../lib/emehmon"

/* E-mehmon (davlat ro'yxati) — server tomoni. Sozlama har FILIAL uchun
   alohida (joriy filial). E-mehmon serveriga so'rovlar backenddan ketadi:
   brauzer faqat o'z backendimiz bilan gaplashadi. */

export type EmehmonEnvironment = "sandbox" | "production"

export interface EmehmonConfig {
  enabled: boolean
  environment: EmehmonEnvironment
  auto_checkout: boolean
  prompt_on_checkin: boolean
  can_configure: boolean
  can_operate: boolean
}

export interface EmehmonSettings {
  enabled: boolean
  environment: EmehmonEnvironment
  username: string
  /** Maxfiy kalit kiritilganmi va oxirgi 4 belgisi (kalitning o'zi javobda kelmaydi) */
  secret_set: boolean
  secret_hint: string
  default_visit_type_id: number | null
  default_guest_type_id: number | null
  card_payment_type_id: number
  auto_checkout: boolean
  prompt_on_checkin: boolean
  enabled_at: string | null
  base_url: string
  /** Yoqish uchun yetishmayotgan narsalar */
  problems: string[]
}

export type EmehmonSettingsPayload = Partial<
  Pick<
    EmehmonSettings,
    | "enabled"
    | "environment"
    | "username"
    | "default_visit_type_id"
    | "default_guest_type_id"
    | "card_payment_type_id"
    | "auto_checkout"
    | "prompt_on_checkin"
  >
> & { secret?: string; clear_secret?: boolean }

export interface EmehmonStatus {
  ok: boolean
  environment: EmehmonEnvironment
  sandbox?: boolean
  hotel?: {
    hotel_id: number | null
    name: string | null
    inn: string | null
    address: string | null
    license_number: string | null
  }
  can_create?: boolean
  blocking_reasons?: string[]
  deposit?: number | null
  deposit_alert?: string | null
  license_expires_at?: string | null
  error_code?: string
  error?: string
}

export interface EmehmonRegistration {
  id: string
  reservation_id: string | null
  guest_id: string | null
  role: "main" | "companion"
  full_name: string | null
  passport_number: string | null
  environment: EmehmonEnvironment
  status: Exclude<EmehmonState, "none">
  listok_id: number | null
  reg_num: string | null
  uncertain: boolean
  attempts: number
  error_code: string | null
  error: string | null
  error_meta: { existing_listok_id?: number; [key: string]: unknown }
  arrived_at: string | null
  registered_at: string | null
  checked_out_at: string | null
  checkout_sum: number | null
  checkout_payment_type: number | null
  checkout_auto: boolean
  checkout_attempts: number
  checkout_error_code: string | null
  checkout_error: string | null
  date_visit_off: string | null
  note: string | null
  foreign_duplicates: unknown[]
  created_at: string | null
  reservation_number?: string | null
  room_number?: string | null
}

export interface CheckoutDefaults {
  sum: number
  payment_type_id: number
}

export interface EmehmonPerson {
  guest_id: string
  role: "main" | "companion"
  name: string
  present: boolean
  state: EmehmonState
  since: string | null
  /** Kirganiga 12 soatdan oshgan — haqiqiy vaqtni E-mehmon qabul qilmaydi */
  overdue: boolean
  /** Mehmon kartasidagi fuqarolikning ISO kodi (id ma'lumotnomadan topiladi) */
  citizen_code: string | null
  registration: EmehmonRegistration | null
  form: EmehmonForm | null
  checkout: CheckoutDefaults | null
}

export interface EmehmonSheet {
  enabled: boolean
  environment: EmehmonEnvironment
  reservation: {
    id: string
    number: string
    status: string
    room_number: string | null
    check_in_date: string
    check_out_date: string
    arrived_at: string | null
    total_amount: number
  }
  window: { min: string; max: string }
  persons: EmehmonPerson[]
}

export interface PendingRegister {
  reservation_id: string
  reservation_number: string
  room_number: string | null
  guest_id: string
  role: "main" | "companion"
  name: string
  state: EmehmonState
  error: string | null
  since: string | null
  overdue: boolean
}

export interface PendingCheckout extends EmehmonRegistration {
  /** Fon vazifasi o'zi chiqaradi (xodim hech narsa qilmaydi) */
  auto: boolean
}

export interface EmehmonPending {
  enabled: boolean
  register: PendingRegister[]
  checkout: PendingCheckout[]
  count: number
}

export interface LookupResult {
  found: boolean
  person?: Partial<EmehmonForm>
  source?: string | null
  birth_place?: string | null
  error_code?: string
  error?: string
  meta?: Record<string, unknown>
}

export interface EmehmonRoom {
  id: number
  room_number: string
  room_type_id?: number | null
  room_type_name?: string | null
}

export type DictionaryName =
  | "countries"
  | "visit-types"
  | "guest-types"
  | "passport-types"
  | "visa-types"
  | "payment-types"

export const emehmonKeys = {
  all: ["emehmon"] as const,
  config: ["emehmon", "config"] as const,
  settings: ["emehmon", "settings"] as const,
  pending: ["emehmon", "pending"] as const,
  sheet: (reservationId: string) => ["emehmon", "sheet", reservationId] as const,
  dictionary: (name: string, lang: string) => ["emehmon", "dictionary", name, lang] as const,
  rooms: ["emehmon", "rooms"] as const,
  journal: (status: string, search: string, page: number) =>
    ["emehmon", "journal", status, search, page] as const,
}

/** Ekran uchun qisqa sozlama — hamma xodim o'qiydi. */
export const useEmehmonConfig = (enabled = true) =>
  useQuery({
    queryKey: emehmonKeys.config,
    queryFn: async () => (await api.get<EmehmonConfig>("/emehmon/config")).data,
    enabled,
    staleTime: 60_000,
    retry: false,
  })

export const useEmehmonSettings = (enabled = true) =>
  useQuery({
    queryKey: emehmonKeys.settings,
    queryFn: async () => (await api.get<EmehmonSettings>("/emehmon/settings")).data,
    enabled,
  })

export const useSaveEmehmonSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EmehmonSettingsPayload) =>
      (await api.put<EmehmonSettings>("/emehmon/settings", payload)).data,
    onSuccess: (data) => {
      qc.setQueryData(emehmonKeys.settings, data)
      qc.invalidateQueries({ queryKey: emehmonKeys.config })
      qc.invalidateQueries({ queryKey: emehmonKeys.pending })
      // Login yoki muhit almashgan bo'lishi mumkin — ma'lumotnomalar boshqa
      qc.invalidateQueries({ queryKey: ["emehmon", "dictionary"] })
      qc.invalidateQueries({ queryKey: emehmonKeys.rooms })
    },
  })
}

export const testEmehmonConnection = async () =>
  (await api.post<EmehmonStatus>("/emehmon/gate/test")).data

/** E-mehmon ma'lumotnomasi (davlatlar, tashrif maqsadlari...). Kam o'zgaradi. */
export const useEmehmonDictionary = (name: DictionaryName, enabled = true) => {
  const lang = getLang()
  return useQuery({
    queryKey: emehmonKeys.dictionary(name, lang),
    queryFn: async () =>
      (
        await api.get<{ items: DictItem[] }>(`/emehmon/dictionaries/${name}`, { params: { lang } })
      ).data.items,
    enabled,
    staleTime: 3_600_000,
    retry: false,
  })
}

export const useEmehmonRooms = (enabled = true) =>
  useQuery({
    queryKey: emehmonKeys.rooms,
    queryFn: async () => (await api.get<{ items: EmehmonRoom[] }>("/emehmon/rooms")).data.items,
    enabled,
    staleTime: 600_000,
    retry: false,
  })

export const useEmehmonPending = (enabled = true) =>
  useQuery({
    queryKey: emehmonKeys.pending,
    queryFn: async () => (await api.get<EmehmonPending>("/emehmon/pending")).data,
    enabled,
    refetchInterval: 60_000,
    retry: false,
  })

export const useEmehmonSheet = (reservationId: string | null) =>
  useQuery({
    queryKey: emehmonKeys.sheet(reservationId || ""),
    queryFn: async () =>
      (await api.get<EmehmonSheet>(`/emehmon/reservations/${reservationId}`)).data,
    enabled: !!reservationId,
    retry: false,
  })

export const useEmehmonJournal = (status: string, search: string, page: number, enabled = true) =>
  useQuery({
    queryKey: emehmonKeys.journal(status, search, page),
    queryFn: async () =>
      (
        await api.get<{ items: EmehmonRegistration[]; total: number }>("/emehmon/registrations", {
          params: {
            status: status || undefined,
            search: search || undefined,
            skip: page * JOURNAL_PAGE,
            limit: JOURNAL_PAGE,
          },
        })
      ).data,
    enabled,
  })

export const JOURNAL_PAGE = 20

export const lookupPerson = async (form: EmehmonForm) =>
  (
    await api.post<LookupResult>("/emehmon/gate/lookup", {
      passport_number: form.passport_number,
      birth_date: form.birth_date,
      citizen_id: form.citizen_id,
    })
  ).data

export const registerPerson = async (reservationId: string, guestId: string, form: EmehmonForm) =>
  (
    await api.post<EmehmonRegistration>(`/emehmon/gate/reservations/${reservationId}/register`, {
      guest_id: guestId,
      form,
    })
  ).data

export const linkListok = async (reservationId: string, guestId: string, listokId: number) =>
  (
    await api.post<EmehmonRegistration>(`/emehmon/gate/reservations/${reservationId}/link`, {
      guest_id: guestId,
      listok_id: listokId,
    })
  ).data

export const skipPerson = async (reservationId: string, guestId: string, note: string) =>
  (
    await api.post<EmehmonRegistration>(`/emehmon/reservations/${reservationId}/skip`, {
      guest_id: guestId,
      note: note || null,
    })
  ).data

export const unskipPerson = async (reservationId: string, guestId: string) =>
  (
    await api.delete<{ ok: boolean }>(`/emehmon/reservations/${reservationId}/skip`, {
      params: { guest_id: guestId },
    })
  ).data

export const checkoutRegistration = async (
  registrationId: string,
  payload: { sum?: number; payment_type_id?: number } = {}
) =>
  (
    await api.post<EmehmonRegistration>(
      `/emehmon/gate/registrations/${registrationId}/checkout`,
      payload
    )
  ).data

export const refreshRegistration = async (registrationId: string) =>
  (await api.post<EmehmonRegistration>(`/emehmon/gate/registrations/${registrationId}/refresh`))
    .data
