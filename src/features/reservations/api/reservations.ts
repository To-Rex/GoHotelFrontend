import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Reservation } from '@/types/api';

export const useReservations = (status?: string) => {
  return useQuery({
    queryKey: ['reservations', status],
    queryFn: async () => {
      const { data } = await api.get<{ items: Reservation[] }>('/reservations/', {
        params: { status, limit: 500, page_size: 500 }
      });
      // Handle both paginated and flat array responses
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

export const useCreateReservation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: any) => {
      // hotelId ni body'dan ajratib, query param sifatida yuboramiz
      // (SUPER_ADMIN uchun to'g'ri mehmonxona kontekstini belgilash uchun).
      const { hotelId, ...body } = payload ?? {};
      const { data } = await api.post<Reservation>('/reservations/', body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      // Bron/hisob-faktura pul harakatiga olib keladi — smenani
      // topshirish dialogi eski summani ko'rsatmasligi uchun kassa
      // hisobi qayta olinsin
      queryClient.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
  });
};

export const useUpdateReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const { id, hotelId, ...body } = payload ?? {};
      const { data } = await api.put<Reservation>(`/reservations/${id}`, body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      // Bron/hisob-faktura pul harakatiga olib keladi — smenani
      // topshirish dialogi eski summani ko'rsatmasligi uchun kassa
      // hisobi qayta olinsin
      queryClient.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
  });
};

/**
 * Bronni cho'zish — QO'SHIMCHA HAQSIZ, faqat administrator uchun.
 *
 * `checkOut` — bronning yangi tugash payti: soatlik bronda aniq vaqt
 * ("2026-09-03T23:00:00"), kunlik bronda chiqish kuni boshlanishi
 * ("2026-09-08T00:00:00"). Vaqt zonasisiz yuboriladi — loyihada bu
 * ustunlar xodim tergan devor soatini saqlaydi.
 *
 * Chegarani (keyingi bron) server tekshiradi; brauzerdagi hisob faqat
 * surish paytida ko'rsatish uchun.
 */
export const useExtendReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string; checkOut: string; hotelId?: string }) => {
      const { data } = await api.post<Reservation>(
        `/reservations/${payload.id}/extend`,
        { check_out: payload.checkOut },
        { params: payload.hotelId ? { hotel_id: payload.hotelId } : {} }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

// "Mehmon chiqmoqda": farroshga tozalash vazifasi boradi, farrosh yakunlagach
// bron avtomatik CHECKED_OUT bo'ladi
export const useRequestCheckout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      hotelId,
      selfAssign,
    }: {
      id: string;
      hotelId?: string;
      selfAssign?: boolean;
    }) => {
      const { data } = await api.post<Reservation>(
        `/reservations/${id}/request-checkout`,
        null,
        {
          params: {
            ...(hotelId ? { hotel_id: hotelId } : {}),
            // Farrosh o'zi bosganda vazifa o'ziga biriktiriladi
            ...(selfAssign ? { self_assign: true } : {}),
          },
        }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['housekeepingTasks'] });
      // Bron/hisob-faktura pul harakatiga olib keladi — smenani
      // topshirish dialogi eski summani ko'rsatmasligi uchun kassa
      // hisobi qayta olinsin
      queryClient.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
  });
};

// Mehmon keldi (check-in): bron CHECKED_IN, xona OCCUPIED holatiga o'tadi.
// Backend shartlari: bron CONFIRMED, xona RESERVED, kirish sanasi kelgan.
export const useCheckInReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, hotelId }: { id: string; hotelId?: string }) => {
      const { data } = await api.post<Reservation>(
        `/reservations/${id}/check-in`,
        null,
        { params: hotelId ? { hotel_id: hotelId } : {} }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      // Bron/hisob-faktura pul harakatiga olib keladi — smenani
      // topshirish dialogi eski summani ko'rsatmasligi uchun kassa
      // hisobi qayta olinsin
      queryClient.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
  });
};

// Bronni boshqa xonaga ko'chirish (vaqt oynasi va bandlik backend'da tekshiriladi)
export const useMoveRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, newRoomId }: { id: string; newRoomId: string }) => {
      const { data } = await api.post<Reservation>(`/reservations/${id}/move-room`, {
        new_room_id: newRoomId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      // Bron/hisob-faktura pul harakatiga olib keladi — smenani
      // topshirish dialogi eski summani ko'rsatmasligi uchun kassa
      // hisobi qayta olinsin
      queryClient.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
  });
};

