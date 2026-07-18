import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Guest } from '@/types/api';

export const useGuests = () => {
  return useQuery({
    queryKey: ['guests'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Guest[] }>('/guests/', {
        params: { page: 1, page_size: 500 }
      });
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

export const useCreateGuest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: Partial<Guest> & { hotelId?: string }) => {
      // hotelId ni body'dan ajratib, query param sifatida yuboramiz
      // (SUPER_ADMIN uchun mehmon yaratishda hotel_id majburiy).
      const { hotelId, ...body } = payload;
      const { data } = await api.post<Guest>('/guests/', body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
  });
};
