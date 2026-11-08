/* Til almashinuvi animatsiyasi — mavzu almashinuvidagi doira (lib/theme.ts)
   bilan bir xil ko'rinish. Farqi: til almashganda sahifa QAYTA YUKLANADI
   (i18n/index.ts: modullardagi tr("...") lar import paytida hisoblanadi),
   View Transitions esa reload'ni qamrab olmaydi. Shuning uchun ikki
   bosqich, ikkalasi ham bosilgan nuqtadan:

   1) ESKI sahifada (`switchLanguageWithReveal`): sahifa fonidagi rangli
      doira bosilgan nuqtadan ochilib ekranni qoplaydi (~320 ms), nuqta
      sessionStorage'ga yoziladi, so'ng til saqlanib sahifa qayta yuklanadi.
   2) YANGI hujjatda (main.tsx, ilova render'idan OLDIN): o'sha rangdagi
      parda darhol qo'yiladi (`coverNow`) — yangi sahifa parda ortida
      chiziladi, oq miltillash bo'lmaydi. Ilova o'rnatilgach parda o'sha
      nuqtadan teshiladi (`uncover`, radial mask): yangi tildagi sahifa
      kattalashayotgan doira ichida paydo bo'ladi (~650 ms).

   "Harakatni kamaytirish" yoqilgan bo'lsa — oddiy reload, pardasiz.
   Parda hech qachon qolib ketmaydi: belgilangan nuqta 15 soniyada eskiradi,
   ochilish esa eng ko'pi bilan 4 soniyada majburan tugaydi. */

import { prefersReducedMotion, revealRadius } from "./theme"

export const LANG_REVEAL_KEY = "lang-reveal"
/** Eski sahifani qoplash davomiyligi (ms) */
export const COVER_MS = 320
/** Yangi sahifa ochilishi (ms) — mavzu doirasi bilan bir xil */
export const REVEAL_MS = 650
/** Belgilangan nuqta shundan eski bo'lsa e'tiborga olinmaydi (ms) */
export const PENDING_TTL_MS = 15_000
/** Parda majburan olib tashlanadigan muddat (ms) */
export const SAFETY_MS = 4_000

export interface RevealPoint {
  x: number
  y: number
  /** Belgilangan vaqt (Date.now) — eskirganini aniqlash uchun */
  t: number
  /** Parda rangi (landing/login sahnasi o'z rangida; bo'sh — sahifa foni) */
  c?: string
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

function sessionStore(): StorageLike | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Saqlangan nuqta — to'g'ri va eskirmagan bo'lsa. */
export function readPendingReveal(
  storage: StorageLike | null,
  now: number = Date.now()
): RevealPoint | null {
  try {
    const raw = storage?.getItem(LANG_REVEAL_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<RevealPoint>
    if (
      typeof value.x !== "number" ||
      typeof value.y !== "number" ||
      typeof value.t !== "number" ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      !Number.isFinite(value.t)
    ) {
      return null
    }
    if (now - value.t > PENDING_TTL_MS || value.t - now > PENDING_TTL_MS) return null
    const point: RevealPoint = { x: value.x, y: value.y, t: value.t }
    if (typeof value.c === "string" && value.c.length <= 40) point.c = value.c
    return point
  } catch {
    return null
  }
}

export function savePendingReveal(point: RevealPoint, storage: StorageLike | null): void {
  try {
    storage?.setItem(LANG_REVEAL_KEY, JSON.stringify(point))
  } catch {
    /* sessionStorage yopiq — yangi sahifa pardasiz ochiladi */
  }
}

export function clearPendingReveal(storage: StorageLike | null): void {
  try {
    storage?.removeItem(LANG_REVEAL_KEY)
  } catch {
    /* hech narsa */
  }
}

/** Sekinlashib tugaydigan egri (cubic ease-out): 0 → 1 */
export const easeOut = (t: number): number => {
  const k = Math.min(1, Math.max(0, t))
  return 1 - (1 - k) ** 3
}

/** Parda — sahifa fonidagi (yoki berilgan) rang, hamma narsaning ustida */
function makeCover(color?: string): HTMLDivElement {
  const el = document.createElement("div")
  el.setAttribute("data-lang-reveal", "")
  el.setAttribute("aria-hidden", "true")
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    background: color || pageBackground(),
    pointerEvents: "auto",
  } as Partial<CSSStyleDeclaration>)
  return el
}

