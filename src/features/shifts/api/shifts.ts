import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/store/auth";

// --- Turlar ---

export interface ShiftSettings {
  mode: "simple" | "cash";
  day_close: string; // "HH:MM"
  /** Kesim vaqtida kassa topshirish majburiymi.
   *  true  — topshirilmaguncha ishlab bo'lmaydi
   *  false — faqat eslatiladi, ish davom etaveradi */
  day_close_required: boolean;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shiftState"] });
      // Kassa harakati o'zgardi — nazorat ko'rsatkichlari ham yangilansin
      qc.invalidateQueries({ queryKey: ["cashOverview"] });
      qc.invalidateQueries({ queryKey: ["shiftHandovers"] });
    },
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
    async (payload: {
      session_id: string;
      counted_cash?: number;
      notes?: string;
      /** Kassa keyingi xodim qabul qilishini kutsinmi (standart: ha) */
      hand_over?: boolean;
    }) => {
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
      qc.invalidateQueries({ queryKey: ["shiftHandovers"] });
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

// --- Kassalar hozir (admin/menejer) ---

/** Ochiq kassa sessiyasi tarkibi bilan (`/shifts/cash-overview`). */
export interface CashDrawer extends ShiftSession {
  branch_name?: string | null;
  payments_cash: number;
  shop_cash: number;
  expenses_cash: number;
  expected_cash: number;
}

export interface CashOverview {
  mode: "simple" | "cash";
  sessions: CashDrawer[];
  /** Hozir ochiq kassalarda bo'lishi kerak bo'lgan jami naqd pul */
  total_expected: number;
  active_count: number;
  pending_count: number;
}

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null)?.response?.status;

/** Ruxsat yo'q (403) — xato emas: kassalar nazorati faqat administrator va
 *  `shift.force_close` egasiga ochiq ("ko'r sanash" — kassir o'z kassasidagi
 *  kutilgan summani ko'rmaydi). */
export const isForbiddenError = (error: unknown): boolean => statusOf(error) === 403;

export const CASH_OVERVIEW_KEY = ["cashOverview"] as const;

export const useCashOverview = (enabled = true) =>
  useQuery({
    queryKey: CASH_OVERVIEW_KEY,
    queryFn: async () => {
      const { data } = await api.get<CashOverview>("/shifts/cash-overview");
      return data;
    },
    enabled,
    // Jonli ko'rsatkich — har daqiqada yangilanadi
    refetchInterval: 60_000,
    staleTime: 15_000,
    retry: (count, error) => !isForbiddenError(error) && count < 2,
  });

// --- Smenadan smenaga o'tgan pullar (admin/menejer) ---

/** Smena yakunida kassadagi pul qayerga ketgani (backend: handover_kind):
 *  HANDOVER — keyingi xodim qabul qildi; PENDING — qabul kutilmoqda;
 *  CASH_OUT — kassa topshirildi (kunlik kesim), pul kassadan chiqdi;
 *  FORCE_TAKEN — majburiy yopildi, pulni rahbar oldi. */
export type HandoverKind = "HANDOVER" | "PENDING" | "CASH_OUT" | "FORCE_TAKEN";

export interface ShiftHandover {
  id: string;
  kind: HandoverKind;
  from_user_id: string;
  from_user_name?: string | null;
  to_user_id?: string | null;
  to_user_name?: string | null;
  closed_by_name?: string | null;
  branch_name?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  accepted_at?: string | null;
  opening_cash: number;
  expected_cash?: number | null;
  counted_cash?: number | null;
  cash_diff?: number | null;
  force_closed: boolean;
  corrected: boolean;
  notes?: string | null;
  /** Qabul qiluvchining yangi sessiyasi boshlang'ich kassasi */
  received_opening_cash?: number | null;
}

export interface HandoverReport {
  mode: "simple" | "cash";
  summary: {
    handed_over_total: number;
    handed_over_count: number;
    taken_out_total: number;
    taken_out_count: number;
    pending_total: number;
    pending_count: number;
    shortage_total: number;
    surplus_total: number;
  };
  items: ShiftHandover[];
}

export const useShiftHandovers = (dateFrom?: string, dateTo?: string, enabled = true) =>
  useQuery({
    queryKey: ["shiftHandovers", dateFrom || null, dateTo || null],
    queryFn: async () => {
      const { data } = await api.get<HandoverReport>("/shifts/handovers", {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 500,
        },
      });
      return data;
    },
    enabled,
    retry: (count, error) => !isForbiddenError(error) && count < 2,
  });

