import { useEffect, useMemo, useRef, useState } from "react"
import { format, subDays } from "date-fns"
import {
  Banknote,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  Settings2,
  Smartphone,
  Split,
  TrendingDown,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiErrorMessage } from "@/lib/apiError"
import { PAYMENT_METHODS } from "@/lib/paymentMethods"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import { tr } from "@/i18n"
import { useCreateExpense, type ExpensePaymentPart } from "../api/expenses"
import { useCreateExpenseCategory, type ExpenseCategory } from "../api/expenseCategories"
import {
  DEFAULT_CATEGORY_NAMES,
  QUICK_AMOUNTS,
  findCategory,
  formatAmountInput,
  hashColor,
  parseAmountInput,
  titlePlaceholder,
  visualOf,
} from "../lib/categoryStyle"

/* Yangi xarajat oynasi.

   Tartib pul kiritish odatiga mos: avval SUMMA (katta maydon, minglik
   bo'shliqlar, tez qo'shish tugmalari), keyin TOIFA (belgili kartochkalar
   — bir bosish), keyin nom, to'lov turi, sana, izoh. Nom bo'sh qolsa
   toifa nomi yoziladi — "Gaz" xarajati uchun alohida nom o'ylash shart
   emas.

   Toifalar ro'yxati serverdan; uni boshqara oladigan xodim shu yerdan
   yangi toifa qo'sha oladi (oynadan chiqmasdan). Eski server (toifalar
   yo'q) bilan ham ishlaydi: oddiy matn maydoni va namunalar ro'yxati.

   QISMAN TO'LOV: summa bir necha to'lov turiga bo'linadi (60 000 naqd +
   40 000 online). Har tur uchun bitta maydon, "qolgani" tugmasi qoldiqni
   shu turga yozadi; yig'indi summaga teng bo'lmaguncha saqlanmaydi.
   Server har bo'lakni alohida qator qilib yozadi — kassadan faqat naqd
   bo'lak chiqadi, ro'yxatda esa bitta xarajat ko'rinadi. */

