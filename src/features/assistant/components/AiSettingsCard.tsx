import { useEffect, useMemo, useState } from "react"
import { Bot, CheckCircle2, KeyRound, ListRestart, Loader2, PlugZap, Save, Search, Trash2, Users } from "lucide-react"

import { tr } from "@/i18n"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"

import {
  listProviderModels,
  testAiConnection,
  useAiSettings,
  useSaveAiMembers,
  useSaveAiSettings,
  type AiMember,
  type TestResult,
} from "../api/assistant"
import { formatCompact } from "../lib/format"

/* Sozlamalar → "AI yordamchi" (faqat sozlovchi va tizim ma'muri).

   Provider (ChatGPT birinchi), model, API kalit (serverda shifrlangan,
   bu yerda faqat oxirgi 4 belgisi), limitlar va kim ishlatishi. Ro'yxatda
   yo'q xodim — hatto administrator — yordamchini ko'rmaydi; sozlovchi va
   tizim ma'muri o'zi doim foydalana oladi (sinash uchun). */

const FIELD =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"

const toInt = (v: string): number | null => {
  const n = Number(v.replace(/[\s ]/g, ""))
  return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}
const toFloat = (v: string): number | null => {
  const n = Number(v.replace(",", "."))
  return v.trim() && Number.isFinite(n) && n >= 0 ? n : null
}

