import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/store/auth";

// --- Turlar ---

export interface ShiftSettings {
  mode: "simple" | "cash";
  day_close: string; // "HH:MM"
}

// Sanalgan summa tuzatilishi (audit yozuvi) — eski qiymat saqlanadi
export interface ShiftCorrection {
  old_counted_cash: number | null;
  new_counted_cash: number;
  old_diff: number | null;
  new_diff: number;
  corrected_by: string;
  corrected_by_name?: string | null;
  corrected_at: string;
  note: string;
}

export interface ShiftSession {
  id: string;
  user_id: string;
  user_name?: string | null;
  status: "ACTIVE" | "PENDING_HANDOVER" | "CLOSED";
  started_at: string | null;
  ended_at: string | null;
  opening_cash: number;
  continue_after_end: boolean;
  force_closed: boolean;
  notes?: string | null;
  // Faqat yopilgan sessiyada ochiladi (ko'r sanash qoidasi)
  expected_cash?: number | null;
  counted_cash?: number | null;
  cash_diff?: number | null;
  accepted_at?: string | null;
  accepted_by_name?: string | null;
  closed_by_name?: string | null;
  corrections?: ShiftCorrection[];
  new_session?: ShiftSession;
}

export interface ShiftState extends ShiftSettings {
  my_session: ShiftSession | null;
  blocking_session: ShiftSession | null;
  // Men qabul qilib olgan avvalgi smena (hisoboti ko'rsatiladi,
  // lekin summalari avvalgi xodim hisobida qoladi)
  accepted_session: ShiftSession | null;
}

// --- Sozlamalar (Sozlamalar sahifasi uchun) ---

export const useShiftSettings = () =>
  useQuery({
    queryKey: ["shiftSettings"],
    queryFn: async () => {
      const { data } = await api.get<ShiftSettings>("/shifts/settings");
      return data;
    },
  });

export const useSaveShiftSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ShiftSettings) => {
      const { data } = await api.put<ShiftSettings>("/shifts/settings", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shiftSettings"] });
      qc.invalidateQueries({ queryKey: ["shiftState"] });
    },
  });
};

// --- Holat (guard + /my-reports paneli) ---

export const useShiftState = (enabled = true) =>
  useQuery({
    queryKey: ["shiftState"],
    queryFn: async () => {
      const { data } = await api.get<ShiftState>("/shifts/state");
      return data;
    },
    enabled,
    // Guard dolzarb bo'lishi uchun muntazam yangilanadi
    refetchInterval: 60_000,
  });

const useShiftMutation = <T = ShiftSession>(fn: (payload: any) => Promise<T>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shiftState"] }),
  });
};

export const useOpenShift = () =>
  useShiftMutation(async (payload: { opening_cash?: number }) => {
    const { data } = await api.post<ShiftSession>("/shifts/open", payload);
    return data;
  });

export const useContinueShift = () =>
  useShiftMutation(async () => {
    const { data } = await api.post<ShiftSession>("/shifts/continue", {});
    return data;
  });

export const useCloseCash = () =>
  useShiftMutation(async (payload: { counted_cash: number; notes?: string }) => {
    const { data } = await api.post<ShiftSession>("/shifts/close-cash", payload);
    return data;
  });

export const useEndShift = () =>
  useShiftMutation(async (payload: { counted_cash: number; notes?: string }) => {
    const { data } = await api.post<ShiftSession>("/shifts/end", payload);
    return data;
  });

export const useAcceptShift = () =>
  useShiftMutation(async (payload: { password: string }) => {
    const { data } = await api.post<ShiftSession>("/shifts/accept", payload);
    return data;
  });

export const useForceCloseShift = () =>
  useShiftMutation(
    async (payload: { session_id: string; counted_cash?: number; notes?: string }) => {
      const { data } = await api.post<ShiftSession>("/shifts/force-close", payload);
      return data;
    }
  );

// Yopilgan sessiya sanalgan summasini tuzatish (admin/menejer, izoh shart)
export const useCorrectShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      session_id: string;
      counted_cash: number;
      note: string;
    }) => {
      const { data } = await api.put<ShiftSession>(
        `/shifts/${payload.session_id}/correct`,
        { counted_cash: payload.counted_cash, note: payload.note }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shiftHistory"] });
      qc.invalidateQueries({ queryKey: ["shiftState"] });
    },
  });
};

// --- Kassada bo'lishi kerak bo'lgan summa (topshirish dialogi uchun) ---

export interface CashBreakdown {
  opening_cash: number;
  payments_cash: number;
  shop_cash: number;
  expenses_cash: number;
  expected_cash: number;
}