/** Qabul qiluvchining boshlang'ich kassasi topshirilgan summadan farq
 *  qiladimi (masalan, sanalgan summa keyin tuzatilgan bo'lsa). */
export const handoverMismatch = (h: ShiftHandover): number | null => {
  if (h.kind !== "HANDOVER") return null;
  if (h.received_opening_cash == null || h.counted_cash == null) return null;
  const diff = Number(h.received_opening_cash) - Number(h.counted_cash);
  return Math.abs(diff) >= 1 ? diff : null;
};

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
export type ShiftRestriction =
  | "work_ended"
  | "blocked"
  | "cut_due"
  | "no_shift"
  | "handover";

/** Smena cheklovi paytida ochiq qoladigan sahifalar.
 *  Yon menyu ham, marshrut qo'riqchisi ham SHU ro'yxatga tayanadi — ikki joyda
 *  alohida yozilsa, ular bir-biriga zid bo'lib qolardi. */
export const SHIFT_ALLOWED_ROUTES = ["/cash-reports", "/my-reports", "/expenses"];

/** Faol smenasi YO'Q xodimga ochiq qoladigan sahifalar.
 *
 *  Xarajat ham kassadan chiqadi va sessiyaga yoziladi. Faol sessiya bo'lmasa,
 *  u hech qaysi smenaga tushmaydi — topshirilgan sessiyaning oynasi allaqachon
 *  yopilgan. Shuning uchun bunday holatda faqat kassa va hisobot qoladi. */
export const SHIFT_ALLOWED_ROUTES_NO_SESSION = ["/cash-reports", "/my-reports"];

/** Cheklov turiga qarab ochiq qoladigan sahifalar.
 *  `cut_due` va `work_ended` da xodimning FAOL sessiyasi bor — u ishlashda
 *  davom etishi yoki kassani topshirishi mumkin, shuning uchun xarajat ham
 *  o'z sessiyasiga yoziladi va ochiq qoladi. */
export const allowedRoutesFor = (restriction: ShiftRestriction | null): string[] =>
  restriction === "cut_due" || restriction === "work_ended"
    ? SHIFT_ALLOWED_ROUTES
    : SHIFT_ALLOWED_ROUTES_NO_SESSION;

/** Cheklov paytida qaysi sahifaga yo'naltiriladi.
 *  Smenani ochish tugmasi shu sahifada — boshqasiga yuborilsa, xodim
 *  cheklovdan chiqishning yo'lini topa olmay qoladi. */
export const SHIFT_REDIRECT_ROUTE = "/cash-reports";

export const shiftRestriction = (
  user: User | null,
  state: ShiftState | undefined
): ShiftRestriction | null => {
  if (!isCashStaff(user)) return null;
  if (!state || state.mode !== "cash") return null;
  // Boshqa xodimning yopilmagan smenasi — men hali sessiya ochmagan bo'lsam
  if (!state.my_session && state.blocking_session) return "blocked";
  // Smena umuman ochilmagan. Kassa hisobi xodimning sessiyasiga bog'langan:
  // sessiyasiz kiritilgan tushum hech kimning kassasiga tushmaydi va smena
  // topshirishda pul "yo'q joydan" paydo bo'ladi.
  if (!state.my_session) return "no_shift";
  // Smena tugallangan, keyingi xodim qabul qilishini kutmoqda. Sessiya oynasi
  // yopilgan, ya'ni bu paytda kiritilgan tushum hech qaysi smenaga tushmaydi —
  // xuddi smena umuman ochilmagandagidek.
  if (state.my_session.status !== "ACTIVE") return "handover";
  // Kesim MAJBURIY bo'lsagina ishni to'sadi. O'chirilgan bo'lsa faqat
  // eslatma ko'rsatiladi (kassa panelida) — bu yerda cheklov qaytmaydi.
  // `!== false`: eski javobda maydon bo'lmasa, majburiy deb qabul qilinadi —
  // serverdagi standart bilan bir xil.
  if (state.day_close_required !== false && isCutDue(state)) return "cut_due";
  if (isWorkEnded(user) && !state.my_session?.continue_after_end) return "work_ended";
  return null;
};
