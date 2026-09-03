import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  CHECKLIST_TASK_TYPES,
  useChecklistDefaults,
  useChecklistTemplates,
  useReplaceChecklistTemplates,
} from "../api/checklistTemplates"

/**
 * Vazifa bandlarini tahrirlash — administrator uchun.
 *
 * Farrosh mobil ilovada shu ro'yxatni ko'radi va har bandni belgilab
 * boradi; hammasi belgilanganda vazifa yakunlanadi. Shuning uchun bu
 * ro'yxat "eslatma" emas, ishning o'lchovi.
 *
 * Tahrir butun ro'yxat bilan saqlanadi (bandma-band emas): xodim
 * qatorlarni qo'shadi, o'chiradi, tartibini o'zgartiradi va bir marta
 * "Saqlash" bosadi. Har bosishda so'rov yuborish tartibni o'zgartirishni
 * chalkash qilardi.
 *
 * Saqlanmagan o'zgarish yo'qolib qolmasligi uchun tugma faqat farq
 * bo'lganda faollashadi va nima o'zgargani yozib turiladi.
 */

type Draft = { key: string; title: string }

let counter = 0
const draft = (title: string): Draft => ({ key: `d${counter++}`, title })

export function ChecklistTemplateEditor() {
  const [taskType, setTaskType] = useState<string>(CHECKLIST_TASK_TYPES[0].key)
  const { data: saved = [], isLoading } = useChecklistTemplates(taskType)
  const { data: defaults = {} } = useChecklistDefaults()
  const replace = useReplaceChecklistTemplates()

  const [items, setItems] = useState<Draft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Serverdagi faol bandlar — tahrirning boshlang'ich holati
  const savedTitles = useMemo(
    () => saved.filter((t) => t.is_active).map((t) => t.title),
    [saved]
  )

  useEffect(() => {
    setItems(savedTitles.map(draft))
    setError(null)
  }, [savedTitles, taskType])

  const titles = items.map((i) => i.title.trim()).filter(Boolean)
  const changed =
    titles.length !== savedTitles.length ||
    titles.some((t, i) => t !== savedTitles[i])

  /* Mehmonxona hali hech narsa kiritmagan bo'lsa vazifalarga STANDART
     ro'yxat tushadi. Buni aytib turish kerak — aks holda bo'sh ekranni
     ko'rgan xodim "farroshda ro'yxat yo'q" deb o'ylardi. */
  const usingDefaults = saved.length === 0
  const defaultTitles = defaults[taskType] || []

  const setTitle = (key: string, title: string) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, title } : i)))

  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list]
      const target = index + delta
      if (target < 0 || target >= next.length) return list
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const save = async () => {
    setError(null)
    try {
      await replace.mutateAsync({ taskType, titles })
      setNotice(
        titles.length === 0
          ? "Ro'yxat bo'shatildi — bu turdagi vazifalarda band ko'rsatilmaydi"
          : `${titles.length} ta band saqlandi`
      )
      window.setTimeout(() => setNotice(null), 3500)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const label =
    CHECKLIST_TASK_TYPES.find((t) => t.key === taskType)?.label || taskType

  return (
    <div className="space-y-4">
      {/* Tur tanlash — har turning o'z ro'yxati bor */}
      <div className="flex flex-wrap gap-1.5">
        {CHECKLIST_TASK_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTaskType(t.key)}
            aria-pressed={taskType === t.key}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              taskType === t.key
                ? "border-primary-600 bg-primary-50 text-primary-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {usingDefaults && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              Bu tur uchun o'z ro'yxatingiz kiritilmagan — vazifalarga{" "}
              <b>standart {defaultTitles.length} ta band</b> tushmoqda. Ularni
              namuna sifatida yuklab, ustiga o'zgartirish mumkin.
            </p>
          )}

          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={item.key} className="flex items-center gap-2">
                <span className="w-6 flex-shrink-0 text-right text-xs tabular-nums text-gray-400">
                  {index + 1}.
                </span>
                <Input
                  className="h-9 flex-1"
                  value={item.title}
                  placeholder="Masalan: Shampun va sovunni almashtirish"
                  onChange={(e) => setTitle(item.key, e.target.value)}
                />
                <div className="flex flex-shrink-0 items-center gap-0.5">
                  <IconButton
                    label="Yuqoriga"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Pastga"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="O'chirish"
                    danger
                    onClick={() =>
                      setItems((list) => list.filter((i) => i.key !== item.key))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>

          {items.length === 0 && (
            <p className="rounded-lg border border-dashed py-6 text-center text-sm text-gray-400">
              Band yo'q. Saqlansa, bu turdagi vazifalarda ro'yxat
              ko'rsatilmaydi.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((list) => [...list, draft("")])}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Band qo'shish
            </Button>

            {defaultTitles.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems(defaultTitles.map(draft))}
                title="Standart ro'yxatni yuklab, ustiga tahrirlash"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Standartdan boshlash
              </Button>
            )}

            <span className="flex-1" />

            {changed && (
              <span className="text-xs text-amber-600">Saqlanmagan o'zgarish</span>
            )}
            <Button
              size="sm"
              disabled={!changed || replace.isPending}
              onClick={save}
            >
              {replace.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Saqlash
            </Button>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {notice}
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-gray-400">
            O'zgarish faqat YANGI vazifalarga ta'sir qiladi: ochilgan
            vazifalar o'z nusxasi bilan qoladi, shuning uchun farrosh
            belgilagan ishlar tarixi buzilmaydi. "{label}" turidagi har
            vazifa shu ro'yxat bilan ochiladi.
          </p>
        </>
      )}
    </div>
  )
}

function IconButton({
  label,
  disabled = false,
  danger = false,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        disabled
          ? "cursor-not-allowed text-gray-300"
          : danger
            ? "text-red-500 hover:bg-red-50"
            : "text-gray-500 hover:bg-gray-100"
      )}
    >
      {children}
    </button>
  )
}
