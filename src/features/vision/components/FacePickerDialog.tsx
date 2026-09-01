import { useEffect, useRef, useState } from "react"
import {
  Camera,
  Layers,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  UserCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useBranches } from "@/features/rooms/api/rooms"
import { cn } from "@/lib/utils"
import { fetchSightingImage, useSightingGroups, type SightingGroup } from "../api/vision"

/**
 * Filial kamerasidan yuz tanlash — odamlar bo'yicha guruhlangan holda.
 *
 * Uch qoida bu komponentning shaklini belgilaydi:
 *
 * 1. **Bir odam — bitta karta.** Mehmon kamera oldidan uch marta o'tsa
 *    server ularni bitta guruhga yig'adi. Alohida ko'rsatish ikki xato
 *    tug'diradi: xodim "qaysi birini tanlayman?" deb o'ylaydi, va
 *    biriktirilmagan qolgan ikkitasi ro'yxatda qolib ketadi.
 *
 * 2. **Faqat bitta filial.** Ro'yxat hech qachon filialsiz so'ralmaydi —
 *    aks holda u butun mehmonxonani qaytarardi va xodim yonidagi filialning
 *    odamini biriktirib qo'yishi mumkin edi. Filial chaqiruvchidan keladi
 *    (bandlovda — xonadan), berilmasa xodim shu yerda tanlaydi.
 *
 * 3. **Faqat biriktirilmaganlar.** Allaqachon boshqa mehmonga tegishli yuz
 *    ko'rinmaydi: uni ikkinchi marta biriktirish bitta odamni ikki mehmon
 *    qilib qo'yardi.
 */

interface FacePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Qaysi filial kameralari ko'rsatiladi.
   *
   *  Berilsa — o'zgartirib bo'lmaydi: bandlovda filial bron qilinayotgan
   *  xonadan kelib chiqadi va uni qo'lda almashtirish noto'g'ri bo'lardi.
   *  Berilmasa — xodim ro'yxatdan tanlaydi. Administratorda `branch_id`
   *  bo'lmasligi odatiy hol, va u sababli imkoniyat butunlay yopilib
   *  qolmasligi kerak. */
  branchId?: string | null
  onSelect: (group: SightingGroup) => void
  /** Mehmonxonada umuman filial bo'lmaganda ko'rsatiladigan izoh. */
  noBranchTitle?: string
  noBranchHint?: string
}

const WINDOW_MINUTES = 120
const REFRESH_MS = 5000

