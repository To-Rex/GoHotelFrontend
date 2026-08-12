import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/* Xodimlar xabar/so'rovlari taxtasi: farrosh mobil ilovadan so'rov yuboradi
   ("104-xonani tekshiring"), admin/menejer saytdan. OPEN → DONE oqimi. */

export interface StaffMessage {
  id: string;
  body: string;
  status: 'OPEN' | 'DONE';
  room_id: string | null;
  room_number: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string | null;
  done_by_name: string | null;
  done_at: string | null;
}

// refetchInterval — sahifa ochiq turganda yangi xabarlar o'zi kelib turadi
export const useStaffMessages = (refetchMs = 30_000) =>
  useQuery({
    queryKey: ['staffMessages'],
    queryFn: async () => {
      const { data } = await api.get<StaffMessage[]>('/messages/');
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: refetchMs,
  });

export const useSendStaffMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { body: string; room_id?: string | null }) => {
      const { data } = await api.post<StaffMessage>('/messages/', {
        body: payload.body,
        room_id: payload.room_id || null,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffMessages'] }),
  });
};

export const useMarkMessageDone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<StaffMessage>(`/messages/${id}/done`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffMessages'] }),
  });
};
