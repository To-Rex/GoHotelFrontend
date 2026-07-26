import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { HousekeepingTask } from '@/types/api';

export const useHousekeepingTasks = (status?: string) => {
  return useQuery({
    queryKey: ['housekeepingTasks', status],
    queryFn: async () => {
      const { data } = await api.get<{ items: HousekeepingTask[] }>(
        '/housekeeping/tasks',
        { params: { status: status || undefined, limit: 200 } }
      );
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

interface TaskCreatePayload {
  branch_id: string;
  room_id: string;
  task_type: string;
  priority?: string;
  assigned_to?: string;
  notes?: string;
  scheduled_date?: string;
  hotelId?: string;
}

export const useCreateHousekeepingTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelId, ...body }: TaskCreatePayload) => {
      // hotel_id query param sifatida (SUPER_ADMIN uchun majburiy)
      const { data } = await api.post<HousekeepingTask>('/housekeeping/tasks', body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['housekeepingTasks'] }),
  });
};

export const useUpdateTaskStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: string;
      notes?: string;
    }) => {
      const { data } = await api.patch<HousekeepingTask>(
        `/housekeeping/tasks/${id}/status`,
        { status, notes: notes || null }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeepingTasks'] });
      // Tozalash yakunlanganda xona holati AVAILABLE bo'lishi mumkin
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

export const useAssignTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assigned_to }: { id: string; assigned_to: string }) => {
      const { data } = await api.post<HousekeepingTask>(
        `/housekeeping/tasks/${id}/assign`,
        { assigned_to }
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['housekeepingTasks'] }),
  });
};
