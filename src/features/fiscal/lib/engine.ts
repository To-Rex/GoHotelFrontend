import { create } from "zustand"

import { tr } from "@/i18n"
import {
  claimReceipt,
  completeReceipt,
  failReceipt,
  fetchFiscalConfig,
  fetchPending,
  fetchTargetReceipts,
  prepareTarget,
  type FiscalReceipt,
  type FiscalTarget,
} from "../api/fiscal"
import {
  EposUnreachable,
  eposCall,
  eposErrorText,
  eposShift,
  fiscalActive,
  isDuplicate,
  isFiscalDevice,
  isShiftClosed,
  parseResult,
  setFiscalDevice,
  type FiscalConfig,
  type FiscalStamp,
} from "./epos"

/* Fiskal cheklarni yuborish.

   Server chekni tayyorlaydi (summa va IKPU bazadan), bu yerda u E-POS'ga
   yuboriladi va natija serverga qaytariladi. Bitta chek — bitta urinish:
   - avval yuborilgan bo'lishi mumkin bo'lsa (aloqa uzilgan urinish) —
     E-POS'dan chek raqami bo'yicha so'raladi, bor bo'lsa qayta yuborilmaydi;
   - E-POS "bunday raqamli chek bor" desa ham — o'sha chek olinadi;
   - fiskal smena yopiq bo'lsa (va avto-ochish yoqilgan bo'lsa) — ochiladi.
   To'lovning o'zi bunga bog'liq emas: pul allaqachon yozilgan, chek
   yuborilmasa navbatda qoladi va keyin qayta uriniladi.

   Hamma ish bitta navbatda ketma-ket bajariladi (shu oynada parallel
   yuborish yo'q); qurilmalar orasidagi poygani server hal qiladi. */

interface FiscalState {
  working: boolean
  /** Navbatda qolgan (yuborilmagan) cheklar soni */
  waiting: number
  failed: FiscalReceipt[]
  lastError: string | null
  set: (patch: Partial<Omit<FiscalState, "set">>) => void
}

export const useFiscalStore = create<FiscalState>((set) => ({
  working: false,
  waiting: 0,
  failed: [],
  lastError: null,
  set: (patch) => set(patch),
}))

/** "Shu kompyuterda fiskal modul bor" — qurilma belgisi (navbar tugmasi,
 *  sozlama kartasi va fon agenti bitta holatga qaraydi). */
export const useFiscalDevice = create<{ device: boolean; setDevice: (on: boolean) => void }>((set) => ({
  device: isFiscalDevice(),
  setDevice: (on) => {
    setFiscalDevice(on)
    set({ device: on })
  },
}))

let chain: Promise<unknown> = Promise.resolve()

/** Ishlarni ketma-ket bajarish (oldingisi tugagach keyingisi). */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = chain.then(job, job)
  chain = next.catch(() => undefined)
  return next
}

let cachedConfig: { at: number; cfg: FiscalConfig } | null = null

/** Sozlama (30 soniya keshlanadi — har to'lovda so'ralmasin). */
export async function loadConfig(force = false): Promise<FiscalConfig | null> {
  if (!force && cachedConfig && Date.now() - cachedConfig.at < 30_000) return cachedConfig.cfg
  try {
    const cfg = await fetchFiscalConfig()
    cachedConfig = { at: Date.now(), cfg }
    return cfg
  } catch {
    return null
  }
}

export const resetConfigCache = () => {
  cachedConfig = null
}

const stampOf = (r: Partial<FiscalStamp>): FiscalStamp | null =>
  r.fiscal_sign
    ? {
        terminal_id: r.terminal_id || "",
        receipt_seq: r.receipt_seq || "",
        fiscal_sign: r.fiscal_sign,
        fiscal_datetime: r.fiscal_datetime || "",
        qr_url: r.qr_url || "",
      }
    : null

async function findExisting(cfg: FiscalConfig, number: string): Promise<FiscalStamp | null> {
  const res = await eposCall(cfg, { method: "checkReceiptIfExists", external_id: number }, 15000)
  if (res?.error || !res?.data?.exists) return null
  const parsed = parseResult(res)
  return parsed.ok ? stampOf(parsed) : null
}

/** Bitta chekni yuborish. Natija: fiskallashgan chek yoki xato matni. */
async function sendReceipt(
  cfg: FiscalConfig,
  id: string
): Promise<{ receipt: FiscalReceipt | null; error?: string }> {
  let claimed
  try {
    claimed = await claimReceipt(id)
  } catch (e: any) {
    // Boshqa qurilma yuboryapti — bu xato emas, navbat keyingi safar ko'radi
    if (e?.response?.status === 409) return { receipt: null }
    return { receipt: null, error: e?.response?.data?.detail || tr("Serverga ulanib bo'lmadi") }
  }
  if (!claimed.request) return { receipt: claimed }

  try {
    if (claimed.verify) {
      const existing = await findExisting(cfg, claimed.number)
      if (existing) return { receipt: await completeReceipt(id, existing) }
    }
    let response = await eposCall(cfg, claimed.request)
    if (response?.error && isShiftClosed(response.message) && cfg.auto_open_shift) {
      const opened = await eposShift(cfg, "open")
      if (opened.ok) response = await eposCall(cfg, claimed.request)
    }
    if (response?.error && isDuplicate(response.message)) {
      const existing = await findExisting(cfg, claimed.number)
      if (existing) return { receipt: await completeReceipt(id, existing) }
    }
    const parsed = parseResult(response)
    if (parsed.ok) return { receipt: await completeReceipt(id, stampOf(parsed)!) }
    await failReceipt(id, parsed.error).catch(() => undefined)
    return { receipt: null, error: parsed.error }
  } catch (e) {
    const error =
      e instanceof EposUnreachable ? e.message : eposErrorText(e instanceof Error ? e.message : e)
    await failReceipt(id, error).catch(() => undefined)
    return { receipt: null, error }
  }
}

