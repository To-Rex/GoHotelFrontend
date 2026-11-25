import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_RECEIPT_SETTINGS } from "@/features/shop/api/shop"
import { buildReservationElements, fiscalElements } from "@/lib/tprints"

// Test muhiti — Node: brauzerning localStorage va window'i yo'q
const storage = new Map<string, string>()
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
})
vi.stubGlobal("window", globalThis)

// Token serverdan olinadi (POST /fiscal/token) — testda soxta javob
const tokenPost = vi.fn(async () => ({ data: { token: "T" } }))
vi.mock("@/lib/api", () => ({ api: { post: (...args: unknown[]) => tokenPost(...(args as [])) } }))

vi.mock("../api/fiscal", () => ({
  claimReceipt: vi.fn(),
  completeReceipt: vi.fn(),
  failReceipt: vi.fn(),
  fetchFiscalConfig: vi.fn(),
  fetchPending: vi.fn(),
  fetchTargetReceipts: vi.fn(),
  prepareTarget: vi.fn(),
}))

import * as server from "../api/fiscal"
import { fiscalizeTarget, latestStamp, resetConfigCache, runFiscalQueue, useFiscalStore } from "./engine"
import {
  eposErrorText,
  eposStatus,
  fiscalActive,
  fiscalDateText,
  isDuplicate,
  isShiftClosed,
  parseResult,
  setFiscalDevice,
  type FiscalConfig,
} from "./epos"

const CFG: FiscalConfig = {
  enabled: true,
  transport: "browser",
  url: "http://localhost:8347/uzpos",
  token_set: true,
  auto_open_shift: true,
  epos_prints: false,
  company_name: "Registon Grand",
  company_inn: "308839903",
  can_configure: false,
  can_operate: true,
}
const FAST = {
  error: false,
  message: {
    terminalId: "UZ1", receiptSeq: "2478", dateTime: "20260305235115", fiscalSign: "256123",
    qrCodeURL: "https://ofd.soliq.uz/check?t=UZ1&r=2478",
  },
}
const STAMP = {
  terminal_id: "UZ1", receipt_seq: "2478", fiscal_datetime: "20260305235115", fiscal_sign: "256123",
  qr_url: "https://ofd.soliq.uz/check?t=UZ1&r=2478",
}
const receipt = (over: Record<string, unknown> = {}) => ({
  id: "r1", kind: "sale", source: "RESERVATION", number: "GH-1", title: "RES-1", amount: 100, cash_amount: 100,
  card_amount: 0, status: "pending", attempts: 0, error: null, invoice_id: "i1", reservation_id: "res1",
  shop_sale_id: null, refund_of_id: null, created_at: null, completed_at: null, ...over,
})

describe("E-POS javoblari", () => {
  it("fiskal ma'lumot uch xil shaklda keladi", () => {
    expect(parseResult(FAST)).toEqual({ ok: true, ...STAMP })
    expect(parseResult({ error: false, info: { ...FAST.message }, paycheck: "JVBER" })).toMatchObject({ ok: true, receipt_seq: "2478" })
    expect(
      parseResult({ error: false, data: { exists: true, receipt: { terminal_id: "NA1", receipt_seq: 3457, fiscal_sign: "921", date_time: "2026", qr_code_url: "q" } } })
    ).toEqual({ ok: true, terminal_id: "NA1", receipt_seq: "3457", fiscal_sign: "921", fiscal_datetime: "2026", qr_url: "q" })
    // "SUCCESS" — fiskal belgisiz javob chek emas
    expect(parseResult({ error: false, message: "SUCCESS" }).ok).toBe(false)
    expect(parseResult(null).ok).toBe(false)
  })

  it("xatolar tushunarli matnga o'giriladi", () => {
    expect(eposErrorText(" EN: cannot connect card \n Ru: Фискальный модуль не подключен")).toBe("Fiskal modul kompyuterga ulanmagan")
    expect(eposErrorText(" EN: ERROR_CURRENT_ZREPORT_IS_EMPTY \n Ru: пустой")).toContain("sotuv bo'lmagan")
    expect(eposErrorText("  Поле   маркировки\n пустое ")).toBe("Поле маркировки пустое")
    expect(parseResult({ error: true, message: "FISCAL_DRIVER_IS_NOT_WORKING" })).toEqual({ ok: false, error: "Fiskal modul drayveri ishlamayapti" })
    expect(isDuplicate("DUPLICATE_EXTERNAL_ID GH-8B4D554B20")).toBe(true)
    expect(isShiftClosed("ERROR_ZREPORT_IS_NOT_OPEN")).toBe(true)
    expect(isShiftClosed("ERROR_ZREPORT_IS_ALREADY_OPEN")).toBe(false)
    expect(fiscalDateText("20260305181816")).toBe("05.03.2026 18:18")
  })

  it("qurilma belgisi: brauzer rejimida faqat fiskal kassa yuboradi", () => {
    setFiscalDevice(false)
    expect(fiscalActive(CFG)).toBe(false)
    expect(fiscalActive({ ...CFG, transport: "server" })).toBe(true)
    setFiscalDevice(true)
    expect(fiscalActive(CFG)).toBe(true)
    expect(fiscalActive({ ...CFG, enabled: false })).toBe(false)
    expect(fiscalActive({ ...CFG, can_operate: false })).toBe(false)
    // Token kiritilmagan filial chek yubormaydi
    expect(fiscalActive({ ...CFG, token_set: false })).toBe(false)
    expect(fiscalActive(null)).toBe(false)
  })
})

