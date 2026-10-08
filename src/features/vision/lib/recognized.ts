import type { Sighting } from "../api/vision"

/* "Kamera tanidi" paneli va toast qoidalari (sof funksiyalar — testlangan).

   Odam kamera oldida turgan yoki qayta o'tgan har safar yangi epizod
   yoziladi. Panelda u BIR MARTA ko'rinishi kerak: server `distinct_guests`
   bilan yig'ib beradi, bu yerdagi guruhlash esa zaxira (eski server yoki
   bir vaqtda kelgan ikki javob). */

/** Panel qatori: mehmonning eng so'nggi ko'rinishi + guruhdagi barcha id */
export interface RecognizedGuest extends Sighting {
  /** Shu qatorga yig'ilgan ko'rinishlar — olib tashlashda hammasi yopiladi */
  sighting_ids: string[]
}

/** Ro'yxat eng yangisi birinchi tartibda keladi. */
export function groupSightingsByGuest(items: Sighting[]): RecognizedGuest[] {
  const byGuest = new Map<string, RecognizedGuest>()
  const out: RecognizedGuest[] = []
  for (const s of items) {
    if (!s.guest_id) continue
    const group = byGuest.get(s.guest_id)
    if (!group) {
      const row: RecognizedGuest = {
        ...s,
        sighting_count: s.sighting_count ?? 1,
        sighting_ids: [s.id],
      }
      byGuest.set(s.guest_id, row)
      out.push(row)
      continue
    }
    group.sighting_ids.push(s.id)
    group.sighting_count = (group.sighting_count ?? 1) + (s.sighting_count ?? 1)
    // Surat: guruhda surati bor kadr bo'lsa, o'shani ko'rsatamiz
    if (!group.has_thumbnail && s.has_thumbnail) {
      group.has_thumbnail = true
      group.image_sighting_id = s.image_sighting_id || s.id
    }
  }
  return out
}

/** Ko'rsatiladigan surat qaysi ko'rinishniki */
export const imageIdOf = (s: Sighting) => s.image_sighting_id || s.id

/** Birinchi so'rovda faqat yaqinda tanilganlar toast bo'ladi (sahifa
 *  ochilganda yarim soat oldingi mehmon haqida xabar bermaymiz) */
export const TOAST_FRESH_MS = 5 * 60 * 1000
/** Bir mehmon haqida qayta xabar — eng tez shu oraliqda (kamera oldida
 *  turgan odam har necha soniyada qayta tanilaveradi) */
export const TOAST_COOLDOWN_MS = 10 * 60 * 1000

/**
 * Yangi kelgan mehmonlar — toast chiqariladiganlari.
 *
 * `known` — oldingi so'rovlarda ko'rilgan ko'rinish id'lari (birinchi
 * so'rovda `null`). Yangi ko'rinish = yangi id; birinchi so'rovda esa soat
 * bo'yicha yangisi. `toasted` — mehmon → oxirgi xabar vaqti (ms).
 */
export function selectArrivals(
  items: RecognizedGuest[],
  known: Set<string> | null,
  toasted: Record<string, number>,
  now: number
): RecognizedGuest[] {
  return items.filter((s) => {
    if (!s.guest_id) return false
    // Qatorning id'si — mehmonning ENG SO'NGGI ko'rinishi: u yangi bo'lsa
    // mehmon hozirgina (qayta) tanilgan
    const fresh = known
      ? !known.has(s.id)
      : now - new Date(s.seen_at).getTime() <= TOAST_FRESH_MS
    if (!fresh) return false
    const last = toasted[s.guest_id]
    return last === undefined || now - last >= TOAST_COOLDOWN_MS
  })
}
