import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Link2,
  Loader2,
  Plus,
  ScanSearch,
  Send,
  Trash2,
  XCircle,
} from "lucide-react"

import { tr } from "@/i18n"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"

import {
  linkListok,
  lookupPerson,
  registerPerson,
  skipPerson,
  useEmehmonDictionary,
  useEmehmonRooms,
  type EmehmonPerson,
} from "../api/emehmon"
import {
  applyLookup,
  canLookup,
  citizenFromCode,
  formProblems,
  fromLocalInput,
  isLocal,
  sortCountries,
  toLocalInput,
  withCitizen,
  type DictItem,
  type EmehmonChild,
  type EmehmonForm,
  type Sex,
} from "../lib/emehmon"

/* Bitta mehmonni E-mehmon'da ro'yxatga olish shakli.

   Shakl mehmon kartasidan (yoki avvalgi ro'yxatidan) to'ldirilgan holda
   keladi. «Bazadan tekshirish» rasmiy ma'lumotni olib keladi: mahalliy
   fuqaro — IIV bazasidan (F.I.O., jins, pasport sanasi, PINFL), chet ellik —
   Chegara xizmatidan (identifikator, viza). Yuborish DOIM xodim tasdig'i
   bilan: bu davlat tizimiga yoziladigan amal. */

const FIELD =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:opacity-60"

interface Props {
  reservationId: string
  person: EmehmonPerson
  /** E-mehmon qabul qiladigan kirish vaqti oralig'i (ISO) */
  window: { min: string; max: string }
  /** Holat o'zgardi — varaq va navbat qayta o'qilsin */
  onChanged: () => void
}

type Busy = "lookup" | "register" | "link" | "skip" | null

