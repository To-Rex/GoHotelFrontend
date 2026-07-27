import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Invoice, PaymentRecord } from '@/types/api';

// Sana oralig'i ixtiyoriy — berilmasa avvalgidek barcha hisob-fakturalar
// qaytadi (DashboardPage shu rejimda ishlatadi).
export const useInvoices = (status?: string, dateFrom?: string, dateTo?: string) => {
  return useQuery({
    queryKey: ['invoices', status, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<Invoice[]>('/finance/invoices', {
        params: {
          status: status || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 500,
        },
      });
      return Array.isArray(data) ? data : [];
    },
  });
};

// To'lovlar ro'yxati (kunlik tushum hisoboti uchun)
export const usePayments = (dateFrom?: string, dateTo?: string) => {
  return useQuery({
    queryKey: ['payments', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<PaymentRecord[]>('/finance/payments', {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });
      return Array.isArray(data) ? data : [];
    },
  });
};
