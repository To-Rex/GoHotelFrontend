import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/* Hujjat skaneri rejimi — mehmonxona sozlamasi (hotels.settings JSONB).
   mrz    — faqat MRZ zonasi (tez, nazorat raqamlari bilan tekshiriladi)
   visual — hujjat old tomonidagi yozuvlar (MRZ yo'q/o'chgan hujjatlar)
   auto   — avval MRZ, topilmasa vizual (standart) */

export type ScanMode = 'mrz' | 'visual' | 'auto';

/* OCR qayerda bajariladi.
   server — serverdagi PP-OCR: telefonni band qilmaydi, sezilarli tez va aniq;
            aloqa uzilsa yoki server dvigateli yo'q bo'lsa qurilmadagi OCR'ga
            avtomatik qaytadi
   device — faqat brauzerda: hujjat rasmi qurilmadan umuman chiqmaydi */
export type ScanEngine = 'server' | 'device';

export interface ScanSettings {
  mode: ScanMode;
  engine: ScanEngine;
  /** Serverda OCR dvigateli o'rnatilganmi (faqat o'qish uchun) */
  serverAvailable: boolean;
}

export const DEFAULT_SCAN_SETTINGS: ScanSettings = {
  mode: 'auto',
  engine: 'server',
  serverAvailable: false,
};

export const useScanSettings = () =>
  useQuery({
    queryKey: ['scanSettings'],
    queryFn: async () => {
      const { data } = await api.get<ScanSettings>('/guests/scan-settings');
      return { ...DEFAULT_SCAN_SETTINGS, ...(data || {}) };
    },
    // Rejim kamdan-kam o'zgaradi — keshda uzoq tursin (skaner tez ochilsin)
    staleTime: 5 * 60 * 1000,
  });

export const useSaveScanSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { mode: ScanMode; engine: ScanEngine }) => {
      const { data } = await api.put<ScanSettings>('/guests/scan-settings', payload);
      return data;
    },
    onSuccess: (data) =>
      qc.setQueryData(['scanSettings'], { ...DEFAULT_SCAN_SETTINGS, ...(data || {}) }),
  });
};