describe("chekda fiskal blok", () => {
  it("soliq havolasi QR kod bo'lib chiqadi", () => {
    const els = fiscalElements({ ...STAMP, inn: "308839903" })
    expect(els.find((e) => e.type === "qr")).toEqual({ type: "qr", value: STAMP.qr_url, size: 6 })
    expect(els.some((e) => e.right === "256123")).toBe(true)
    expect(els.some((e) => e.right === "05.03.2026 23:51")).toBe(true)
    expect(els.some((e) => e.right === "308839903")).toBe(true)
    expect(fiscalElements(null)).toEqual([])
    expect(fiscalElements({ ...STAMP, fiscal_sign: "" })).toEqual([])
  })

  it("bron chekida: fiskal bo'lmasa avvalgidek, bo'lsa QR qo'shiladi", () => {
    const data = {
      reservation_number: "RES-1", check_in: "2026-11-01", check_out: "2026-11-02", total_amount: 300000, paid_amount: 300000,
    }
    const plain = buildReservationElements(data, "Hotel", DEFAULT_RECEIPT_SETTINGS)
    const fiscal = buildReservationElements(data, "Hotel", DEFAULT_RECEIPT_SETTINGS, STAMP)
    expect(plain.some((e) => e.type === "qr" && e.value === STAMP.qr_url)).toBe(false)
    expect(fiscal.some((e) => e.type === "qr" && e.value === STAMP.qr_url)).toBe(true)
    expect(fiscal.length).toBeGreaterThan(plain.length)
  })
})

