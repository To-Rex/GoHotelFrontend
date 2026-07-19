import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
