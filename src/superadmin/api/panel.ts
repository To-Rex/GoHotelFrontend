import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { uploadAppInChunks } from "./appUpload"
import { PANEL_TOKEN_KEY, panelApi } from "./client"

/** Panel API qatlami — barcha so'rovlar `/superadmin` ostida. */

export interface PanelUser {
  id: string
  email: string | null
  label: string
  is_root: boolean
  is_active: boolean
  created_at: string | null
  last_login_at: string | null
}

export interface PanelSession {
  access_token: string
  user: { id: string; email: string; label: string; is_root: boolean }
}

export interface Overview {
  hotels: number
  hotels_active: number
  branches: number
  rooms: number
  users: number
  guests: number
  reservations: number
  reservations_active: number
}

export interface PanelHotel {
  id: string
  name: string
  code: string
  status: string
  stars: number
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  description?: string | null
  address_line1?: string | null
  branch_count?: number
  room_count?: number
  user_count?: number
}

export interface PanelBranch {
  id: string
  hotel_id: string
  name: string
  code: string
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  is_main_branch: boolean
  room_count?: number
}

export interface HotelStaff {
  id: string
  username: string
  first_name: string
  last_name: string
  user_type: string
  status: string
  email: string | null
  phone: string | null
  last_login_at: string | null
}

/* ------------------------------------------------------------ kirish -- */

export async function panelLogin(
  email: string,
  password: string
): Promise<PanelSession> {
  const { data } = await panelApi.post<PanelSession>("/auth/login", {
    email,
    password,
  })
  localStorage.setItem(PANEL_TOKEN_KEY, data.access_token)
  return data
}

export function panelLogout() {
  localStorage.removeItem(PANEL_TOKEN_KEY)
}

export const usePanelMe = (enabled = true) =>
  useQuery({
    queryKey: ["panelMe"],
    queryFn: async () => {
      const { data } = await panelApi.get<PanelSession["user"]>("/auth/me")
      return data
    },
    enabled,
    retry: false,
  })

export const useChangeOwnPassword = () =>
  useMutation({
    mutationFn: async (payload: {
      current_password: string
      new_password: string
    }) => {
      const { data } = await panelApi.post("/auth/change-password", payload)
      return data
    },
  })

/* ------------------------------------------------------- umumiy holat -- */

export const useOverview = () =>
  useQuery({
    queryKey: ["panelOverview"],
    queryFn: async () => {
      const { data } = await panelApi.get<Overview>("/overview")
      return data
    },
  })

/* -------------------------------------------------------- mehmonxona -- */

export const useHotels = (search?: string) =>
  useQuery({
    queryKey: ["panelHotels", search || ""],
    queryFn: async () => {
      const { data } = await panelApi.get<PanelHotel[]>("/hotels", {
        params: { search: search?.trim() || undefined },
      })
      return Array.isArray(data) ? data : []
    },
  })

const invalidateHotels = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["panelHotels"] })
  qc.invalidateQueries({ queryKey: ["panelOverview"] })
}

export const useSaveHotel = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PanelHotel> & { id?: string }) => {
      const { id, ...body } = payload
      const { data } = id
        ? await panelApi.put<PanelHotel>(`/hotels/${id}`, body)
        : await panelApi.post<PanelHotel>("/hotels", body)
      return data
    },
    onSuccess: () => invalidateHotels(qc),
  })
}

export const useDeactivateHotel = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await panelApi.delete<PanelHotel>(`/hotels/${id}`)
      return data
    },
    onSuccess: () => invalidateHotels(qc),
  })
}

/* --------------------------------------------- butunlay o'chirish -- */

/** Boshqa (yoki global) jadval qatori shu mehmonxona qatoriga qaraydi. */
export interface PurgeConflict {
  table: string
  column: string
  references: string
  rows: number
  on_delete: string
  /** true — o'chirishni to'xtatadi; false — u ustun bo'shatiladi */
  blocking: boolean
}

export interface PurgeSharedHotel {
  hotel_id: string
  hotel_name: string
  guests: number
}

/** Tizim akkaunti (SUPER_ADMIN, sozlovchi) — o'chmaydi, faqat ajratiladi. */
export interface PurgeSystemUser {
  id: string
  username: string | null
  user_type: string
}

export interface PurgePreview {
  hotel: { id: string; name: string; code: string; status: string }
  tables: { table: string; rows: number }[]
  total_rows: number
  shared_guests: { count: number; hotels: PurgeSharedHotel[] }
  system_users: PurgeSystemUser[]
  conflicts: PurgeConflict[]
  files: number
  can_purge: boolean
  blocked_by: ("HOTEL_ACTIVE" | "CROSS_HOTEL_REFERENCES")[]
}

