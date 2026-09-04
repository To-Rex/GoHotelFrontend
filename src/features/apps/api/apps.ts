import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * Dasturlar do'koni — mehmonxona tomoni.
 *
 * Boshqaruv paneli yuklagan Android/Windows dasturlari shu yerdan
 * ko'rinadi. Faqat administrator uchun: o'rnatish fayllari — tizimni
 * boshqarish vositasi.
 */

export interface AppRelease {
  id: string
  platform: "ANDROID" | "WINDOWS"
  name: string
  version: string | null
  notes: string | null
  original_name: string
  mime_type: string
  file_size: number
  download_count: number
  created_at: string | null
}

export const useAppReleases = (enabled = true) =>
  useQuery({
    queryKey: ["appReleases"],
    queryFn: async () => {
      const { data } = await api.get<AppRelease[]>("/apps/")
      return Array.isArray(data) ? data : []
    },
    enabled,
  })

/** O'qish oson hajm: 87.4 MB, 512 KB. */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "—"
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

/**
 * Faylni yuklab olib, saqlash oynasini ochadi.
 *
 * Oddiy havola ishlamaydi: so'rovga token sarlavhasi kerak. Shuning
 * uchun fayl blob sifatida olinadi va brauzerga topshiriladi.
 */
export async function downloadAppRelease(app: AppRelease): Promise<void> {
  const { data } = await api.get<Blob>(`/apps/${app.id}/download`, {
    responseType: "blob",
    // Katta o'rnatuvchi sekin tarmoqda ham ulgurishi kerak
    timeout: 10 * 60 * 1000,
  })
  const url = URL.createObjectURL(data)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = app.original_name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
