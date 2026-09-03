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

/* ------------------------------------------------------------------ *
 * Brauzer tomonidagi jadval                                           *
 * ------------------------------------------------------------------ */

/**
 * Ba'zi ro'yxatlar serverdan TO'LIQ keladi va sahifalanmaydi — masalan
 * shaxsiy hisobot: u bitta xodimning bitta davri, ya'ni yuz qatordan
 * oshmaydi va yig'indilari allaqachon serverda hisoblangan.
 *
 * Bunday ro'yxatlar uchun qidiruv, saralash va sahifalash shu yerda,
 * brauzerda bajariladi. Ko'rinish va boshqaruv serverdan keladigan
 * jadvallar bilan bir xil qoladi — xodim bittasini o'rgansa qolganini
 * ham biladi.
 */

/** Ustun qiymatini qatordan olib beruvchi funksiya. */
export type Accessor<T> = (row: T) => string | number | null | undefined

export interface ViewOptions<T> {
  /** Qidiruv qaysi maydonlar bo'yicha ishlaydi */
  search: ReadonlyArray<Accessor<T>>
  /** Ustun nomi -> qiymat. Nomlar `SortableHead column` bilan bir xil */
  sort: Record<string, Accessor<T>>
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === ""

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "uz")
}

/** Qidiruv bo'yicha filtr — barcha berilgan maydonlar tekshiriladi. */
export function filterRows<T>(
  rows: ReadonlyArray<T>,
  search: string,
  fields: ReadonlyArray<Accessor<T>>
): T[] {
  const query = search.trim().toLowerCase()
  if (!query) return [...rows]
  return rows.filter((row) =>
    fields.some((field) => {
      const value = field(row)
      return value != null && String(value).toLowerCase().includes(query)
    })
  )
}

/** Saralash. Noma'lum ustun nomida tartib o'zgarmaydi. */
export function sortRows<T>(
  rows: ReadonlyArray<T>,
  sortBy: string,
  sortDir: SortDir,
  accessors: Record<string, Accessor<T>>
): T[] {
  const accessor = accessors[sortBy]
  if (!accessor) return [...rows]
  const sign = sortDir === "asc" ? 1 : -1
  // Barqaror tartib: teng qiymatlar dastlabki joyida qoladi
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const left = accessor(a.row)
      const right = accessor(b.row)
      // Bo'sh qiymat HAR DOIM oxirida — yo'nalishdan qat'i nazar.
      // Belgiga ko'paytirilsa u teskari tartibda ro'yxat boshini
      // egallab olardi: "xonasi yo'q" qatorlar birinchi chiqardi.
      const leftEmpty = isEmpty(left)
      const rightEmpty = isEmpty(right)
      if (leftEmpty || rightEmpty) {
        if (leftEmpty && rightEmpty) return a.index - b.index
        return leftEmpty ? 1 : -1
      }
      const result = compare(left, right)
      return result !== 0 ? result * sign : a.index - b.index
    })
    .map((item) => item.row)
}

export interface TableView<T> {
  /** Shu sahifada ko'rsatiladigan qatorlar */
  rows: T[]
  /** Qidiruvdan keyingi JAMI qatorlar (sahifalashdan oldin) */
  total: number
  pageCount: number
  /** Chegaradan chiqib ketmagan sahifa raqami */
  page: number
  label: string
}

/**
 * Qidiruv + saralash + sahifalashni bir yo'la qo'llaydi.
 *
 * Sahifa raqami shu yerda chegaraga keltiriladi: qidiruv toraysa
 * 5-sahifada turgan xodim bo'sh jadval oldida qolmasligi kerak.
 */
export function tableView<T>(
  rows: ReadonlyArray<T>,
  state: TableState,
  options: ViewOptions<T>,
  pageSize: number = PAGE_SIZE
): TableView<T> {
  const filtered = filterRows(rows, state.search, options.search)
  const sorted = sortRows(filtered, state.sortBy, state.sortDir, options.sort)
  const total = sorted.length
  const page = clampPage(state.page, total, pageSize)
  const start = page * pageSize
  const visible = sorted.slice(start, start + pageSize)
  return {
    rows: visible,
    total,
    pageCount: pageCount(total, pageSize),
    page,
    label: rangeLabel(page, visible.length, total, pageSize),
  }
}
