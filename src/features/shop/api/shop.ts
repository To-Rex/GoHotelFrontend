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

/** Bo'lib to'lashning bitta bo'lagi (summa + usul) */
export interface SalePaymentPart {
  amount: number;
  payment_method: string;
}

export interface ShopSale {
  id: string;
  reservation_id: string | null;
  reservation_number: string | null;
  guest_name?: string | null;
  total_amount: number;
  payment_method: string | null;
  /** Bo'lib to'lash bo'laklari (oddiy to'lovda null) */
  payments?: SalePaymentPart[] | null;
  status: 'PAID' | 'PENDING';
  paid_at: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string | null;
  items: ShopSaleItem[];
}

export interface ShopSalesOptions {
  /** Sana filtri qaysi maydonga qo'llanadi: sotuv vaqti yoki to'lov vaqti */
  dateBy?: 'created' | 'paid';
  status?: 'PAID' | 'PENDING';
  /** Kerak bo'lmaganda so'rov umuman yuborilmasin (masalan sana hali ma'lum emas) */
  enabled?: boolean;
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

export const useShopSales = (
  dateFrom?: string,
  dateTo?: string,
  opts: ShopSalesOptions = {}
) => {
  return useQuery({
    queryKey: ['shopSales', dateFrom, dateTo, opts.dateBy, opts.status],
    queryFn: async () => {
      const { data } = await api.get<ShopSale[]>('/shop/sales', {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          date_by: opts.dateBy || undefined,
          status: opts.status || undefined,
        },
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: opts.enabled ?? true,
  });
};

const invalidateShop = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['shopProducts'] });
  qc.invalidateQueries({ queryKey: ['shopSales'] });
  // Do'kon savdosi kassaga tushadi — kutilgan summa qayta hisoblansin
  qc.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
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

// --- Ombor (warehouse) ---

export interface WarehouseMovement {
  type: 'KIRIM' | 'SOTUV' | 'SPISANIYE' | 'INVENTAR';
  product_name: string;
  /** Ishorali: musbat — omborga kirdi, manfiy — chiqdi */
  quantity: number;
  amount: number | null;
  note: string | null;
  user_name: string;
  created_at: string | null;
}

export const useWarehouseMovements = (limit = 100) =>
  useQuery({
    queryKey: ['warehouseMovements', limit],
    queryFn: async () => {
      const { data } = await api.get<WarehouseMovement[]>(
        '/shop/warehouse/movements',
        { params: { limit } }
      );
      return Array.isArray(data) ? data : [];
    },
  });

const invalidateWarehouse = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['shopProducts'] });
  qc.invalidateQueries({ queryKey: ['warehouseMovements'] });
};

// Spisaniye: singan/muddati o'tgan mahsulotni sabab bilan chiqarish
export const useWriteoffProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      productId: string;
      quantity: number;
      reason: string;
    }) => {
      const { data } = await api.post<ShopProduct>(
        `/shop/products/${payload.productId}/writeoff`,
        { quantity: payload.quantity, reason: payload.reason }
      );
      return data;
    },
    onSuccess: () => {
      const qc2 = qc;
      invalidateWarehouse(qc2);
    },
  });
};

// Inventarizatsiya: sanalgan qoldiq kiritiladi, farq tizimda tuzatiladi
export const useInventoryProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      productId: string;
      counted: number;
      reason?: string;
    }) => {
      const { data } = await api.post<{ diff: number; product: ShopProduct }>(
        `/shop/products/${payload.productId}/inventory`,
        { counted: payload.counted, reason: payload.reason }
      );
      return data;
    },
    onSuccess: () => invalidateWarehouse(qc),
  });
};

// --- Chek dizayni (har mehmonxona uchun alohida, hotels.settings JSONB) ---

export interface ReceiptSettings {
  /** Bo'sh — mehmonxona nomi ishlatiladi */
  title: string;
  subtitle: string;
  header_note: string;
  footer_text: string;
  footer_note: string;
  show_check_no: boolean;
  show_seller: boolean;
  show_guest: boolean;
  paper: 58 | 80;
  qr_url: string;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  title: '',
  subtitle: "Mini-do'kon cheki",
  header_note: '',
  footer_text: 'Xaridingiz uchun rahmat!',
  footer_note: '',
  show_check_no: true,
  show_seller: true,
  show_guest: true,
  paper: 80,
  qr_url: '',
};

export const useReceiptSettings = () =>
  useQuery({
    queryKey: ['receiptSettings'],
    queryFn: async () => {
      const { data } = await api.get<ReceiptSettings>('/shop/receipt-settings');
      return { ...DEFAULT_RECEIPT_SETTINGS, ...(data || {}) };
    },
  });

export const useSaveReceiptSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ReceiptSettings) => {
      const { data } = await api.put<ReceiptSettings>('/shop/receipt-settings', payload);
      return data;
    },
    onSuccess: (data) =>
      qc.setQueryData(['receiptSettings'], {
        ...DEFAULT_RECEIPT_SETTINGS,
        ...(data || {}),
      }),
  });
};

export const useCreateShopSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      items: { product_id: string; quantity: number }[];
      payment_method?: string | null;
      /** Bo'lib to'lash: bo'laklar jami sotuv summasiga teng bo'lishi shart */
      payments?: SalePaymentPart[] | null;
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
    mutationFn: async ({
      id,
      payment_method,
      payments,
    }: {
      id: string;
      payment_method?: string;
      payments?: SalePaymentPart[] | null;
    }) => {
      const { data } = await api.post<ShopSale>(`/shop/sales/${id}/pay`, {
        payment_method: payment_method || null,
        payments: payments || null,
      });
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
