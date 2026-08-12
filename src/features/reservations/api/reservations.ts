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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['reservationEditWindow'] }),
  });
};

export const useCancelReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason, hotelId }: { id: string; reason?: string; hotelId?: string }) => {
      const { data } = await api.post<Reservation>(
        `/reservations/${id}/cancel`,
        { reason: reason || null },
        { params: hotelId ? { hotel_id: hotelId } : {} }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      // Bekor qilinganda bog'liq hisob-faktura ham VOID bo'ladi —
      // Moliya bo'limi darhol yangilanishi uchun keshni tozalaymiz
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};
