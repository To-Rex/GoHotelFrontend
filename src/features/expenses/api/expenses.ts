import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Expense } from '@/types/api';

interface ExpensesOptions {
  // Davr almashganda eski ro'yxatni ekranda ushlab turish. Sana o'zgarishi
  // yangi queryKey degani, ya'ni so'rov noldan boshlanadi va sahifa bir
  // lahzaga bo'shab qoladi — davr tugmalari bilan birga. Bu chaqiruvchi
  // uchun tugma bosilmagandek tuyuladi, shuning uchun xarajatlar sahifasi
  // buni yoqadi. Boshqa joylarda (smena hisoboti) eski davr raqamlari bir
  // lahza ko'rinib qolgani yaxshi emas — shuning uchun ixtiyoriy.
  keepPrevious?: boolean;
}

// Xarajatlar ro'yxati — sana oralig'i ixtiyoriy. `enabled` bilan ruxsati
// yo'q foydalanuvchilar uchun so'rov umuman yuborilmaydi (403 oldini oladi).
export const useExpenses = (
  dateFrom?: string,
  dateTo?: string,
  enabled = true,
  options: ExpensesOptions = {},
) => {
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
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      // Naqd xarajat kassadan chiqadi — kutilgan summa qayta hisoblansin
      qc.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      // Naqd xarajat kassadan chiqadi — kutilgan summa qayta hisoblansin
      qc.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
  });
};