const METHOD_ICONS: Record<string, typeof Banknote> = {
  CASH: Banknote,
  CARD: CreditCard,
  ONLINE: Smartphone,
  BANK_TRANSFER: Landmark,
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

export function ExpenseFormDialog({
  open,
  onClose,
  categories,
  categoriesReady,
  categoriesLoading = false,
  canManageCategories,
  onManageCategories,
  todayStr,
}: {
  open: boolean
  onClose: () => void
  /** Faol toifalar (ro'yxat tartibida) */
  categories: ExpenseCategory[]
  /** Server toifalarni berdi (false — eski server yoki xato: matn maydoni) */
  categoriesReady: boolean
  /** Ro'yxat hali yuklanmoqda — kartochkalar o'rnida skelet */
  categoriesLoading?: boolean
  canManageCategories: boolean
  onManageCategories?: () => void
  todayStr: string
}) {
  const user = useAuthStore((s) => s.user)
  const createExpense = useCreateExpense()
  const createCategory = useCreateExpenseCategory()

  const [amountStr, setAmountStr] = useState("")
  const [categoryName, setCategoryName] = useState("")
  const [title, setTitle] = useState("")
  const [method, setMethod] = useState("CASH")
  const [expenseDate, setExpenseDate] = useState(todayStr)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [newCatOpen, setNewCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  // Qisman to'lov: to'lov turi → kiritilgan summa (formatlangan satr)
  const [splitOn, setSplitOn] = useState(false)
  const [partAmounts, setPartAmounts] = useState<Record<string, string>>({})
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAmountStr("")
    setCategoryName("")
    setTitle("")
    setMethod("CASH")
    setExpenseDate(todayStr)
    setNotes("")
    setError(null)
    setNewCatOpen(false)
    setNewCatName("")
    setSplitOn(false)
    setPartAmounts({})
    // Oyna ochilishi bilan summa yoziladi
    const t = window.setTimeout(() => amountRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, todayStr])

  const yesterdayStr = useMemo(
    () => format(subDays(new Date(`${todayStr}T12:00:00`), 1), "yyyy-MM-dd"),
    [todayStr]
  )

  const amount = parseAmountInput(amountStr)
  const selected = findCategory(categoryName, categories)
  const effectiveTitle = title.trim() || (categoryName ? tr(categoryName) : "")

  // Qisman to'lov bo'laklari (bo'sh maydonlar tashlanadi)
  const parts: ExpensePaymentPart[] = splitOn
    ? PAYMENT_METHODS.flatMap((m) => {
        const value = parseAmountInput(partAmounts[m.value] || "")
        return value === null ? [] : [{ payment_method: m.value, amount: value }]
      })
    : []
  const partsSum = parts.reduce((s, p) => s + p.amount, 0)
  const remainder = (amount ?? 0) - partsSum
  // Bo'lingan: yig'indi summaga teng va kamida bitta bo'lak bor
  const splitReady = !splitOn || (amount !== null && remainder === 0 && parts.length > 0)
  const canSave = amount !== null && effectiveTitle.length > 0 && splitReady && !createExpense.isPending
  const methodLabelOf = (code: string) => PAYMENT_METHODS.find((m) => m.value === code)?.label || code
  const methodLabel =
    splitOn && parts.length > 1
      ? parts.map((p) => `${methodLabelOf(p.payment_method)} ${fmt(p.amount)}`).join(" + ")
      : methodLabelOf(splitOn && parts.length === 1 ? parts[0].payment_method : method)

  const setPart = (code: string, raw: string) =>
    setPartAmounts((prev) => ({ ...prev, [code]: formatAmountInput(raw) }))

  const toggleSplit = () => {
    if (splitOn) {
      setSplitOn(false)
      setPartAmounts({})
      return
    }
    // Tanlangan tur butun summani oladi — xodim faqat ikkinchisini yozadi
    setPartAmounts(amount !== null ? { [method]: formatAmountInput(String(amount)) } : {})
    setSplitOn(true)
  }

  const addQuick = (value: number) => {
    setAmountStr(formatAmountInput(String((amount || 0) + value)))
    amountRef.current?.focus()
  }

  const save = async () => {
    if (amount === null) {
      setError(tr("Summani to'g'ri kiriting (0 dan katta)"))
      return
    }
    if (!effectiveTitle) {
      setError(tr("Xarajat nomini kiriting yoki toifa tanlang"))
      return
    }
    if (splitOn && (parts.length === 0 || remainder !== 0)) {
      setError(
        remainder > 0
          ? tr("Qisman to'lov to'liq taqsimlanmagan: {{amount}} So'm qoldi", { amount: fmt(remainder) })
          : tr("Bo'laklar yig'indisi summadan {{amount}} So'm ortiq", { amount: fmt(-remainder) })
      )
      return
    }
    setError(null)
    // Bitta bo'lak qolsa — oddiy xarajat o'sha tur bilan
    const singleMethod = splitOn && parts.length === 1 ? parts[0].payment_method : method
    try {
      await createExpense.mutateAsync({
        // Nom bo'sh qolsa toifa nomi (bazadagi o'zbekcha yozilishi) yoziladi
        title: title.trim() || categoryName,
        amount,
        category: categoryName.trim() || undefined,
        payment_method: singleMethod,
        payments: splitOn && parts.length > 1 ? parts : undefined,
        expense_date: expenseDate || undefined,
        notes: notes.trim() || undefined,
        hotelId: user?.hotel_id,
      })
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const addCategory = async () => {
    const name = newCatName.replace(/\s+/g, " ").trim()
    if (!name) return
    const existing = findCategory(name, categories)
    if (existing) {
      setCategoryName(existing.name)
      setNewCatOpen(false)
      setNewCatName("")
      return
    }
    try {
      const created = await createCategory.mutateAsync({
        name,
        icon: "tag",
        color: hashColor(name),
      })
      setCategoryName(created.name)
      setNewCatOpen(false)
      setNewCatName("")
      setError(null)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSave) {
      e.preventDefault()
      void save()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[540px]">
        {/* Grid bo'laklarida `min-w-0`: ichidagi maydonlar (qisman to'lov
            qatorlari, uzun yig'ma satr) tor ekranda oynani kengaytirmasin */}
        <DialogHeader className="min-w-0 border-b border-gray-100 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <TrendingDown className="h-4 w-4" />
            </span>
            {tr("Yangi xarajat")}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {tr("Summa, toifa va sana — qolgani ixtiyoriy. Kim kiritgani avtomatik yoziladi.")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 px-5 py-4">
          {/* SUMMA */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600" htmlFor="expense-amount">
              {tr("Summa")}
            </label>
            <div className="relative">
              <input
                id="expense-amount"
                ref={amountRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={amountStr}
                onChange={(e) => setAmountStr(formatAmountInput(e.target.value))}
                onKeyDown={onEnter}
                placeholder="0"
                className={cn(
                  "h-14 w-full rounded-xl border border-gray-200 bg-white pr-16 pl-4 text-2xl font-bold text-gray-900 tabular-nums tracking-tight outline-none transition-colors",
                  "placeholder:text-gray-300 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                )}
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-gray-400">
                {tr("So'm")}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => addQuick(q)}
                  className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 tabular-nums transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  +{fmt(q)}
                </button>
              ))}
              {amount !== null && (
                <button
                  type="button"
                  onClick={() => setAmountStr("")}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-600"
                >
                  {tr("Tozalash")}
                </button>
              )}
            </div>
          </div>

          {/* TOIFA */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-gray-600">{tr("Toifa")}</label>
              {categoriesReady && canManageCategories && onManageCategories && (
                <button
                  type="button"
                  onClick={onManageCategories}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700"
                >
                  <Settings2 className="h-3 w-3" />
                  {tr("Toifalarni sozlash")}
                </button>
              )}
            </div>

            {categoriesReady && categoriesLoading ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-[70px] rounded-xl" />
                ))}
              </div>
            ) : categoriesReady ? (
              <>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {categories.map((c) => {
                    const { Icon, color } = visualOf(c)
                    const isSel = selected?.id === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategoryName(isSel ? "" : c.name)}
                        aria-pressed={isSel}
                        title={tr(c.name)}
                        className={cn(
                          "flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center transition-all",
                          isSel
                            ? cn("ring-2", color.selected)
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            isSel ? color.solid : color.icon
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span
                          className={cn(
                            "w-full truncate text-[11px] leading-tight font-medium",
                            isSel ? "text-gray-900" : "text-gray-600"
                          )}
                        >
                          {tr(c.name)}
                        </span>
                      </button>
                    )
                  })}
                  {canManageCategories && !newCatOpen && (
                    <button
                      type="button"
                      onClick={() => setNewCatOpen(true)}
                      className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-1.5 py-2.5 text-center text-gray-500 transition-colors hover:border-primary-300 hover:bg-primary-50/40 hover:text-primary-700"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
                        <Plus className="h-4 w-4" />
                      </span>
                      <span className="w-full truncate text-[11px] leading-tight font-medium">
                        {tr("Yangi toifa")}
                      </span>
                    </button>
                  )}
                </div>
                {newCatOpen && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50/40 p-2">
                    <Input
                      autoFocus
                      value={newCatName}
                      maxLength={50}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void addCategory()
                        }
                        if (e.key === "Escape") setNewCatOpen(false)
                      }}
                      placeholder={tr("Toifa nomi, masalan: Qo'riqlash")}
                      className="h-9 bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={addCategory}
                      disabled={!newCatName.trim() || createCategory.isPending}
                    >
                      {createCategory.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        tr("Qo'shish")
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewCatOpen(false)
                        setNewCatName("")
                      }}
                    >
                      {tr("Bekor")}
                    </Button>
                  </div>
                )}
                {categories.length === 0 && !newCatOpen && (
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    {tr("Toifalar hali yo'q — xarajat toifasiz ham saqlanadi.")}
                  </p>
                )}
              </>
            ) : (
              <>
                <Input
                  list="expense-categories"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder={tr("Tanlang yoki yozing")}
                />
                <datalist id="expense-categories">
                  {DEFAULT_CATEGORY_NAMES.map((c) => (
                    // Qiymat o'zbekcha saqlanadi; boshqa tilda yonida tarjimasi turadi
                    <option key={c} value={c} label={tr(c) !== c ? tr(c) : undefined} />
                  ))}
                </datalist>
              </>
            )}
          </div>

          {/* NOMI */}
          <div>
            <label className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-gray-600" htmlFor="expense-title">
              <span>{tr("Nomi")}</span>
              {categoryName && !title.trim() && (
                <span className="text-[11px] font-normal text-gray-400">
                  {tr("bo'sh qolsa: {{name}}", { name: tr(categoryName) })}
                </span>
              )}
            </label>
            <Input
              id="expense-title"
              value={title}
              maxLength={255}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={onEnter}
              placeholder={titlePlaceholder(categoryName)}
            />
          </div>

          {/* TO'LOV TURI — bitta yoki qisman (bir necha tur) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-gray-600">{tr("To'lov turi")}</label>
              <button
                type="button"
                onClick={toggleSplit}
                aria-pressed={splitOn}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                  splitOn
                    ? "bg-primary-100 text-primary-700"
                    : "text-primary-600 hover:bg-primary-50 hover:text-primary-700"
                )}
              >
                <Split className="h-3 w-3" />
                {splitOn ? tr("Bitta to'lov turi") : tr("Qisman to'lov")}
              </button>
            </div>

            {!splitOn ? (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = METHOD_ICONS[m.value] || Banknote
                  const isSel = method === m.value
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      aria-pressed={isSel}
                      title={m.label}
                      className={cn(
                        "flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                        isSel
                          ? "border-primary-400 bg-primary-50 text-primary-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-primary-200 bg-primary-50/30 p-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = METHOD_ICONS[m.value] || Banknote
                  const raw = partAmounts[m.value] || ""
                  const value = parseAmountInput(raw)
                  return (
                    <div key={m.value} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex w-[128px] flex-shrink-0 items-center gap-1.5 text-xs font-medium sm:w-[150px]",
                          value !== null ? "text-gray-900" : "text-gray-500"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{m.label}</span>
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={m.label}
                        value={raw}
                        onChange={(e) => setPart(m.value, e.target.value)}
                        onKeyDown={onEnter}
                        placeholder="0"
                        className={cn(
                          "h-9 w-0 min-w-0 flex-1 rounded-lg border bg-white px-2.5 text-sm font-semibold tabular-nums outline-none transition-colors",
                          "placeholder:font-normal placeholder:text-gray-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-100",
                          value !== null ? "border-primary-300 text-gray-900" : "border-gray-200"
                        )}
                      />
                      {remainder > 0 && (
                        <button
                          type="button"
                          onClick={() => setPart(m.value, String((value ?? 0) + remainder))}
                          title={tr("Qolgan summani shu turga yozish")}
                          className="flex-shrink-0 rounded-md px-1.5 py-1 text-[11px] font-medium text-primary-600 hover:bg-primary-100"
                        >
                          +{fmt(remainder)}
                        </button>
                      )}
                    </div>
                  )
                })}
                <p
                  className={cn(
                    "pt-0.5 text-[11px] font-medium",
                    amount === null
                      ? "text-gray-400"
                      : remainder === 0 && parts.length > 1
                        ? "text-emerald-700"
                        : remainder === 0
                          ? "text-gray-500"
                          : remainder > 0
                            ? "text-amber-700"
                            : "text-red-600"
                  )}
                  aria-live="polite"
                >
                  {amount === null
                    ? tr("Avval summani kiriting, keyin uni turlarga bo'ling")
                    : remainder === 0 && parts.length > 1
                      ? tr("Taqsimlandi: {{parts}}", { parts: methodLabel })
                      : remainder === 0
                        ? tr("Hammasi bitta turda — oddiy xarajat sifatida saqlanadi")
                        : remainder > 0
                          ? tr("Qoldi: {{amount}} So'm", { amount: fmt(remainder) })
                          : tr("Ortiqcha: {{amount}} So'm", { amount: fmt(-remainder) })}
                </p>
              </div>
            )}
          </div>

          {/* SANA */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600" htmlFor="expense-date">
              {tr("Sana")}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: todayStr, label: tr("Bugun") },
                { key: yesterdayStr, label: tr("Kecha") },
              ].map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setExpenseDate(d.key)}
                  aria-pressed={expenseDate === d.key}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    expenseDate === d.key
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {d.label}
                </button>
              ))}
              <Input
                id="expense-date"
                type="date"
                max={todayStr}
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="h-[34px] w-[160px] text-xs"
              />
              {expenseDate && expenseDate !== todayStr && expenseDate !== yesterdayStr && (
                <span className="text-[11px] text-gray-400">{tr("Boshqa sana tanlangan")}</span>
              )}
            </div>
          </div>

          {/* IZOH */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600" htmlFor="expense-notes">
              {tr("Izoh")}
              <span className="ml-1 font-normal text-gray-400">({tr("ixtiyoriy")})</span>
            </label>
            <Input
              id="expense-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={onEnter}
              placeholder={tr("Qo'shimcha izoh...")}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-600">{error}</p>
          )}
        </div>

        {/* `min-w-0`: yig'ma satr uzun bo'lsa ham (qisman to'lov) oynani
            kengaytirmaydi — grid elementi o'z matniga qarab cho'zilmasin */}
        <DialogFooter className="min-w-0 flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate text-xs text-gray-500" title={amount !== null ? methodLabel : undefined}>
            {amount !== null ? (
              <>
                <span className="font-semibold text-gray-900 tabular-nums">
                  {tr("{{amount}} So'm", { amount: fmt(amount) })}
                </span>
                {" · "}
                {categoryName ? tr(categoryName) : tr("toifasiz")}
                {" · "}
                {methodLabel}
                {" · "}
                {expenseDate === todayStr ? tr("bugun") : expenseDate === yesterdayStr ? tr("kecha") : expenseDate}
              </>
            ) : (
              tr("Summani kiriting")
            )}
          </p>
          <div className="flex flex-shrink-0 gap-2">
            <Button variant="outline" onClick={onClose}>
              {tr("Bekor qilish")}
            </Button>
            <Button onClick={save} disabled={!canSave}>
              {createExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Saqlash")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