/** Guruh a'zolari bir-biriga shu darajadan kam o'xshasa — ogohlantiramiz. */
const WEAK_COHESION = 0.7

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "hozirgina"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} daq. oldin`
  const hours = Math.floor(minutes / 60)
  return `${hours} soat oldin`
}

/**
 * Bitta guruh kartasi.
 *
 * Rasm `<img src>` bilan olinmaydi — endpoint token talab qiladi, `<img>`
 * esa sarlavha yubormaydi. Shuning uchun blob sifatida yuklanadi va object
 * URL yasaladi.
 */
function GroupCard({
  group,
  selected,
  onClick,
}: {
  group: SightingGroup
  selected: boolean
  onClick: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!group.has_thumbnail) return
    fetchSightingImage(group.best_sighting_id)
      .then((objectUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        urlRef.current = objectUrl
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [group.best_sighting_id, group.has_thumbnail])

  const weak = group.count > 1 && group.cohesion < WEAK_COHESION

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-lg border-2 text-left transition-colors",
        selected
          ? "border-primary-500 ring-2 ring-primary-200"
          : "border-gray-200 hover:border-primary-400"
      )}
    >
      <div className="aspect-square w-full bg-gray-100">
        {url ? (
          <img
            src={url}
            alt={`${group.camera_name || group.camera_id} kamerasidan`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            {failed || !group.has_thumbnail ? (
              <Camera className="h-6 w-6" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </div>
        )}
      </div>

      {group.count > 1 && (
        <span
          className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-gray-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white"
          title={`${group.count} ta surat bitta odamga tegishli deb topildi`}
        >
          <Layers className="h-3 w-3" />
          {group.count}
        </span>
      )}
      {weak && (
        <span
          className="absolute right-1.5 top-1.5 rounded-full bg-amber-500/90 p-1 text-white"
          title="Guruh a'zolari bir-biriga unchalik o'xshamaydi — tekshirib ko'ring"
        >
          <TriangleAlert className="h-3 w-3" />
        </span>
      )}
      {selected && (
        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-primary-600 p-1 text-white">
          <UserCheck className="h-3 w-3" />
        </span>
      )}

      <div className="space-y-0.5 px-2 py-1.5">
        <p className="truncate text-[11px] font-medium text-gray-700">
          {group.camera_name || group.camera_id}
        </p>
        <p className="text-[10px] text-gray-400">
          {timeAgo(group.last_seen_at)}
          {group.count > 1 && ` · ${group.count} marta`}
        </p>
      </div>
    </button>
  )
}

export function FacePickerDialog({
  open,
  onOpenChange,
  branchId,
  onSelect,
  noBranchTitle = "Filial topilmadi",
  noBranchHint = "Suratlar filial bo'yicha ajratiladi, lekin bu mehmonxonada filial yaratilmagan. Avval filial qo'shing.",
}: FacePickerDialogProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [chosenBranch, setChosenBranch] = useState<string>("")

  /* Chaqiruvchi filialni bergan bo'lsa o'sha, bo'lmasa xodim tanlagani.
     Faqat bittasi ishlatiladi — ikkalasi bir vaqtda hech qachon emas. */
  const fixedBranch = branchId || null
  const { data: branches = [] } = useBranches()
  const effectiveBranch = fixedBranch || chosenBranch || null

  /* Filial berilmagan va mehmonxonada bittagina filial bo'lsa — tanlash
     shart emas, o'zi tanlanadi. Ko'p filialli mehmonxonada esa xodim
     ataylab tanlashi kerak: noto'g'ri filial noto'g'ri odamni biriktiradi. */
  useEffect(() => {
    if (fixedBranch || chosenBranch) return
    const list = branches as Array<{ id: string }>
    if (list.length === 1) setChosenBranch(list[0].id)
  }, [fixedBranch, chosenBranch, branches])

  const { data, isLoading, isError, refetch, isFetching } = useSightingGroups({
    branchId: effectiveBranch || undefined,
    minutes: WINDOW_MINUTES,
    limit: 24,
    // Dialog ochiq turganda yangi kelganlar o'zidan paydo bo'lsin — mehmon
    // qabulxonaga endi yaqinlashayotgan bo'lishi mumkin.
    refetchMs: open ? REFRESH_MS : 0,
    enabled: open,
  })

  useEffect(() => {
    if (!open) setSelectedKey(null)
  }, [open])

  const items = data?.items || []
  const selected = items.find((g) => g.best_sighting_id === selectedKey) || null

  const confirm = () => {
    if (!selected) return
    onSelect(selected)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Kameradan yuz tanlash
          </DialogTitle>
        </DialogHeader>

        {(branches as Array<{ id: string }>).length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">{noBranchTitle}</p>
              <p className="mt-0.5 text-xs">{noBranchHint}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Filialni chaqiruvchi bermagan bo'lsa — shu yerda tanlanadi.
                Bandlovda u xonadan aniq bo'ladi va tanlov ko'rsatilmaydi. */}
            {!fixedBranch && (branches as Array<{ id: string }>).length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">Filial</label>
                <select
                  className="h-9 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm"
                  value={chosenBranch}
                  onChange={(e) => {
                    setChosenBranch(e.target.value)
                    setSelectedKey(null)
                  }}
                >
                  <option value="">— tanlang —</option>
                  {(branches as Array<{ id: string; name: string }>).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Har bir karta — bitta odam. Bir necha marta o'tgan bo'lsa
                suratlari birlashtirilgan va hammasi birga biriktiriladi.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")}
                />
                Yangilash
              </Button>
            </div>

            {!effectiveBranch ? (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 text-center">
                <Camera className="h-7 w-7 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">Filialni tanlang</p>
                <p className="max-w-sm text-xs text-gray-400">
                  Suratlar filial bo'yicha ajratiladi — boshqa filialning
                  kameralaridan kelgan yuzlar bu yerda ko'rinmaydi.
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex h-56 items-center justify-center text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Suratlarni olishda xatolik. Kamera agenti ishlayaptimi va
                kameralar filialga biriktirilganmi — tekshiring.
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 text-center">
                <Camera className="h-7 w-7 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">
                  Bu filialda yangi yuz yo'q
                </p>
                {/* Sozlamalar sahifasi faqat administrator uchun, shuning
                    uchun qabulxona xodimiga u yerga borishni aytish foydasiz —
                    kimga murojaat qilishini aytamiz. */}
                <p className="max-w-sm text-xs text-gray-400">
                  Mehmon kamera oldidan o'tsa surat bir necha soniyada shu yerda
                  paydo bo'ladi. Bo'sh qolsa — kamera bu filialga biriktirilmagan
                  bo'lishi mumkin; administratordan so'rang (Sozlamalar →
                  Kameralar).
                </p>
              </div>
            ) : (
              <div className="grid max-h-[22rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                {items.map((group) => (
                  <GroupCard
                    key={group.best_sighting_id}
                    group={group}
                    selected={group.best_sighting_id === selectedKey}
                    onClick={() => setSelectedKey(group.best_sighting_id)}
                  />
                ))}
              </div>
            )}

            {selected && selected.count > 1 && (
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <Layers className="h-3.5 w-3.5" />
                {selected.count} ta surat biriktiriladi — bir nechtasidan
                yig'ilgan shablon aniqroq ishlaydi.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="button" onClick={confirm} disabled={!selected}>
            <UserCheck className="mr-2 h-4 w-4" />
            Tanlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
