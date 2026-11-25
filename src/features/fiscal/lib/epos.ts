import { api } from "@/lib/api"
import { tr } from "@/i18n"

/* E-POS Communicator bilan aloqa (fiskal modul).

   Communicator kassa kompyuterida ishlaydi (odatda http://localhost:8347/uzpos)
   va unga fiskal modul USB orqali ulangan. Ikki xil ulanish:
   - "browser" — so'rov shu kompyuterning brauzeridan to'g'ridan-to'g'ri
     ketadi (TPrints chek printeri kabi). Faqat fiskal modul ulangan
     kompyuterda ishlaydi — shuning uchun qurilma alohida belgilanadi
     (`isFiscalDevice`).
   - "server" — so'rovni backend yuboradi (manzil internetdan ko'rinadigan
     bo'lsa, masalan E-POS sinov muhiti). Istalgan qurilmadan ishlaydi.

   TOKEN har kompaniya/filialniki va bazada shifrlangan. "Server" rejimida u
   brauzerga umuman kelmaydi. "Brauzer" rejimida so'rovni brauzer yuborgani
   uchun token kerak bo'ladi: u serverdan faqat kassirga, faqat kerak paytda
   olinadi va faqat XOTIRADA turadi (localStorage'ga yozilmaydi). */

export interface FiscalConfig {
  enabled: boolean
  transport: "browser" | "server"
  url: string
  /** Filialga E-POS tokeni kiritilganmi (tokenning o'zi bu yerda kelmaydi) */
  token_set: boolean
  auto_open_shift: boolean
  epos_prints: boolean
  company_name: string
  company_inn: string
  can_configure: boolean
  can_operate: boolean
}

export interface FiscalStamp {
  terminal_id: string
  receipt_seq: string
  fiscal_sign: string
  fiscal_datetime: string
  qr_url: string
}

export type ParsedResult =
  | ({ ok: true } & FiscalStamp)
  | { ok: false; error: string }

const DEVICE_KEY = "fiscal_device"

/** Shu kompyuterda fiskal modul (E-POS Communicator) bormi — qurilma sozlamasi. */
export const isFiscalDevice = (): boolean => {
  try {
    return localStorage.getItem(DEVICE_KEY) === "1"
  } catch {
    return false
  }
}

export const setFiscalDevice = (on: boolean) => {
  try {
    localStorage.setItem(DEVICE_KEY, on ? "1" : "0")
  } catch {
    // saqlab bo'lmasa — faqat shu sessiyada
  }
}

/** Shu qurilma fiskal cheklarni yubora oladimi. */
export const fiscalActive = (cfg: FiscalConfig | null | undefined): cfg is FiscalConfig =>
  !!cfg &&
  cfg.enabled &&
  cfg.token_set &&
  cfg.can_operate &&
  (cfg.transport === "server" || isFiscalDevice())

export class EposUnreachable extends Error {}

/** E-POS manzili. `token` — faqat sozlama oynasida hali saqlanmagan tokenni
 *  sinash uchun; odatda berilmaydi va serverdan olinadi. */
export type EposTarget = Pick<FiscalConfig, "transport" | "url"> & { token?: string }

const TOKEN_TTL_MS = 5 * 60_000
let cachedToken: { at: number; value: string } | null = null

/** Token keshini tozalash (sozlama o'zgarganda). */
export const resetTokenCache = () => {
  cachedToken = null
}

/** Token — serverdan, faqat xotirada (5 daqiqa). Diskka yozilmaydi. */
async function loadToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < TOKEN_TTL_MS) return cachedToken.value
  try {
    const { data } = await api.post<{ token: string }>("/fiscal/token")
    cachedToken = { at: Date.now(), value: data.token }
    return data.token
  } catch (e: any) {
    throw new EposUnreachable(e?.response?.data?.detail || tr("E-POS tokenini olib bo'lmadi"))
  }
}

/** E-POS'ga bitta so'rov. Aloqa bo'lmasa — `EposUnreachable`. */
export async function eposCall(
  cfg: EposTarget,
  body: Record<string, unknown>,
  timeoutMs = 45000
): Promise<any> {
  if (cfg.transport === "server") {
    try {
      const { data } = await api.post("/fiscal/relay", body, { timeout: timeoutMs })
      return data
    } catch (e: any) {
      throw new EposUnreachable(
        e?.response?.data?.detail || tr("E-POS serveriga ulanib bo'lmadi")
      )
    }
  }
  // Chek so'rovida token serverdan birga keladi; xizmat so'rovlari uchun olinadi
  const token = (typeof body.token === "string" && body.token) || cfg.token || (await loadToken())
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token }),
      signal: ctrl.signal,
    })
    return await res.json()
  } catch {
    throw new EposUnreachable(
      tr("E-POS bilan aloqa yo'q — shu kompyuterda E-POS Communicator ishlab turganini tekshiring")
    )
  } finally {
    window.clearTimeout(timer)
  }
}

/* E-POS xabarlari ikki tilda keladi (" EN: ... \n Ru: ..."). Tanish kodlar
   o'zbekchaga o'giriladi, qolgani — bir qatorga keltirilgan asl matn. */