export function EmehmonPersonForm({ reservationId, person, window: allowed, onChanged }: Props) {
  const [form, setForm] = useState<EmehmonForm | null>(person.form)
  const [busy, setBusy] = useState<Busy>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lookup, setLookup] = useState<{ ok: boolean; text: string } | null>(null)
  const [showExtra, setShowExtra] = useState(false)
  const [showChildren, setShowChildren] = useState((person.form?.children.length ?? 0) > 0)

  const { data: countriesRaw, error: dictionaryError } = useEmehmonDictionary("countries")
  const { data: visitTypes } = useEmehmonDictionary("visit-types")
  const { data: guestTypes } = useEmehmonDictionary("guest-types")
  const { data: passportTypes } = useEmehmonDictionary("passport-types")
  const foreign = !!form?.citizen_id && !isLocal(form.citizen_id)
  const { data: visaTypes } = useEmehmonDictionary("visa-types", foreign)
  const { data: rooms } = useEmehmonRooms()
  const countries = useMemo(() => sortCountries(countriesRaw ?? []), [countriesRaw])

  // Mehmon kartasidagi fuqarolik (ISO kodi) ma'lumotnoma kelgach id'ga aylanadi.
  // Bir marta: xodim tanlovni o'zi o'zgartirsa, qayta tiqishtirilmaydi
  const citizenResolved = useRef(false)
  useEffect(() => {
    if (citizenResolved.current || countries.length === 0) return
    citizenResolved.current = true
    const id = citizenFromCode(person.citizen_code, countries)
    if (id) setForm((f) => (f && !f.citizen_id ? { ...f, citizen_id: id } : f))
  }, [countries, person.citizen_code])

  if (!form) return null

  const patch = (p: Partial<EmehmonForm>) => {
    setForm((f) => (f ? { ...f, ...p } : f))
    setProblems([])
    setError(null)
  }
  const local = isLocal(form.citizen_id)
  const failure = person.state === "failed" ? person.registration : null
  const duplicateId = failure?.error_code === "LISTOK_DUPLICATE_ACTIVE" ? failure.error_meta?.existing_listok_id : undefined
  const roomKnown = !form.room || (rooms ?? []).some((r) => r.room_number === form.room)

  const doLookup = async () => {
    setBusy("lookup")
    setLookup(null)
    try {
      const res = await lookupPerson(form)
      if (res.found && res.person) {
        setForm(applyLookup(form, res.person))
        setProblems([])
        setLookup({ ok: true, text: tr("Rasmiy bazadan topildi — ma'lumotlar to'ldirildi") })
      } else {
        setLookup({ ok: false, text: res.error || tr("Topilmadi") })
      }
    } catch (e) {
      setLookup({ ok: false, text: apiErrorMessage(e) })
    }
    setBusy(null)
  }

  const submit = async () => {
    const found = formProblems(form, Date.now())
    setProblems(found)
    setError(null)
    if (found.length) return
    setBusy("register")
    try {
      await registerPerson(reservationId, person.guest_id, form)
      // Natija (ro'yxatga olindi yoki E-mehmon rad etdi) varaqda ko'rinadi
      onChanged()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
    setBusy(null)
  }

  const link = async () => {
    if (!duplicateId) return
    setBusy("link")
    setError(null)
    try {
      await linkListok(reservationId, person.guest_id, duplicateId)
      onChanged()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
    setBusy(null)
  }

  const skip = async () => {
    const note = globalThis.prompt(tr("Nega ro'yxatga olish kerak emas? (ixtiyoriy izoh)"), "")
    if (note === null) return
    setBusy("skip")
    setError(null)
    try {
      await skipPerson(reservationId, person.guest_id, note.trim())
      onChanged()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
    setBusy(null)
  }

  const setChild = (index: number, p: Partial<EmehmonChild>) =>
    patch({ children: form.children.map((c, i) => (i === index ? { ...c, ...p } : c)) })

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
      {failure?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <p className="flex items-start gap-1.5 font-medium">
            <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {tr("E-mehmon javobi")}: {failure.error}
            </span>
          </p>
          {failure.uncertain && (
            <p className="mt-1 pl-5 text-red-600">
              {tr("Natija noma'lum bo'lishi mumkin. Shaklni o'zgartirmasdan qayta yuboring — mehmon ikki marta yozilmaydi.")}
            </p>
          )}
          {duplicateId && (
            <button
              type="button"
              onClick={link}
              disabled={busy !== null}
              className="ml-5 mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {busy === "link" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {tr("Mavjud ro'yxatni bog'lash (№ {{id}})", { id: duplicateId })}
            </button>
          )}
        </div>
      )}
      {dictionaryError && (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {tr("E-mehmon ma'lumotnomalari yuklanmadi")}: {apiErrorMessage(dictionaryError)}
          </span>
        </p>
      )}
      {person.overdue && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {tr("Mehmon kirganiga 12 soatdan oshgan. E-mehmon faqat oxirgi 12 soat ichidagi kirish vaqtini qabul qiladi — vaqtni o'zingiz ko'rsating.")}
        </p>
      )}

      <Group title={tr("Hujjat")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Labeled label={tr("Fuqarolik")} required>
            <select
              className={FIELD}
              value={form.citizen_id ?? ""}
              onChange={(e) => {
                setForm(withCitizen(form, e.target.value ? Number(e.target.value) : null))
                setProblems([])
                setLookup(null)
              }}
            >
              <option value="">{tr("Tanlang")}</option>
              {withCurrent(countries, form.citizen_id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label={tr("Pasport seriya va raqami")} required>
            <input
              className={cn(FIELD, "font-mono uppercase")}
              value={form.passport_number}
              onChange={(e) => patch({ passport_number: e.target.value.replace(/\s+/g, "").toUpperCase() })}
              placeholder="AB1234567"
              spellCheck={false}
            />
          </Labeled>
          <Labeled label={tr("Tug'ilgan sana")} required>
            <input
              type="date"
              className={FIELD}
              value={form.birth_date ?? ""}
              onChange={(e) => patch({ birth_date: e.target.value || null })}
            />
          </Labeled>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={doLookup}
            disabled={busy !== null || !canLookup(form)}
            title={tr("Pasport, tug'ilgan sana va fuqarolik bo'yicha rasmiy bazadan qidirish")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy === "lookup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {tr("Bazadan tekshirish")}
          </button>
          {lookup ? (
            <span className={cn("inline-flex items-start gap-1.5 text-xs", lookup.ok ? "text-emerald-700" : "text-red-700")}>
              {lookup.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
              {lookup.text}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {local
                ? tr("IIV bazasidan: F.I.O., jinsi, pasport sanasi va PINFL")
                : tr("Chegara xizmati bazasidan: identifikator va viza ma'lumoti")}
            </span>
          )}
        </div>
      </Group>

      <Group title={tr("Shaxs")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Labeled label={tr("Familiya (lotincha)")} required>
            <input className={cn(FIELD, "uppercase")} value={form.surname} onChange={(e) => patch({ surname: e.target.value.toUpperCase() })} spellCheck={false} />
          </Labeled>
          <Labeled label={tr("Ism (lotincha)")} required>
            <input className={cn(FIELD, "uppercase")} value={form.firstname} onChange={(e) => patch({ firstname: e.target.value.toUpperCase() })} spellCheck={false} />
          </Labeled>
          <Labeled label={tr("Otasining ismi")}>
            <input className={cn(FIELD, "uppercase")} value={form.lastname} onChange={(e) => patch({ lastname: e.target.value.toUpperCase() })} spellCheck={false} />
          </Labeled>
          <Labeled label={tr("Jinsi")} required>
            <select className={FIELD} value={form.sex ?? ""} onChange={(e) => patch({ sex: (e.target.value || null) as Sex | null })}>
              <option value="">{tr("Tanlang")}</option>
              <option value="M">{tr("Erkak")}</option>
              <option value="W">{tr("Ayol")}</option>
            </select>
          </Labeled>
          <Labeled label={tr("Pasport berilgan sana")} required>
            <input type="date" className={FIELD} value={form.passport_date ?? ""} onChange={(e) => patch({ passport_date: e.target.value || null })} />
          </Labeled>
          <Labeled label={tr("Hujjat turi")}>
            <select className={FIELD} value={form.passport_type_id} onChange={(e) => patch({ passport_type_id: Number(e.target.value) || 1 })}>
              {withCurrent(passportTypes?.length ? passportTypes : [{ id: 1, name: tr("Pasport") }], form.passport_type_id).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Labeled>
          {local ? (
            <Labeled label={tr("PINFL")} hint={tr("Bo'sh qolsa E-mehmon o'zi topadi")}>
              <input
                className={cn(FIELD, "font-mono")}
                inputMode="numeric"
                value={form.pinfl}
                onChange={(e) => patch({ pinfl: e.target.value.replace(/\D/g, "").slice(0, 14) })}
                placeholder="14 raqam"
              />
            </Labeled>
          ) : (
            <Labeled label={tr("Chegara xizmati identifikatori")} required hint={tr("«Bazadan tekshirish» to'ldiradi")}>
              <input className={cn(FIELD, "font-mono")} value={form.person_id} onChange={(e) => patch({ person_id: e.target.value.trim() })} />
            </Labeled>
          )}
          <div className="sm:col-span-2">
            <Labeled label={tr("Pasportni kim bergan")}>
              <input className={FIELD} value={form.passport_issued_by} onChange={(e) => patch({ passport_issued_by: e.target.value })} />
            </Labeled>
          </div>
        </div>
      </Group>

      <Group title={tr("Turish")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Labeled label={tr("Kirish vaqti (Toshkent)")} required>
            <input
              type="datetime-local"
              className={FIELD}
              value={toLocalInput(form.arrival)}
              min={toLocalInput(allowed.min)}
              max={toLocalInput(allowed.max)}
              onChange={(e) => patch({ arrival: fromLocalInput(e.target.value) })}
            />
          </Labeled>
          <Labeled label={tr("Turish muddati (sutka)")} required>
            <input
              type="number"
              min={1}
              max={365}
              className={FIELD}
              value={form.days ?? ""}
              onChange={(e) => patch({ days: e.target.value ? Math.max(1, Math.min(365, Number(e.target.value))) : null })}
            />
          </Labeled>
          <Labeled label={tr("Xona")} hint={roomKnown ? undefined : tr("Bu xona E-mehmon kabinetida topilmadi")}>
            {rooms && rooms.length > 0 ? (
              <select className={FIELD} value={form.room} onChange={(e) => patch({ room: e.target.value })}>
                <option value="">—</option>
                {!roomKnown && <option value={form.room}>{form.room}</option>}
                {rooms.map((r) => (
                  <option key={r.id} value={r.room_number}>
                    {r.room_type_name ? `${r.room_number} · ${r.room_type_name}` : r.room_number}
                  </option>
                ))}
              </select>
            ) : (
              <input className={FIELD} value={form.room} onChange={(e) => patch({ room: e.target.value })} />
            )}
          </Labeled>
          <Labeled label={tr("Tashrif maqsadi")} required>
            <DictSelect items={visitTypes} value={form.visit_type_id} onChange={(v) => patch({ visit_type_id: v })} />
          </Labeled>
          <Labeled label={tr("Mehmon turi")} required>
            <DictSelect items={guestTypes} value={form.guest_type_id} onChange={(v) => patch({ guest_type_id: v })} />
          </Labeled>
          <Labeled label={tr("Yashash summasi (so'm)")}>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={form.amount ?? ""}
              onChange={(e) => patch({ amount: e.target.value ? Math.max(0, Math.round(Number(e.target.value))) : null })}
            />
          </Labeled>
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={form.paid} onChange={(e) => patch({ paid: e.target.checked })} />
          {tr("Yashash haqi to'langan")}
        </label>
      </Group>

      <Toggle open={showExtra || foreign} locked={foreign} onToggle={() => setShowExtra((x) => !x)} label={tr("Viza va chegara ma'lumoti")} />
      {(showExtra || foreign) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Labeled label={tr("Viza turi")}>
            <DictSelect items={visaTypes} value={form.visa_type_id} onChange={(v) => patch({ visa_type_id: v })} empty={tr("Vizasiz")} />
          </Labeled>
          <Labeled label={tr("Viza raqami")}>
            <input className={cn(FIELD, "font-mono")} value={form.visa_number} onChange={(e) => patch({ visa_number: e.target.value })} />
          </Labeled>
          <Labeled label={tr("Vizani kim bergan")}>
            <input className={FIELD} value={form.visa_issued_by} onChange={(e) => patch({ visa_issued_by: e.target.value })} />
          </Labeled>
          <Labeled label={tr("Viza boshlanishi")}>
            <input type="date" className={FIELD} value={form.visa_from ?? ""} onChange={(e) => patch({ visa_from: e.target.value || null })} />
          </Labeled>
          <Labeled label={tr("Viza tugashi")}>
            <input type="date" className={FIELD} value={form.visa_to ?? ""} onChange={(e) => patch({ visa_to: e.target.value || null })} />
          </Labeled>
          <Labeled label={tr("Chegaradan o'tgan sana")}>
            <input type="date" className={FIELD} value={form.kpp_date ?? ""} onChange={(e) => patch({ kpp_date: e.target.value || null })} />
          </Labeled>
          <Labeled label={tr("Chegara punkti raqami")}>
            <input className={FIELD} value={form.kpp_number} onChange={(e) => patch({ kpp_number: e.target.value })} />
          </Labeled>
          <Labeled label={tr("Tug'ilgan davlati")}>
            <DictSelect items={countries} value={form.birth_country_id} onChange={(v) => patch({ birth_country_id: v })} empty={tr("Fuqaroligi bilan bir xil")} />
          </Labeled>
          <Labeled label={tr("Qaysi davlatdan kelgan")}>
            <DictSelect items={countries} value={form.from_country_id} onChange={(v) => patch({ from_country_id: v })} empty={tr("Fuqaroligi bilan bir xil")} />
          </Labeled>
        </div>
      )}

      <Toggle
        open={showChildren}
        onToggle={() => setShowChildren((x) => !x)}
        label={tr("Mehmon hujjati bilan yashaydigan bolalar ({{n}})", { n: form.children.length })}
      />
      {showChildren && (
        <div className="space-y-2">
          {form.children.map((child, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_2.25rem]">
              <input className={cn(FIELD, "uppercase")} value={child.full_name} placeholder={tr("Familiya va ism")} onChange={(e) => setChild(index, { full_name: e.target.value.toUpperCase() })} />
              <select className={FIELD} value={child.gen ?? ""} onChange={(e) => setChild(index, { gen: (e.target.value || null) as Sex | null })}>
                <option value="">{tr("Jinsi")}</option>
                <option value="M">{tr("O'g'il")}</option>
                <option value="W">{tr("Qiz")}</option>
              </select>
              <input type="date" className={FIELD} value={child.birth_day ?? ""} onChange={(e) => setChild(index, { birth_day: e.target.value || null })} />
              <button
                type="button"
                onClick={() => patch({ children: form.children.filter((_, i) => i !== index) })}
                title={tr("O'chirish")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch({ children: [...form.children, { full_name: "", gen: null, birth_day: null }] })}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr("Bola qo'shish")}
          </button>
        </div>
      )}

      {problems.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-lg border border-amber-200 bg-amber-50 py-2 pl-7 pr-3 text-xs text-amber-800">
          {problems.map((p) => (
            <li key={p}>{tr(p)}</li>
          ))}
        </ul>
      )}
      {error && <p className="whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={skip}
          disabled={busy !== null || person.state === "skipped"}
          title={tr("Masalan, mehmon E-mehmon kabinetida qo'lda ro'yxatga olingan")}
          className="inline-flex h-9 items-center rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy === "skip" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {tr("Kerak emas")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy !== null}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy === "register" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {tr("E-mehmon'da ro'yxatga olish")}
        </button>
      </div>
    </div>
  )
}

/** Tanlangan qiymat ro'yxatda bo'lmasa ham (ma'lumotnoma hali yuklanmagan)
 *  tanlov yo'qolib qolmasin. */
function withCurrent(items: DictItem[], current: number | null): DictItem[] {
  if (current == null || items.some((i) => i.id === current)) return items
  return [{ id: current, name: `#${current}` }, ...items]
}

function DictSelect({
  items,
  value,
  onChange,
  empty,
}: {
  items: DictItem[] | undefined
  value: number | null
  onChange: (value: number | null) => void
  empty?: string
}) {
  return (
    <select className={FIELD} value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{empty ?? tr("Tanlang")}</option>
      {withCurrent(items ?? [], value).map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function Labeled({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
    </label>
  )
}

function Toggle({
  open,
  locked,
  onToggle,
  label,
}: {
  open: boolean
  locked?: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      className="flex w-full items-center gap-1.5 text-left text-xs font-semibold text-foreground disabled:cursor-default"
    >
      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "" : "-rotate-90")} />
      {label}
    </button>
  )
}
