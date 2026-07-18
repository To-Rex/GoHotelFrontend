import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Reservation } from '@/types/api';

export const useReservations = (status?: string) => {
  return useQuery({
    queryKey: ['reservations', status],
    queryFn: async () => {
      const { data } = await api.get<{ items: Reservation[] }>('/reservations/', {
        params: { status, limit: 500, page_size: 500 }
      });
      // Handle both paginated and flat array responses
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

export const useCreateReservation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: any) => {
      // hotelId ni body'dan ajratib, query param sifatida yuboramiz
      // (SUPER_ADMIN uchun to'g'ri mehmonxona kontekstini belgilash uchun).
      const { hotelId, ...body } = payload ?? {};
      const { data } = await api.post<Reservation>('/reservations/', body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

export const useUpdateReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const { id, hotelId, ...body } = payload ?? {};
      const { data } = await api.put<Reservation>(`/reservations/${id}`, body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

export const useCancelReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason, hotelId }: { id: string; reason?: string; hotelId?: string }) => {
      const { data } = await api.post<Reservation>(
        `/reservations/${id}/cancel`,
        { reason: reason || null },
        { params: hotelId ? { hotel_id: hotelId } : {} }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};
