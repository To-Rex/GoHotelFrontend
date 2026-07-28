import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Expense } from '@/types/api';

// Xarajatlar ro'yxati — sana oralig'i ixtiyoriy. `enabled` bilan ruxsati
// yo'q foydalanuvchilar uchun so'rov umuman yuborilmaydi (403 oldini oladi).
export const useExpenses = (dateFrom?: string, dateTo?: string, enabled = true) => {
  return useQuery({
    queryKey: ['expenses', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<Expense[]>('/expenses/', {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 1000,
        },
      });
      return Array.isArray(data) ? data : [];
    },
    enabled,
  });
};

interface ExpenseCreatePayload {
  title: string;
  amount: number;
  category?: string;
  payment_method?: string;
  expense_date?: string;
  notes?: string;
  hotelId?: string;
}

export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelId, ...body }: ExpenseCreatePayload) => {
      const { data } = await api.post<Expense>('/expenses/', body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hotelId }: { id: string; hotelId?: string }) => {
      await api.delete(`/expenses/${id}`, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
};
