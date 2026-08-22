import { api } from "@/lib/api"
import type { DocumentSide, DocumentType, ScannedDoc } from "../components/documentScannerTypes"

/**
 * Hujjatni SERVERDA o'qish.
 *
 * Telefon brauzerida OCR bitta yadroda WebAssembly'da ishlaydi va zaif
 * qurilmada sezilarli sekin; server esa PP-OCR modellarini to'liq CPU'da
 * yuritadi va MRZ nazorat raqamlarini tekshiradi. Shuning uchun qurilma faqat
 * hujjatni ko'rish va suratga olish bilan shug'ullanadi — tanish serverga
 * beriladi.
 *
 * Javob shakli qurilmadagi OCR bilan bir xil (`ScannedDoc`), shuning uchun
 * skaner ikkala manbani ham bir xil ishlaydi. Server javob bermasa yoki
 * dvigatel o'rnatilmagan bo'lsa (503), chaqiruvchi qurilmadagi OCR'ga
 * qaytadi — foydalanuvchi uchun farqi bilinmaydi.
 *
 * Rasm serverda SAQLANMAYDI: faqat xotirada o'qiladi.
 */

/** Kadr sifati va hajmi orasidagi muvozanat — ~150-300 KB JPEG. */
const JPEG_QUALITY = 0.86

export class ServerScanUnavailable extends Error {}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Kadrni JPEG'ga aylantirib bo'lmadi"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  })
}

export async function scanDocumentOnServer(
  canvas: HTMLCanvasElement,
  documentType: DocumentType,
  side: DocumentSide,
  signal?: AbortSignal
): Promise<ScannedDoc> {
  const blob = await canvasToJpeg(canvas)
  const form = new FormData()
  form.append("file", blob, "document.jpg")
  form.append("document_type", documentType)
  form.append("side", side)
  try {
    const { data } = await api.post<ScannedDoc>("/guests/scan-document", form, {
      // Content-Type ni axios FormData chegarasi bilan o'zi qo'ysin
      headers: { "Content-Type": undefined as unknown as string },
      timeout: 20000,
      signal,
    })
    return data
  } catch (error: any) {
    // 503 — serverda dvigatel yo'q; tarmoq xatosi — aloqa yo'q. Ikkalasida ham
    // qurilmadagi OCR'ga qaytish kerak, boshqa xatolarda esa qaytmaydi
    // (masalan 422 "rasmda yozuv yo'q" — bu keyingi kadrda hal bo'ladi).
    const status = error?.response?.status
    if (status === 503 || status === 404 || !error?.response) {
      throw new ServerScanUnavailable(error?.message || "Server skaneri mavjud emas")
    }
    throw error
  }
}
