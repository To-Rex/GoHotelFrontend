/**
 * Sahifalanadigan jadvalning holati: qidiruv, saralash va sahifa raqami.
 *
 * Moliya sahifasida uchta jadval bor va ularning har biri bir xil ishlashi
 * kerak — sarlavha bosilsa saralanadi, qidirilsa birinchi sahifaga
 * qaytadi. Bu qoidalarni har jadvalda qaytadan yozish o'rniga shu yerda
 * bir marta.
 */

export type SortDir = "asc" | "desc"

export interface TableState {
  search: string
  sortBy: string
  sortDir: SortDir
  /** 0 dan boshlanadi */
  page: number
}

export const PAGE_SIZE = 50

export function initialTableState(
  sortBy: string,
  sortDir: SortDir = "desc"
): TableState {
  return { search: "", sortBy, sortDir, page: 0 }
}

/**
 * Ustun sarlavhasi bosilganda.
 *
 * Boshqa ustun bosilsa — o'sha ustun bo'yicha, standart yo'nalishda.
 * O'sha ustun qayta bosilsa — yo'nalish teskarisiga o'zgaradi.
 *
 * Sahifa har doim boshiga qaytadi: 7-sahifada turib saralashni
 * o'zgartirgan odam natijaning boshini ko'rishni kutadi, o'rtasini emas.
 */
export function toggleSort(
  state: TableState,
  column: string,
  defaultDir: SortDir = "desc"
): TableState {
  if (state.sortBy === column) {
    return {
      ...state,
      sortDir: state.sortDir === "asc" ? "desc" : "asc",
      page: 0,
    }
  }
  return { ...state, sortBy: column, sortDir: defaultDir, page: 0 }
}

/** Qidiruv o'zgarsa ham birinchi sahifaga qaytiladi. */
export function setSearch(state: TableState, search: string): TableState {
  return { ...state, search, page: 0 }
}

/** Jami qatorlardan nechta sahifa chiqadi (kamida bitta). */
export function pageCount(total: number, pageSize: number = PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0 || pageSize <= 0) return 1
  return Math.ceil(total / pageSize)
}

/**
 * Sahifa raqamini chegara ichida ushlaydi.
 *
 * Kerak bo'ladigan holat: xodim oxirgi sahifada turganda davrni
 * o'zgartiradi va yozuvlar kamayib ketadi — o'shanda bo'sh sahifada
 * qolib ketmasligi kerak.
 */
export function clampPage(
  page: number,
  total: number,
  pageSize: number = PAGE_SIZE
): number {
  const last = pageCount(total, pageSize) - 1
  if (!Number.isFinite(page) || page < 0) return 0
  return Math.min(Math.trunc(page), Math.max(last, 0))
}

/**
 * "51–100 / 1240" ko'rinishidagi yozuv.
 *
 * `loaded` — shu sahifada haqiqatan kelgan qatorlar soni. Oxirgi sahifa
 * to'liq bo'lmaydi va hisoblab chiqarilgan raqam noto'g'ri chiqardi.
 */
export function rangeLabel(
  page: number,
  loaded: number,
  total: number,
  pageSize: number = PAGE_SIZE
): string {
  if (total <= 0 || loaded <= 0) return "0"
  const first = page * pageSize + 1
  const last = page * pageSize + loaded
  return `${first}–${last} / ${total}`
}

/** Serverga yuboriladigan so'rov parametrlari. */
export function queryParams(state: TableState, pageSize: number = PAGE_SIZE) {
  const search = state.search.trim()
  return {
    skip: state.page * pageSize,
    limit: pageSize,
    // Bo'sh qidiruv umuman yuborilmaydi: shunda so'rov kaliti ham,
    // serverdagi shart ham keraksiz o'zgarmaydi
    search: search || undefined,
    sort_by: state.sortBy || undefined,
    sort_dir: state.sortDir,
  }
}
