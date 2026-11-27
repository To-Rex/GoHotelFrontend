import { create } from "zustand"

/* E-mehmon oynalarining holati — bitta joyda: oynani navbar tugmasi, bron
   oynasidagi tugma va kirishdan keyingi eslatma ochadi, o'zi esa
   `EmehmonAgent` ichida (MainLayout'da bitta) chiziladi. */

interface EmehmonUi {
  /** Ochiq bron varag'i (yo'q bo'lsa `null`) */
  reservationId: string | null
  /** Shu mehmonning shakli darhol ochilsin */
  focusGuestId: string | null
  journalOpen: boolean
  /** Kirish rasmiylashtirilgan bron — pastda eslatma chiqadi */
  prompt: string | null
  /** Eslatma qo'yilgan payt (ms) — navbat shundan KEYIN o'qilgandagina yopiladi */
  promptAt: number
  openReservation: (reservationId: string, guestId?: string | null) => void
  closeReservation: () => void
  setJournalOpen: (open: boolean) => void
  setPrompt: (reservationId: string | null) => void
}

export const useEmehmonUi = create<EmehmonUi>((set) => ({
  reservationId: null,
  focusGuestId: null,
  journalOpen: false,
  prompt: null,
  promptAt: 0,
  openReservation: (reservationId, guestId = null) =>
    set({ reservationId, focusGuestId: guestId, prompt: null }),
  closeReservation: () => set({ reservationId: null, focusGuestId: null }),
  setJournalOpen: (journalOpen) => set({ journalOpen }),
  setPrompt: (prompt) => set({ prompt, promptAt: prompt ? Date.now() : 0 }),
}))

/** Kirish so'rovi javobi kelgan zahoti server hali yozuvni yakunlamagan
 *  bo'lishi mumkin — shu vaqt ichida o'qilgan navbatga ishonilmaydi */
export const PROMPT_SETTLE_MS = 2000

/** Eslatma hali kerakmi: navbat eslatmadan KEYIN o'qilgan va unda shu
 *  bronning ro'yxatga olinmagan mehmoni qolmagan bo'lsa — kerak emas. */
export function promptResolved(
  prompt: string | null,
  promptAt: number,
  pendingAt: number,
  reservationIds: string[] | undefined
): boolean {
  if (!prompt || !reservationIds) return false
  return pendingAt > promptAt + PROMPT_SETTLE_MS && !reservationIds.includes(prompt)
}

/** `/reservations/<id>/check-in` so'rovidan bron identifikatori. */
export function checkedInReservationId(method: string | undefined, url: string | undefined): string | null {
  if ((method || "").toLowerCase() !== "post") return null
  const match = /\/reservations\/([0-9a-f-]{36})\/check-in(?:[/?#]|$)/i.exec(url || "")
  return match ? match[1] : null
}

/** Mehmonlar tarkibi yoki holati o'zgaradigan so'rovmi — navbat qayta o'qiladi. */
export function touchesStay(method: string | undefined, url: string | undefined): boolean {
  const verb = (method || "get").toLowerCase()
  if (verb === "get") return false
  const path = url || ""
  if (path.includes("/emehmon/")) return false
  return /\/(reservations|check-?out|companions|housekeeping)/i.test(path)
}
