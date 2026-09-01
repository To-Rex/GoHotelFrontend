import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Kameradan kelgan yuz suratlari (ko'rinishlar).
 *
 * Suratlar filialga o'rnatilgan IP kameralardan keladi va serverda 12 soat
 * turadi. Eng muhim qoida shu yerda: ro'yxat DOIM `branch_id` bilan
 * so'raladi. Xodim yangi mehmonga yuz biriktirayotganda boshqa filialning
 * odamini ko'rmasligi kerak — bu shunchaki qulaylik emas, chalkashlik
 * boshqa odamning bronini ochishga olib keladi.
 */

export interface Sighting {
  id: string;
  status: 'recognized' | 'uncertain' | 'unknown' | 'low_quality';
  camera_id: string;
  camera_name?: string | null;
  location?: string | null;
  seen_at: string;
  similarity: number;
  margin: number;
  quality_score: number;
  branch_id?: string | null;
  guest_id?: string | null;
  guest_name?: string | null;
  guest_phone?: string | null;
  last_stay_at?: string | null;
  visits: number;
  has_thumbnail: boolean;
  /** Vektori saqlangan va hali hech kimga biriktirilmagan. */
  can_enroll: boolean;
  acknowledged: boolean;
}

export interface SightingList {
  items: Sighting[];
  unacknowledged: number;
  engine: string;
}

export interface SightingsQuery {
  /** Majburiy: bu filial kameralaridan kelganlar. */
  branchId?: string;
  /** Necha daqiqalik oyna. Qabulxona uchun 30-60 mantiqiy. */
  minutes?: number;
  limit?: number;
  /** Faqat hali hech kimga biriktirilmaganlar. */
  onlyUnmatched?: boolean;
  includeAcknowledged?: boolean;
  /** Polling oralig'i (ms). 0 yoki undefined — o'chirilgan. */
  refetchMs?: number;
  enabled?: boolean;
}

export const useSightings = (params: SightingsQuery = {}) => {
  const {
    branchId,
    minutes = 60,
    limit = 24,
    onlyUnmatched = false,
    includeAcknowledged = true,
    refetchMs,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      'vision-sightings',
      branchId ?? null,
      minutes,
      limit,
      onlyUnmatched,
      includeAcknowledged,
    ],
    // Filialsiz so'ramaymiz: filtrsiz ro'yxat butun mehmonxonani qaytaradi
    // va tanlash oynasida boshqa filialning odami paydo bo'lardi.
    enabled: enabled && !!branchId,
    refetchInterval: refetchMs && refetchMs > 0 ? refetchMs : false,
    queryFn: async () => {
      const { data } = await api.get<SightingList>('/vision/sightings', {
        params: {
          branch_id: branchId,
          minutes,
          limit,
          only_unmatched: onlyUnmatched,
          include_acknowledged: includeAcknowledged,
        },
      });
      return data;
    },
  });
};

/**
 * Bir odamning bir necha ko'rinishi — bitta karta.
 *
 * Mehmon kamera oldidan uch marta o'tsa uchta epizod yoziladi. Server
 * ularni vektorlari bo'yicha guruhlab beradi, shunda xodim "bularning
 * qaysi biri?" deb o'ylamaydi va biriktirilmagan qolganlari ro'yxatda
 * qolib ketmaydi.
 */
export interface SightingGroup {
  /** Guruhning barcha ko'rinishlari — biriktirishda hammasi yuboriladi. */
  sighting_ids: string[];
  /** Eng sifatlisi — surat shundan olinadi. */
  best_sighting_id: string;
  count: number;
  camera_id: string;
  camera_name?: string | null;
  location?: string | null;
  branch_id?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  quality_score: number;
  /** A'zolarning bir-biriga o'xshashligi. Past bo'lsa guruhga boshqa odam
      tushgan bo'lishi mumkin — panel buni belgilab qo'yadi. */
  cohesion: number;
  has_thumbnail: boolean;
}

export interface SightingGroupList {
  items: SightingGroup[];
  ungrouped: number;
}

export const useSightingGroups = (params: SightingsQuery = {}) => {
  const { branchId, minutes = 120, limit = 24, refetchMs, enabled = true } = params;
  return useQuery({
    queryKey: ['vision-sighting-groups', branchId ?? null, minutes, limit],
    // Filialsiz so'ramaymiz: filtrsiz ro'yxat butun mehmonxonani qaytarardi.
    enabled: enabled && !!branchId,
    refetchInterval: refetchMs && refetchMs > 0 ? refetchMs : false,
    queryFn: async () => {
      const { data } = await api.get<SightingGroupList>('/vision/sightings/groups', {
        params: { branch_id: branchId, minutes, limit },
      });
      return data;
    },
  });
};

/**
 * Ko'rinish suratini yuklaydi.
 *
 * `<img src>` sarlavha yubormaydi, endpoint esa token talab qiladi —
 * shuning uchun surat blob sifatida olinadi va object URL yasaladi.
 * Chaqiruvchi uni `URL.revokeObjectURL` bilan bo'shatishi shart.
 */