// i18n:keys
const KNOWN_ERRORS: Array<[RegExp, string]> = [
  [/cannot connect card/i, "Fiskal modul kompyuterga ulanmagan"],
  [/ZREPORT_IS_ALREADY_OPEN/i, "Fiskal smena allaqachon ochiq"],
  [/CURRENT_ZREPORT_IS_EMPTY/i, "Fiskal smenada sotuv bo'lmagan — yopib bo'lmaydi"],
  [/CASH_REGISTERER_NUMBER_NOT_AVAILABLE/i, "Kassa raqami mavjud emas — E-POS xizmatida qarzdorlik bo'lishi mumkin"],
  [/FISCAL_DRIVER_IS_NOT_WORKING|Fiscal Drive API/i, "Fiskal modul drayveri ishlamayapti"],
  [/ZREPORT.*(NOT_OPEN|IS_NOT_OPEN|CLOSED)|OPEN_ZREPORT/i, "Fiskal smena ochilmagan"],
  [/ZREPORT.*(EXPIRED|24)/i, "Fiskal smena 24 soatdan oshgan — yopib, qayta oching"],
]

export function eposErrorText(message: unknown): string {
  const text = String(message ?? "").replace(/\s+/g, " ").trim()
  for (const [pattern, label] of KNOWN_ERRORS) if (pattern.test(text)) return tr(label)
  return text || tr("E-POS xatosi")
}

export const isDuplicate = (message: unknown): boolean => /DUPLICATE_EXTERNAL_ID/i.test(String(message ?? ""))
export const isShiftClosed = (message: unknown): boolean =>
  /ZREPORT.*(NOT_OPEN|IS_NOT_OPEN|CLOSED)|OPEN_ZREPORT/i.test(String(message ?? ""))

/** E-POS javobi → fiskal ma'lumot. `sale` da `info`, `fastSale` da `message`,
 *  tekshiruvda `data.receipt` (snake_case) ichida keladi. */
export function parseResult(body: any): ParsedResult {
  if (!body || typeof body !== "object") return { ok: false, error: tr("E-POS javobi tushunarsiz") }
  if (body.error) return { ok: false, error: eposErrorText(body.message) }
  const info =
    (body.info && typeof body.info === "object" && body.info) ||
    (body.message && typeof body.message === "object" && body.message) ||
    (body.data?.receipt && typeof body.data.receipt === "object" && body.data.receipt) ||
    {}
  const get = (...names: string[]) => {
    for (const n of names) if (info[n] !== undefined && info[n] !== null && info[n] !== "") return String(info[n])
    return ""
  }
  const stamp: FiscalStamp = {
    terminal_id: get("terminalId", "terminal_id"),
    receipt_seq: get("receiptSeq", "receipt_seq"),
    fiscal_sign: get("fiscalSign", "fiscal_sign"),
    fiscal_datetime: get("dateTime", "date_time"),
    qr_url: get("qrCodeURL", "qr_code_url"),
  }
  if (!stamp.fiscal_sign) return { ok: false, error: tr("E-POS javobida fiskal belgi yo'q") }
  return { ok: true, ...stamp }
}

/** "20260305181816" → "05.03.2026 18:18" (fiskal modul vaqti — o'zgartirilmaydi). */
export function fiscalDateText(value: string | null | undefined): string {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(String(value ?? ""))
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : String(value ?? "")
}

/* --- Xizmat so'rovlari: holat va fiskal smena (Z-hisobot) --- */

export interface EposStatus {
  ok: boolean
  version?: string
  shiftOpen?: boolean
  error?: string
}

export async function eposStatus(cfg: EposTarget): Promise<EposStatus> {
  try {
    const version = await eposCall(cfg, { method: "getVersion" }, 8000)
    if (version?.error) return { ok: false, error: eposErrorText(version.message) }
    const shift = await eposCall(cfg, { method: "getZReportsStatus" }, 8000)
    return {
      ok: true,
      version: typeof version?.message === "string" ? version.message : undefined,
      shiftOpen: shift?.error ? undefined : !!shift?.message?.isOpen,
      error: shift?.error ? eposErrorText(shift.message) : undefined,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : tr("E-POS bilan aloqa yo'q") }
  }
}

export async function eposShift(
  cfg: EposTarget,
  action: "open" | "close"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await eposCall(cfg, { method: action === "open" ? "openZreport" : "closeZreport" }, 60000)
    if (res?.error) {
      // "Allaqachon ochiq" — ochish uchun xato emas
      if (action === "open" && /ALREADY_OPEN/i.test(String(res.message))) return { ok: true }
      return { ok: false, error: eposErrorText(res.message) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : tr("E-POS bilan aloqa yo'q") }
  }
}

/** IKPU kodi uchun o'ram (o'lchov birligi) kodlari — E-POS'dan. Noto'g'ri
 *  juftlikni E-POS chek yuborishda rad etadi, shuning uchun ro'yxatdan tanlanadi. */
export async function eposPackages(
  cfg: EposTarget,
  classCode: string
): Promise<{ ok: boolean; items: { code: string; name: string }[]; error?: string }> {
  try {
    const res = await eposCall(cfg, { method: "getICPCPackage", classCode }, 20000)
    if (res?.error) return { ok: false, items: [], error: eposErrorText(res.message) }
    const items = Array.isArray(res?.packages)
      ? res.packages.map((p: any) => ({ code: String(p.code ?? ""), name: String(p.nameLat ?? p.nameUz ?? p.name ?? "") }))
      : []
    return { ok: true, items: items.filter((p: { code: string }) => p.code) }
  } catch (e) {
    return { ok: false, items: [], error: e instanceof Error ? e.message : tr("E-POS bilan aloqa yo'q") }
  }
}
