import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Tags,
  Trash2,
  X,
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
import { tr } from "@/i18n"
import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useReorderExpenseCategories,
  useUpdateExpenseCategory,
  type ExpenseCategory,
} from "../api/expenseCategories"
import {
  CATEGORY_COLORS,
  COLOR_KEYS,
  FALLBACK_COLOR,
  FALLBACK_ICON,
  ICON_KEYS,
  findCategory,
  hashColor,
  iconFor,
  visualOf,
} from "../lib/categoryStyle"

/* Xarajat toifalarini boshqarish — administrator va xarajatni o'chira
   oladigan xodim uchun.

   Toifa xarajatda NOM bilan saqlanadi, shuning uchun:
   * qayta nomlash eski xarajatlarga ham o'tadi (hisobot bo'linmaydi);
   * ishlatilgan toifa o'chirilmaydi — ARXIVGA tushadi (tanlovdan chiqadi,
     xarajatlar o'z toifasida qoladi), qayta yoqsa bo'ladi;
   * ishlatilmagani butunlay o'chadi.

   Har amal darhol serverga yoziladi (alohida "Saqlash" yo'q): toifalar
   bir-biriga bog'liq emas, tartib esa o'q tugmalari bilan — har bosish
   bitta so'rov. */

const fmt = (n: number) => Number(n || 0).toLocaleString()

function IconPicker({
  value,
  onChange,
  colorKey,
}: {
  value: string
  onChange: (icon: string) => void
  colorKey: string
}) {
  const color = CATEGORY_COLORS[colorKey] || CATEGORY_COLORS[FALLBACK_COLOR]
  return (
    <div className="grid grid-cols-9 gap-1 sm:grid-cols-11" role="listbox" aria-label={tr("Belgi")}>
      {ICON_KEYS.map((key) => {
        const Icon = iconFor(key)
        const isSel = key === value
        return (
          <button
            key={key}
            type="button"
            role="option"
            aria-selected={isSel}
            onClick={() => onChange(key)}
            title={key}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
              isSel ? cn("border-transparent", color.solid) : "border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="listbox" aria-label={tr("Rang")}>
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="option"
          aria-selected={key === value}
          onClick={() => onChange(key)}
          title={key}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-transform",
            CATEGORY_COLORS[key].swatch,
            key === value ? "scale-110 ring-2 ring-gray-900/40 ring-offset-1" : "hover:scale-110"
          )}
        >
          {key === value && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      ))}
    </div>
  )
}

/** Toifa qatori ko'rinishi (tahrir rejimi bilan). */
function CategoryRow({
  category,
  index,
  count,
  taken,
  onMove,
  onSave,
  onRemove,
  busy,
}: {
  category: ExpenseCategory
  index: number
  count: number
  /** Boshqa toifalar (nom to'qnashuvini mijozda ham ko'rsatish uchun) */
  taken: ExpenseCategory[]
  onMove: (dir: -1 | 1) => void
  onSave: (payload: { name: string; icon: string; color: string }) => Promise<void>
  onRemove: () => void
  busy: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon || FALLBACK_ICON)
  const [color, setColor] = useState(category.color || FALLBACK_COLOR)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) return
    setName(category.name)
    setIcon(category.icon || FALLBACK_ICON)
    setColor(category.color || FALLBACK_COLOR)
  }, [category, editing])

  const { Icon, color: style } = visualOf(category)
  const clean = name.replace(/\s+/g, " ").trim()
  const clash = clean ? findCategory(clean, taken) : undefined
  const changed = clean !== category.name || icon !== (category.icon || FALLBACK_ICON) || color !== (category.color || FALLBACK_COLOR)
  const canSave = clean.length > 0 && !clash && changed && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({ name: clean, icon, color })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    const EditIcon = iconFor(icon)
    const editStyle = CATEGORY_COLORS[color] || CATEGORY_COLORS[FALLBACK_COLOR]
    return (
      <li className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/30 p-3">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", editStyle.solid)}>
            <EditIcon className="h-4 w-4" />
          </span>
          <Input
            autoFocus
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void save()
              }
              if (e.key === "Escape") setEditing(false)
            }}
            className="h-9 bg-white"
            aria-invalid={Boolean(clash)}
          />
        </div>
        {clash && (
          <p className="text-[11px] font-medium text-red-600">
            {tr("\"{{name}}\" toifasi allaqachon bor", { name: clash.name })}
          </p>
        )}
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} colorKey={color} />
        {clean !== category.name && clean && category.usage_count > 0 && (
          <p className="text-[11px] text-amber-700">
            {tr("Nom o'zgarsa {{count}} ta xarajatdagi toifa nomi ham o'zgaradi.", { count: category.usage_count })}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            {tr("Bekor")}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!canSave}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {tr("Saqlash")}
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-2.5 py-2">
      <div className="flex flex-shrink-0 flex-col">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0 || busy}
          title={tr("Yuqoriga")}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1 || busy}
          title={tr("Pastga")}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", style.icon)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{tr(category.name)}</p>
        <p className="truncate text-[11px] text-gray-400">
          {category.usage_count > 0
            ? tr("{{count}} ta xarajat · {{total}} So'm", {
                count: category.usage_count,
                total: fmt(category.usage_total),
              })
            : tr("Hali ishlatilmagan")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={tr("Tahrirlash")}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        title={category.usage_count > 0 ? tr("Arxivlash") : tr("O'chirish")}
        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
      >
        {category.usage_count > 0 ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </li>
  )
}

