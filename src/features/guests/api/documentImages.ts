import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DocumentSide, DocumentType } from '../components/documentScannerTypes';

/* Skanerlangan pasport / ID karta SURATI — MinIO'da, mehmon kartasiga
   biriktiriladi (backend: document_images.py).

   Veb skaneri natijani mehmon hali yo'q paytda beradi, shuning uchun
   suratlar ekranda eslab qolinadi va mehmon yaratilgach/tanlangach
   yuklanadi. Telefonda skanerlangan hujjat surati esa serverda allaqachon
   saqlangan — yangi mehmon yaratilsa unga `linkScanToGuest` bilan
   bog'lanadi.

   Saqlash HECH QACHON asosiy amalni (mehmon/bron saqlash) to'xtatmaydi:
   bu yerdagi yordamchilar xato tashlamaydi, natijani qaytaradi. */

/** Skanerdan kelgan suratlar: tomon → JPEG */
export interface ScanImages {
  documentType?: DocumentType;
  images: Partial<Record<DocumentSide, Blob>>;
}

export interface GuestDocumentImage {
  id: string;
  /** document_passport | document_front | document_back | photo */
  category: string | null;
  side: DocumentSide | null;
  mime_type: string;
  file_size: number;
  created_at: string | null;
  uploaded_by_name?: string | null;
}

export type SaveImagesOutcome = 'saved' | 'disabled' | 'empty' | 'failed';

export const SCAN_SIDES: DocumentSide[] = ['passport', 'front', 'back'];

export const hasScanImages = (scan?: ScanImages | null): scan is ScanImages =>
  !!scan && SCAN_SIDES.some((side) => !!scan.images[side]);

export const guestDocumentImagesKey = (guestId?: string | null) => ['guestDocumentImages', guestId];

export const uploadGuestDocumentImages = async (guestId: string, scan: ScanImages) => {
  const form = new FormData();
  for (const side of SCAN_SIDES) {
    const blob = scan.images[side];
    if (blob) form.append(side, blob, `${side}.jpg`);
  }
  if (scan.documentType) form.append('document_type', scan.documentType);
  const { data } = await api.post<{ stored: GuestDocumentImage[]; disabled: boolean }>(
    `/guests/${guestId}/document-images`,
    form,
    // Content-Type ni brauzer o'zi (boundary bilan) qo'yadi
    { headers: { 'Content-Type': undefined as any } }
  );
  return data;
};

/** Suratlarni mehmonga saqlaydi. Xato tashlamaydi. */
export const saveScanImages = async (
  guestId: string | null | undefined,
  scan: ScanImages | null | undefined
): Promise<SaveImagesOutcome> => {
  if (!guestId || !hasScanImages(scan)) return 'empty';
  try {
    const data = await uploadGuestDocumentImages(guestId, scan);
    return data?.disabled ? 'disabled' : 'saved';
  } catch (e) {
    console.error('Hujjat suratini saqlab bo\'lmadi', e);
    return 'failed';
  }
};

/** Telefonda skanerlangan hujjat suratini mehmonga bog'laydi. Xato tashlamaydi. */
export const linkScanToGuest = async (
  scanId: string | null | undefined,
  guestId: string | null | undefined
): Promise<boolean> => {
  if (!scanId || !guestId) return false;
  try {
    await api.post(`/reception/scans/${scanId}/link-guest`, { guest_id: guestId });
    return true;
  } catch (e) {
    console.error('Skan suratini mehmonga bog\'lab bo\'lmadi', e);
    return false;
  }
};

export const useGuestDocumentImages = (guestId?: string | null, enabled = true) =>
  useQuery({
    queryKey: guestDocumentImagesKey(guestId),
    queryFn: async () => {
      const { data } = await api.get<GuestDocumentImage[]>(`/guests/${guestId}/document-images`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!guestId && enabled,
    // Ruxsat yo'q (403) — qayta urinish foydasiz
    retry: false,
  });

/** Rasmning o'zi API orqali (MinIO havolasi HTTPS sahifada ochilmaydi). */
export const fetchGuestDocumentImage = async (guestId: string, fileId: string): Promise<Blob> => {
  const { data } = await api.get(`/guests/${guestId}/document-images/${fileId}`, {
    responseType: 'blob',
  });
  return data as Blob;
};
