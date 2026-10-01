/* Ko'p tillilik: o'zbekcha (asosiy), ruscha, inglizcha.

   Kodda matnlar O'ZBEKCHA yoziladi va tr("...") ga o'raladi — o'zbekcha
   matnning o'zi kalit:

       tr("Saqlash")
       tr("{{count}} ta xona", { count })

   O'zbek tilida tr kalitni o'zini qaytaradi (lug'at kerak emas, shuning
   uchun o'zbekcha interfeys hech qachon "tarjimasiz" qolmaydi). Rus va
   ingliz tillarida lug'atdan (locales/ru, locales/en) qidiriladi; topilmasa
   yana o'zbekcha matn chiqadi — yangi yozilgan, hali tarjima qilinmagan
   matn ekranda bo'sh joy emas, o'zbekcha ko'rinadi.

   Til almashganda sahifa qayta yuklanadi (setLang). Sabab: yorliqlarning
   ko'pi modul darajasidagi konstantalarda (STATUS_LABELS va h.k.) — ular
   import paytida bir marta hisoblanadi. Qayta yuklash hamma joyda til bir
   xil bo'lishini kafolatlaydi; til esa kamdan-kam almashtiriladi.

   Yangi matn qo'shilganda:
       npm run i18n:wrap     — o'zbekcha matnlarni tr() ga o'raydi
       npm run i18n:check    — tarjimasi yo'q kalitlarni ko'rsatadi */

import { format } from "date-fns"

export type Lang = "uz" | "ru" | "en"

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: "uz", label: "O'zbekcha", short: "UZ" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "en", label: "English", short: "EN" },
]

const STORAGE_KEY = "lang"

/** Ko'plik shakllari: "{{count}} ta xona" → 1 номер / 2 номера / 5 номеров. */
export type PluralForms = { other: string } & Partial<
  Record<"zero" | "one" | "two" | "few" | "many", string>
>
export type Dictionary = Record<string, string | PluralForms>

let lang: Lang = "uz"
let dict: Dictionary = {}
let pluralRules: Intl.PluralRules | null = null

const isLang = (v: unknown): v is Lang => v === "uz" || v === "ru" || v === "en"

/** Havoladagi `?lang=ru` — tilni shu yerning o'zida tanlaydi va eslab
 *  qoladi (landing sahifasiga aniq tilda havola berish uchun). */
function fromUrl(): Lang | null {
  try {
    const v = new URLSearchParams(window.location.search).get("lang")
    if (!isLang(v)) return null
    localStorage.setItem(STORAGE_KEY, v)
    return v
  } catch {
    return null
  }
}

function readStored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isLang(v) ? v : "uz"
  } catch {
    return "uz" // localStorage yopiq — asosiy til
  }
}

export const getLang = (): Lang => lang

/** Sana va oy nomlari uchun Intl locale. Sonlar har doim "uz-UZ" bilan
 *  formatlanadi (1 234 567) — pul yozuvi tildan qat'i nazar bir xil. */
export const dateLocale = (): string =>
  lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "uz-UZ"

/** Kalendar sarlavhasi: oy va yil. O'zbek va ingliz tilida avvalgidek
 *  date-fns yozuvi ("September 2026"), rus tilida — "Сентябрь 2026". */
export function monthYear(date: Date): string {
  if (lang !== "ru") return format(date, "MMMM yyyy")
  const month = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(date)
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`
}

/** Lug'atni o'rnatish (ilova ishga tushganda va testlarda). */
export function loadDictionary(next: Lang, dictionary: Dictionary): void {
  lang = next
  dict = dictionary
  pluralRules = next === "uz" ? null : new Intl.PluralRules(next)
}

const SLOT = /\{\{(\w+)\}\}/g

function fill(text: string, params: Record<string, unknown>): string {
  return text.replace(SLOT, (slot, name: string) => {
    if (!(name in params)) return slot
    const v = params[name]
    // JSX kabi: null/undefined/boolean ekranga chiqmaydi
    return v == null || typeof v === "boolean" ? "" : String(v)
  })
}

/** Ko'plik uchun son: `count` bo'lsa o'sha, aks holda birinchi sonli qiymat. */
function pluralCount(params?: Record<string, unknown>): number | null {
  if (!params) return null
  if (typeof params.count === "number") return params.count
  for (const v of Object.values(params)) if (typeof v === "number") return v
  return null
}

/**
 * Matnni joriy tilga o'giradi. Kalit — o'zbekcha matnning o'zi.
 * `{{nom}}` o'rinlariga `params` qiymatlari qo'yiladi.
 */
export function tr(key: string, params?: Record<string, unknown>): string {
  return render(dict[key], key, params)
}

/**
 * Kontekstli tarjima: bitta o'zbekcha so'z boshqa tilda ikki xil bo'lganda.
 *
 *     trc("login", "Kirish")    → "Войти"   (tizimga kirish tugmasi)
 *     trc("stay", "Kirish")     → "Заезд"   (mehmonning kelish sanasi)
 *
 * Lug'atda kalit `kontekst::matn`. Topilmasa oddiy tr(matn) ga tushadi;
 * o'zbek tilida matnning o'zi.
 */
export function trc(context: string, key: string, params?: Record<string, unknown>): string {
  return render(dict[`${context}::${key}`] ?? dict[key], key, params)
}

function render(
  entry: string | PluralForms | undefined,
  key: string,
  params?: Record<string, unknown>
): string {
  let text = key
  if (typeof entry === "string") {
    // Bo'sh tarjima ham haqiqiy: boshqa tilda keraksiz bo'lak ("…da boshlanadi")
    text = entry
  } else if (entry) {
    const n = pluralCount(params)
    const form = n === null || !pluralRules ? "other" : pluralRules.select(n)
    text = entry[form as keyof PluralForms] || entry.other || key
  }
  return params ? fill(text, params) : text
}

/**
 * Saqlangan tilni o'qib, lug'atini yuklaydi. Ilova modullari import
 * qilinishidan OLDIN chaqiriladi (main.tsx) — modul darajasidagi
 * tr("...") lar to'g'ri tilda hisoblanishi uchun.
 */
export async function initI18n(): Promise<void> {
  const stored = fromUrl() ?? readStored()
  try {
    document.documentElement.lang = stored
  } catch {
    /* DOM yo'q (test) */
  }
  if (stored === "uz") return
  try {
    const mod =
      stored === "ru" ? await import("./locales/ru") : await import("./locales/en")
    loadDictionary(stored, mod.default)
  } catch {
    // Lug'at yuklanmadi (tarmoq) — ilova o'zbekcha ochiladi, yiqilmaydi
    loadDictionary("uz", {})
  }
}

/** Tilni almashtirish: tanlov saqlanadi va sahifa qayta yuklanadi. */
export function setLang(next: Lang): void {
  if (next === lang) return
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* saqlab bo'lmadi — joriy seans o'zgarmaydi */
  }
  window.location.reload()
}
