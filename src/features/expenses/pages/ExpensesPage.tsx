import { useState, useMemo } from "react"
import { format } from "date-fns"
import { TrendingDown, Plus, Trash2, Loader2, User as UserIcon, Tags, X } from "lucide-react"
import { useExpenses, useDeleteExpense } from "../api/expenses"
import { useExpenseCategories } from "../api/expenseCategories"
import type { Expense } from "@/types/api"
import { usePermissions } from "@/lib/permissions"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  buildDatePresets,
  isRangeInverted,
  resolveDateRange,
} from "@/lib/datePresets"
import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"
import { tr } from "@/i18n"
import { CategoryChip } from "../components/CategoryChip"
import { ExpenseCategoriesDialog } from "../components/ExpenseCategoriesDialog"
import { ExpenseFormDialog } from "../components/ExpenseFormDialog"
import { categoryVisual, nameKey } from "../lib/categoryStyle"

/* Xarajatlar sahifasi.

   Toifalar serverdagi ro'yxatdan (Toifalar oynasi — administrator va
   xarajatni o'chira oladigan xodim boshqaradi). Xarajatda toifa NOM
   bilan saqlanadi, shuning uchun eski, ro'yxatda bo'lmagan nomlar ham
   avvalgidek ko'rinadi va yig'indiga kiradi. Toifa chipini bosish
   ro'yxatni shu toifaga filtrlaydi. */

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

  /* Toifalar ro'yxati — chiplar, filtr va yangi xarajat oynasi uchun.
     Eski server (toifalar yo'q) xato qaytaradi — oyna oddiy matn
     maydoniga tushadi, sahifa qolgan qismi avvalgidek ishlaydi. */
  const categoriesQuery = useExpenseCategories(false, true)
  const categories = categoriesQuery.data?.items ?? []
  const categoriesReady = !categoriesQuery.isError
  // Serverning javobi aniq; kelmagan bo'lsa o'chirish ruxsati bilan bir xil
  const canManageCategories = categoriesQuery.data?.can_manage ?? canDelete

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
  const deleteMutation = useDeleteExpense()

  // Eski backendda date_from/date_to bo'lmasa ham to'g'ri ishlashi uchun
  // mijoz tomonida ham filtrlaymiz
  const inRange = useMemo(
    () =>
      expenses.filter((e) => {
        const d = String(e.expense_date || "").slice(0, 10)
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
        return true
      }),
    [expenses, dateFrom, dateTo]
  )

  // Toifasiz xarajat hisobotdagidek "Boshqa" ga yig'iladi (server ham shunday)
  const categoryOf = (e: Expense) => e.category || /* i18n:skip */ "Boshqa"

  // Toifa filtri — chip bosilganda; davr almashsa ham turadi
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const filtered = useMemo(
    () =>
      categoryFilter
        ? inRange.filter((e) => nameKey(categoryOf(e)) === nameKey(categoryFilter))
        : inRange,
    [inRange, categoryFilter]
  )

  const total = inRange.reduce((s, e) => s + Number(e.amount || 0), 0)
  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount || 0), 0)

  // Kategoriyalar bo'yicha taqsimot — davrdagi hamma xarajat (filtrsiz),
  // aks holda filtr bosilgach qolgan chiplar yo'qolib qolardi
  const byCategory = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of inRange) {
      const key = categoryOf(e)
      m[key] = (m[key] || 0) + Number(e.amount || 0)
    }
    return Object.entries(m).sort(([, a], [, b]) => b - a)
  }, [inRange])

  // --- Oynalar: yangi xarajat va toifalar ---
  const [modalOpen, setModalOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  const onDelete = async (e: Expense) => {
    if (!confirm(tr("\"{{title}}\" xarajatini o'chirasizmi?", { title: e.title }))) return
    try {
      await deleteMutation.mutateAsync({ id: e.id, hotelId: user?.hotel_id })
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{tr("Xarajatlar")}</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr("Xarajatlar")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tr("{{v}} · {{count}} ta chiqim", { v: dateFrom || dateTo
              ? tr("Davr: {{v}} — {{v2}}", { v: dateFrom || "...", v2: dateTo || "..." })
              : tr("Davr: barcha davr"), count: filtered.length })}
            {/* Davr almashganda eski ro'yxat joyida qoladi, shuning uchun
                yangilanayotganini shu kichik belgi bildiradi. */}
            {isFetching && (
              <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-gray-400" />
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {categoriesReady && canManageCategories && (
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
              <Tags className="h-4 w-4 mr-2" />
              {tr("Toifalar")}
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {tr("Xarajat qo'shish")}
            </Button>
          )}
        </div>
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
        {/* Bitta kalendar — moliya sahifasidagi bilan bir xil: oraliq ikki
            bosishda, tez tugmalar ichida, aniq sana qo'lda pastdagi maydonlarda */}
        <DateRangePicker
          value={{ from: dateFrom, to: dateTo }}
          onChange={editRange}
          presets={presets}
          presetKey={presetKey}
          onPreset={selectPreset}
        />
      </div>

      {/* Teskari oraliqda ro'yxat doim bo'sh chiqadi. Buni aytmasak,
          "xarajatlar yo'q" degan yozuv sanalar almashib qolganini emas,
          xarajat yozilmaganini bildirayotgandek tuyuladi. */}
      {rangeInverted && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {tr("Boshlanish sanasi tugash sanasidan keyin turibdi — shuning uchun ro'yxat bo'sh. Sanalarni almashtirib ko'ring.")}
        </p>
      )}

      {/* Jami + kategoriyalar taqsimoti */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border bg-white px-4 py-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <TrendingDown className="h-4.5 w-4.5" size={18} />
          </span>
          <div>
            <p className="text-xs text-gray-500">{tr("Jami xarajat")}</p>
            <p className="text-lg font-bold text-gray-900">{tr("{{total}} So'm", { total: fmt(total) })}</p>
          </div>
        </div>
        {byCategory.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {byCategory.map(([cat, sum]) => {
              const { Icon, color } = categoryVisual(cat, categories)
              const active = categoryFilter !== null && nameKey(categoryFilter) === nameKey(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(active ? null : cat)}
                  aria-pressed={active}
                  title={active ? tr("Filtrni olib tashlash") : tr("Faqat shu toifani ko'rsatish")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-[box-shadow,opacity]",
                    color.chip,
                    active ? "ring-2 ring-gray-900/30 ring-offset-1" : "hover:opacity-85",
                    categoryFilter !== null && !active && "opacity-55"
                  )}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" aria-hidden />
                  <span className="font-medium">{tr(cat)}</span>
                  <span className="font-semibold tabular-nums">{fmt(sum)}</span>
                </button>
              )
            })}
            {categoryFilter !== null && (
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-3 w-3" />
                {tr("Hammasi")}
              </button>
            )}
          </div>
        )}
      </div>

      {categoryFilter !== null && (
        <p className="-mt-3 text-xs text-gray-500">
          {tr("Filtr: {{name}} — {{count}} ta, {{total}} So'm", {
            name: tr(categoryFilter),
            count: filtered.length,
            total: fmt(filteredTotal),
          })}
        </p>
      )}

      {/* MOBIL: xarajatlar karta ko'rinishida (jadval planshet/desktopda) */}
      <div className="space-y-2.5 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-gray-400">
            {categoryFilter !== null
              ? tr("Bu toifada tanlangan davrda xarajat yo'q")
              : tr("Tanlangan davrda xarajatlar yo'q")}
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
                    <span className="text-xs font-normal text-gray-400">{tr("So'm")}</span>
                  </span>
                  {e.category ? (
                    <CategoryChip name={e.category} categories={categories} />
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
                  {e.created_by_name || tr("Noma'lum")}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    title={tr("O'chirish")}
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
              <TableHead>{tr("Sana")}</TableHead>
              <TableHead>{tr("Xarajat")}</TableHead>
              <TableHead>{tr("Kategoriya")}</TableHead>
              <TableHead>{tr("To'lov turi")}</TableHead>
              <TableHead>{tr("Kim kiritgan")}</TableHead>
              <TableHead className="text-right">{tr("Summa")}</TableHead>
              {canDelete && <TableHead className="text-right">{tr("Amallar")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 7 : 6} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <TrendingDown className="h-8 w-8" />
                    <p className="text-sm">
                      {categoryFilter !== null
                        ? tr("Bu toifada tanlangan davrda xarajat yo'q")
                        : tr("Tanlangan davrda xarajatlar yo'q")}
                    </p>
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
                      <CategoryChip name={e.category} categories={categories} />
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
                        {e.created_by_name || tr("Noma'lum")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    −{fmt(e.amount)}{" "}
                    <span className="text-xs font-normal text-gray-400">{tr("So'm")}</span>
                  </TableCell>
                  {canDelete && (
                    <TableCell className="text-right">
                      <button
                        type="button"
                        title={tr("O'chirish")}
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

      <ExpenseFormDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        categoriesReady={categoriesReady}
        categoriesLoading={categoriesQuery.isLoading}
        canManageCategories={canManageCategories}
        onManageCategories={() => setCategoriesOpen(true)}
        todayStr={todayStr}
      />
      <ExpenseCategoriesDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </div>
  )
}
