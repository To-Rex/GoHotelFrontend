import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { tr } from '@/i18n';

/* Bron jarimalari — kech chiqish, shikast (sindirilgan narsa), boshqa.

   Jarima faqat KIRGAN yoki CHIQIB KETGAN bronga yoziladi (keyin topilgan
   shikast uchun ham). Summa bron jamiga va hisob-fakturaga qo'shiladi,
   to'lov odatdagi "Qo'shimcha to'lov" paneli orqali olinadi. Qo'shish —
   `reservation.update` ruxsati; bekor qilish — administrator yoki menejer
   (`shift.force_close`). Jarima o'chirilmaydi: bekor qilingani sababi
   bilan ro'yxatda qoladi. Haqiqiy tekshiruv SERVERDA. */

export type PenaltyKind = 'LATE_CHECKOUT' | 'DAMAGE' | 'OTHER';

export const PENALTY_KINDS: PenaltyKind[] = ['LATE_CHECKOUT', 'DAMAGE', 'OTHER'];

/** Jarima yoziladigan bron holatlari (server: PENALTY_STATUSES). */
export const PENALTY_STATUSES = ['CHECKED_IN', 'CHECKED_OUT'];

export const penaltyKindLabel = (kind: string): string => {
  if (kind === 'LATE_CHECKOUT') return tr('Kech chiqish');
  if (kind === 'DAMAGE') return tr('Shikast / buzilgan narsa');
  if (kind === 'OTHER') return tr('Boshqa');
  return kind;
};

export interface ReservationPenalty {
  id: string;
  reservation_id: string;
  kind: PenaltyKind | string;
  amount: number;
  note?: string | null;
  penalty_date?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
  voided_at?: string | null;
  voided_by_name?: string | null;
  void_reason?: string | null;
}

export interface LateCheckoutSuggestion {
  late_minutes: number;
  hours: number;
  hourly_amount: number;
  amount: number;
  due_at: string;
}

export interface ReservationPenaltyList {
  items: ReservationPenalty[];
  total: number;
  can_add: boolean;
  late_suggestion: LateCheckoutSuggestion | null;
}

export interface PenaltyChangeResult {
  penalty: ReservationPenalty;
  reservation_total: number;
  penalty_total: number;
  payment_status: string;
}

export const reservationPenaltiesKey = (id: string) => ['reservationPenalties', id] as const;

export const useReservationPenalties = (reservationId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: reservationPenaltiesKey(reservationId || ''),
    queryFn: async () => {
      const { data } = await api.get<ReservationPenaltyList>(
        `/reservations/${reservationId}/penalties`
      );
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        total: Number(data?.total || 0),
        can_add: data?.can_add === true,
        late_suggestion: data?.late_suggestion ?? null,
      } as ReservationPenaltyList;
    },
    enabled: enabled && !!reservationId,
  });

/** Jarima bron jami, qarz va hisob-fakturani o'zgartiradi — shularga
 *  bog'liq ro'yxatlar yangilansin. */
const invalidateAfterChange = (
  queryClient: ReturnType<typeof useQueryClient>,
  reservationId: string
) => {
  queryClient.invalidateQueries({ queryKey: reservationPenaltiesKey(reservationId) });
  queryClient.invalidateQueries({ queryKey: ['reservations'] });
  queryClient.invalidateQueries({ queryKey: ['invoices'] });
  queryClient.invalidateQueries({ queryKey: ['invoicesPage'] });
  queryClient.invalidateQueries({ queryKey: ['debtors'] });
  queryClient.invalidateQueries({ queryKey: ['reservationDebt'] });
  queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
  queryClient.invalidateQueries({ queryKey: ['financePenalties'] });
  queryClient.invalidateQueries({ queryKey: ['roomReservations'] });
};

export const useAddPenalty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      kind,
      amount,
      note,
    }: {
      reservationId: string;
      kind: PenaltyKind;
      amount: number;
      note?: string;
    }) => {
      const { data } = await api.post<PenaltyChangeResult>(
        `/reservations/${reservationId}/penalties`,
        { kind, amount, note: note?.trim() || null }
      );
      return data;
    },
    onSuccess: (_data, vars) => invalidateAfterChange(queryClient, vars.reservationId),
  });
};