export function AiSettingsCard() {
  const { data, isLoading } = useAiSettings()
  const save = useSaveAiSettings()
  const saveMembers = useSaveAiMembers()

  const [provider, setProvider] = useState("openai")
  const [model, setModel] = useState("")
  const [customModel, setCustomModel] = useState(false)
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [userLimit, setUserLimit] = useState("")
  const [hotelLimit, setHotelLimit] = useState("")
  const [priceIn, setPriceIn] = useState("")
  const [priceOut, setPriceOut] = useState("")
  const [mask, setMask] = useState(true)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [test, setTest] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [remoteModels, setRemoteModels] = useState<string[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)

  const s = data?.settings
  useEffect(() => {
    if (!s) return
    setProvider(s.provider)
    setModel(s.model ?? "")
    setBaseUrl(s.base_url ?? "")
    setEnabled(s.enabled)
    setUserLimit(s.default_monthly_limit != null ? String(s.default_monthly_limit) : "")
    setHotelLimit(s.hotel_monthly_limit != null ? String(s.hotel_monthly_limit) : "")
    setPriceIn(s.price_input != null ? String(s.price_input) : "")
    setPriceOut(s.price_output != null ? String(s.price_output) : "")
    setMask(s.mask_sensitive)
  }, [s])

  const info = data?.providers.find((p) => p.key === provider)
  const models = useMemo(() => {
    const base = info?.models ?? []
    const extra = (remoteModels ?? []).filter((m) => !base.includes(m))
    return [...base, ...extra]
  }, [info, remoteModels])
  useEffect(() => {
    if (model && models.length && !models.includes(model)) setCustomModel(true)
  }, [model, models])

  const changeProvider = (key: string) => {
    setProvider(key)
    const p = data?.providers.find((x) => x.key === key)
    setModel(p?.default_model ?? "")
    setCustomModel(!p?.default_model)
    setBaseUrl("")
    setRemoteModels(null)
    setTest(null)
  }

  const payload = () => ({
    provider,
    model: model.trim() || undefined,
    base_url: baseUrl.trim() || undefined,
    api_key: apiKey.trim() || undefined,
  })

  const onSave = async (extra?: { enabled?: boolean }) => {
    setNote(null)
    try {
      await save.mutateAsync({
        ...payload(),
        base_url: baseUrl.trim() || null,
        enabled: extra?.enabled ?? enabled,
        default_monthly_limit: toInt(userLimit),
        hotel_monthly_limit: toInt(hotelLimit),
        price_input: toFloat(priceIn),
        price_output: toFloat(priceOut),
        mask_sensitive: mask,
      })
      setApiKey("")
      setNote({ ok: true, text: tr("Sozlama saqlandi") })
    } catch (e) {
      // Yoqish rad etilsa (kalit yo'q) — belgi avvalgi holatiga qaytadi
      if (extra?.enabled !== undefined) setEnabled(!extra.enabled)
      setNote({ ok: false, text: apiErrorMessage(e) })
    }
  }

  const onTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      setTest(await testAiConnection(payload()))
    } catch (e) {
      setTest({ ok: false, message: apiErrorMessage(e) })
    } finally {
      setTesting(false)
    }
  }

  const onModels = async () => {
    setLoadingModels(true)
    try {
      const res = await listProviderModels(payload())
      if (res.ok) setRemoteModels(res.models)
      else setTest({ ok: false, message: res.message })
    } catch (e) {
      setTest({ ok: false, message: apiErrorMessage(e) })
    } finally {
      setLoadingModels(false)
    }
  }

  const clearKey = async () => {
    try {
      await save.mutateAsync({ clear_key: true, enabled: false })
      setEnabled(false)
      setNote({ ok: true, text: tr("Kalit o'chirildi — yordamchi o'chirildi") })
    } catch (e) {
      setNote({ ok: false, text: apiErrorMessage(e) })
    }
  }

  return (
    <section id="ai-assistant" className="scroll-mt-4 overflow-hidden rounded-2xl border bg-white">
      <div className="flex items-start gap-3 border-b bg-gray-50/70 px-5 py-4">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900">{tr("AI yordamchi")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            {tr("Xodimlar «Yordamchi» sahifasida savol beradi, hisobot, grafik va Excel oladi, ish buyuradi. Yordamchi faqat xodimning o'z ruxsatlari doirasida ishlaydi, ma'lumotni o'chira olmaydi, har bir o'zgartirishni xodim tasdiqlaydi. Kalit serverda shifrlangan saqlanadi.")}
          </p>
        </div>
        <label className="flex flex-shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={enabled}
            disabled={isLoading || save.isPending}
            onChange={(e) => {
              setEnabled(e.target.checked)
              void onSave({ enabled: e.target.checked })
            }}
          />
          {enabled ? tr("Yoqilgan") : tr("O'chirilgan")}
        </label>
      </div>

      {isLoading ? (
        <p className="p-5 text-sm text-gray-400">{tr("Yuklanmoqda...")}</p>
      ) : (
        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{tr("Provayder")}</span>
              <select className={FIELD} value={provider} onChange={(e) => changeProvider(e.target.value)}>
                {data?.providers.map((p) => (
                  <option key={p.key} value={p.key}>
                    {tr(p.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
                {tr("Model")}
                <button
                  type="button"
                  onClick={onModels}
                  disabled={loadingModels}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline disabled:opacity-60"
                >
                  {loadingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListRestart className="h-3 w-3" />}
                  {tr("Ro'yxatni olish")}
                </button>
              </span>
              {customModel || !models.length ? (
                <div className="flex gap-1.5">
                  <input
                    className={FIELD}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={info?.default_model ?? "model-name"}
                  />
                  {models.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCustomModel(false)}
                      className="flex-shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      {tr("Ro'yxat")}
                    </button>
                  )}
                </div>
              ) : (
                <select
                  className={FIELD}
                  value={model}
                  onChange={(e) => {
                    if (e.target.value === "__custom") {
                      setCustomModel(true)
                      setModel("")
                    } else setModel(e.target.value)
                  }}
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                      {m === info?.default_model ? ` — ${tr("tavsiya")}` : ""}
                    </option>
                  ))}
                  <option value="__custom">{tr("Boshqa model…")}</option>
                </select>
              )}
            </label>
            {(info?.needs_base_url || provider !== "openai") && (
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-gray-600">
                  {tr("API manzili")}
                  {!info?.needs_base_url && <span className="font-normal text-gray-400"> · {tr("ixtiyoriy")}</span>}
                </span>
                <input
                  className={FIELD}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={info?.base_url ?? "https://api.example.com/v1"}
                />
              </label>
            )}
            <label className="block sm:col-span-2">
              <span className="mb-1 flex items-center gap-2 text-xs font-medium text-gray-600">
                <KeyRound className="h-3.5 w-3.5" />
                {tr("API kalit")}
                {s?.has_key && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    ••••{s.key_hint}
                  </span>
                )}
              </span>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  autoComplete="off"
                  className={FIELD}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={s?.has_key ? tr("Almashtirish uchun yangi kalitni kiriting") : "sk-..."}
                />
                {s?.has_key && (
                  <button
                    type="button"
                    onClick={clearKey}
                    title={tr("Kalitni o'chirish")}
                    className="flex-shrink-0 rounded-lg border border-red-200 px-2.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{tr("Xodim boshiga oylik limit (token)")}</span>
              <input className={FIELD} inputMode="numeric" value={userLimit} onChange={(e) => setUserLimit(e.target.value)} placeholder={tr("cheklanmagan")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{tr("Mehmonxona oylik limiti (token)")}</span>
              <input className={FIELD} inputMode="numeric" value={hotelLimit} onChange={(e) => setHotelLimit(e.target.value)} placeholder={tr("cheklanmagan")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{tr("Narx: kiruvchi, $ / 1M")}</span>
              <input className={FIELD} inputMode="decimal" value={priceIn} onChange={(e) => setPriceIn(e.target.value)} placeholder={tr("ixtiyoriy")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{tr("Narx: chiquvchi, $ / 1M")}</span>
              <input className={FIELD} inputMode="decimal" value={priceOut} onChange={(e) => setPriceOut(e.target.value)} placeholder={tr("ixtiyoriy")} />
            </label>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={mask} onChange={(e) => setMask(e.target.checked)} />
            <span>
              {tr("Shaxsiy ma'lumotlarni yashirish")}
              <span className="block text-xs text-gray-500">
                {tr("Pasport, hujjat raqami, tug'ilgan sana va karta ma'lumotlari AI xizmatiga yuborilmaydi. Parol va kalitlar har doim yashiriladi.")}
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {tr("Saqlash")}
            </button>
            <button
              type="button"
              onClick={onTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              {tr("Ulanishni tekshirish")}
            </button>
            {note && (
              <span className={cn("text-xs", note.ok ? "text-emerald-700" : "text-red-600")}>{note.text}</span>
            )}
          </div>
          {test && (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-xs",
                test.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
              )}
            >
              {test.ok
                ? tr("Ulanish ishlayapti: javob «{{reply}}», {{ms}} ms", { reply: test.reply ?? "", ms: test.latency_ms ?? 0 })
                : `${test.message ?? tr("Ulanib bo'lmadi")}${test.detail ? ` — ${test.detail}` : ""}`}
            </p>
          )}

          <MembersEditor members={data?.members ?? []} saving={saveMembers.isPending} onSave={(items) => saveMembers.mutateAsync(items)} />
        </div>
      )}
    </section>
  )
}

function MembersEditor({
  members,
  saving,
  onSave,
}: {
  members: AiMember[]
  saving: boolean
  onSave: (items: { user_id: string; allowed: boolean; monthly_limit: number | null }[]) => Promise<unknown>
}) {
  const [q, setQ] = useState("")
  const [draft, setDraft] = useState<Record<string, { allowed: boolean; limit: string }>>({})
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setDraft(
      Object.fromEntries(
        members.map((m) => [m.user_id, { allowed: m.allowed, limit: m.monthly_limit != null ? String(m.monthly_limit) : "" }]),
      ),
    )
  }, [members])

  const shown = members.filter((m) => !q.trim() || `${m.name} ${m.username}`.toLowerCase().includes(q.trim().toLowerCase()))
  const allowedCount = Object.values(draft).filter((d) => d.allowed).length
  const dirty = members.filter((m) => {
    const d = draft[m.user_id]
    return d && (d.allowed !== m.allowed || (d.limit.trim() ? toInt(d.limit) : null) !== m.monthly_limit)
  })

  const submit = async () => {
    setNote(null)
    try {
      await onSave(
        dirty.map((m) => ({
          user_id: m.user_id,
          allowed: draft[m.user_id].allowed,
          monthly_limit: draft[m.user_id].limit.trim() ? toInt(draft[m.user_id].limit) : null,
        })),
      )
      setNote({ ok: true, text: tr("Saqlandi") })
    } catch (e) {
      setNote({ ok: false, text: apiErrorMessage(e) })
    }
  }

  const setAll = (allowed: boolean) =>
    setDraft((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { ...v, allowed }])))

  return (
    <div className="rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2.5">
        <Users className="h-4 w-4 text-gray-500" />
        <p className="text-sm font-semibold text-gray-900">{tr("Kim foydalana oladi")}</p>
        <span className="text-xs text-gray-500">{tr("{{n}} ta xodimga ochiq", { n: allowedCount })}</span>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("Qidirish")}
            className="h-8 w-40 rounded-lg border border-gray-200 bg-white pl-7 pr-2 text-xs text-gray-900 outline-none focus:border-primary-400"
          />
        </div>
      </div>
      <p className="px-3 pt-2 text-[11px] text-gray-500">
        {tr("Sozlovchi va tizim ma'muri doim foydalana oladi. Administrator ham ro'yxatda belgilanmasa yordamchini ko'rmaydi. Limit bo'sh — umumiy limit amal qiladi.")}
      </p>
      <div className="flex gap-3 px-3 pt-2 text-xs">
        <button type="button" onClick={() => setAll(true)} className="font-medium text-primary-600 hover:underline">
          {tr("Hammasini belgilash")}
        </button>
        <button type="button" onClick={() => setAll(false)} className="font-medium text-gray-500 hover:underline">
          {tr("Hammasini olib tashlash")}
        </button>
      </div>
      <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-gray-400">{tr("Xodimlar topilmadi")}</p>
        ) : (
          shown.map((m) => {
            const d = draft[m.user_id] ?? { allowed: m.allowed, limit: "" }
            return (
              <div key={m.user_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    checked={d.allowed}
                    onChange={(e) => setDraft((x) => ({ ...x, [m.user_id]: { ...d, allowed: e.target.checked } }))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{m.name}</span>
                    <span className="block truncate text-[11px] text-gray-500">
                      {m.user_type === "ADMIN" ? tr("Administrator") : tr("Xodim")} · @{m.username}
                      {m.month_tokens > 0 && ` · ${tr("shu oy {{t}} token", { t: formatCompact(m.month_tokens) })}`}
                    </span>
                  </span>
                </label>
                <input
                  inputMode="numeric"
                  value={d.limit}
                  onChange={(e) => setDraft((x) => ({ ...x, [m.user_id]: { ...d, limit: e.target.value } }))}
                  placeholder={tr("limit")}
                  title={tr("Shaxsiy oylik limit (token)")}
                  className="h-8 w-28 rounded-lg border border-gray-200 bg-white px-2 text-right text-xs tabular-nums text-gray-900 outline-none focus:border-primary-400"
                />
              </div>
            )
          })
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-2.5">
        <button
          type="button"
          onClick={submit}
          disabled={!dirty.length || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {dirty.length ? tr("Saqlash ({{n}})", { n: dirty.length }) : tr("Saqlash")}
        </button>
        {note && <span className={cn("text-xs", note.ok ? "text-emerald-700" : "text-red-600")}>{note.text}</span>}
      </div>
    </div>
  )
}
