/* Yordamchi sahifasining yon panellari: suhbatlar tarixi — chapda, rejalar —
   o'ngda.

   Panellar boshida YOPIQ — chat butun kenglikni egallaydi. Sarlavhadagi
   tugma bosilganda panel siljib chiqadi:
   - joy yetsa — chat yonida turadi (chatni suradi, ustiga yopilmaydi);
   - yetmasa — chat ustidan tortma bo'lib chiqadi.
   Qaysi biri — sahifaning HAQIQIY kengligiga qarab (ekran o'lchami emas:
   chapdagi asosiy menyu yig'ilgan-yoyilgani ham hisobga kiradi). */

export const HISTORY_WIDTH = 288
export const PLANS_WIDTH = 320
/** Yon panel yonida chatga qolishi kerak bo'lgan eng kam kenglik. */
export const CHAT_MIN_WIDTH = 560
/** Tortma ko'rinishidagi eng katta kenglik (tor ekranda — ekranning 88%). */
export const HISTORY_OVERLAY_MAX = 320
export const PLANS_OVERLAY_MAX = 384

export type PanelKey = "history" | "plans"

export interface PanelDock {
  /** Suhbatlar paneli chat yonida tura oladimi */
  history: boolean
  /** Rejalar paneli chat yonida tura oladimi */
  plans: boolean
  /** Ikkalasi birga ochiq tura oladimi — aks holda biri ochilsa, ikkinchisi yopiladi */
  both: boolean
}

export function panelDock(width: number): PanelDock {
  return {
    history: width >= HISTORY_WIDTH + CHAT_MIN_WIDTH,
    plans: width >= PLANS_WIDTH + CHAT_MIN_WIDTH,
    both: width >= HISTORY_WIDTH + PLANS_WIDTH + CHAT_MIN_WIDTH,
  }
}

/** Havola orqali panelni ochish: `/assistant?panel=plans` (eslatmadagi «Rejalar»). */
export const PANEL_PARAM = "panel"

export const parsePanelParam = (v: string | null): PanelKey | null =>
  v === "history" || v === "plans" ? v : null
