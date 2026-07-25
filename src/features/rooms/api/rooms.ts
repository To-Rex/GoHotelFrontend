import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Room, Floor } from '@/types/api';

export interface Branch {
  id: string;
  hotel_id: string;
  name: string;
  code?: string;
}

// Foydalanuvchining mehmonxonasidagi filiallar (backend hotel bo'yicha filtrlaydi)
export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Branch[] }>('/branches/', {
        params: { page_size: 500 },
      });
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

// Tanlangan filial qavatlari
export const useFloorsByBranch = (branchId?: string) => {
  return useQuery({
    queryKey: ['floors', branchId],
    queryFn: async () => {
      const { data } = await api.get<{ items: Floor[] }>('/floors/', {
        params: { branch_id: branchId, limit: 200 },
      });
      const list = Array.isArray(data) ? data : (data.items || []);
      return [...list].sort((a, b) => a.floor_number - b.floor_number);
    },
    enabled: !!branchId,
  });
};

interface FloorPayload {
  branch_id: string;
  hotel_id?: string;
  floor_number: number;
  name?: string;
}

export const useCreateFloor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: FloorPayload) => {
      const { data } = await api.post<Floor>('/floors/', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
};

export const useUpdateFloor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string; floor_number: number; name?: string }) => {
      const { data } = await api.put<Floor>(`/floors/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
};

export const useDeleteFloor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/floors/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
};

export const useRooms = (status?: string) => {
  return useQuery({
    queryKey: ['rooms', status],
    queryFn: async () => {
      const { data } = await api.get<{ items: Room[] }>('/rooms/', {
        params: { status, limit: 500, page_size: 500 }
      });
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

export const useFloors = () => {
  return useQuery({
    queryKey: ['floors'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Floor[] }>('/floors/', {
        params: { limit: 200 }
      });
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

export const useRoomTypes = () => {
  return useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => {
      const { data } = await api.get<{ items: any[] }>('/room-types/', {
        params: { limit: 100 }
      });
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};