export const useVoidPenalty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      penaltyId,
      reason,
    }: {
      reservationId: string;
      penaltyId: string;
      reason?: string;
    }) => {
      const { data } = await api.post<PenaltyChangeResult>(
        `/reservations/${reservationId}/penalties/${penaltyId}/void`,
        { reason: reason?.trim() || null }
      );
      return data;
    },
    onSuccess: (_data, vars) => invalidateAfterChange(queryClient, vars.reservationId),
  });
};

// ------------------------------------------------------------ moliya --

export interface PenaltyJournalItem extends ReservationPenalty {
  reservation_number?: string | null;
  room_number?: string | null;
  guest_name?: string | null;
}

export interface PenaltyJournal {
  summary: {
    total: number;
    count: number;
    by_kind: Record<string, { total: number; count: number }>;
  };
  items: PenaltyJournalItem[];
}

export const useFinancePenalties = (dateFrom?: string, dateTo?: string, enabled = true) =>
  useQuery({
    queryKey: ['financePenalties', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<PenaltyJournal>('/finance/penalties', {
        params: { date_from: dateFrom || undefined, date_to: dateTo || undefined },
      });
      return {
        summary: {
          total: Number(data?.summary?.total || 0),
          count: Number(data?.summary?.count || 0),
          by_kind: data?.summary?.by_kind || {},
        },
        items: Array.isArray(data?.items) ? data.items : [],
      } as PenaltyJournal;
    },
    enabled,
    placeholderData: keepPreviousData,
  });

// --------------------------------------------------------- sozlama --

/* Kech chiqish taklifi: soatiga summa (0 — o'chiq) va imtiyozli daqiqalar.
   Standart — O'CHIQ. Yoqilsa server kechikkan soatlarni (yuqoriga
   yaxlitlab) hisoblab taklif qiladi, xodim summani o'zgartira oladi. */
export interface PenaltySettings {
  late_hourly_amount: number;
  grace_minutes: number;
  /** Kunlik bronda chiqish soati (server sozlamasi, faqat o'qish) */
  checkout_hour?: number;
}

export const PENALTY_SETTINGS_DEFAULTS: PenaltySettings = {
  late_hourly_amount: 0,
  grace_minutes: 0,
};

export const PENALTY_SETTINGS_KEY = ['penaltySettings'] as const;

const num = (value: unknown, max: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
};

export const resolvePenaltySettings = (raw: unknown): PenaltySettings => {
  if (!raw || typeof raw !== 'object') return { ...PENALTY_SETTINGS_DEFAULTS };
  const r = raw as Record<string, unknown>;
  const out: PenaltySettings = {
    late_hourly_amount: num(r.late_hourly_amount, 1_000_000_000),
    grace_minutes: Math.floor(num(r.grace_minutes, 600)),
  };
  if (r.checkout_hour !== undefined && r.checkout_hour !== null) {
    out.checkout_hour = Math.floor(num(r.checkout_hour, 23));
  }
  return out;
};

export const usePenaltySettings = (enabled = true) =>
  useQuery({
    queryKey: PENALTY_SETTINGS_KEY,
    queryFn: async () => {
      const { data } = await api.get<PenaltySettings>('/hotels/penalty-settings');
      return resolvePenaltySettings(data);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

export const useSavePenaltySettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (next: PenaltySettings) => {
      const { data } = await api.put<PenaltySettings>('/hotels/penalty-settings', {
        late_hourly_amount: num(next.late_hourly_amount, 1_000_000_000),
        grace_minutes: Math.floor(num(next.grace_minutes, 600)),
      });
      return resolvePenaltySettings(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(PENALTY_SETTINGS_KEY, data);
      // Ochiq bron oynalaridagi taklif yangi qoidaga moslashsin
      queryClient.invalidateQueries({ queryKey: ['reservationPenalties'] });
    },
  });
};

/** Kechikish matni: "2 soat 10 daqiqa". */
export const lateDurationLabel = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h > 0 && rest > 0) return tr('{{h}} soat {{m}} daqiqa', { h, m: rest });
  if (h > 0) return tr('{{h}} soat', { h });
  return tr('{{m}} daqiqa', { m: rest });
};
