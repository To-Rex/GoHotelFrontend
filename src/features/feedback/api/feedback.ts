import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  FeedbackPriority,
  FeedbackStatus,
  FeedbackType,
  GuestFeedback,
} from "@/types/api"

/* Talab, taklif va shikoyatlar — /feedback/ endpointlari.
   `hotelId` faqat SUPER_ADMIN uchun (boshqa xodimlarda tokendan olinadi). */

export interface FeedbackListParams {
  status?: string
  feedback_type?: string
  date_from?: string
  date_to?: string
  query?: string
}

interface FeedbackListResponse {
  items: GuestFeedback[]
  total: number
}

export const useFeedbackList = (params: FeedbackListParams = {}, enabled = true) =>
  useQuery({
    queryKey: ["feedback", params],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<FeedbackListResponse | GuestFeedback[]>(
        "/feedback/",
        { params: { ...params, limit: 500 } }
      )
      // Ikkala shaklga chidamli (boshqa ro'yxat huklari bilan bir xil odat)
      if (Array.isArray(data)) return { items: data, total: data.length }
      return { items: data.items || [], total: data.total ?? 0 }
    },
    placeholderData: keepPreviousData,
    // Boshqa xodim kiritgan yangi shikoyat sahifa ochiq turganda ham ko'rinsin
    refetchInterval: 60_000,
  })

export interface FeedbackCreatePayload {
  feedback_type: FeedbackType
  subject: string
  body: string
  priority?: FeedbackPriority
  guest_id?: string
  reservation_id?: string
  room_id?: string
  guest_name?: string
  guest_phone?: string
  assigned_to?: string
  hotelId?: string
}

export const useCreateFeedback = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ hotelId, ...body }: FeedbackCreatePayload) => {
      const { data } = await api.post<GuestFeedback>("/feedback/", body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback"] }),
  })
}

/* PATCH faqat yuborilgan maydonlarni o'zgartiradi: `undefined` — tegilmaydi,
   `null` — tozalanadi (masalan mas'ulni olib tashlash). */
export interface FeedbackUpdatePayload {
  id: string
  hotelId?: string
  feedback_type?: FeedbackType
  subject?: string
  body?: string
  priority?: FeedbackPriority
  guest_id?: string | null
  reservation_id?: string | null
  room_id?: string | null
  guest_name?: string | null
  guest_phone?: string | null
  assigned_to?: string | null
  resolution?: string | null
}

export const useUpdateFeedback = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, hotelId, ...body }: FeedbackUpdatePayload) => {
      const { data } = await api.patch<GuestFeedback>(`/feedback/${id}`, body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback"] }),
  })
}

export const useSetFeedbackStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      hotelId,
      status,
      resolution,
    }: {
      id: string
      hotelId?: string
      status: FeedbackStatus
      resolution?: string
    }) => {
      const { data } = await api.patch<GuestFeedback>(
        `/feedback/${id}/status`,
        { status, resolution },
        { params: hotelId ? { hotel_id: hotelId } : {} }
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback"] }),
  })
}

export const useDeleteFeedback = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, hotelId }: { id: string; hotelId?: string }) => {
      await api.delete(`/feedback/${id}`, {
        params: hotelId ? { hotel_id: hotelId } : {},
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback"] }),
  })
}
