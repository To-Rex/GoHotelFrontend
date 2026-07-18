import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Room } from '@/types/api';

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