export interface FiscalRun {
  /** Shu yurishda fiskallashgan cheklar */
  done: FiscalReceipt[]
  errors: string[]
}

const belongs = (r: FiscalReceipt, t: FiscalTarget) =>
  t.source === "SHOP"
    ? !!t.sale_id && r.shop_sale_id === t.sale_id
    : r.source === "RESERVATION" &&
      ((!!t.reservation_id && r.reservation_id === t.reservation_id) ||
        (!!t.invoice_id && r.invoice_id === t.invoice_id))

async function refreshState() {
  try {
    const pending = await fetchPending()
    useFiscalStore.getState().set({
      waiting: pending.count,
      failed: pending.receipts.filter((r) => r.status === "failed"),
    })
  } catch {
    // holatni yangilab bo'lmadi — keyingi safar
  }
}

/**
 * Bitta bron yoki sotuvning to'lovlarini fiskallashtirish (to'lovdan keyin).
 * Fiskal modul bu qurilmada faol bo'lmasa — hech narsa qilmaydi.
 */
export function fiscalizeTarget(target: FiscalTarget): Promise<FiscalRun> {
  return enqueue(async () => {
    const run: FiscalRun = { done: [], errors: [] }
    const cfg = await loadConfig()
    if (!fiscalActive(cfg)) return run
    const store = useFiscalStore.getState()
    store.set({ working: true })
    try {
      const prepared = await prepareTarget(target).catch(() => [] as FiscalReceipt[])
      // Shu maqsadning oldingi tugallanmagan cheklari ham (qayta urinish)
      const pending = await fetchPending().catch(() => null)
      const queue = new Map<string, FiscalReceipt>()
      for (const r of prepared) if (r.status === "pending") queue.set(r.id, r)
      for (const r of pending?.receipts ?? []) if (belongs(r, target)) queue.set(r.id, r)
      for (const r of queue.values()) {
        const result = await sendReceipt(cfg, r.id)
        if (result.receipt?.status === "done") run.done.push(result.receipt)
        else if (result.error) run.errors.push(result.error)
      }
      store.set({ lastError: run.errors[0] ?? null })
    } finally {
      store.set({ working: false })
      void refreshState()
    }
    return run
  })
}

/** Butun navbatni yuborish (fon agenti va "Qayta urinish"). */
export function runFiscalQueue(): Promise<FiscalRun> {
  return enqueue(async () => {
    const run: FiscalRun = { done: [], errors: [] }
    const cfg = await loadConfig()
    if (!fiscalActive(cfg)) return run
    const store = useFiscalStore.getState()
    let pending
    try {
      pending = await fetchPending()
    } catch {
      return run
    }
    if (!pending.enabled || pending.count === 0) {
      store.set({ waiting: 0, failed: [] })
      return run
    }
    store.set({ working: true })
    try {
      const ids = new Set(pending.receipts.map((r) => r.id))
      for (const target of pending.targets) {
        const prepared = await prepareTarget(target).catch(() => [] as FiscalReceipt[])
        for (const r of prepared) if (r.status === "pending") ids.add(r.id)
      }
      for (const id of ids) {
        const result = await sendReceipt(cfg, id)
        if (result.receipt?.status === "done") run.done.push(result.receipt)
        else if (result.error) {
          run.errors.push(result.error)
          // E-POS'ning o'zi ishlamayapti — qolganlarini urinish foydasiz
          if (/aloqa yo'q|ulanib bo'lmadi/i.test(result.error)) break
        }
      }
      store.set({ lastError: run.errors[0] ?? null })
    } finally {
      store.set({ working: false })
      await refreshState()
    }
    return run
  })
}

/** Chekni qayta chiqarishda QR uchun: bron/sotuvning eng oxirgi fiskal ma'lumoti. */
export async function latestStamp(target: {
  reservation_id?: string
  sale_id?: string
}): Promise<FiscalStamp | null> {
  const cfg = await loadConfig()
  if (!cfg?.enabled) return null
  try {
    const items = await fetchTargetReceipts(target)
    const sale = items.find((r) => r.kind !== "refund") ?? items[0]
    return sale ? stampOf(sale) : null
  } catch {
    return null
  }
}

export { stampOf }
