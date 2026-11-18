import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { format } from "date-fns"
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  PencilLine,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import { tr, trc } from "@/i18n"
import { useCloseCash, useEndShift, useExpectedCash, type ShiftSession } from "../api/shifts"
import {
  breakdownRows,
  caretForDigits,
  checkCount,
  digitsBefore,
  formatCountInput,
  groupSeparator,
  parseCountInput,
  type BreakdownRow,
  type CountState,
} from "../lib/cashCount"
import {
  amountDue,
  cashLeftAfter,
  handoverPeriod,
  hasCuts,
  selectedCut,
  type CutChoice,
} from "../lib/cashCuts"
import { CashCutPicker } from "./CashCutPicker"
import { NonCashMethods } from "./NonCashMethods"

/** "cash" — kassani topshirish (ish davom etadi), "end" — smenani tugallash */
export type CountKind = "cash" | "end"

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString()
const stamp = (iso: string) => format(new Date(iso), "dd.MM HH:mm")
/** Maydondagi minglik ajratgich — `fmt` bilan bir xil (brauzer tili bo'yicha) */
const GROUP = groupSeparator()
const formatCount = (raw: string) => formatCountInput(raw, GROUP)

const breakdownLabel = (key: BreakdownRow["key"]): string => {
  switch (key) {
    case "opening":
      return tr("Boshlang'ich kassa")
    case "payments":
      return tr("Naqd to'lovlar")
    case "shop":
      return tr("Do'kon (naqd savdo)")
    case "expenses":
      return tr("Naqd xarajatlar")
    case "carried":
      return tr("Kesimdan keyin sarflangan")
  }
}

/** Sanalgan summa holati — rang va belgi */
const COUNT_TONE: Record<CountState, string> = {
  empty: "bg-gray-50 text-gray-500",
  match: "bg-emerald-50 text-emerald-700",
  short: "bg-red-50 text-red-600",
  over: "bg-amber-50 text-amber-700",
}

function SectionTitle({ step, children }: { step?: number; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
      {step !== undefined && (
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">
          {step}
        </span>
      )}
      {children}
    </p>
  )
}

/* Kassani sanab topshirish dialogi — "Kassani topshirish" va "Smenani
   tugallash" uchun bitta oyna.

   Oqim ikki qadam:
     1. Qaysi kungacha (faqat "Kassani topshirish"da va sessiyaga kunlik kesim
        tushgan bo'lsa) — kunlar vaqt chizig'ida, ketma-ket tanlanadi;
     2. Pulni sanab kiritish — topshiriladigan summa tarkibi bilan, katta
        formatlangan maydon va kutilgan summa bilan JONLI solishtiruv
        (mos / kamomad / ortiqcha), ya'ni farq tasdiqlashdan oldin ko'rinadi.

   Keng ekranda qadamlar yonma-yon turadi (hech narsa aylantirilmaydi);
   telefonda ustma-ust, tugmalar esa doim pastda ko'rinib turadi.

   Kutilgan summa maydonga avtomatik yozib qo'yiladi — xodim sanab, kerak
   bo'lsa tuzatadi. Kompyuterda maydon darhol tanlangan holda turadi: yozishni
   boshlasa, eski qiymat almashadi. */
