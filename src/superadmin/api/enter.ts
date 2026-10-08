/**
 * Paneldan mehmonxonaga "kirish" — asosiy tizimni sozlovchi huquqida ochish.
 *
 * Server (`POST /superadmin/hotels/{id}/enter`) panel foydalanuvchisining
 * yashirin sozlovchi hisobi nomidan token juftligi beradi. Panel va asosiy
 * tizim bitta domen — asosiy tizim o'z sessiyasini `localStorage` dan
 * o'qiydi, shuning uchun tokenlar va profil shu yerga yoziladi va yangi
 * oynada kerakli sahifa ochiladi. Shu brauzerda ochiq turgan mehmonxona
 * sessiyasi (bo'lsa) shu bilan almashadi.
 */

export interface EnterResult {
  access_token: string
  refresh_token: string
  user: Record<string, unknown>
  hotel: { id: string; name: string; code: string | null }
}

export const MAIN_APP_TOKEN_KEY = "accessToken"
export const MAIN_APP_REFRESH_KEY = "refreshToken"
export const MAIN_APP_AUTH_KEY = "auth-storage"

/** Asosiy tizim sessiyasini brauzer xotirasiga yozadi (store/auth.ts shakli). */
export function seedMainAppSession(storage: Storage, result: EnterResult): void {
  storage.setItem(MAIN_APP_TOKEN_KEY, result.access_token)
  storage.setItem(MAIN_APP_REFRESH_KEY, result.refresh_token)
  storage.setItem(
    MAIN_APP_AUTH_KEY,
    JSON.stringify({ state: { user: result.user, isAuthenticated: true }, version: 0 })
  )
}

/** Ochiladigan sahifa: faqat ilova ichidagi yo'l (tashqi manzil emas). */
export function safeEntryPath(path?: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/start"
  return path
}

export function enterMainApp(result: EnterResult, path?: string | null): void {
  seedMainAppSession(window.localStorage, result)
  window.open(safeEntryPath(path), "_blank", "noopener")
}
