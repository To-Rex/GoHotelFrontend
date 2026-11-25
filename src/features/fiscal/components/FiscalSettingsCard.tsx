import { useEffect, useState, type ReactNode } from "react"
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, PlugZap, ReceiptText, RotateCcw, XCircle } from "lucide-react"

import { tr } from "@/i18n"
import { apiErrorMessage } from "@/lib/apiError"
import { PAYMENT_METHODS } from "@/lib/paymentMethods"
import { cn } from "@/lib/utils"

import {
  dismissReceipt,
  useFiscalReceipts,
  useFiscalSettings,
  useSaveFiscalSettings,
  type FiscalItemKind,
  type FiscalReceipt,
  type FiscalSettings,
} from "../api/fiscal"
import { resetConfigCache, runFiscalQueue, useFiscalDevice, useFiscalStore } from "../lib/engine"
import { eposStatus, fiscalDateText, type EposStatus } from "../lib/epos"
import { PackageField } from "./PackageField"

/* Sozlamalar → "Fiskal modul (E-POS)" — joriy FILIAL uchun.

   Ixtiyoriy: yoqilmagan filialda tizim avvalgidek ishlaydi. Yoqilgach
   shu paytdan keyingi har bir to'lov fiskal chekka kiradi va bosma chekda
   soliq havolasi QR kod bo'lib chiqadi. Faqat sozlovchi o'zgartiradi. */

const FIELD =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-500 disabled:bg-gray-50"

// i18n:keys
const KIND_HINTS: Record<FiscalItemKind, string> = {
  room: "Xona haqi (majburiy)",
  service: "Bronga yozilgan xizmatlar",
  penalty: "Jarimalar",
  shop: "Do'kon — o'z kodi yo'q mahsulotlar",
}
const KINDS: FiscalItemKind[] = ["room", "service", "penalty", "shop"]

type ReceiptStatus = FiscalReceipt["status"]
type ReceiptKind = FiscalReceipt["kind"]

// i18n:keys
const STATUS_LABEL: Record<ReceiptStatus, string> = {
  pending: "Navbatda",
  sent: "Yuborilmoqda",
  done: "Fiskallashgan",
  failed: "Xato",
  skipped: "O'tkazib yuborilgan",
}
const STATUS_TONE: Record<ReceiptStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  sent: "bg-sky-50 text-sky-700",
  done: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-gray-100 text-gray-600",
}
// i18n:keys
const KIND_LABEL: Record<ReceiptKind, string> = {
  sale: "Sotuv",
  advance: "Avans",
  refund: "Qaytarim",
}

type Form = Omit<FiscalSettings, "problems" | "default_url" | "enabled_at" | "token_set" | "token_hint">

const toForm = (s: FiscalSettings): Form => ({
  enabled: s.enabled,
  transport: s.transport,
  url: s.url,
  company_name: s.company_name,
  company_address: s.company_address,
  company_inn: s.company_inn,
  company_phone: s.company_phone,
  printer_size: s.printer_size,
  vat_percent: s.vat_percent,
  items: s.items,
  methods: s.methods,
  prepayment_as_advance: s.prepayment_as_advance,
  auto_open_shift: s.auto_open_shift,
  epos_prints: s.epos_prints,
})