export function CashCountDialog({
  kind,
  approval,
  onClose,
  onDone,
}: {
  /** `null` — yopiq */
  kind: CountKind | null
  /** Tasdiq rejimi: topshirilgan kassa admin/menejer tasdig'ini kutadi */
  approval: boolean
  onClose: () => void
  /** Topshirildi — yopilgan sessiya hisoboti bilan */
  onDone: (report: ShiftSession) => void
}) {
  const open = kind !== null
  const closeCash = useCloseCash()
  const endShift = useEndShift()
  const saving = closeCash.isPending || endShift.isPending
  const { data: expected, isFetching, refetch } = useExpectedCash(open)

  // Yopilish animatsiyasi davomida oyna oxirgi ko'rinishida qoladi
  // (`kind` allaqachon `null`), aks holda sarlavha bir lahzaga almashardi.
  const [shown, setShown] = useState<CountKind>(kind ?? "cash")
  // Kunlik kesim bo'yicha topshirish: qaysi kesimgacha (`null` — xodim hali
  // tanlamagan, standart: oxirgi kesimgacha). Faqat "Kassani topshirish"da;
  // smenani tugallashda kassa keyingi xodimga butunligicha o'tadi.
  const [cutChoice, setCutChoice] = useState<CutChoice | null>(null)
  const [counted, setCounted] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  // Bo'sh maydon bilan tasdiqlashga urinildi — maydon ostidagi satr ogohlantiradi
  const [needCount, setNeedCount] = useState(false)

  // Har ochilishda tanlov tozalanadi: kesim variantlari vaqtga bog'liq
  // (yangi kesim kelgan bo'lishi mumkin)
  const [prevKind, setPrevKind] = useState(kind)
  if (kind !== prevKind) {
    setPrevKind(kind)
    if (kind) {
      setShown(kind)
      setCutChoice(null)
      setError(null)
      setNeedCount(false)
    }
  }

  const cutMode = shown === "cash" && hasCuts(expected)
  const activeCut = cutMode ? selectedCut(expected, cutChoice) : null
  // Topshiriladigan summa: tanlangan kesimgacha yoki kassadagi hamma pul
  const due = amountDue(expected, activeCut)
  const left = cashLeftAfter(expected, activeCut)
  const period = cutMode ? handoverPeriod(expected, cutChoice) : null
  const source = activeCut ?? expected
  const rows = breakdownRows(source, activeCut?.carried_cash)

  const countedValue = parseCountInput(counted)
  // Hisob hali kelmagan bo'lsa solishtiradigan narsa yo'q
  const check = expected ? checkCount(due, countedValue) : { state: "empty" as const, diff: 0 }
  const missing = needCount && countedValue === null

  // Kutilgan summa maydonga AVTOMATIK yozib qo'yiladi — xodim istasa
  // o'zgartiradi. Ikkita nozik shart:
  //
  // 1. KESHDAGI eski qiymatda qotib qolmaslik. Dialog ochilganda so'rov
  //    keshdagi summani darhol qaytaradi va yangisini fonda oladi; hisob har
  //    yangilanganda maydon ham yangilanadi (yangi bron qilingandan keyin
  //    eski summa qolib ketmasin).
  // 2. Xodim kiritgan qiymatni bosib ketmaslik: u bir marta tahrirlagach,
  //    hisob yangilansa ham maydonga tegilmaydi. Kesim tanlovi o'zgarsa —
  //    summa boshqa, shuning uchun maydon qayta to'ldiriladi (`chooseCut`).
  const inputRef = useRef<HTMLInputElement | null>(null)
  const editedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      editedRef.current = false
      return
    }
    if (editedRef.current || !expected) return
    setCounted(formatCount(String(Math.max(0, Math.round(due)))))
    setError(null)
    setNeedCount(false)
    // Maydon fokusda bo'lsa yangi qiymat ham tanlangan holda tursin
    const frame = requestAnimationFrame(() => {
      const el = inputRef.current
      if (el && document.activeElement === el) el.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, expected, due, cutChoice])

  // Formatlash bo'shliq qo'shadi/oladi — kursor yozilayotgan raqam yonida qolsin
  const caretRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = inputRef.current
    const caret = caretRef.current
    caretRef.current = null
    if (el && caret !== null && document.activeElement === el) el.setSelectionRange(caret, caret)
  }, [counted])

  const onCountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const formatted = formatCount(el.value)
    const caret = caretForDigits(
      formatted,
      digitsBefore(el.value, el.selectionStart ?? el.value.length)
    )
    // Shu paytdan boshlab avtomatik to'ldirish maydonga tegmaydi
    editedRef.current = true
    setError(null)
    setNeedCount(false)
    if (formatted === counted) {
      // Qiymat o'zgarmadi (masalan, harf yozildi) — React maydonni o'zi
      // tiklaydi, kursorni esa biz joyiga qaytaramiz
      requestAnimationFrame(() => {
        if (document.activeElement === el) el.setSelectionRange(caret, caret)
      })
      return
    }
    caretRef.current = caret
    setCounted(formatted)
  }

  // Kesim tanlovi: summa maydoni yangi tanlovga qayta to'ldiriladi
  const chooseCut = (choice: CutChoice) => {
    editedRef.current = false
    setCutChoice(choice)
  }

  const submit = async () => {
    // Bo'sh maydon jimgina 0 bo'lib o'tib ketmasligi kerak
    if (countedValue === null) {
      setNeedCount(true)
      inputRef.current?.focus()
      return
    }
    setError(null)
    try {
      const payload = { counted_cash: countedValue, notes: notes.trim() || undefined }
      const report =
        shown === "cash"
          ? await closeCash.mutateAsync({
              ...payload,
              // Kesim tanlangan bo'lsa — faqat o'sha kesimgacha topshiriladi
              cut_at: activeCut?.cut_at,
            })
          : await endShift.mutateAsync(payload)
      setCounted("")
      setNotes("")
      onDone(report)
    } catch (e) {
      setError(apiErrorMessage(e))
      // Hisob yoki kesim variantlari o'zgargan bo'lishi mumkin — yangilaymiz
      void refetch()
    }
  }

  // Summa qanday yig'ilgani — tafsilot: sanash maydonidan keyin (keng ekranda
  // chap ustunda, kunlar ostida) turadi, asosiy narsalarni pastga surmaydi.
  // Kesim tanlangan bo'lsa — o'sha kesimgacha bo'lgan tarkib.
  const details = expected ? (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-3 transition-opacity",
        isFetching && "opacity-60"
      )}
    >
      <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        {tr("Summa tarkibi")}
      </p>
      {rows.length > 0 && (
        <dl className="mt-2 space-y-1 text-xs">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 text-gray-500">{breakdownLabel(row.key)}</dt>
              <dd
                className={cn(
                  "flex-shrink-0 font-semibold tabular-nums",
                  row.sign === -1 ? "text-red-600" : "text-gray-700"
                )}
              >
                {row.sign === 1 ? "+" : row.sign === -1 ? "−" : ""}
                {fmt(row.amount)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {/* Kesimdan keyingi naqd xarajat shu kunlarning pulidan to'langan — u
          kassada yo'q, shuning uchun topshirilmaydi (kamomad ham yozilmaydi);
          yangi kassaning boshlang'ich summasi bo'ladi. Summasi yuqoridagi
          qatorda. */}
      {activeCut && activeCut.carried_cash > 0 && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700">
          {tr("Kesimdan keyingi xarajatga ketgan — topshirilmaydi va kamomad hisoblanmaydi.")}
        </p>
      )}
      {/* Naqdsiz turlar kassaga kirmaydi — alohida ko'rsatiladi */}
      <NonCashMethods
        rows={source?.methods}
        compact
        className={cn("mt-2", rows.length > 0 && "border-t border-gray-200 pt-2")}
      />
    </div>
  ) : null

  const title = shown === "cash" ? tr("Kassani topshirish") : tr("Smenani tugallash")
  const description =
    shown === "end"
      ? tr("Smena yopiladi va keyingi xodim qabul qilishi kutiladi.")
      : activeCut
        ? tr("Tanlangan kungacha bo'lgan pul topshiriladi. Undan keyingi tushum kassada qoladi va yangi kassa hisobida davom etadi.")
        : tr("Kassa yopilib, ishni davom ettirishingiz uchun yangi kassa 0 so'mdan ochiladi.")
  const submitLabel =
    shown === "end"
      ? tr("Smenani tugallash")
      : countedValue !== null
        ? tr("{{amount}} so'm topshirish", { amount: fmt(countedValue) })
        : tr("Kassani topshirish")

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]",
          // Ikki ustunli ko'rinishda oyna tepadan mahkamlanadi (o'rtaga emas):
          // kun tanlanganda o'ng ustun balandligi o'zgaradi va o'rtaga
          // tekislangan oyna sakrab, ro'yxat kursor ostidan qochardi.
          cutMode &&
            "md:top-[var(--cash-top)] md:max-h-[calc(100dvh_-_1rem_-_var(--cash-top))] md:max-w-[820px] md:translate-y-0 md:[--cash-top:max(1rem,calc(50dvh_-_21rem))]"
        )}
        onOpenAutoFocus={(event) => {
          // Kompyuterda — darhol summa maydoni (tanlangan holda: yozsa
          // almashadi). Sensorli ekranda klaviatura oynaning yarmini yopib
          // qo'yadi, shuning uchun fokus oynaning o'zida qoladi.
          event.preventDefault()
          const touch = window.matchMedia?.("(pointer: coarse)").matches
          const el = inputRef.current
          if (el && !touch) {
            el.focus()
            el.select()
          } else {
            ;(event.currentTarget as HTMLElement | null)?.focus()
          }
        }}
      >
        <DialogHeader className="min-w-0 flex-shrink-0 gap-1.5 border-b border-gray-100 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2.5 pr-8">
            <span
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl",
                shown === "cash" ? "bg-sky-50 text-sky-600" : "bg-primary-50 text-primary-600"
              )}
            >
              {shown === "cash" ? (
                <ArrowRightLeft className="h-[18px] w-[18px]" />
              ) : (
                <CheckCircle2 className="h-[18px] w-[18px]" />
              )}
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-gray-500">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4",
            cutMode && "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-6"
          )}
        >
          {cutMode ? (
            // Keng ekranda chap ustun: kunlar + summa tarkibi. Tor ekranda
            // ustun "erib ketadi" (`contents`) va bo'laklar tartib bilan
            // tiziladi: kunlar → sanash → tarkib, ya'ni summa maydoni
            // tafsilotlardan oldin keladi.
            <div className="contents md:flex md:min-w-0 md:flex-col md:gap-4">
              {/* 1-qadam: kunlik kesim bo'yicha — qaysi kungacha */}
              <section className="order-1 min-w-0 space-y-2.5">
                <SectionTitle step={1}>{tr("Qaysi kungacha topshirasiz?")}</SectionTitle>
                <CashCutPicker data={expected} choice={cutChoice} onChange={chooseCut} />
              </section>
              {details && <div className="order-3 min-w-0">{details}</div>}
            </div>
          ) : null}

          {/* 2-qadam: pulni sanab kiritish */}
          <section className="order-2 min-w-0 space-y-3">
            <SectionTitle step={cutMode ? 2 : undefined}>{tr("Pulni sanab kiriting")}</SectionTitle>

            {/* Topshiriladigan (kassada bo'lishi kerak bo'lgan) summa */}
            {expected ? (
              <div
                className={cn(
                  "rounded-xl border border-primary-100 bg-primary-50/60 px-3.5 py-3 transition-opacity",
                  // Fonda yangi hisob olinayotganda raqam eskirgan bo'lishi
                  // mumkin — buni yashirmaymiz, aks holda xodim eski summani
                  // haqiqiy deb o'qib qoladi
                  isFetching && "opacity-60"
                )}
              >
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  {activeCut ? tr("Topshiriladigan summa") : tr("Kassada bo'lishi kerak")}
                  {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
                </p>
                <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight tabular-nums text-primary-700">
                  {fmt(due)}
                  <span className="ml-1.5 text-sm font-medium tracking-normal text-gray-400">
                    {tr("so'm")}
                  </span>
                </p>
                {period && (
                  <p className="mt-0.5 text-[11px] tabular-nums text-gray-500">
                    {stamp(period.from)} → {period.to ? stamp(period.to) : trc("shift", "hozir")}
                    {period.to && period.days > 1 && (
                      <> · {tr("{{count}} kun", { count: period.days })}</>
                    )}
                  </p>
                )}
                {activeCut && left > 0 && (
                  <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-primary-100 pt-2 text-xs">
                    <span className="min-w-0 text-gray-500">{tr("Topshirgach kassada qoladi")}</span>
                    <span className="flex-shrink-0 font-semibold tabular-nums text-gray-700">
                      {tr("{{v}} so'm", { v: fmt(left) })}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              isFetching && <Skeleton className="h-24 w-full rounded-xl" />
            )}

            {/* Sanalgan summa */}
            <div>
              <label
                htmlFor="cash-counted"
                className="mb-1.5 block text-xs font-medium text-gray-600"
              >
                {tr("Siz sanagan summa")}
              </label>
              <div className="relative">
                <input
                  id="cash-counted"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={counted}
                  onChange={onCountChange}
                  placeholder="0"
                  aria-describedby="cash-counted-status"
                  aria-invalid={missing || undefined}
                  className={cn(
                    "h-14 w-full rounded-xl border border-gray-200 bg-white pr-16 pl-4 text-2xl font-bold text-gray-900 tabular-nums tracking-tight outline-none transition-colors",
                    "placeholder:text-gray-300 focus:border-primary-400 focus:ring-4 focus:ring-primary-600/15"
                  )}
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-gray-400">
                  {tr("so'm")}
                </span>
              </div>
              {/* Kutilgan summa bilan jonli solishtiruv. Hisob kelmagan
                  bo'lsa solishtiradigan narsa yo'q — satr faqat bo'sh maydonni
                  eslatadi. */}
              {(expected || countedValue === null) && (
                <p
                  id="cash-counted-status"
                  role="status"
                  className={cn(
                    "mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium leading-relaxed",
                    missing ? COUNT_TONE.short : COUNT_TONE[check.state]
                  )}
                >
                  {check.state === "match" ? (
                    <CheckCircle2 className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                  ) : check.state === "empty" && !missing ? (
                    <PencilLine className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  <span>
                    {check.state === "match"
                      ? tr("Kutilgan summaga mos keladi")
                      : check.state === "short"
                        ? tr("Kamomad: {{v}} so'm — sizning hisobingizga yoziladi", { v: fmt(check.diff) })
                        : check.state === "over"
                          ? tr("Ortiqcha: {{v}} so'm — sizning hisobingizga yoziladi", { v: fmt(check.diff) })
                          : missing
                            ? tr("Kassadagi haqiqiy summani kiriting")
                            : tr("Kassadagi pulni sanab, summani kiriting")}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="cash-notes" className="mb-1.5 block text-xs font-medium text-gray-600">
                {tr("Izoh")}
                <span className="ml-1 font-normal text-gray-400">({tr("ixtiyoriy")})</span>
              </label>
              <Input
                id="cash-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  check.state === "short" || check.state === "over"
                    ? tr("Farq sababini yozing")
                    : tr("Masalan: pul rahbarga topshirildi")
                }
              />
            </div>
          </section>

          {!cutMode && details && <div className="order-3 min-w-0">{details}</div>}
        </div>

        <div className="min-w-0 flex-shrink-0 space-y-2.5 border-t border-gray-100 bg-gray-50/60 px-5 py-3.5">
          {/* Tasdiq rejimi: topshirilgan kassa admin/menejer tasdig'ini kutadi.
              Tugma yonida — bosishdan oldin albatta ko'rinsin (aylanadigan
              qismda bo'lsa, past ekranda ko'rinmay qolardi). */}
          {shown === "cash" && approval && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <ShieldCheck className="mt-px h-3.5 w-3.5 flex-shrink-0" />
              {tr("Topshirgach admin yoki menejer tasdig'i kutiladi — tasdiqlanguncha ishlab bo'lmaydi.")}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            {/* Telefonda tugmalar yonma-yon sig'ishi uchun ichki bo'shliq torroq:
                asosiy tugmada summa ham yoziladi */}
            <Button variant="outline" onClick={onClose} className="flex-shrink-0 px-3 sm:px-4">
              {tr("Bekor qilish")}
            </Button>
            <Button
              onClick={submit}
              disabled={saving}
              className="min-w-0 flex-1 px-3 text-[13px] sm:flex-none sm:px-4 sm:text-sm"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 flex-shrink-0 animate-spin" />}
              <span className="truncate">{submitLabel}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