export const useExpectedCash = (enabled: boolean) =>
  useQuery({
    queryKey: ["shiftExpectedCash"],
    queryFn: async () => {
      const { data } = await api.get<CashBreakdown>("/shifts/expected-cash");
      return data;
    },
    enabled,
    // Dialog har ochilganda yangi hisob olinadi
    staleTime: 0,
  });

// --- Smenalar tarixi (admin/menejer sahifasi) ---

export const useShiftHistory = (limit = 100, enabled = true, refetchInterval?: number) =>
  useQuery({
    queryKey: ["shiftHistory", limit],
    queryFn: async () => {
      const { data } = await api.get<ShiftSession[]>("/shifts/history", {
        params: { limit },
      });
      return data;
    },
    enabled,
    refetchInterval,
  });

// --- Yordamchi hisob-kitoblar (guard va panel uchun) ---

const parseHM = (t?: string): number | null => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
};

/** Xodimning ish vaqti tugaganmi (tungi smena ham hisobga olinadi). */
export const isWorkEnded = (user: User | null): boolean => {
  if (!user || user.user_type !== "EMPLOYEE") return false;
  const start = parseHM(user.work_start);
  const end = parseHM(user.work_end);
  if (start === null || end === null || start === end) return false;
  const d = new Date();
  const cur = d.getHours() * 60 + d.getMinutes();
  const inShift = start < end ? cur >= start && cur < end : cur >= start || cur < end;
  return !inShift;
};

/** Kunlik kassa kesimi keldimi: sessiya kesim vaqtidan OLDIN ochilgan va
 *  hozir kesim vaqtidan o'tgan bo'lsa — kassani topshirish kerak. */
export const isCutDue = (state: ShiftState | undefined): boolean => {
  if (!state || state.mode !== "cash" || !state.my_session?.started_at) return false;
  const cut = parseHM(state.day_close);
  if (cut === null) return false;
  const now = new Date();
  // Bugungi kesim momenti
  const cutToday = new Date(now);
  cutToday.setHours(Math.floor(cut / 60), cut % 60, 0, 0);
  if (now < cutToday) return false;
  return new Date(state.my_session.started_at) < cutToday;
};

/** Kassa bilan ishlaydigan xodimmi: bron/to'lov yaratadigan (resepshn,
 *  kassir). Farrosh va texnik xodimlar smena tizimiga tortilmaydi — ularning
 *  ishi kassaga bog'liq emas. Menejer (shift.force_close egasi) mustasno. */
const CASH_PERMS = ["finance.payment.create", "reservation.create"];
export const isCashStaff = (user: User | null): boolean =>
  !!user &&
  user.user_type === "EMPLOYEE" &&
  !(user.permissions || []).includes("shift.force_close") &&
  (user.permissions || []).some((p) => CASH_PERMS.includes(p));

/** Xodim uchun sahifalar cheklanganmi va sababi. */
/** Smena cheklovi paytida ochiq qoladigan sahifalar.
 *  Yon menyu ham, marshrut qo'riqchisi ham SHU ro'yxatga tayanadi — ikki joyda
 *  alohida yozilsa, ular bir-biriga zid bo'lib qolardi. */
export const SHIFT_ALLOWED_ROUTES = ["/cash-reports", "/my-reports", "/expenses"];

/** Cheklov paytida qaysi sahifaga yo'naltiriladi.
 *  Smenani ochish tugmasi shu sahifada — boshqasiga yuborilsa, xodim
 *  cheklovdan chiqishning yo'lini topa olmay qoladi. */
export const SHIFT_REDIRECT_ROUTE = "/cash-reports";

export const shiftRestriction = (
  user: User | null,
  state: ShiftState | undefined
): "work_ended" | "blocked" | "cut_due" | "no_shift" | null => {
  if (!isCashStaff(user)) return null;
  if (!state || state.mode !== "cash") return null;
  // Boshqa xodimning yopilmagan smenasi — men hali sessiya ochmagan bo'lsam
  if (!state.my_session && state.blocking_session) return "blocked";
  // Smena umuman ochilmagan. Kassa hisobi xodimning sessiyasiga bog'langan:
  // sessiyasiz kiritilgan tushum hech kimning kassasiga tushmaydi va smena
  // topshirishda pul "yo'q joydan" paydo bo'ladi.
  if (!state.my_session) return "no_shift";
  if (isCutDue(state)) return "cut_due";
  if (isWorkEnded(user) && !state.my_session?.continue_after_end) return "work_ended";
  return null;
};
