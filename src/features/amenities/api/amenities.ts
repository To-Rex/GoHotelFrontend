import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Amenity } from '@/types/api';

export const useAmenities = () => {
  return useQuery({
    queryKey: ['amenities'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Amenity[] }>('/amenities/');
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

interface AmenityPayload {
  name: string;
  icon?: string;
}

export const useCreateAmenity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AmenityPayload) => {
      const { data } = await api.post<Amenity>('/amenities/', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amenities'] }),
  });
};

export const useUpdateAmenity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<AmenityPayload> & { id: string; is_active?: boolean }) => {
      const { data } = await api.put<Amenity>(`/amenities/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amenities'] }),
  });
};

export const useDeleteAmenity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/amenities/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amenities'] }),
  });
};
