import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import type { Guest } from '@/types/api';

export const useGuests = () => {
  return useQuery({
    queryKey: ['guests'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Guest[] }>('/guests/', {
        params: { page: 1, page_size: 500 }
      });
      return Array.isArray(data) ? data : (data.items || []);
    },
  });
};

export const GUESTS_PAGE_SIZE = 50;

export const guestsPageHasMore = (count: number, pageSize = GUESTS_PAGE_SIZE): boolean =>
  count === pageSize;

const asGuestList = (data: Guest[] | { items?: Guest[] } | null | undefined): Guest[] =>
  Array.isArray(data) ? data : (data?.items || []);

export const useGuestList = (query: string) => {
  const q = query.trim();
  return useInfiniteQuery({
    queryKey: ['guests', 'list', q],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<Guest[] | { items: Guest[] }>('/guests/', {
        params: {
          page: pageParam,
          page_size: GUESTS_PAGE_SIZE,
          ...(q ? { query: q } : {}),
        },
      });
      const items = asGuestList(data);
      return { items, page: pageParam, hasMore: guestsPageHasMore(items.length) };
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
};

export const searchGuests = async (query: string, limit = 20): Promise<Guest[]> => {
  const { data } = await api.get<Guest[] | { items: Guest[] }>('/guests/', {
    params: { page: 1, page_size: limit, query },
  });
  return asGuestList(data);
};

export const fetchGuest = async (id: string): Promise<Guest> => {
  const { data } = await api.get<Guest>(`/guests/${id}`);
  return data;
};

export const useGuestSearch = (query: string, enabled = true) => {
  const q = useDebouncedValue(query.trim(), 250);
  return useQuery({
    queryKey: ["guests", "search", q],
    queryFn: () => searchGuests(q),
    enabled: enabled && q.length >= 2,
    placeholderData: keepPreviousData,
  });
};

/* Yangi mehmon formasi: passport/telefon terilishi bilan bazada shunday
   mehmon bor-yo'qligi jonli tekshiriladi (GET /guests/lookup — server
   formatga chidamli taqqoslaydi: passport harf-raqamlari, telefon oxirgi
   9 raqami). Topilsa forma ostida "bazada bor — tanlang" chiqadi: xodim
   qayta yaratmaydi, server ham dublikat qilmaydi. */

export type GuestMatch = Guest & { matched_by: "passport" | "phone" }

export const normalizePassportKey = (value?: string | null) =>
  (value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
export const normalizePhoneKey = (value?: string | null) => (value || "").replace(/\D/g, "")

/** Qidirishga arziydimi: passport 5 belgidan, telefon 7 raqamdan */
export const guestLookupKey = (passport?: string | null, phone?: string | null): string => {
  const pass = normalizePassportKey(passport)
  const digits = normalizePhoneKey(phone)
  return `${pass.length >= 5 ? pass : ""}|${digits.length >= 7 ? digits : ""}`
}

export const lookupGuestMatches = async (
  passport?: string | null,
  phone?: string | null
): Promise<GuestMatch[]> => {
  const pass = normalizePassportKey(passport)
  const digits = normalizePhoneKey(phone)
  if (pass.length < 5 && digits.length < 7) return []
  const { data } = await api.get<{ matches: GuestMatch[] }>("/guests/lookup", {
    params: {
      passport_number: pass.length >= 5 ? pass : undefined,
      phone: digits.length >= 7 ? digits : undefined,
    },
  })
  return Array.isArray(data?.matches) ? data.matches : []
}

export const useGuestMatches = (
  passport: string | null | undefined,
  phone: string | null | undefined,
  enabled = true
) => {
  const key = useDebouncedValue(guestLookupKey(passport, phone), 300)
  const [pass, digits] = key.split("|")
  return useQuery({
    queryKey: ["guests", "lookup", key],
    queryFn: () => lookupGuestMatches(pass, digits),
    enabled: enabled && key !== "|",
    placeholderData: keepPreviousData,
    // Eski serverda endpoint yo'q — xato ko'rsatilmaydi, shunchaki bo'sh
    retry: false,
  })
}

export const useGuest = (guestId?: string | null) =>
  useQuery({
    queryKey: ["guests", "detail", guestId],
    queryFn: () => fetchGuest(guestId as string),
    enabled: !!guestId,
  });

export const useCreateGuest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: Partial<Guest> & { hotelId?: string }) => {
      // hotelId ni body'dan ajratib, query param sifatida yuboramiz
      // (SUPER_ADMIN uchun mehmon yaratishda hotel_id majburiy).
      const { hotelId, ...body } = payload;
      const { data } = await api.post<Guest>('/guests/', body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
  });
};

export const useUpdateGuest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<Guest> & { id: string; hotelId?: string }) => {
      const { id, hotelId, ...body } = payload;
      const { data } = await api.put<Guest>(`/guests/${id}`, body, {
        params: hotelId ? { hotel_id: hotelId } : {},
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      // Mehmon kartochkasi xona bandlovlari javobida ham keladi — telefon
      // yoki passport o'zgarsa o'sha oynada ham darhol yangilansin
      queryClient.invalidateQueries({ queryKey: ['roomReservations'] });
    },
  });
};

// Mehmon hujjati/surati uchun ruxsat etilgan formatlar va maksimal hajm
export const GUEST_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const GUEST_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Mehmon suratini (yoki hujjat nusxasini) backendning /files/upload endpointiga
 * yuklaydi. MinIO'da `hotel-documents` bucketiga tushadi va file_attachments
 * jadvalida entity_type="guest", entity_id=<mehmon id> bilan bog'lanadi.
 * `file.upload` ruxsati talab qilinadi.
 */
export const uploadGuestFile = async (
  guestId: string,
  file: File,
  category = 'photo',
  hotelId?: string
) => {
  const form = new FormData();
  // Fayl nomini xavfsizlashtiramiz — MinIO obyekt yo'liga nom qo'shiladi
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeName = `${category}-${Date.now()}.${ext}`;
  form.append('file', file, safeName);
  form.append('entity_type', 'guest');
  form.append('entity_id', guestId);
  form.append('category', category);

  const { data } = await api.post('/files/upload', form, {
    params: hotelId ? { hotel_id: hotelId } : {},
    // Content-Type ni brauzer o'zi (boundary bilan) qo'yadi
    headers: { 'Content-Type': undefined as any },
  });
  return data;
};