export interface PurgeResult {
  hotel: PurgePreview["hotel"]
  deleted: Record<string, number>
  total_rows: number
  guests_moved: number
  guests_moved_to: PurgeSharedHotel[]
  system_users_kept: PurgeSystemUser[]
  set_null: PurgeConflict[]
  files_removed: number
  files_failed: number
  seconds: number
}

/** Nima o'chishini ko'rsatadi — serverda hech narsa o'zgarmaydi. */
export const useHotelPurgePreview = (hotelId?: string) =>
  useQuery({
    queryKey: ["panelHotelPurge", hotelId],
    queryFn: async () => {
      const { data } = await panelApi.get<PurgePreview>(
        `/hotels/${hotelId}/purge-preview`
      )
      return data
    },
    enabled: !!hotelId,
    // Har ochilganda yangi hisob — eski raqam bilan o'chirib yubormaslik uchun
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

export const usePurgeHotel = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      confirm_code: string
      password: string
    }) => {
      const { id, ...body } = payload
      const { data } = await panelApi.post<PurgeResult>(
        `/hotels/${id}/purge`,
        body
      )
      return data
    },
    // Mehmonxona ko'p bo'limda ko'rinadi (mehmonlar, bronlar, moliya,
    // audit) — panelning hamma ro'yxati yangilanadi
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["panelHotelPurge"] })
      qc.invalidateQueries({
        predicate: (query) =>
          String(query.queryKey[0] ?? "").startsWith("panel"),
      })
    },
  })
}

/* ------------------------------------------------------------ filial -- */

export const useBranches = (hotelId?: string) =>
  useQuery({
    queryKey: ["panelBranches", hotelId],
    queryFn: async () => {
      const { data } = await panelApi.get<PanelBranch[]>(
        `/hotels/${hotelId}/branches`
      )
      return Array.isArray(data) ? data : []
    },
    enabled: !!hotelId,
  })

const invalidateBranches = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["panelBranches"] })
  qc.invalidateQueries({ queryKey: ["panelHotels"] })
  qc.invalidateQueries({ queryKey: ["panelOverview"] })
}

export const useSaveBranch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PanelBranch> & { hotelId: string }) => {
      const { hotelId, id, ...body } = payload
      const { data } = id
        ? await panelApi.put<PanelBranch>(`/branches/${id}`, body)
        : await panelApi.post<PanelBranch>(`/hotels/${hotelId}/branches`, body)
      return data
    },
    onSuccess: () => invalidateBranches(qc),
  })
}

export const useDeleteBranch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await panelApi.delete(`/branches/${id}`)
    },
    onSuccess: () => invalidateBranches(qc),
  })
}

/* ------------------------------------------------ mehmonxona xodimlari -- */

export const useHotelStaff = (hotelId?: string) =>
  useQuery({
    queryKey: ["panelStaff", hotelId],
    queryFn: async () => {
      const { data } = await panelApi.get<HotelStaff[]>(
        `/hotels/${hotelId}/users`
      )
      return Array.isArray(data) ? data : []
    },
    enabled: !!hotelId,
  })

export const useSetStaffStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; status: string }) => {
      const { data } = await panelApi.patch(`/staff/${payload.id}/status`, {
        status: payload.status,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["panelStaff"] }),
  })
}

export const useResetStaffPassword = () =>
  useMutation({
    mutationFn: async (payload: { id: string; password: string }) => {
      const { data } = await panelApi.post(`/staff/${payload.id}/password`, {
        password: payload.password,
      })
      return data
    },
  })

/* ------------------------------------------------------ sozlovchilar -- */

/** Sozlovchi — mehmonxonaga bog'lanmagan hisob: asosiy tizimga login va
 *  parol bilan kiradi, istalgan mehmonxona va filialni tanlab sozlaydi.
 *  Holati va paroli xodimlarniki kabi (`/staff/{id}/...`). */
export interface Configurator {
  id: string
  username: string
  first_name: string
  last_name: string
  user_type: string
  status: string
  email?: string | null
  phone?: string | null
  created_at?: string | null
  last_login_at?: string | null
}

export const useConfigurators = () =>
  useQuery({
    queryKey: ["panelConfigurators"],
    queryFn: async () => {
      const { data } = await panelApi.get<Configurator[]>("/configurators")
      return Array.isArray(data) ? data : []
    },
  })

const invalidateConfigurators = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["panelConfigurators"] })

export const useCreateConfigurator = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      username: string
      password: string
      first_name: string
      last_name?: string
      phone?: string
    }) => {
      const { data } = await panelApi.post<Configurator>("/configurators", payload)
      return data
    },
    onSuccess: () => invalidateConfigurators(qc),
  })
}

