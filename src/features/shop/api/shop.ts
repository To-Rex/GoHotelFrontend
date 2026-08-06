import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/* Do'kon API qatlamı — mahsulotlar FIFO partiyalar bilan keladi,
   sotuvlar serverda partiya narxlari bo'yicha hisoblanadi. */

export interface ShopBatch {
  id: string;
  quantity: number;
  remaining: number;
  cost_price: number | null;
  sale_price: number;
  created_at: string | null;
}

export interface ShopProduct {
  id: string;
  name: string;
  category: string | null;
  emoji: string | null;
  is_active: boolean;
  stock: number;
  current_price: number | null;
  batches: ShopBatch[];
}

export interface ShopSaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ShopSale {
  id: string;
  reservation_id: string | null;
  reservation_number: string | null;
  total_amount: number;
  payment_method: string | null;
  status: 'PAID' | 'PENDING';
  created_by: string;
  created_by_name: string | null;
  created_at: string | null;
  items: ShopSaleItem[];
}

export const useShopProducts = (includeInactive = false) => {
  return useQuery({
    queryKey: ['shopProducts', includeInactive],
    queryFn: async () => {
      const { data } = await api.get<ShopProduct[]>('/shop/products', {
        params: { include_inactive: includeInactive },
      });
      return Array.isArray(data) ? data : [];
    },
  });
};

export const useShopSales = (dateFrom?: string, dateTo?: string) => {
  return useQuery({
    queryKey: ['shopSales', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<ShopSale[]>('/shop/sales', {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });
      return Array.isArray(data) ? data : [];
    },
  });
};

const invalidateShop = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['shopProducts'] });
  qc.invalidateQueries({ queryKey: ['shopSales'] });
};

export const useCreateShopProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; category?: string; emoji?: string }) => {
      const { data } = await api.post<ShopProduct>('/shop/products', payload);
      return data;
    },
    onSuccess: () => invalidateShop(qc),
  });
};

export const useUpdateShopProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      category?: string;
      emoji?: string;
      is_active?: boolean;
    }) => {
      const { data } = await api.put<ShopProduct>(`/shop/products/${id}`, payload);
      return data;
    },
    onSuccess: () => invalidateShop(qc),
  });
};

export const useDeleteShopProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<{ deactivated: boolean }>(`/shop/products/${id}`);
      return data;
    },
    onSuccess: () => invalidateShop(qc),
  });
};

export const useAddShopBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      ...payload
    }: {
      productId: string;
      quantity: number;
      sale_price: number;
      cost_price?: number;
    }) => {
      const { data } = await api.post<ShopProduct>(
        `/shop/products/${productId}/batches`,
        payload
      );
      return data;
    },
    onSuccess: () => invalidateShop(qc),
  });
};

export const useCreateShopSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      items: { product_id: string; quantity: number }[];
      payment_method?: string | null;
      reservation_id?: string | null;
    }) => {
      const { data } = await api.post<ShopSale>('/shop/sales', payload);
      return data;
    },
    onSuccess: () => invalidateShop(qc),
  });
};

export const usePayShopSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payment_method }: { id: string; payment_method: string }) => {
      const { data } = await api.post<ShopSale>(`/shop/sales/${id}/pay`, { payment_method });
      return data;
    },
    onSuccess: () => invalidateShop(qc),
  });
};

export const useCancelShopSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/shop/sales/${id}`);
    },
    onSuccess: () => invalidateShop(qc),
  });
};
