import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/* Hujjat skaneri rejimi — mehmonxona sozlamasi (hotels.settings JSONB).
   mrz    — faqat MRZ zonasi (tez, nazorat raqamlari bilan tekshiriladi)
   visual — hujjat old tomonidagi yozuvlar (MRZ yo'q/o'chgan hujjatlar)
   auto   — avval MRZ, topilmasa vizual (standart) */

export type ScanMode = 'mrz' | 'visual' | 'auto';

export interface ScanSettings {
  mode: ScanMode;
}

export const DEFAULT_SCAN_SETTINGS: ScanSettings = { mode: 'auto' };

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
    mutationFn: async (mode: ScanMode) => {
      const { data } = await api.put<ScanSettings>('/guests/scan-settings', { mode });
      return data;
    },
    onSuccess: (data) =>
      qc.setQueryData(['scanSettings'], { ...DEFAULT_SCAN_SETTINGS, ...(data || {}) }),
  });
};
