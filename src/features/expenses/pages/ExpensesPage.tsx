import { useState, useMemo } from "react"
import { format } from "date-fns"
import { TrendingDown, Plus, Trash2, Loader2, User as UserIcon } from "lucide-react"
import { useExpenses, useCreateExpense, useDeleteExpense } from "../api/expenses"
import type { Expense } from "@/types/api"
import { usePermissions } from "@/lib/permissions"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  buildDatePresets,
  isRangeInverted,
  resolveDateRange,
} from "@/lib/datePresets"
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/paymentMethods"

const selectClass =
  "w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

// Tez-tez ishlatiladigan kategoriyalar — istalgan matn ham kiritsa bo'ladi
const CATEGORY_SUGGESTIONS = [
  "Oziq-ovqat",
  "Kommunal to'lovlar",
  "Ta'mirlash",
  "Xo'jalik buyumlari",
  "Ish haqi",
  "Transport",
  "Soliqlar",
  "Reklama",
  "Boshqa",
]

// Nomlar va ro'yxat butun ilova uchun bitta joyda
const METHOD_LABELS = PAYMENT_METHOD_LABELS

const fmt = (n: number) => Number(n || 0).toLocaleString()

const initials = (name?: string | null) => {
  const parts = (name || "").trim().split(/\s+/)
  return (
    `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?"
  )
}

export const ExpensesPage = () => {
  const { can } = usePermissions()
  // Xarajat kiritish barcha rollar uchun ochiq (backend ham shunday);
  // o'chirish esa expense.delete ruxsati bilan (admin avtomatik)
  const canCreate = true
  const canDelete = can("expense.delete")
  const user = useAuthStore((s) => s.user)

  const todayStr = format(new Date(), "yyyy-MM-dd")

  /* Davr tanlash. Qaysi tugma bosilgani KALIT sifatida saqlanadi, sanalarga
     qarab topilmaydi: ikki davr bir xil oraliqqa tushishi mumkin (oyning
     1-kunida "Shu oy" = "Bugun", 7-kunida "Shu oy" = "Oxirgi 7 kun") va
     o'shanda tanlov noto'g'ri tugmada qolib ketardi. Batafsil izoh
     `lib/datePresets.ts` da. */
  const [presetKey, setPresetKey] = useState<string | null>("today")
  const [custom, setCustom] = useState({ from: todayStr, to: todayStr })

  // Kun almashsa tugmalar sanasi ham yangilanadi — sahifa yarim tundan
  // o'tib ketsa "Bugun" kechagi kunda qolib ketmasin.
  const presets = useMemo(() => buildDatePresets(new Date(todayStr)), [todayStr])
  const { from: dateFrom, to: dateTo } = resolveDateRange(
    presets,
    presetKey,
    custom
  )
  const rangeInverted = isRangeInverted(dateFrom, dateTo)

  const selectPreset = (p: { key: string; from: string; to: string }) => {
    setPresetKey(p.key)
    // Qo'lda tahrirlashga o'tilganda shu sanalardan davom etsin
    setCustom({ from: p.from, to: p.to })
  }

  const editRange = (next: { from: string; to: string }) => {
    setCustom(next)
    setPresetKey(null)
  }

  const {
    data: expenses = [],
    isLoading,
    isFetching,
  } = useExpenses(dateFrom, dateTo, true, { keepPrevious: true })
  const createMutation = useCreateExpense()
  const deleteMutation = useDeleteExpense()

  // Eski backendda date_from/date_to bo'lmasa ham to'g'ri ishlashi uchun
  // mijoz tomonida ham filtrlaymiz
  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        const d = String(e.expense_date || "").slice(0, 10)
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
        return true
      }),
    [expenses, dateFrom, dateTo]
  )

  const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0)

  // Kategoriyalar bo'yicha taqsimot
  const byCategory = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of filtered) {
      const key = e.category || "Boshqa"
      m[key] = (m[key] || 0) + Number(e.amount || 0)
    }
    return Object.entries(m).sort(([, a], [, b]) => b - a)
  }, [filtered])

  // --- Qo'shish dialogi ---
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("")
  const [method, setMethod] = useState("CASH")
  const [expenseDate, setExpenseDate] = useState(todayStr)
  const [notes, setNotes] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const openCreate = () => {
    setTitle("")
    setAmount("")
    setCategory("")
    setMethod("CASH")
    setExpenseDate(todayStr)
    setNotes("")
    setErrorMsg(null)
    setModalOpen(true)
  }

  const onSubmit = async () => {
    if (!title.trim()) {
      setErrorMsg("Xarajat nomini kiriting")
      return
    }
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setErrorMsg("Summani to'g'ri kiriting (0 dan katta)")
      return
    }
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        amount: amt,
        category: category.trim() || undefined,
        payment_method: method,
        expense_date: expenseDate || undefined,
        notes: notes.trim() || undefined,
        hotelId: user?.hotel_id,
      })
      setModalOpen(false)
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
    }
  }

  const onDelete = async (e: Expense) => {
    if (!confirm(`"${e.title}" xarajatini o'chirasizmi?`)) return
    try {
      await deleteMutation.mutateAsync({ id: e.id, hotelId: user?.hotel_id })
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Xarajatlar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Xarajatlar</h1>
          <p className="text-sm text-gray-500 mt-1">
            {dateFrom || dateTo
              ? `Davr: ${dateFrom || "..."} — ${dateTo || "..."}`
              : "Davr: barcha davr"}{" "}
            · {filtered.length} ta chiqim
            {/* Davr almashganda eski ro'yxat joyida qoladi, shuning uchun
                yangilanayotganini shu kichik belgi bildiradi. */}
            {isFetching && (
              <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-gray-400" />
            )}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Xarajat qo'shish
          </Button>
        )}
      </div>

      {/* Davr tanlash */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => selectPreset(p)}
              aria-pressed={presetKey === p.key}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                presetKey === p.key
                  ? "border-primary-600 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Sanadan</label>
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => editRange({ from: e.target.value, to: dateTo })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Sanagacha</label>
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => editRange({ from: dateFrom, to: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Teskari oraliqda ro'yxat doim bo'sh chiqadi. Buni aytmasak,
          "xarajatlar yo'q" degan yozuv sanalar almashib qolganini emas,
          xarajat yozilmaganini bildirayotgandek tuyuladi. */}
      {rangeInverted && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Boshlanish sanasi tugash sanasidan keyin turibdi — shuning uchun
          ro'yxat bo'sh. Sanalarni almashtirib ko'ring.
        </p>
      )}

      {/* Jami + kategoriyalar taqsimoti */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border bg-white px-4 py-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <TrendingDown className="h-4.5 w-4.5" size={18} />
          </span>
          <div>
            <p className="text-xs text-gray-500">Jami xarajat</p>
            <p className="text-lg font-bold text-gray-900">{fmt(total)} So'm</p>
          </div>
        </div>
        {byCategory.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {byCategory.map(([cat, sum]) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
              >
                <span className="font-medium">{cat}:</span>
                <span className="font-semibold text-gray-900">{fmt(sum)} So'm</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* MOBIL: xarajatlar karta ko'rinishida (jadval planshet/desktopda) */}
      <div className="space-y-2.5 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
            Tanlangan davrda xarajatlar yo'q
          </div>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="rounded-2xl border bg-white p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 leading-tight">{e.title}</p>
                  {e.notes && (
                    <p className="mt-0.5 truncate text-xs leading-tight text-gray-400">
                      {e.notes}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                    {e.expense_date} · {METHOD_LABELS[e.payment_method] || e.payment_method}
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold text-red-600">
                    −{fmt(e.amount)}{" "}
                    <span className="text-xs font-normal text-gray-400">So'm</span>
                  </span>
                  {e.category ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {e.category}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-2.5">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-[10px] font-semibold text-white">
                  {e.created_by_name ? (
                    initials(e.created_by_name)
                  ) : (
                    <UserIcon className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="truncate text-sm text-gray-700">
                  {e.created_by_name || "Noma'lum"}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    title="O'chirish"
                    onClick={() => onDelete(e)}
                    className="ml-auto p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
      <div className="hidden rounded-lg border bg-white overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead>Sana</TableHead>
              <TableHead>Xarajat</TableHead>
              <TableHead>Kategoriya</TableHead>
              <TableHead>To'lov turi</TableHead>
              <TableHead>Kim kiritgan</TableHead>
              <TableHead className="text-right">Summa</TableHead>
              {canDelete && <TableHead className="text-right">Amallar</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 7 : 6} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <TrendingDown className="h-8 w-8" />
                    <p className="text-sm">Tanlangan davrda xarajatlar yo'q</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-gray-600">{e.expense_date}</TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900 leading-tight">{e.title}</p>
                    {e.notes && (
                      <p className="text-xs text-gray-400 leading-tight mt-0.5 max-w-[280px] truncate">
                        {e.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {e.category ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {e.category}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {METHOD_LABELS[e.payment_method] || e.payment_method}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-[10px] font-semibold text-white">
                        {e.created_by_name ? (
                          initials(e.created_by_name)
                        ) : (
                          <UserIcon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="text-gray-700">
                        {e.created_by_name || "Noma'lum"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    −{fmt(e.amount)}{" "}
                    <span className="text-xs font-normal text-gray-400">So'm</span>
                  </TableCell>
                  {canDelete && (
                    <TableCell className="text-right">
                      <button
                        type="button"
                        title="O'chirish"
                        onClick={() => onDelete(e)}
                        className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Qo'shish dialogi */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Yangi xarajat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Xarajat nomi *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Kir yuvish vositalari"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Summa (So'm) *</label>
                <Input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Masalan: 150000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Sana</label>
                <Input
                  type="date"
                  max={todayStr}
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Kategoriya</label>
                <Input
                  list="expense-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Tanlang yoki yozing"
                />
                <datalist id="expense-categories">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">To'lov turi</label>
                <select
                  className={selectClass}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map(({ value: v, label: l }) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Izoh</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Qo'shimcha izoh..."
              />
            </div>
            {errorMsg && (
              <p className="text-sm text-red-500 whitespace-pre-line">{errorMsg}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={onSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