// Bron balansi bo'yicha hisob-kitob: xona almashtirishdan keyin qo'shimcha
// to'lov (PAY, qisman ham mumkin) yoki ortiqcha to'langanni qaytarish (REFUND).
// Qaytarim manfiy Payment bo'lib yoziladi — hisobotlarda avtomatik aks etadi.
export const useSettleReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      paymentMethod,
      direction,
    }: {
      id: string;
      amount: number;
      paymentMethod: string;
      direction: 'PAY' | 'REFUND';
    }) => {
      const { data } = await api.post<Reservation>(
        `/reservations/${id}/settle-payment`,
        { amount, payment_method: paymentMethod, direction }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      // Bron/hisob-faktura pul harakatiga olib keladi — smenani
      // topshirish dialogi eski summani ko'rsatmasligi uchun kassa
      // hisobi qayta olinsin
      queryClient.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
  });
};

// Bron tahriri vaqt oynasi sozlamasi (daqiqalarda, 0 = cheklovsiz)
export interface EditWindowSettings {
  window_minutes: number;
  default_minutes: number;
}

export const useEditWindowSettings = () =>
  useQuery({
    queryKey: ['reservationEditWindow'],
    queryFn: async () => {
      const { data } = await api.get<EditWindowSettings>(
        '/reservations/edit-window-settings'
      );
      return data;
    },
  });

export const useSaveEditWindowSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (windowMinutes: number) => {
      const { data } = await api.put<EditWindowSettings>(
        '/reservations/edit-window-settings',
        null,
        { params: { window_minutes: windowMinutes } }
      );
      return data;
    },
    // Bu sozlama saqlash — pul harakati emas, kassa hisobi tegilmaydi
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['reservationEditWindow'] }),
  });
};

/* Bekor qilishda ushlab qolinadigan foiz.

   Mehmonxonalar bu masalada bir xil emas: biri to'lovni to'liq qaytaradi,
   biri jarima ushlab qoladi. Standarti 0 — sozlanmagan mehmonxonada pul
   to'liq qaytariladi. */
export interface CancellationSettings {
  fee_percent: number;
  default_percent: number;
}

export const useCancellationSettings = () =>
  useQuery({
    queryKey: ['reservationCancellationSettings'],
    queryFn: async () => {
      const { data } = await api.get<CancellationSettings>(
        '/reservations/cancellation-settings'
      );
      return data;
    },
  });

export const useSaveCancellationSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (feePercent: number) => {
      const { data } = await api.put<CancellationSettings>(
        '/reservations/cancellation-settings',
        null,
        { params: { fee_percent: feePercent } }
      );
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['reservationCancellationSettings'],
      }),
  });
};

/* Bekor qilinsa qancha qaytariladi — tasdiqlashdan OLDIN ko'rsatish uchun.
   Pul qaytarish orqaga qaytarib bo'lmaydigan amal, shuning uchun xodim
   summani ko'rmasdan tasdiqlamasligi kerak. */
export interface CancellationQuote {
  paid_amount: number;
  fee_percent: number;
  fee_amount: number;
  refund_amount: number;
}

export const useCancellationQuote = (reservationId?: string) =>
  useQuery({
    queryKey: ['cancellationQuote', reservationId],
    // Faqat bekor qilish tasdiqlanayotganda so'raladi
    enabled: !!reservationId,
    queryFn: async () => {
      const { data } = await api.get<CancellationQuote>(
        `/reservations/${reservationId}/cancellation-quote`
      );
      return data;
    },
  });

export const useCancelReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reason,
      hotelId,
      refundAmount,
      refundMethod,
    }: {
      id: string;
      reason?: string;
      hotelId?: string;
      /* Qaytariladigan summa. Berilmasa server mehmonxona sozlamasidagi
         foizdan hisoblaydi — eski chaqiruvlar shu sababdan o'zgarishsiz
         ishlayveradi. */
      refundAmount?: number;
      refundMethod?: string;
    }) => {
      const { data } = await api.post<Reservation>(
        `/reservations/${id}/cancel`,
        {
          reason: reason || null,
          refund_amount: refundAmount ?? null,
          refund_method: refundMethod ?? null,
        },
        { params: hotelId ? { hotel_id: hotelId } : {} }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      // Pul qaytarilgan bo'lsa to'lovlar ro'yxati ham o'zgardi
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      // Bekor qilinganda bog'liq hisob-faktura ham VOID bo'ladi —
      // Moliya bo'limi darhol yangilanishi uchun keshni tozalaymiz
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      // Bron/hisob-faktura pul harakatiga olib keladi — smenani
      // topshirish dialogi eski summani ko'rsatmasligi uchun kassa
      // hisobi qayta olinsin
      queryClient.invalidateQueries({ queryKey: ['shiftExpectedCash'] });
    },
  });
};