export function FiscalSettingsCard() {
  const { data, isLoading } = useFiscalSettings()
  const save = useSaveFiscalSettings()
  const { device, setDevice } = useFiscalDevice()
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<EposStatus | null>(null)
  const [testing, setTesting] = useState(false)
  // Token faqat YOZILADI: saqlangani serverdan qaytmaydi (faqat oxirgi 4 belgisi)
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    if (data) setForm(toForm(data))
  }, [data])

  const patch = (p: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...p } : f))
    setSaved(false)
  }
  const patchItem = (kind: FiscalItemKind, p: Partial<Form["items"][FiscalItemKind]>) =>
    setForm((f) => (f ? { ...f, items: { ...f.items, [kind]: { ...f.items[kind], ...p } } } : f))

  const submit = async (override?: Partial<Form>) => {
    if (!form) return false
    setError(null)
    setSaved(false)
    try {
      const next = await save.mutateAsync({
        ...form,
        ...override,
        ...(token.trim() ? { token: token.trim() } : {}),
      })
      setForm(toForm(next))
      setToken("")
      setShowToken(false)
      resetConfigCache()
      setSaved(true)
      return true
    } catch (e) {
      setError(apiErrorMessage(e))
      if (override?.enabled !== undefined) setForm((f) => (f ? { ...f, enabled: !override.enabled } : f))
      return false
    }
  }

  const test = async () => {
    if (!form || !data) return
    setTesting(true)
    setStatus(null)
    // Avval saqlanadi: token va manzil serverda — sinov aynan saqlangan sozlama bilan
    if (!(await submit())) {
      setTesting(false)
      return
    }
    setStatus(await eposStatus({ transport: form.transport, url: form.url }))
    setTesting(false)
  }

  return (
    <section id="fiscal-epos" className="scroll-mt-4 overflow-hidden rounded-2xl border bg-white">
      <div className="flex items-start gap-3 border-b bg-gray-50/70 px-5 py-4">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <ReceiptText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900">{tr("Fiskal modul (E-POS)")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            {tr("Yoqilsa, shu filialdagi har bir to'lov E-POS fiskal moduli orqali soliqqa yuboriladi va chekda soliq havolasi QR kod bo'lib chiqadi. Yoqilmasa — hamma narsa avvalgidek ishlaydi. Sozlama faqat shu filial uchun.")}
          </p>
        </div>
        <label className="flex flex-shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={!!form?.enabled}
            disabled={!form || save.isPending}
            onChange={(e) => {
              patch({ enabled: e.target.checked })
              void submit({ enabled: e.target.checked })
            }}
          />
          {form?.enabled ? tr("Yoqilgan") : tr("O'chirilgan")}
        </label>
      </div>

      {isLoading || !form || !data ? (
        <p className="p-5 text-sm text-gray-400">{tr("Yuklanmoqda...")}</p>
      ) : (
        <div className="space-y-6 p-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!form.enabled && data.problems.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">{tr("Yoqish uchun to'ldirilishi kerak:")}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {data.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <Block title={tr("Ulanish")} hint={tr("E-POS Communicator kassa kompyuterida ishlaydi va fiskal modul unga USB orqali ulangan.")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={tr("Ulanish usuli")}>
                <select
                  className={FIELD}
                  value={form.transport}
                  onChange={(e) => patch({ transport: e.target.value as Form["transport"] })}
                >
                  <option value="browser">{tr("Brauzerdan — kassa kompyuteridagi E-POS")}</option>
                  <option value="server">{tr("Server orqali — internetdagi manzil")}</option>
                </select>
              </Labeled>
              <Labeled label={tr("E-POS manzili")}>
                <input
                  className={cn(FIELD, "font-mono text-xs")}
                  value={form.url}
                  onChange={(e) => patch({ url: e.target.value })}
                  placeholder={data.default_url}
                />
              </Labeled>
            </div>
            <div className="mt-3">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <KeyRound className="h-3.5 w-3.5" />
                {tr("E-POS token")}
                {data.token_set && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
                    {tr("saqlangan: ••••{{hint}}", { hint: data.token_hint })}
                  </span>
                )}
              </span>
              <div className="flex gap-1">
                <input
                  className={cn(FIELD, "font-mono text-xs")}
                  type={showToken ? "text" : "password"}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value)
                    setSaved(false)
                  }}
                  placeholder={
                    data.token_set
                      ? tr("Almashtirish uchun yangi tokenni kiriting")
                      : tr("E-POS bergan tokenni kiriting")
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowToken((x) => !x)}
                  title={showToken ? tr("Yashirish") : tr("Ko'rsatish")}
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {tr("Tokenni E-POS beradi — har kompaniya va filialda o'ziniki. Bazada shifrlangan holda saqlanadi va bu yerda qayta ko'rsatilmaydi (faqat oxirgi 4 belgisi).")}
              </p>
            </div>
            {form.transport === "browser" && (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={device}
                  onChange={(e) => setDevice(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-gray-800">{tr("Shu kompyuterda fiskal modul bor")}</span>
                  <span className="block text-xs leading-relaxed text-gray-500">
                    {tr("Bu belgi har bir kompyuterda alohida saqlanadi: fiskal cheklarni faqat belgilangan kassa kompyuteri yuboradi. Boshqa qurilmalarda (telefon, boshqa kompyuter) olingan to'lovlar navbatga tushadi va shu kassadan yuboriladi.")}
                  </span>
                </span>
              </label>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={test}
                disabled={testing}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                {tr("Ulanishni tekshirish")}
              </button>
              {status &&
                (status.ok ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {[status.version, status.shiftOpen === undefined ? null : status.shiftOpen ? tr("fiskal smena ochiq") : tr("fiskal smena yopiq")]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : (
                  <span className="inline-flex items-start gap-1.5 text-sm text-red-700">
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    {status.error}
                  </span>
                ))}
            </div>
          </Block>

          <Block title={tr("Kompaniya")} hint={tr("Chek sarlavhasida chiqadi — soliq talabi.")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={tr("Kompaniya nomi")}>
                <input className={FIELD} value={form.company_name} onChange={(e) => patch({ company_name: e.target.value })} placeholder="“Registon Grand” MCHJ" />
              </Labeled>
              <Labeled label={tr("STIR (INN)")}>
                <input
                  className={cn(FIELD, "font-mono")}
                  inputMode="numeric"
                  value={form.company_inn}
                  onChange={(e) => patch({ company_inn: e.target.value.replace(/\D/g, "").slice(0, 14) })}
                  placeholder="308839903"
                />
              </Labeled>
              <Labeled label={tr("Manzil")}>
                <input className={FIELD} value={form.company_address} onChange={(e) => patch({ company_address: e.target.value })} />
              </Labeled>
              <Labeled label={tr("Telefon (ixtiyoriy)")}>
                <input className={FIELD} value={form.company_phone} onChange={(e) => patch({ company_phone: e.target.value })} placeholder="+998" />
              </Labeled>
            </div>
          </Block>

          <Block
            title={tr("IKPU kodlari")}
            hint={tr("Kodlar tasnif.soliq.uz saytidan olinadi: IKPU — 17 xonali, yonida o'ram (o'lchov birligi) kodi. Bo'sh qoldirilgan tur uchun xona haqi kodi ishlatiladi. Do'kon mahsulotiga o'z kodi mahsulot oynasida kiritiladi.")}
          >
            <div className="space-y-2">
              {KINDS.map((kind) => (
                <div key={kind} className="grid gap-2 rounded-lg border border-gray-100 p-2.5 sm:grid-cols-[minmax(0,1.3fr)_11rem_10rem]">
                  <Labeled label={tr(KIND_HINTS[kind])}>
                    <input className={FIELD} value={form.items[kind].name} onChange={(e) => patchItem(kind, { name: e.target.value })} />
                  </Labeled>
                  <Labeled label={tr("IKPU kodi")}>
                    <input
                      className={cn(FIELD, "font-mono text-xs")}
                      inputMode="numeric"
                      value={form.items[kind].class_code}
                      onChange={(e) => patchItem(kind, { class_code: e.target.value.replace(/\D/g, "").slice(0, 17) })}
                      placeholder="17 xonali"
                    />
                  </Labeled>
                  <div>
                    <span className="mb-1 block text-xs font-medium text-gray-600">{tr("O'ram kodi")}</span>
                    <PackageField
                      className={cn(FIELD, "font-mono text-xs")}
                      classCode={form.items[kind].class_code}
                      value={form.items[kind].package_code}
                      onChange={(code) => patchItem(kind, { package_code: code })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Block>

          <Block title={tr("Soliq va to'lov usullari")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={tr("QQS stavkasi")}>
                <select className={FIELD} value={form.vat_percent} onChange={(e) => patch({ vat_percent: Number(e.target.value) })}>
                  <option value={0}>{tr("QQSsiz (0%)")}</option>
                  <option value={12}>12%</option>
                </select>
              </Labeled>
              <Labeled label={tr("Chek qog'ozi kengligi")}>
                <select className={FIELD} value={form.printer_size} onChange={(e) => patch({ printer_size: Number(e.target.value) })}>
                  <option value={80}>80 mm</option>
                  <option value={58}>58 mm</option>
                </select>
              </Labeled>
              {PAYMENT_METHODS.map((m) => (
                <Labeled key={m.value} label={tr("{{method}} — fiskal chekda", { method: m.label })}>
                  <select
                    className={FIELD}
                    value={form.methods[m.value] ?? "card"}
                    onChange={(e) => patch({ methods: { ...form.methods, [m.value]: e.target.value as "cash" | "card" | "skip" } })}
                  >
                    <option value="cash">{tr("Naqd")}</option>
                    <option value="card">{tr("Karta")}</option>
                    <option value="skip">{tr("Fiskallashtirilmaydi")}</option>
                  </select>
                </Labeled>
              ))}
            </div>
          </Block>

          <Block title={tr("Qo'shimcha")}>
            <div className="space-y-2">
              <Check
                checked={form.auto_open_shift}
                onChange={(v) => patch({ auto_open_shift: v })}
                label={tr("Fiskal smenani avtomatik ochish")}
                hint={tr("Chek yuborishda smena yopiq bo'lsa, o'zi ochiladi. Yopish (Z-hisobot) — yuqoridagi «Fiskal» tugmasidan, har kuni.")}
              />
              <Check
                checked={form.epos_prints}
                onChange={(v) => patch({ epos_prints: v })}
                label={tr("Fiskal chekni E-POS o'zi chop etsin")}
                hint={tr("O'chiq bo'lsa (tavsiya etiladi) — chekni tizim o'zi chiqaradi, soliq QR kodi bilan. Yoqilsa E-POS o'z chekini ham chiqaradi. Qaytarim va avans cheklarini E-POS har doim o'zi chop etadi.")}
              />
              <Check
                checked={form.prepayment_as_advance}
                onChange={(v) => patch({ prepayment_as_advance: v })}
                label={tr("Mehmon kirishidan oldingi to'lov — avans cheki")}
                hint={tr("O'chiq bo'lsa har bir to'lov sotuv cheki bo'ladi. Yoqish-yoqmaslikni buxgalteringiz bilan kelishing.")}
              />
            </div>
          </Block>

          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={save.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr("Saqlash")}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {tr("Saqlandi")}
              </span>
            )}
          </div>

          {form.enabled && <ReceiptsList />}
        </div>
      )}
    </section>
  )
}

function ReceiptsList() {
  const { data, refetch, isFetching } = useFiscalReceipts()
  const working = useFiscalStore((s) => s.working)
  const [busyId, setBusyId] = useState<string | null>(null)
  const items = data?.items ?? []

  const retry = async () => {
    await runFiscalQueue()
    void refetch()
  }
  const dismiss = async (r: FiscalReceipt) => {
    const reason = window.prompt(tr("Chekni navbatdan olib tashlash sababi:"))
    if (!reason?.trim()) return
    setBusyId(r.id)
    try {
      await dismissReceipt(r.id, reason.trim())
    } catch {
      // ro'yxat qayta o'qiladi — holat o'sha yerda ko'rinadi
    }
    setBusyId(null)
    void refetch()
  }

  return (
    <Block title={tr("Oxirgi fiskal cheklar")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{tr("Jami: {{n}} ta", { n: data?.total ?? 0 })}</p>
        <button
          type="button"
          onClick={retry}
          disabled={working}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {working || isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {tr("Navbatni yuborish")}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
          {tr("Hali fiskal chek yo'q — to'lov olinganda shu yerda ko'rinadi")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">{tr("Chek")}</th>
                <th className="px-3 py-2 font-medium">{tr("Turi")}</th>
                <th className="px-3 py-2 text-right font-medium">{tr("Summa")}</th>
                <th className="px-3 py-2 font-medium">{tr("Holat")}</th>
                <th className="px-3 py-2 font-medium">{tr("Fiskal ma'lumot")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-800">{r.title || "—"}</p>
                    <p className="font-mono text-[10px] text-gray-400">{r.number}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{tr(KIND_LABEL[r.kind])}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-800">
                    {Number(r.amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-md px-1.5 py-0.5 font-medium", STATUS_TONE[r.status])}>
                      {tr(STATUS_LABEL[r.status])}
                    </span>
                  </td>
                  <td className="max-w-[18rem] px-3 py-2">
                    {r.status === "done" ? (
                      <a
                        href={r.qr_url || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                        title={tr("Soliq saytida ochish")}
                      >
                        № {r.receipt_seq} · {fiscalDateText(r.fiscal_datetime)}
                      </a>
                    ) : (
                      <span className="line-clamp-2 text-gray-500" title={r.error || ""}>
                        {r.error || "—"}
                      </span>
                    )}
                    {r.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => void dismiss(r)}
                        disabled={busyId === r.id}
                        className="ml-2 text-[11px] text-gray-400 underline-offset-2 hover:text-red-600 hover:underline"
                      >
                        {tr("Olib tashlash")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Block>
  )
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 p-3">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        <span className="block text-xs leading-relaxed text-gray-500">{hint}</span>
      </span>
    </label>
  )
}