export const fetchSightingImage = async (sightingId: string): Promise<string> => {
  const { data } = await api.get(`/vision/sightings/${sightingId}/image`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(data as Blob);
};

/** Ko'rinish suratini `File` sifatida oladi — mehmon surati qilib yuklash uchun. */
export const fetchSightingFile = async (
  sightingId: string,
  name = 'face.jpg'
): Promise<File> => {
  const { data } = await api.get(`/vision/sightings/${sightingId}/image`, {
    responseType: 'blob',
  });
  const blob = data as Blob;
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
};

export interface EnrollResult {
  guest_id: string;
  enrolled: boolean;
  profiles: number;
  consent_at?: string | null;
  last_matched_at?: string | null;
}

/**
 * Ko'rinishni mehmonga biriktiradi — keyingi tashrifda u avtomatik tanaladi.
 *
 * `consent` majburiy: mehmonning biometrik ma'lumot saqlashga roziligi
 * yo'q bo'lsa server rad etadi. Bu texnik emas, huquqiy shart.
 */
export const useEnrollSighting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      sightingId: string;
      guestId: string;
      consent: boolean;
      /** Guruhning qolgan ko'rinishlari — ular ham shu mehmonga yoziladi
          va vektorlari shablonga qo'shiladi. */
      sightingIds?: string[];
    }) => {
      const { data } = await api.post<EnrollResult>(
        `/vision/sightings/${payload.sightingId}/enroll`,
        {
          guest_id: payload.guestId,
          consent: payload.consent,
          sighting_ids: payload.sightingIds ?? [],
        }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vision-sightings'] });
      queryClient.invalidateQueries({ queryKey: ['vision-sighting-groups'] });
      queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
  });
};

export const useAcknowledgeSighting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sightingId: string) => {
      const { data } = await api.post(`/vision/sightings/${sightingId}/ack`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vision-sightings'] });
    },
  });
};

// ---------------------------------------------------------------------------
// Qurilmalar (kamera agenti o'rnatilgan kompyuterlar)
// ---------------------------------------------------------------------------

export interface VisionDevice {
  id: string;
  name: string;
  device_id?: string | null;
  branch_id?: string | null;
  is_active: boolean;
  /** Tokenning oxirgi 4 belgisi — qaysi token ekanini ajratish uchun. */
  token_hint: string;
  last_seen_at?: string | null;
  events_received: number;
  created_at: string;
}

/** Yaratilgan qurilma — `token` FAQAT shu javobda ochiq keladi. */
export interface VisionDeviceCreated extends VisionDevice {
  token: string;
}

export const useVisionDevices = () =>
  useQuery({
    queryKey: ['vision-devices'],
    queryFn: async () => {
      const { data } = await api.get<VisionDevice[]>('/vision/devices');
      return data;
    },
  });

/**
 * Yangi kamera agenti uchun token yaratadi.
 *
 * Token javobda bir marta ochiq keladi va bazada faqat SHA-256 xeshi
 * qoladi — ya'ni uni qayta ko'rsatib bo'lmaydi. Yo'qolsa yangisini
 * yaratib, eskisini bekor qilish kerak.
 */
export const useCreateVisionDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; branch_id?: string | null }) => {
      const { data } = await api.post<VisionDeviceCreated>('/vision/devices', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vision-devices'] });
    },
  });
};

/** Tokenni bekor qiladi. Qurilma o'chirilmaydi — tarix qoladi. */
export const useRevokeVisionDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deviceId: string) => {
      const { data } = await api.delete(`/vision/devices/${deviceId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vision-devices'] });
      queryClient.invalidateQueries({ queryKey: ['vision-cameras'] });
    },
  });
};

// ---------------------------------------------------------------------------
// Kameralar
// ---------------------------------------------------------------------------

export interface VisionCamera {
  id: string;
  camera_id: string;
  name?: string | null;
  location?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  device_id: string;
  device_name?: string | null;
  is_active: boolean;
  sightings_count: number;
  last_seen_at?: string | null;
  created_at: string;
}

export const useVisionCameras = (params: { branchId?: string; unassignedOnly?: boolean } = {}) =>
  useQuery({
    queryKey: ['vision-cameras', params.branchId ?? null, !!params.unassignedOnly],
    queryFn: async () => {
      const { data } = await api.get<VisionCamera[]>('/vision/cameras', {
        params: {
          branch_id: params.branchId,
          unassigned_only: params.unassignedOnly,
        },
      });
      return data;
    },
  });

export const useUpdateVisionCamera = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      branch_id?: string | null;
      name?: string;
      is_active?: boolean;
    }) => {
      const { id, ...body } = payload;
      const { data } = await api.patch<VisionCamera>(`/vision/cameras/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vision-cameras'] });
      queryClient.invalidateQueries({ queryKey: ['vision-sightings'] });
    },
  });
};

/** Vision umuman sozlanganmi — tugmani ko'rsatish/yashirish uchun. */
export const useVisionStats = (enabled = true) =>
  useQuery({
    queryKey: ['vision-stats'],
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<{
        profiles: number;
        guests_with_face: number;
        active_devices: number;
        model: string;
        match_threshold: number;
        match_margin: number;
      }>('/vision/stats');
      return data;
    },
  });
