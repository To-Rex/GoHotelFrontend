import { api } from "@/lib/api"
import type { DocumentType, ScannedDoc } from "../components/documentScannerTypes"

/**
 * Hujjatni SERVERDA o'qish va tekshirish.
 *
 * ID kartaning ikkala tomoni BITTA so'rovda yuboriladi. Bu qulaylik uchun
 * emas: server faqat shundagina old tomondagi bosma ma'lumotni orqa tomondagi
 * MRZ bilan solishtira oladi, ikkala tomon bitta hujjatga tegishli ekanini
 * tekshira oladi va nazorat raqami bo'yicha tiklangan belgini mustaqil
 * tasdiqlay oladi. Passport uchun bitta sahifa yetarli — unda MRZ ham, bosma
 * maydonlar ham bor.
 *
 * Rasm serverda SAQLANMAYDI: xotirada o'qiladi va javob bilan yo'qoladi.
 */

/** Sifat va hajm orasidagi muvozanat — ~200-400 KB JPEG. */
const JPEG_QUALITY = 0.88

/** Server ishlamayapti — chaqiruvchi qurilmadagi OCR'ga qaytishi kerak. */
export class ServerScanUnavailable extends Error {}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Kadrni JPEG'ga aylantirib bo'lmadi"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  })
}

export interface DocumentShots {
  /** ID kartaning old tomoni yoki passportning ma'lumotlar sahifasi */
  front: HTMLCanvasElement
  /** Faqat ID karta uchun — MRZ joylashgan orqa tomon */
  back?: HTMLCanvasElement
}

export async function scanDocumentOnServer(
  shots: DocumentShots,
  documentType: DocumentType,
  signal?: AbortSignal
): Promise<ScannedDoc> {
  const form = new FormData()
  form.append("document_type", documentType)
  try {
    form.append("front", await canvasToJpeg(shots.front), "front.jpg")
    if (shots.back) form.append("back", await canvasToJpeg(shots.back), "back.jpg")
  } catch {
    // Kanvasni kodlab bo'lmadi — bu serverning aybi emas, lekin serverga
    // yuboradigan narsa ham yo'q, shuning uchun qurilmadagi yo'lga o'tamiz.
    throw new ServerScanUnavailable("Rasmni tayyorlab bo'lmadi")
  }
  try {
    const { data } = await api.post<ScannedDoc>("/guests/scan-document", form, {
      // Content-Type ni axios FormData chegarasi bilan o'zi qo'ysin
      headers: { "Content-Type": undefined as unknown as string },
      timeout: 30000,
      signal,
    })
    return data
  } catch (error: any) {
    const status = error?.response?.status as number | undefined
    // Serverdagi HAR QANDAY nosozlik (503, 500, 502, marshrut yo'q) va
    // tarmoq uzilishi — qurilmadagi OCR'ga o'tish sababi. Faqat 4xx
    // (masalan "rasmda yozuv topilmadi") server ishlayotganini bildiradi,
    // ya'ni dvigatelni almashtirishning hojati yo'q.
    if (status === undefined || status >= 500 || status === 404) {
      throw new ServerScanUnavailable(error?.message || "Server skaneri javob bermadi")
    }
    throw error
  }
}
