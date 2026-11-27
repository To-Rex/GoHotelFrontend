import { useEffect, useState, type ReactNode } from "react"
import { CheckCircle2, Eye, EyeOff, IdCard, KeyRound, Loader2, PlugZap, XCircle } from "lucide-react"

import { tr } from "@/i18n"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"

import {
  testEmehmonConnection,
  useEmehmonDictionary,
  useEmehmonSettings,
  useSaveEmehmonSettings,
  type EmehmonEnvironment,
  type EmehmonSettings,
  type EmehmonStatus,
} from "../api/emehmon"
import { money, type DictItem } from "../lib/emehmon"

/* Sozlamalar → "E-mehmon" — joriy FILIAL uchun.

   Ixtiyoriy: yoqilmagan filialda tizim avvalgidek ishlaydi. Login va maxfiy
   kalitni E-mehmon ma'muri beradi; ular kiritilib, integratsiya yoqilgach
   xodimlar kirgan mehmonni shu yerdan davlat ro'yxatiga oladi. Faqat
   sozlovchi va tizim ma'muri o'zgartiradi. */

const FIELD =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-500 disabled:bg-gray-50"

type Form = Pick<
  EmehmonSettings,
  | "enabled"
  | "environment"
  | "username"
  | "default_visit_type_id"
  | "default_guest_type_id"
  | "card_payment_type_id"
  | "auto_checkout"
  | "prompt_on_checkin"
>

const toForm = (s: EmehmonSettings): Form => ({
  enabled: s.enabled,
  environment: s.environment,
  username: s.username,
  default_visit_type_id: s.default_visit_type_id,
  default_guest_type_id: s.default_guest_type_id,
  card_payment_type_id: s.card_payment_type_id,
  auto_checkout: s.auto_checkout,
  prompt_on_checkin: s.prompt_on_checkin,
})

