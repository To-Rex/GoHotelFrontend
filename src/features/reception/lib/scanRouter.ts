import type { DocumentScan } from "../api/scans"

/* Telefon skanlarini OCHIQ turgan bandlov oynasiga yo'naltirish.

   Oddiy holatda telefonda skanerlangan hujjat yangi bandlov oynasini
   ochadi. Lekin oyna ALLAQACHON ochiq bo'lsa (birinchi skandan keyin),
   ikkinchi skan yangi oyna ochib xodim kiritgan hamma narsani yo'qotib
   yuborardi. Buning o'rniga ochiq oyna skanni o'ziga "da'vo qiladi":
   skanerlangan odam hamroh bo'lib tushadi.

   Ro'yxatdan o'tish oddiy modul o'zgaruvchisi: bir vaqtda bitta bandlov
   oynasi ochiq bo'ladi, context yoki store bu yerda ortiqcha edi. */

type ScanConsumer = (scan: DocumentScan) => boolean

let consumer: ScanConsumer | null = null

/** Ochilgan bandlov oynasi chaqiradi; qaytgan funksiya yopilishda. */
export function registerScanConsumer(handler: ScanConsumer): () => void {
  consumer = handler
  return () => {
    if (consumer === handler) consumer = null
  }
}

/** Skan iste'molchiga taklif qilinadi — olsa `true`, shunda yangi
    bandlov oynasi OCHILMAYDI. */
export function offerScan(scan: DocumentScan): boolean {
  if (!consumer) return false
  try {
    return consumer(scan)
  } catch {
    return false
  }
}
