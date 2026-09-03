import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { api } from '@/lib/api';
import type { FinanceSummary, Invoice, PaymentRecord } from '@/types/api';
import { PAGE_SIZE, queryParams, type TableState } from '@/lib/tableState';

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

/* ------------------------------------------------------------------ *
 * Sahifalanadigan ro'yxatlar                                          *
 * ------------------------------------------------------------------ */

/** Bir sahifa qator + jami soni. */
export interface Page<T> {
  rows: T[];
  /** Serverdagi jami qatorlar — sarlavhadan olinadi */
  total: number;
}

/**
 * Jami sonni javob sarlavhasidan o'qiydi.
 *
 * Sarlavha yo'q bo'lishi mumkin: backend hali yangilanmagan bo'lsa yoki
 * CORS uni ochmagan bo'lsa. Bunday holatda kelgan qatorlar sonining o'zi
 * ishlatiladi — sahifalagich bitta sahifa ko'rsatadi, lekin jadval
 * baribir ishlaydi.
 */
function pageOf<T>(response: AxiosResponse<T[]>, skip: number): Page<T> {
  const rows = Array.isArray(response.data) ? response.data : [];
  const raw = Number(response.headers?.['x-total-count']);
  return {
    rows,
    total: Number.isFinite(raw) && raw >= 0 ? raw : skip + rows.length,
  };
}

interface PagedOptions {
  dateFrom?: string;
  dateTo?: string;
  state: TableState;
  pageSize?: number;
  /** Tab ochilmagan bo'lsa so'rov umuman yuborilmaydi */
  enabled?: boolean;
}

/**
 * To'lovlar jadvalining bitta sahifasi.
 *
 * `placeholderData` bilan: sahifa almashganda jadval bo'shab ketmaydi,
 * eski qatorlar yangi sahifa kelguncha turadi — aks holda har bosishda
 * ekran "sakrardi".
 */
export const usePaymentsPage = ({
  dateFrom,
  dateTo,
  state,
  pageSize = PAGE_SIZE,
  enabled = true,
}: PagedOptions) => {
  const params = queryParams(state, pageSize);
  return useQuery({
    queryKey: ['paymentsPage', dateFrom, dateTo, params],
    queryFn: async () => {
      const response = await api.get<PaymentRecord[]>('/finance/payments', {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          ...params,
        },
      });
      return pageOf(response, params.skip);
    },
    enabled,
    placeholderData: keepPreviousData,
  });
};

/** Hisob-fakturalar jadvalining bitta sahifasi. */
export const useInvoicesPage = ({
  dateFrom,
  dateTo,
  status,
  state,
  pageSize = PAGE_SIZE,
  enabled = true,
}: PagedOptions & { status?: string }) => {
  const params = queryParams(state, pageSize);
  return useQuery({
    queryKey: ['invoicesPage', status, dateFrom, dateTo, params],
    queryFn: async () => {
      const response = await api.get<Invoice[]>('/finance/invoices', {
        params: {
          status: status || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          ...params,
        },
      });
      return pageOf(response, params.skip);
    },
    enabled,
    placeholderData: keepPreviousData,
  });
};

/**
 * Davr yig'indisi — kartalar, sof natija, to'lov usullari va xarajat
 * toifalari shu bitta so'rovdan chiqadi.
 *
 * Ilgari bu raqamlar brauzerda, to'liq ro'yxatlar ustidan hisoblanardi.
 * U yo'l ikki jihatdan yomon edi: ro'yxat 500 qatordan uzun bo'lsa
 * raqamlar jimgina kam chiqardi, va bir necha ming yozuvni uzatish
 * sahifani sekinlashtirardi. Tafsilot backenddagi
 * `finance_summary_service` izohida.
 */
export const useFinanceSummary = (
  dateFrom?: string,
  dateTo?: string,
  status?: string
) => {
  return useQuery({
    queryKey: ['financeSummary', dateFrom, dateTo, status],
    queryFn: async () => {
      const { data } = await api.get<FinanceSummary>('/finance/summary', {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          status: status || undefined,
        },
      });
      return data;
    },
    placeholderData: keepPreviousData,
  });
};