export function EmehmonSettingsCard() {
  const { data, isLoading } = useEmehmonSettings()
  const save = useSaveEmehmonSettings()
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<EmehmonStatus | null>(null)
  const [testing, setTesting] = useState(false)
  // Maxfiy kalit faqat YOZILADI: saqlangani serverdan qaytmaydi (faqat oxirgi 4 belgisi)
  const [secret, setSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)

  // Ma'lumotnomalar saqlangan login va kalit bilan o'qiladi
  const ready = !!data?.secret_set && !!data.username
  const { data: visitTypes } = useEmehmonDictionary("visit-types", ready)
  const { data: guestTypes } = useEmehmonDictionary("guest-types", ready)

  useEffect(() => {
    if (data) setForm(toForm(data))
  }, [data])

  const patch = (p: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...p } : f))
    setSaved(false)
  }

  const submit = async (override?: Partial<Form>) => {
    if (!form) return false
    setError(null)
    setSaved(false)
    try {
      const next = await save.mutateAsync({
        ...form,
        ...override,
        ...(secret.trim() ? { secret: secret.trim() } : {}),
      })
      setForm(toForm(next))
      setSecret("")
      setShowSecret(false)
      setSaved(true)
      return true
    } catch (e) {
      setError(apiErrorMessage(e))
      if (override?.enabled !== undefined) setForm((f) => (f ? { ...f, enabled: !override.enabled } : f))
      return false
    }
  }

  const test = async () => {
    if (!form) return
    setTesting(true)
    setStatus(null)
    // Avval saqlanadi: login va kalit serverda — sinov aynan saqlangan sozlama bilan
    if (await submit()) {
      try {
        setStatus(await testEmehmonConnection())
      } catch (e) {
        setStatus({ ok: false, environment: form.environment, error: apiErrorMessage(e) })
      }
    }
    setTesting(false)
  }

  return (
    <section id="emehmon" className="scroll-mt-4 overflow-hidden rounded-2xl border bg-white">
      <div className="flex items-start gap-3 border-b bg-gray-50/70 px-5 py-4">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <IdCard className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900">{tr("E-mehmon (davlat ro'yxati)")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            {tr("Yoqilsa, shu filialga kirgan mehmonlar tizimning o'zidan E-mehmon'da ro'yxatga olinadi va chiqqanda ro'yxatdan chiqariladi. Yoqilmasa — hamma narsa avvalgidek ishlaydi. Sozlama faqat shu filial uchun.")}
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
          {error && <p className="whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
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

          <Block
            title={tr("Ulanish")}
            hint={tr("Login va maxfiy kalitni E-mehmon ma'muri beradi (CRM API). So'rovlar faqat serverdan yuboriladi — kalit brauzerga chiqmaydi.")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={tr("Muhit")}>
                <select
                  className={FIELD}
                  value={form.environment}
                  onChange={(e) => {
                    patch({ environment: e.target.value as EmehmonEnvironment })
                    setStatus(null)
                  }}
                >
                  <option value="sandbox">{tr("Sinov muhiti (sandbox)")}</option>
                  <option value="production">{tr("Ishchi muhit (haqiqiy ro'yxat)")}</option>
                </select>
              </Labeled>
              <Labeled label={tr("Login (X-User-Name)")}>
                <input
                  className={cn(FIELD, "font-mono text-xs")}
                  value={form.username}
                  onChange={(e) => patch({ username: e.target.value.trim() })}
                  placeholder="hotel-0000001"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Labeled>
            </div>
            <div className="mt-3">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <KeyRound className="h-3.5 w-3.5" />
                {tr("Maxfiy kalit (secret)")}
                {data.secret_set && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
                    {tr("saqlangan: ••••{{hint}}", { hint: data.secret_hint })}
                  </span>
                )}
              </span>
              <div className="flex gap-1">
                <input
                  className={cn(FIELD, "font-mono text-xs")}
                  type={showSecret ? "text" : "password"}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value)
                    setSaved(false)
                  }}
                  placeholder={
                    data.secret_set
                      ? tr("Almashtirish uchun yangi kalitni kiriting")
                      : tr("E-mehmon bergan maxfiy kalitni kiriting")
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((x) => !x)}
                  title={showSecret ? tr("Yashirish") : tr("Ko'rsatish")}
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {tr("Kalit har mehmonxona va muhitda o'ziniki; E-mehmon uni faqat bir marta ko'rsatadi. Bazada shifrlangan holda saqlanadi va bu yerda qayta ko'rsatilmaydi (faqat oxirgi 4 belgisi).")}
              </p>
            </div>
            <p className="mt-2 font-mono text-[11px] text-gray-400">{data.base_url}</p>
            <div className="mt-3 flex flex-wrap items-start gap-3">
              <button
                type="button"
                onClick={test}
                disabled={testing}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                {tr("Ulanishni tekshirish")}
              </button>
              {status && <StatusView status={status} />}
            </div>
          </Block>

          <Block
            title={tr("Standart qiymatlar")}
            hint={tr("Ro'yxatga olish shaklida oldindan tanlangan bo'ladi — xodim har safar o'zgartirishi mumkin.")}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Labeled label={tr("Tashrif maqsadi")}>
                <DictSelect items={visitTypes} value={form.default_visit_type_id} onChange={(v) => patch({ default_visit_type_id: v })} disabled={!ready} />
              </Labeled>
              <Labeled label={tr("Mehmon turi")}>
                <DictSelect items={guestTypes} value={form.default_guest_type_id} onChange={(v) => patch({ default_guest_type_id: v })} disabled={!ready} />
              </Labeled>
              <Labeled label={tr("Karta to'lovi E-mehmon'da")}>
                <select className={FIELD} value={form.card_payment_type_id} onChange={(e) => patch({ card_payment_type_id: Number(e.target.value) })}>
                  <option value={4}>Uzcard</option>
                  <option value={3}>Humo</option>
                </select>
              </Labeled>
            </div>
            {!ready && (
              <p className="mt-2 text-xs text-gray-500">
                {tr("Ro'yxatlar login va maxfiy kalit saqlangach E-mehmon'dan yuklanadi.")}
              </p>
            )}
          </Block>

          <Block title={tr("Ish tartibi")}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Check
                checked={form.prompt_on_checkin}
                onChange={(v) => patch({ prompt_on_checkin: v })}
                label={tr("Kirishdan keyin eslatish")}
                hint={tr("Mehmon kirishi rasmiylashtirilgach xodimga «E-mehmon'da ro'yxatga oling» eslatmasi chiqadi.")}
              />
              <Check
                checked={form.auto_checkout}
                onChange={(v) => patch({ auto_checkout: v })}
                label={tr("Avtomatik chiqarish")}
                hint={tr("Mehmon tizimda chiqarilganda (yoki hamroh «ketdi» deb belgilanganda) E-mehmon ro'yxati ham o'zi yopiladi. Summa bron summasidan teng ulush, to'lov turi — eng ko'p tushgan usul.")}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              {tr("Ro'yxatga olish har doim xodim tasdig'i bilan yuboriladi: bu davlat tizimiga yoziladigan amal. Faqat integratsiya yoqilgandan keyin kirgan mehmonlar navbatga tushadi.")}
            </p>
          </Block>

          <div className="flex items-center gap-3 border-t pt-4">
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
        </div>
      )}
    </section>
  )
}

function StatusView({ status }: { status: EmehmonStatus }) {
  if (!status.ok) {
    return (
      <span className="inline-flex items-start gap-1.5 text-sm text-red-700">
        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        {status.error || tr("E-mehmon'ga ulanib bo'lmadi")}
      </span>
    )
  }
  const blocked = status.can_create === false
  return (
    <div className="min-w-0 flex-1 text-sm">
      <p className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        {[status.hotel?.name || tr("Ulandi"), status.sandbox ? tr("sinov muhiti") : null].filter(Boolean).join(" · ")}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
        {status.hotel?.inn && <li>{tr("STIR: {{inn}}", { inn: status.hotel.inn })}</li>}
        {status.deposit != null && <li>{tr("Depozit: {{sum}} so'm", { sum: money(status.deposit) })}</li>}
        {status.license_expires_at && <li>{tr("Litsenziya muddati: {{date}}", { date: status.license_expires_at })}</li>}
        <li className={blocked ? "font-medium text-red-700" : undefined}>
          {blocked ? tr("Ro'yxatga olish hozir mumkin EMAS") : tr("Ro'yxatga olish mumkin")}
          {status.blocking_reasons && status.blocking_reasons.length > 0 && `: ${status.blocking_reasons.join(", ")}`}
        </li>
        {status.deposit_alert && <li className="text-amber-700">{status.deposit_alert}</li>}
      </ul>
    </div>
  )
}

function DictSelect({
  items,
  value,
  onChange,
  disabled,
}: {
  items: DictItem[] | undefined
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}) {
  const list = items ?? []
  const known = value == null || list.some((i) => i.id === value)
  return (
    <select className={FIELD} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{tr("Tanlanmagan")}</option>
      {!known && <option value={value ?? ""}>#{value}</option>}
      {list.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
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
