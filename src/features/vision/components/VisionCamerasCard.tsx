import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Video,
  VideoOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useBranches } from "@/features/rooms/api/rooms"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import {
  useUpdateVisionCamera,
  useVisionCameras,
  type VisionCamera,
} from "../api/vision"

/**
 * Kamerani filialga biriktirish.
 *
 * Bu sozlama bo'lmasa yuz tanish ishlamaydi, shuning uchun u shu yerda:
 * suratlar filial bo'yicha ajratiladi, va filiali yo'q kamera HECH QAYSI
 * ro'yxatga tushmaydi. Yangi mehmonga yuz biriktirmoqchi bo'lgan xodim
 * "bu filialda yangi yuz yo'q" degan xabarni ko'radi va sababi aynan shu
 * bo'lishi mumkin.
 *
 * Kameralar qo'lda qo'shilmaydi — agent birinchi hodisani yuborganda
 * o'zi paydo bo'ladi. Shuning uchun bu yerda "qo'shish" tugmasi yo'q,
 * faqat biriktirish va yoqib-o'chirish bor.
 */

function timeAgo(iso?: string | null): string {
  if (!iso) return "hech qachon"
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "hozirgina"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} daq. oldin`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} soat oldin`
  return `${Math.floor(hours / 24)} kun oldin`
}

function CameraRow({
  camera,
  branches,
  canManage,
  onError,
}: {
  camera: VisionCamera
  branches: Array<{ id: string; name: string }>
  canManage: boolean
  onError: (message: string | null) => void
}) {
  const update = useUpdateVisionCamera()
  const [savedAt, setSavedAt] = useState(0)

  const apply = async (patch: { branch_id?: string | null; is_active?: boolean }) => {
    onError(null)
    try {
      await update.mutateAsync({ id: camera.id, ...patch })
      setSavedAt(Date.now())
    } catch (e: any) {
      onError(e?.response?.data?.detail || "Saqlab bo'lmadi. Qayta urinib ko'ring.")
    }
  }

  const unassigned = !camera.branch_id
  const justSaved = savedAt > 0 && Date.now() - savedAt < 3000

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border p-3",
        unassigned ? "border-amber-300 bg-amber-50/50" : "border-gray-200"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
          camera.is_active ? "bg-primary-50 text-primary-600" : "bg-gray-100 text-gray-400"
        )}
      >
        {camera.is_active ? (
          <Video className="h-4 w-4" />
        ) : (
          <VideoOff className="h-4 w-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {camera.name || camera.camera_id}
        </p>
        <p className="truncate text-[11px] text-gray-500">
          {camera.camera_id}
          {camera.device_name ? ` · ${camera.device_name}` : ""} · oxirgi surat:{" "}
          {timeAgo(camera.last_seen_at)} · jami {camera.sightings_count}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <select
          className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          value={camera.branch_id || ""}
          disabled={!canManage || update.isPending}
          onChange={(e) => apply({ branch_id: e.target.value || null })}
        >
          <option value="">— filial tanlanmagan —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canManage || update.isPending}
          onClick={() => apply({ is_active: !camera.is_active })}
          title={
            camera.is_active
              ? "Kamerani vaqtincha o'chirish — hodisalari qabul qilinmaydi"
              : "Kamerani qayta yoqish"
          }
        >
          {camera.is_active ? "O'chirish" : "Yoqish"}
        </Button>

        <span className="w-5">
          {update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : justSaved ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : null}
        </span>
      </div>
    </div>
  )
}

export function VisionCamerasCard() {
  const { can } = usePermissions()
  const canManage = can("employee.manage")
  const { data: branches = [] } = useBranches()
  const { data: cameras = [], isLoading, isError, refetch, isFetching } =
    useVisionCameras()
  const [error, setError] = useState<string | null>(null)

  const unassigned = useMemo(
    () => cameras.filter((c) => !c.branch_id).length,
    [cameras]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Kameralar agent birinchi suratni yuborganda o'zi paydo bo'ladi. Filial
          biriktirilmagunicha ularning suratlari yangi mehmonga yuz biriktirish
          oynasida ko'rinmaydi.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
          Yangilash
        </Button>
      </div>

      {unassigned > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">
              {unassigned} ta kamera filialga biriktirilmagan.
            </span>{" "}
            Ularning suratlari hech qaysi filial ro'yxatiga tushmaydi — quyida
            filialni tanlang.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-28 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Kameralar ro'yxatini olishda xatolik. Backend yangilanganmi va
          migratsiya bajarilganmi — tekshiring.
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <Video className="h-7 w-7 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">Hali kamera yo'q</p>
          <p className="max-w-md text-xs text-gray-400">
            GoHotels Vision agenti o'rnatilgan, kamera qo'shilgan va qurilma
            tokeni saqlangan bo'lishi kerak. Agent birinchi yuzni yuborishi
            bilan kamera shu ro'yxatda paydo bo'ladi.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cameras.map((camera) => (
            <CameraRow
              key={camera.id}
              camera={camera}
              branches={branches as Array<{ id: string; name: string }>}
              canManage={canManage}
              onError={setError}
            />
          ))}
        </div>
      )}

      {!canManage && cameras.length > 0 && (
        <p className="text-xs text-gray-400">
          Filialni o'zgartirish uchun xodimlarni boshqarish ruxsati kerak.
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