describe("fiskal cheklarni yuborish", () => {
  const api = vi.mocked(server)
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    resetConfigCache()
    setFiscalDevice(true)
    useFiscalStore.getState().set({ working: false, waiting: 0, failed: [], lastError: null })
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
    api.fetchFiscalConfig.mockResolvedValue(CFG)
    api.fetchPending.mockResolvedValue({ enabled: true, targets: [], receipts: [], count: 0 })
    api.prepareTarget.mockResolvedValue([receipt()] as any)
    api.claimReceipt.mockResolvedValue({ ...receipt({ status: "sent", attempts: 1 }), request: { token: "T", method: "fastSale" }, verify: false } as any)
    api.completeReceipt.mockImplementation(async (id, stamp) => ({ ...receipt({ id, status: "done" }), ...stamp }) as any)
    api.failReceipt.mockResolvedValue(receipt({ status: "failed" }) as any)
  })

  const reply = (body: unknown) => ({ json: async () => body })
  const methods = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).method)

  it("to'lovdan keyin: tayyorlash → yuborish → natijani saqlash", async () => {
    fetchMock.mockResolvedValueOnce(reply(FAST))
    const run = await fiscalizeTarget({ source: "RESERVATION", reservation_id: "res1" })
    expect(api.prepareTarget).toHaveBeenCalledWith({ source: "RESERVATION", reservation_id: "res1" })
    // Chek so'rovida token serverdan birga kelgan — alohida so'ralmaydi
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "T", method: "fastSale" })
    expect(tokenPost).not.toHaveBeenCalled()
    expect(api.completeReceipt).toHaveBeenCalledWith("r1", STAMP)
    expect(run.errors).toEqual([])
    expect(run.done[0]).toMatchObject({ status: "done", qr_url: STAMP.qr_url })
  })

  it("fiskal modul bu qurilmada faol emas — hech narsa yuborilmaydi", async () => {
    setFiscalDevice(false)
    const run = await fiscalizeTarget({ source: "SHOP", sale_id: "s1" })
    expect(run).toEqual({ done: [], errors: [] })
    expect(api.prepareTarget).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("avval yuborilgan bo'lishi mumkin — E-POS'dan so'raladi, qayta yuborilmaydi", async () => {
    api.claimReceipt.mockResolvedValue({ ...receipt({ status: "sent", attempts: 2 }), request: { token: "T", method: "fastSale" }, verify: true } as any)
    fetchMock.mockResolvedValueOnce(
      reply({ error: false, data: { exists: true, receipt: { terminal_id: "UZ1", receipt_seq: 2478, fiscal_sign: "256123", date_time: "20260305235115", qr_code_url: STAMP.qr_url } } })
    )
    const run = await fiscalizeTarget({ source: "RESERVATION", reservation_id: "res1" })
    expect(methods()).toEqual(["checkReceiptIfExists"])
    expect(api.completeReceipt).toHaveBeenCalledWith("r1", STAMP)
    expect(run.done).toHaveLength(1)
  })

  it("E-POS «bunday chek bor» desa — o'sha chek olinadi", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ error: true, message: "DUPLICATE_EXTERNAL_ID GH-1" }))
      .mockResolvedValueOnce(reply({ error: false, data: { exists: true, receipt: { terminal_id: "UZ1", receipt_seq: "2478", fiscal_sign: "256123", date_time: "20260305235115", qr_code_url: STAMP.qr_url } } }))
    const run = await fiscalizeTarget({ source: "RESERVATION", reservation_id: "res1" })
    expect(methods()).toEqual(["fastSale", "checkReceiptIfExists"])
    expect(run.done).toHaveLength(1)
    expect(api.failReceipt).not.toHaveBeenCalled()
  })

  it("fiskal smena yopiq — o'zi ochiladi va chek qayta yuboriladi", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ error: true, message: " EN: ERROR_ZREPORT_IS_NOT_OPEN " }))
      .mockResolvedValueOnce(reply({ error: false, message: "SUCCESS" }))
      .mockResolvedValueOnce(reply(FAST))
    const run = await fiscalizeTarget({ source: "RESERVATION", reservation_id: "res1" })
    expect(methods()).toEqual(["fastSale", "openZreport", "fastSale"])
    expect(run.done).toHaveLength(1)
    // Xizmat so'rovi (smenani ochish) uchun token serverdan olinadi
    expect(tokenPost).toHaveBeenCalledWith("/fiscal/token")
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ method: "openZreport", token: "T" })
  })

  it("E-POS xatosi va aloqa yo'qligi — chek xato holatida navbatda qoladi", async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: true, message: " EN: cannot connect card " }))
    let run = await fiscalizeTarget({ source: "RESERVATION", reservation_id: "res1" })
    expect(run.errors).toEqual(["Fiskal modul kompyuterga ulanmagan"])
    expect(api.failReceipt).toHaveBeenCalledWith("r1", "Fiskal modul kompyuterga ulanmagan")
    expect(useFiscalStore.getState().lastError).toBe("Fiskal modul kompyuterga ulanmagan")

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    run = await fiscalizeTarget({ source: "RESERVATION", reservation_id: "res1" })
    expect(run.errors[0]).toContain("E-POS bilan aloqa yo'q")
    expect(api.completeReceipt).not.toHaveBeenCalled()
  })

  it("boshqa qurilma yuborayotgan chek — xato emas, o'tkazib yuboriladi", async () => {
    api.claimReceipt.mockRejectedValue({ response: { status: 409 } })
    const run = await fiscalizeTarget({ source: "RESERVATION", reservation_id: "res1" })
    expect(run).toEqual({ done: [], errors: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fon navbati: maqsadlar tayyorlanadi, tugallanmaganlar qayta yuboriladi", async () => {
    api.fetchPending.mockResolvedValue({
      enabled: true, count: 2,
      targets: [{ source: "SHOP", sale_id: "s1" }],
      receipts: [receipt({ id: "old", status: "failed", attempts: 1 })],
    } as any)
    api.prepareTarget.mockResolvedValue([receipt({ id: "new" })] as any)
    api.claimReceipt.mockImplementation(async (id) => ({ ...receipt({ id, status: "sent" }), request: { token: "T", method: "fastSale" }, verify: false }) as any)
    fetchMock.mockResolvedValue(reply(FAST))
    const run = await runFiscalQueue()
    expect(api.claimReceipt.mock.calls.map((c) => c[0])).toEqual(["old", "new"])
    expect(run.done).toHaveLength(2)
  })

  it("token faqat xotirada: bir marta olinadi, sozlama o'zgarsa qayta so'raladi", async () => {
    tokenPost.mockClear()
    fetchMock.mockResolvedValue(reply({ error: false, message: "Communicator--3.23.6" }))
    await eposStatus({ transport: "browser", url: CFG.url })
    await eposStatus({ transport: "browser", url: CFG.url })
    expect(tokenPost).toHaveBeenCalledTimes(1)
    expect(storage.size === 0 || ![...storage.values()].includes("T")).toBe(true)   // diskka yozilmaydi
    resetConfigCache()
    await eposStatus({ transport: "browser", url: CFG.url })
    expect(tokenPost).toHaveBeenCalledTimes(2)
    // Server tokenni bermasa — tushunarli xato, so'rov yuborilmaydi
    resetConfigCache()
    fetchMock.mockClear()
    tokenPost.mockRejectedValueOnce({ response: { data: { detail: "E-POS token kiritilmagan" } } })
    const status = await eposStatus({ transport: "browser", url: CFG.url })
    expect(status).toEqual({ ok: false, error: "E-POS token kiritilmagan" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("qayta chiqarishda oxirgi fiskal chek (qaytarim emas) olinadi", async () => {
    api.fetchTargetReceipts.mockResolvedValue([
      { ...receipt({ kind: "refund", status: "done" }), ...STAMP, fiscal_sign: "R" },
      { ...receipt({ kind: "sale", status: "done" }), ...STAMP },
    ] as any)
    expect(await latestStamp({ reservation_id: "res1" })).toEqual(STAMP)
    api.fetchFiscalConfig.mockResolvedValue({ ...CFG, enabled: false })
    resetConfigCache()
    expect(await latestStamp({ reservation_id: "res1" })).toBeNull()
  })
})
