import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ServiceCatalogItem, HotelServiceItem } from '@/types/api';

// Global xizmatlar katalogi (backend faqat faol xizmatlarni qaytaradi)
export const useServices = () => {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await api.get<{ items: ServiceCatalogItem[] }>('/services/');
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

interface ServicePayload {
  name: string;
  code: string;
  description?: string;
  category?: string;
}

export const useCreateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ServicePayload) => {
      const { data } = await api.post<ServiceCatalogItem>('/services/', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
};

export const useUpdateService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string; name?: string; description?: string; category?: string; is_active?: boolean }) => {
      const { data } = await api.put<ServiceCatalogItem>(`/services/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
};

// --- Mehmonxona xizmatlari (narxlar) ---

export const useHotelServices = () => {
  return useQuery({
    queryKey: ['hotelServices'],
    queryFn: async () => {
      const { data } = await api.get<{ items: HotelServiceItem[] }>('/hotel-services/');
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

export const useCreateHotelService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      hotelId,
      ...body
    }: { service_id: string; price: number; hotelId?: string }) => {
      // hotel_id query param sifatida yuboriladi (SUPER_ADMIN uchun majburiy)
      const { data } = await api.post<HotelServiceItem>('/hotel-services/', body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hotelServices'] }),
  });
};

export const useUpdateHotelService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      hotelId,
      ...body
    }: { id: string; price?: number; is_active?: boolean; hotelId?: string }) => {
      const { data } = await api.put<HotelServiceItem>(`/hotel-services/${id}`, body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hotelServices'] }),
  });
};

// Backend bu yerda "soft delete" qiladi — xizmat mehmonxona uchun o'chiriladi
// (is_active=false), keyin PUT bilan qayta yoqish mumkin.
export const useDeleteHotelService = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hotelId }: { id: string; hotelId?: string }) => {
      await api.delete(`/hotel-services/${id}`, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hotelServices'] }),
  });
};