export function ExpenseCategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useExpenseCategories(true, open)
  const create = useCreateExpenseCategory()
  const update = useUpdateExpenseCategory()
  const remove = useDeleteExpenseCategory()
  const reorder = useReorderExpenseCategories()

  const [newName, setNewName] = useState("")
  const [newIcon, setNewIcon] = useState(FALLBACK_ICON)
  const [newColor, setNewColor] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNewName("")
    setNewIcon(FALLBACK_ICON)
    setNewColor(null)
    setPickerOpen(false)
    setError(null)
    setNotice(null)
  }, [open])

  const all = useMemo(() => data?.items ?? [], [data])
  const active = useMemo(() => all.filter((c) => c.is_active), [all])
  const archived = useMemo(() => all.filter((c) => !c.is_active), [all])
  const busy = reorder.isPending || remove.isPending || update.isPending

  const cleanNew = newName.replace(/\s+/g, " ").trim()
  // Rang tanlanmagan bo'lsa nomdan avtomatik
  const effectiveColor = newColor || (cleanNew ? hashColor(cleanNew) : FALLBACK_COLOR)
  const newClash = cleanNew ? findCategory(cleanNew, all) : undefined

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setError(null)
    setNotice(null)
    try {
      await action()
      if (done) setNotice(done)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const addNew = async () => {
    if (!cleanNew || newClash) return
    await run(async () => {
      await create.mutateAsync({ name: cleanNew, icon: newIcon, color: effectiveColor })
      setNewName("")
      setNewIcon(FALLBACK_ICON)
      setNewColor(null)
      setPickerOpen(false)
    })
  }

  const move = (list: ExpenseCategory[], index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    const ids = list.map((c) => c.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    void run(() => reorder.mutateAsync(ids))
  }

  const removeOne = (c: ExpenseCategory) => {
    const question =
      c.usage_count > 0
        ? tr("\"{{name}}\" toifasi {{count}} ta xarajatda ishlatilgan. U arxivga tushadi: tanlovdan chiqadi, xarajatlar o'z toifasida qoladi. Davom etasizmi?", {
            name: tr(c.name),
            count: c.usage_count,
          })
        : tr("\"{{name}}\" toifasini o'chirasizmi?", { name: tr(c.name) })
    if (!confirm(question)) return
    void run(
      () => remove.mutateAsync(c.id),
      c.usage_count > 0 ? tr("Toifa arxivga tushdi") : tr("Toifa o'chirildi")
    )
  }

  const NewIcon = iconFor(newIcon)
  const newStyle = CATEGORY_COLORS[effectiveColor] || CATEGORY_COLORS[FALLBACK_COLOR]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="min-w-0 border-b border-gray-100 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Tags className="h-4 w-4" />
            </span>
            {tr("Xarajat toifalari")}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {tr("Nom o'zgarsa eski xarajatlardagi nom ham o'zgaradi. Ishlatilgan toifa o'chirilmaydi — arxivga tushadi.")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 px-5 py-4">
          {/* Yangi toifa */}
          <div className="rounded-xl border border-dashed border-gray-300 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                title={tr("Belgi va rang")}
                aria-expanded={pickerOpen}
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
                  cleanNew ? newStyle.solid : "bg-gray-100 text-gray-500"
                )}
              >
                <NewIcon className="h-4 w-4" />
              </button>
              <Input
                value={newName}
                maxLength={50}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void addNew()
                  }
                }}
                placeholder={tr("Yangi toifa nomi, masalan: Qo'riqlash")}
                className="h-9"
                aria-invalid={Boolean(newClash)}
              />
              <Button type="button" size="sm" onClick={addNew} disabled={!cleanNew || Boolean(newClash) || create.isPending}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">{tr("Qo'shish")}</span>
              </Button>
            </div>
            {newClash && (
              <p className="mt-1.5 text-[11px] font-medium text-red-600">
                {newClash.is_active
                  ? tr("\"{{name}}\" toifasi allaqachon bor", { name: newClash.name })
                  : tr("\"{{name}}\" toifasi arxivda — pastdan qayta yoqing", { name: newClash.name })}
              </p>
            )}
            {pickerOpen && (
              <div className="mt-3 space-y-2.5">
                <ColorPicker value={effectiveColor} onChange={setNewColor} />
                <IconPicker value={newIcon} onChange={setNewIcon} colorKey={effectiveColor} />
              </div>
            )}
          </div>

          {/* Faol toifalar */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : active.length === 0 ? (
            <p className="rounded-xl border border-dashed py-8 text-center text-sm text-gray-400">
              {tr("Faol toifalar yo'q")}
            </p>
          ) : (
            <ul className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-0.5">
              {active.map((c, i) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  index={i}
                  count={active.length}
                  taken={all.filter((o) => o.id !== c.id)}
                  busy={busy}
                  onMove={(dir) => move(active, i, dir)}
                  onRemove={() => removeOne(c)}
                  onSave={async (payload) => {
                    await run(async () => {
                      const res = await update.mutateAsync({ id: c.id, ...payload })
                      if (res.renamed_expenses) {
                        setNotice(
                          tr("{{count}} ta xarajatda toifa nomi yangilandi", { count: res.renamed_expenses })
                        )
                      }
                    })
                  }}
                />
              ))}
            </ul>
          )}

          {/* Arxiv */}
          {archived.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-expanded={showArchived}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                {showArchived
                  ? tr("Arxivni yashirish")
                  : tr("Arxiv: {{count}} ta toifa", { count: archived.length })}
              </button>
              {showArchived && (
                <ul className="mt-2 space-y-1.5">
                  {archived.map((c) => {
                    const { Icon } = visualOf(c)
                    return (
                      <li
                        key={c.id}
                        className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 px-2.5 py-2"
                      >
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-500">{tr(c.name)}</p>
                          <p className="truncate text-[11px] text-gray-400">
                            {tr("{{count}} ta xarajat · {{total}} So'm", {
                              count: c.usage_count,
                              total: fmt(c.usage_total),
                            })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            run(() => update.mutateAsync({ id: c.id, is_active: true }), tr("Toifa qayta yoqildi"))
                          }
                        >
                          <ArchiveRestore className="h-3.5 w-3.5 sm:mr-1.5" />
                          <span className="hidden sm:inline">{tr("Qayta yoqish")}</span>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-600">{error}</p>
          )}
          {notice && !error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <Check className="h-4 w-4" />
              {notice}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 bg-gray-50/60 px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-1.5 h-4 w-4" />
            {tr("Yopish")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
