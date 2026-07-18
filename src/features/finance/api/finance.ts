import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Invoice } from '@/types/api';

export const useInvoices = (status?: string) => {
  return useQuery({
    queryKey: ['invoices', status],
    queryFn: async () => {
      const { data } = await api.get<Invoice[]>('/finance/invoices', {
        params: { status, limit: 100 }
      });
      return data;
    },
  });
};
