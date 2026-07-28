import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ResetDataResult {
  message: string;
  scope: string;
  deleted: Record<string, number>;
  total_deleted: number;
}

// Ma'lumotlarni tozalash (reset) — faqat ADMIN/SUPER_ADMIN. Backend qo'shimcha
// himoya sifatida confirm="RESET" talab qiladi.
export const useResetData = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      scope,
      hotelId,
    }: {
      scope: 'operational' | 'full';
      hotelId?: string;
    }) => {
      const { data } = await api.post<ResetDataResult>(
        '/maintenance/reset-data',
        { scope, confirm: 'RESET' },
        { params: hotelId ? { hotel_id: hotelId } : {} }
      );
      return data;
    },
    // Hamma keshni yangilaymiz — barcha sahifalar yangi (bo'sh) holatni ko'rsatadi
    onSuccess: () => qc.invalidateQueries(),
  });
};