export const useSetConfiguratorStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; status: "ACTIVE" | "INACTIVE" }) => {
      const { data } = await panelApi.patch(`/staff/${payload.id}/status`, {
        status: payload.status,
      })
      return data
    },
    onSuccess: () => invalidateConfigurators(qc),
  })
}

export const useDeleteConfigurator = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await panelApi.delete(`/configurators/${id}`)
    },
    onSuccess: () => invalidateConfigurators(qc),
  })
}

/* ------------------------------------------- panel foydalanuvchilari -- */

export const usePanelUsers = () =>
  useQuery({
    queryKey: ["panelUsers"],
    queryFn: async () => {
      const { data } = await panelApi.get<PanelUser[]>("/users")
      return Array.isArray(data) ? data : []
    },
  })

const invalidateUsers = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["panelUsers"] })

export const useCreatePanelUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      email: string
      password: string
      label: string
    }) => {
      const { data } = await panelApi.post<PanelUser>("/users", payload)
      return data
    },
    onSuccess: () => invalidateUsers(qc),
  })
}

export const useSetPanelUserActive = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; is_active: boolean }) => {
      const { data } = await panelApi.patch<PanelUser>(
        `/users/${payload.id}/active`,
        { is_active: payload.is_active }
      )
      return data
    },
    onSuccess: () => invalidateUsers(qc),
  })
}

export const useResetPanelUserPassword = () =>
  useMutation({
    mutationFn: async (payload: { id: string; password: string }) => {
      const { data } = await panelApi.post(`/users/${payload.id}/password`, {
        password: payload.password,
      })
      return data
    },
  })

export const useDeletePanelUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await panelApi.delete(`/users/${id}`)
    },
    onSuccess: () => invalidateUsers(qc),
  })
}

/* ------------------------------------------------------------ nazorat -- */

export interface PanelRoom {
  id: string
  room_number: string
  floor: number
  room_type: string
  base_price: number
  capacity: number | null
  status: string
}

export interface PanelReservation {
  id: string
  reservation_number: string
  hotel_id: string
  hotel_name: string
  guest_name: string
  room_number: string
  booking_type: string
  check_in_date: string
  check_out_date: string
  status: string
  payment_status: string
  total_amount: number
  paid_amount: number
  created_at: string | null
}

export interface FinanceRow {
  hotel_id: string
  hotel_name: string
  income: number
  expense: number
  net: number
  payment_count: number
}

export interface FinanceSummary {
  date_from: string
  date_to: string
  items: FinanceRow[]
  income: number
  expense: number
  net: number
}

export interface AuditRow {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  hotel_name: string | null
  user_name: string | null
  ip_address: string | null
  created_at: string | null
}

export interface PanelGuest {
  id: string
  name: string
  phone: string | null
  passport_number: string | null
  blacklisted: boolean
  blacklist_reason: string | null
  created_at: string | null
}

export const useHotelRooms = (hotelId?: string) =>
  useQuery({
    queryKey: ["panelRooms", hotelId],
    queryFn: async () => {
      const { data } = await panelApi.get<PanelRoom[]>(`/hotels/${hotelId}/rooms`)
      return Array.isArray(data) ? data : []
    },
    enabled: !!hotelId,
  })

export const useCreateStaff = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      hotelId: string
      username: string
      password: string
      first_name: string
      last_name: string
      user_type: string
    }) => {
      const { hotelId, ...body } = payload
      const { data } = await panelApi.post<HotelStaff>(
        `/hotels/${hotelId}/users`,
        body
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["panelStaff"] })
      qc.invalidateQueries({ queryKey: ["panelHotels"] })
    },
  })
}

export interface ReservationFilters {
  hotel_id?: string
  status?: string
  date_from?: string
  date_to?: string
  search?: string
  skip?: number
  limit?: number
}

export const usePanelReservations = (filters: ReservationFilters) =>
  useQuery({
    queryKey: ["panelReservations", filters],
    queryFn: async () => {
      const { data } = await panelApi.get<{
        total: number
        items: PanelReservation[]
      }>("/reservations", {
        params: {
          hotel_id: filters.hotel_id || undefined,
          status: filters.status || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          search: filters.search?.trim() || undefined,
          skip: filters.skip ?? 0,
          limit: filters.limit ?? 50,
        },
      })
      return data
    },
    placeholderData: keepPreviousData,
  })