/** Sahifa foni: mavzu o'zgaruvchisi (kun — oq, tun — qora) */
function pageBackground(): string {
  try {
    const body = getComputedStyle(document.body).backgroundColor
    if (body && body !== "rgba(0, 0, 0, 0)" && body !== "transparent") return body
  } catch {
    /* hisoblab bo'lmadi */
  }
  return "hsl(var(--background))"
}

/**
 * Eski sahifada: doira bosilgan nuqtadan ekranni qoplaydi, nuqta saqlanadi,
 * so'ng `apply` (tilni saqlab reload) chaqiriladi. `apply` reload
 * qilmasa parda o'zi yo'qoladi (SAFETY_MS). `color` — parda rangi
 * (landing/login sahnasi uchun; bo'sh — sahifa foni), u yangi hujjatga
 * ham o'tadi.
 */
export function switchLanguageWithReveal(
  apply: () => void,
  origin?: { x: number; y: number },
  color?: string
): Promise<void> {
  if (typeof document === "undefined" || prefersReducedMotion() || typeof Element.prototype.animate !== "function") {
    apply()
    return Promise.resolve()
  }
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? window.innerHeight / 2
  const radius = revealRadius(x, y, window.innerWidth, window.innerHeight)
  const cover = makeCover(color)
  cover.style.clipPath = `circle(0px at ${x}px ${y}px)`
  document.body.appendChild(cover)
  const animation = cover.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: COVER_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
  )
  const safety = window.setTimeout(() => cover.remove(), SAFETY_MS)
  return animation.finished
    .catch(() => {})
    .then(() => {
      savePendingReveal({ x, y, t: Date.now(), ...(color ? { c: color } : {}) }, sessionStore())
      apply()
      // Reload boshlanmasa (masalan, til o'sha-o'sha) parda qolib ketmasin
      window.setTimeout(() => {
        cover.remove()
        window.clearTimeout(safety)
      }, SAFETY_MS)
    })
}

export interface Cover {
  element: HTMLDivElement
  point: RevealPoint
}

/**
 * Yangi hujjatda, ilovadan OLDIN: saqlangan nuqta bo'lsa pardani darhol
 * qo'yadi va nuqtani o'chiradi (ikkinchi reload'ga ta'sir qilmasin).
 * Nuqta bo'lmasa yoki harakat kamaytirilgan bo'lsa — null.
 */
export function coverNow(): Cover | null {
  const storage = sessionStore()
  const point = readPendingReveal(storage)
  clearPendingReveal(storage)
  if (!point || prefersReducedMotion()) return null
  const element = makeCover(point.c)
  document.body.appendChild(element)
  // Ilova chizilmay qolsa ham parda abadiy turmaydi
  window.setTimeout(() => element.remove(), SAFETY_MS)
  return { element, point }
}

/**
 * Ilova o'rnatilgach: parda bosilgan nuqtadan teshilib ochiladi —
 * yangi tildagi sahifa kattalashayotgan doira ichida ko'rinadi.
 */
export function uncover(cover: Cover): Promise<void> {
  const { element, point } = cover
  const radius = revealRadius(point.x, point.y, window.innerWidth, window.innerHeight)
  return new Promise((resolve) => {
    // Ilova birinchi marta chizilib bo'lishini kutamiz (ikki kadr)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const started = performance.now()
        const frame = (now: number) => {
          const progress = easeOut((now - started) / REVEAL_MS)
          const r = Math.round(radius * progress)
          // Teshik: doira ichi shaffof, tashqarisi parda rangida
          const mask = `radial-gradient(circle at ${point.x}px ${point.y}px, transparent ${r}px, #000 ${r + 1}px)`
          element.style.maskImage = mask
          element.style.setProperty("-webkit-mask-image", mask)
          if (progress < 1) {
            requestAnimationFrame(frame)
          } else {
            element.remove()
            resolve()
          }
        }
        requestAnimationFrame(frame)
      })
    )
  })
}
