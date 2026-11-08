/* Kun/tun mavzusi: saqlash, qo'llash va ANIMATSIYALI almashtirish.

   Mavzu `html.dark` sinfi (Tailwind `dark:` varianti va index.css dagi
   CSS o'zgaruvchilari) va localStorage'dagi "theme" kaliti bilan yashaydi.
   main.tsx saqlangan tanlovni render'dan OLDIN qo'yadi — sahifa ochilishida
   "oq miltillash" bo'lmaydi; bu modul faqat ALMASHTIRISHni boshqaradi.

   Almashtirish ikki yo'l bilan animatsiya qilinadi:

   1. View Transitions API bor brauzerda (Chrome, Edge, Safari 18+) yangi
      mavzu bosilgan nuqtadan DOIRA bo'lib butun sahifani qoplaydi
      (clip-path, `::view-transition-new(root)` ustida). Brauzer eski va
      yangi holatning suratini o'zi oladi — sahifadagi birorta komponent
      bundan bexabar, hech narsa qayta chizilmaydi.
   2. Bo'lmasa (Firefox) ranglar yumshoq o'tadi: html'ga vaqtincha
      `theme-fade` sinfi qo'yiladi, CSS unda rang xususiyatlariga
      transition beradi.

   "Harakatni kamaytirish" (prefers-reduced-motion) yoqilgan bo'lsa —
   darhol, animatsiyasiz: bu foydalanuvchining aniq tanlovi. */

export type Theme = "light" | "dark"

export const THEME_KEY = "theme"
/** Doira ochilish davomiyligi (ms) */
export const REVEAL_MS = 650
/** Ranglar yumshoq o'tishi (ms) — index.css dagi `.theme-fade` bilan bir xil */
export const FADE_MS = 420

export const REVEAL_CLASS = "theme-reveal"
export const FADE_CLASS = "theme-fade"

export const nextTheme = (current: Theme): Theme => (current === "dark" ? "light" : "dark")

/** Saqlangan tanlov; yo'q yoki noma'lum qiymat — null (standart kun) */
export function readStoredTheme(storage: Pick<Storage, "getItem"> | null): Theme | null {
  try {
    const value = storage?.getItem(THEME_KEY)
    return value === "dark" || value === "light" ? value : null
  } catch {
    return null
  }
}

export function persistTheme(theme: Theme, storage: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(THEME_KEY, theme)
  } catch {
    /* localStorage yopiq — tanlov shu sessiyada qoladi */
  }
}

export const currentTheme = (root: Element): Theme =>
  root.classList.contains("dark") ? "dark" : "light"

export function applyThemeClass(theme: Theme, root: Element): void {
  root.classList.toggle("dark", theme === "dark")
}

/** Bosilgan nuqtadan ekranning eng uzoq burchagigacha masofa — doira shu
 *  radiusga yetganda butun sahifani qoplaydi */
export function revealRadius(x: number, y: number, width: number, height: number): number {
  const dx = Math.max(x, width - x)
  const dy = Math.max(y, height - y)
  return Math.ceil(Math.hypot(dx, dy))
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

export interface SwitchOrigin {
  x: number
  y: number
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>
    finished: Promise<void>
  }
}

/**
 * Mavzuni almashtiradi va natijani saqlaydi. `origin` — doira ochiladigan
 * nuqta (odatda bosilgan tugma markazi); berilmasa ekran markazi.
 * Qaytgan promise animatsiya tugaganda bajariladi.
 */
export function switchTheme(next: Theme, origin?: SwitchOrigin): Promise<void> {
  const root = document.documentElement
  const apply = () => {
    applyThemeClass(next, root)
    persistTheme(next, safeStorage())
  }

  if (prefersReducedMotion()) {
    apply()
    return Promise.resolve()
  }

  const doc = document as ViewTransitionDocument
  if (typeof doc.startViewTransition === "function") {
    const x = origin?.x ?? window.innerWidth / 2
    const y = origin?.y ?? window.innerHeight / 2
    const radius = revealRadius(x, y, window.innerWidth, window.innerHeight)
    root.classList.add(REVEAL_CLASS)
    let transition: { ready: Promise<void>; finished: Promise<void> }
    try {
      transition = doc.startViewTransition(apply)
    } catch {
      // Brauzer o'tishni boshlay olmadi (masalan, boshqa o'tish ketyapti)
      root.classList.remove(REVEAL_CLASS)
      apply()
      return Promise.resolve()
    }
    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: REVEAL_MS,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        )
      })
      .catch(() => {
        /* o'tish bekor bo'lsa mavzu baribir qo'llangan */
      })
    return transition.finished
      .catch(() => {})
      .then(() => {
        root.classList.remove(REVEAL_CLASS)
      })
  }

  // View Transitions yo'q — ranglar yumshoq o'tadi
  root.classList.add(FADE_CLASS)
  apply()
  return new Promise((resolve) => {
    window.setTimeout(() => {
      root.classList.remove(FADE_CLASS)
      resolve()
    }, FADE_MS)
  })
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