export const usePanelFinance = (
  dateFrom: string,
  dateTo: string,
  hotelId?: string
) =>
  useQuery({
    queryKey: ["panelFinance", dateFrom, dateTo, hotelId || ""],
    queryFn: async () => {
      const { data } = await panelApi.get<FinanceSummary>("/finance", {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          hotel_id: hotelId || undefined,
        },
      })
      return data
    },
    enabled: !!dateFrom && !!dateTo,
    placeholderData: keepPreviousData,
  })

export const usePanelAudit = (hotelId?: string) =>
  useQuery({
    queryKey: ["panelAudit", hotelId || ""],
    queryFn: async () => {
      const { data } = await panelApi.get<AuditRow[]>("/audit", {
        params: { hotel_id: hotelId || undefined },
      })
      return Array.isArray(data) ? data : []
    },
  })

/* --------------------------------------------------- push (Firebase) -- */

export interface PushStatus {
  enabled: boolean
  configured: boolean
  credential_source: string
  error: string | null
  panel_key_stored: boolean
  panel_key_readable: boolean
  project_id: string | null
  updated_at: string | null
}

export const usePushStatus = () =>
  useQuery({
    queryKey: ["panelPushStatus"],
    queryFn: async () => {
      const { data } = await panelApi.get<PushStatus>("/push")
      return data
    },
  })

const invalidatePush = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["panelPushStatus"] })

export const useSavePushCredentials = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: string) => {
      const { data } = await panelApi.post<PushStatus>("/push/credentials", {
        credentials,
      })
      return data
    },
    onSuccess: () => invalidatePush(qc),
  })
}

export const useDeletePushCredentials = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await panelApi.delete<PushStatus>("/push/credentials")
      return data
    },
    onSuccess: () => invalidatePush(qc),
  })
}

export const useTestPush = () =>
  useMutation({
    mutationFn: async (fcmToken: string) => {
      const { data } = await panelApi.post<{ sent: number }>("/push/test", {
        fcm_token: fcmToken,
      })
      return data
    },
  })

/* ------------------------------------------------ dasturlar do'koni -- */

export interface PanelAppRelease {
  id: string
  platform: "ANDROID" | "WINDOWS"
  name: string
  version: string | null
  notes: string | null
  original_name: string
  mime_type: string
  file_size: number
  download_count: number
  created_at: string | null
}

export const usePanelApps = () =>
  useQuery({
    queryKey: ["panelApps"],
    queryFn: async () => {
      const { data } = await panelApi.get<PanelAppRelease[]>("/apps")
      return Array.isArray(data) ? data : []
    },
  })

/** Fayl BO'LAKLAB yuboriladi (appUpload.ts): har bo'lak alohida qisqa
    so'rov — proksi vaqt chegarasi (60 s) katta faylni uzmaydi, xato bergan
    bo'lak qayta ketadi, `onProgress` foizni beradi. */
export const useUploadPanelApp = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      platform: string
      name: string
      version: string
      notes: string
      file: File
      onProgress?: (percent: number) => void
    }) =>
      uploadAppInChunks<PanelAppRelease>(panelApi, payload, {
        onProgress: payload.onProgress,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["panelApps"] }),
  })
}

export const useDeletePanelApp = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await panelApi.delete(`/apps/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["panelApps"] }),
  })
}

export const usePanelGuests = (search?: string) =>
  useQuery({
    queryKey: ["panelGuests", search || ""],
    queryFn: async () => {
      const { data } = await panelApi.get<PanelGuest[]>("/guests", {
        params: { search: search?.trim() || undefined },
      })
      return Array.isArray(data) ? data : []
    },
  })

/* --- So'rovlar jurnali (oxirgi 500 ta, faqat server xotirasida) ------ */

export interface ApiLogEntry {
  id: number
  ts: string
  method: string
  path: string
  status: number
  duration_ms: number
  ip?: string | null
  request_body?: string | null
  response_body?: string | null
}

export interface ApiLogList {
  items: ApiLogEntry[]
  captured_total: number
  max_entries: number
}

/** Jurnal — sahifa ochiq va pauza bosilmagan bo'lsa har 3 soniyada
    yangilanadi; oldingi natija almashinuv paytida ushlab turiladi. */
export const useApiLogs = (
  filters: { method?: string; status?: string; q?: string },
  live: boolean
) =>
  useQuery({
    queryKey: ["panelApiLogs", filters],
    queryFn: async () => {
      const { data } = await panelApi.get<ApiLogList>("/api-logs", {
        params: {
          method: filters.method || undefined,
          status: filters.status || undefined,
          q: filters.q?.trim() || undefined,
        },
      })
      return data
    },
    refetchInterval: live ? 3000 : false,
    placeholderData: (prev: ApiLogList | undefined) => prev,
  })

export const useClearApiLogs = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await panelApi.delete("/api-logs")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["panelApiLogs"] }),
  })
}
