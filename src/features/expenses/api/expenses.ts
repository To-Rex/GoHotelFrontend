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

export interface ExpensePaymentPart {
  payment_method: string;
  amount: number;
}

interface ExpenseCreatePayload {
  title: string;
  amount: number;
  category?: string;
  payment_method?: string;
  /** Qisman to'lov: summa bir necha to'lov turiga bo'linadi (yig'indisi
   *  `amount`). Berilsa `payment_method` o'rniga ishlatiladi; server har
   *  bo'lakni alohida qator qilib yozadi (`split_group`). */
  payments?: ExpensePaymentPart[];
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

/** Xarajatni tahrirlash — faqat O'ZGARGAN maydonlar yuboriladi
 *  (`lib/expenseEdit.ts` → buildUpdatePayload). Server: PUT /expenses/{id}. */
export interface ExpenseUpdatePayload {
  title?: string;
  amount?: number;
  category?: string | null;
  /** Bitta to'lov turi (bo'lingan xarajat ham shu bilan bitta turga qaytadi) */
  payment_method?: string;
  /** 2+ bo'lak, yig'indisi `amount` ga teng */
  payments?: ExpensePaymentPart[];
  expense_date?: string;
  notes?: string | null;
  /** Tahrir sababi — tarixda ko'rinadi */
  note?: string;
}

/* Xarajat o'zgarsa yangilanadigan ma'lumotlar: ro'yxat, kassa (naqd qism),
   moliya yig'indisi, shaxsiy hisobot, xodimlar hisoboti va smena tarixi. */
const EXPENSE_AFFECTED_KEYS = [
  ['expenses'],
  ['shiftExpectedCash'],
  ['financeSummary'],
  ['myReport'],
  ['reportStaff'],
  ['cashOverview'],
  ['shiftHistory'],
  ['expenseCategories'],
];

export const useUpdateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      hotelId,
      ...body
    }: ExpenseUpdatePayload & { id: string; hotelId?: string }) => {
      const { data } = await api.put<Expense & { parts?: Expense[] }>(`/expenses/${id}`, body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => {
      for (const queryKey of EXPENSE_AFFECTED_KEYS) qc.invalidateQueries({ queryKey });
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
