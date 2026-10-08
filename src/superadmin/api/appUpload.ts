import type { AxiosInstance } from "axios"

/**
 * Dasturlar do'koniga BO'LAKLAB yuklash.
 *
 * Nega: o'rnatish fayllari katta (APK ~100 MB). Bitta so'rovda yuborilsa
 * yo'ldagi proksi 60 soniyadan uzoq kelayotgan tanani uzadi (504) — sekin
 * tarmoqdan yangi versiya umuman qo'shib bo'lmas edi. Endi fayl 4 MB'lik
 * bo'laklarga bo'linib har biri alohida qisqa so'rov bilan ketadi; xato
 * bergan bo'lak qayta yuboriladi; jarayon foizda ko'rinadi.
 */

export interface UploadSession {
  upload_id: string
  chunk_size: number
  total_chunks: number
}

export interface ChunkUploadPayload {
  platform: string
  name: string
  version: string
  notes: string
  file: Blob & { name?: string; type?: string }
}

export interface ChunkUploadOptions {
  onProgress?: (percent: number) => void
  /** Bitta bo'lak uchun urinishlar soni */
  retries?: number
  /** Urinishlar orasidagi kutish (testda almashtiriladi) */
  sleep?: (ms: number) => Promise<void>
}

export const CHUNK_RETRIES = 3
export const CHUNK_TIMEOUT_MS = 2 * 60 * 1000
export const COMPLETE_TIMEOUT_MS = 10 * 60 * 1000

type Client = Pick<AxiosInstance, "post" | "put" | "delete">

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Bo'laklar chegaralari: [boshi, oxiri) juftliklari. */
export function chunkRanges(size: number, chunkSize: number): Array<[number, number]> {
  if (size <= 0 || chunkSize <= 0) return []
  const out: Array<[number, number]> = []
  for (let start = 0; start < size; start += chunkSize) {
    out.push([start, Math.min(size, start + chunkSize)])
  }
  return out
}

export async function uploadAppInChunks<T = unknown>(
  client: Client,
  payload: ChunkUploadPayload,
  options: ChunkUploadOptions = {}
): Promise<T> {
  const { onProgress, retries = CHUNK_RETRIES, sleep = wait } = options
  const file = payload.file
  const { data: session } = await client.post<UploadSession>("/apps/uploads", {
    platform: payload.platform,
    name: payload.name,
    version: payload.version.trim() || null,
    notes: payload.notes.trim() || null,
    filename: file.name || "app.bin",
    size: file.size,
    content_type: file.type || null,
  })
  const ranges = chunkRanges(file.size, session.chunk_size)
  onProgress?.(0)

  try {
    for (let i = 0; i < ranges.length; i++) {
      const [start, end] = ranges[i]
      const part = file.slice(start, end)
      let lastError: unknown = null
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await client.put(`/apps/uploads/${session.upload_id}/chunks/${i}`, part, {
            headers: { "Content-Type": "application/octet-stream" },
            timeout: CHUNK_TIMEOUT_MS,
          })
          lastError = null
          break
        } catch (e) {
          lastError = e
          if (attempt < retries) await sleep(1000 * attempt)
        }
      }
      if (lastError) throw lastError
      onProgress?.(Math.round(((i + 1) / ranges.length) * 100))
    }
    const { data } = await client.post<T>(
      `/apps/uploads/${session.upload_id}/complete`,
      {},
      { timeout: COMPLETE_TIMEOUT_MS }
    )
    return data
  } catch (e) {
    // Chala yuklash serverda qolmasin (xatosi muhim emas)
    try {
      await client.delete(`/apps/uploads/${session.upload_id}`)
    } catch {
      /* e'tiborsiz */
    }
    throw e
  }
}
