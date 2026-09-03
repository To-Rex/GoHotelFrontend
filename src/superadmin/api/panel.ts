import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
