import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  Video,
  VideoOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useBranches } from "@/features/rooms/api/rooms"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import {
  useUpdateVisionCamera,
  useVisionCameras,
  type VisionCamera,
} from "../api/vision"
import {
  assignableHere,
  cameraPlace,
  needsMoveConfirm,
  sortCamerasForBranch,
} from "../lib/cameraBranch"
import { tr, trc } from "@/i18n"

/**
 * Kamerani filialga biriktirish.
 *
 * Bu sozlama bo'lmasa yuz tanish ishlamaydi, shuning uchun u shu yerda:
 * suratlar filial bo'yicha ajratiladi, va filiali yo'q kamera HECH QAYSI
 * ro'yxatga tushmaydi. Yangi mehmonga yuz biriktirmoqchi bo'lgan xodim
 * "bu filialda yangi yuz yo'q" degan xabarni ko'radi va sababi aynan shu
 * bo'lishi mumkin.
 *
 * Sozlovchi odatda O'ZI TURGAN filialni sozlaydi — shuning uchun asosiy
 * harakat bitta tugma: "Shu filialga biriktirish" (xato tanlov yo'q).
 * Boshqa filialga biriktirish tanlov orqali qoladi; biriktirilgan kamerani
 * ko'chirish tasdiq so'raydi (`cameraBranch.ts`).
 *
 * Kameralar qo'lda qo'shilmaydi — agent birinchi hodisani yuborganda
 * o'zi paydo bo'ladi. Shuning uchun bu yerda "qo'shish" tugmasi yo'q,
 * faqat biriktirish va yoqib-o'chirish bor.
 */

function timeAgo(iso?: string | null): string {
  if (!iso) return tr("hech qachon")
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return tr("hozirgina")
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return tr("{{minutes}} daq. oldin", { minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return tr("{{hours}} soat oldin", { hours })
  return tr("{{Math}} kun oldin", { Math: Math.floor(hours / 24) })
}

type Branch = { id: string; name: string }

/** Ko'chirish tasdig'i — sozlovchi qaysi filialdan qayerga o'tkazayotganini ko'radi. */
function confirmMove(camera: VisionCamera, target: Branch | null): boolean {
  const name = camera.name || camera.camera_id
  const from = camera.branch_name || tr("noma'lum filial")
  return window.confirm(
    target
      ? tr("«{{name}}» kamerasi {{from}} filialidan {{to}} filialiga o'tkazilsinmi?\n\nUning yangi suratlari endi {{to}} filialida ko'rinadi.", { name, from, to: target.name })
      : tr("«{{name}}» kamerasining {{from}} filialiga biriktirilishi bekor qilinsinmi?\n\nBiriktirilmagan kameraning suratlari hech qaysi filialda ko'rinmaydi.", { name, from })
  )
}

function CameraRow({
  camera,
  branches,
  currentBranchId,
  canManage,
  onError,
}: {
  camera: VisionCamera
  branches: Branch[]
  currentBranchId: string | null | undefined
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
      onError(e?.response?.data?.detail || tr("Saqlab bo'lmadi. Qayta urinib ko'ring."))
    }
  }

  const assign = (branchId: string | null) => {
    if (branchId === (camera.branch_id || null)) return
    const target = branchId ? branches.find((b) => b.id === branchId) || null : null
    if (needsMoveConfirm(camera, branchId) && !confirmMove(camera, target)) return
    void apply({ branch_id: branchId })
  }

  const place = cameraPlace(camera, currentBranchId)
  const justSaved = savedAt > 0 && Date.now() - savedAt < 3000
  const busy = !canManage || update.isPending

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border p-3",
        place === "unassigned"
          ? "border-amber-300 bg-amber-50/50"
          : place === "here"
            ? "border-emerald-200 bg-emerald-50/30"
            : "border-gray-200"
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
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">
            {camera.name || camera.camera_id}
          </p>
          {/* Qayerda — bir qarashda: shu filial / boshqa filial / biriktirilmagan */}
          {place === "here" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <MapPin className="h-3 w-3" />
              {tr("Shu filialda")}
            </span>
          ) : place === "elsewhere" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              <Building2 className="h-3 w-3" />
              {camera.branch_name || tr("Boshqa filial")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {tr("Biriktirilmagan")}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-gray-500">
          {tr("{{camera_id}}{{v}} · oxirgi surat: {{last_seen_at}} · jami {{sightings_count}}", { camera_id: camera.camera_id, v: camera.device_name ? ` · ${camera.device_name}` : "", last_seen_at: timeAgo(camera.last_seen_at), sightings_count: camera.sightings_count })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Asosiy harakat: sozlovchi turgan filialga bir bosishda */}
        {canManage && currentBranchId && place !== "here" && (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => assign(currentBranchId)}
            title={tr("Kamerani siz hozir turgan filialga biriktirish")}
          >
            <MapPin className="mr-1.5 h-3.5 w-3.5" />
            {tr("Shu filialga biriktirish")}
          </Button>
        )}

        {/* Boshqa filial — tanlov orqali (biriktirilganini ko'chirish tasdiq bilan) */}
        <select
          className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          value={camera.branch_id || ""}
          disabled={busy}
          onChange={(e) => assign(e.target.value || null)}
          title={tr("Boshqa filialga biriktirish")}
        >
          <option value="">{tr("— filial tanlanmagan —")}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id === currentBranchId ? tr("{{name}} (siz shu yerdasiz)", { name: b.name }) : b.name}
            </option>
          ))}
        </select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => apply({ is_active: !camera.is_active })}
          title={
            camera.is_active
              ? tr("Kamerani vaqtincha o'chirish — hodisalari qabul qilinmaydi")
              : tr("Kamerani qayta yoqish")
          }
        >
          {camera.is_active ? trc("toggle", "O'chirish") : tr("Yoqish")}
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
  const user = useAuthStore((s) => s.user)
  const currentBranchId = user?.branch_id || null
  const { data: branches = [] } = useBranches()
  const { data: cameras = [], isLoading, isError, refetch, isFetching } =
    useVisionCameras()
  const update = useUpdateVisionCamera()
  const [error, setError] = useState<string | null>(null)

  const currentBranchName =
    user?.branch_name ||
    (branches as Branch[]).find((b) => b.id === currentBranchId)?.name ||
    null

  const ordered = useMemo(
    () => sortCamerasForBranch(cameras, currentBranchId),
    [cameras, currentBranchId]
  )
  const unassigned = useMemo(
    () => cameras.filter((c) => !c.branch_id).length,
    [cameras]
  )
  const pending = useMemo(() => assignableHere(cameras, currentBranchId), [cameras, currentBranchId])
  const hereCount = useMemo(
    () => cameras.filter((c) => cameraPlace(c, currentBranchId) === "here").length,
    [cameras, currentBranchId]
  )

  /* Biriktirilmaganlarning hammasini shu filialga — bitta tasdiq bilan.
     Boshqa filial kameralari ataylab tegilmaydi. */
  const assignAllHere = async () => {
    if (!currentBranchId || pending.length === 0) return
    const names = pending.map((c) => `• ${c.name || c.camera_id}`).join("\n")
    if (
      !window.confirm(
        tr("{{count}} ta biriktirilmagan kamera «{{branch}}» filialiga biriktirilsinmi?\n\n{{names}}", {
          count: pending.length,
          branch: currentBranchName || "",
          names,
        })
      )
    )
      return
    setError(null)
    try {
      for (const camera of pending) {
        await update.mutateAsync({ id: camera.id, branch_id: currentBranchId })
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || tr("Saqlab bo'lmadi. Qayta urinib ko'ring."))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {tr("Kameralar agent birinchi suratni yuborganda o'zi paydo bo'ladi. Filial biriktirilmagunicha ularning suratlari yangi mehmonga yuz biriktirish oynasida ko'rinmaydi.")}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
          {tr("Yangilash")}
        </Button>
      </div>

      {/* Sozlovchi qayerda turgani — biriktirish qayerga ketishini aniq ko'rsatadi */}
      {currentBranchId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
          <MapPin className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <span>
            {tr("Siz hozir {{branch}} filialidasiz — «Shu filialga biriktirish» kamerani shu filialga qo'yadi.", {
              branch: currentBranchName || tr("joriy"),
            })}
          </span>
          {cameras.length > 0 && (
            <span className="text-xs text-emerald-700">
              {tr("Bu filialda {{count}} ta kamera.", { count: hereCount })}
            </span>
          )}
        </div>
      )}

      {unassigned > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-sm text-amber-800">
            <span className="font-medium">
              {tr("{{unassigned}} ta kamera filialga biriktirilmagan.", { unassigned })}
            </span>{" "}{tr("Ularning suratlari hech qaysi filial ro'yxatiga tushmaydi — quyida filialni tanlang.")}
          </p>
          {canManage && currentBranchId && pending.length > 0 && (
            <Button type="button" size="sm" disabled={update.isPending} onClick={assignAllHere}>
              {update.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {tr("Hammasini shu filialga ({{count}})", { count: pending.length })}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-28 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {tr("Kameralar ro'yxatini olishda xatolik. Backend yangilanganmi va migratsiya bajarilganmi — tekshiring.")}
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <Video className="h-7 w-7 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">{tr("Hali kamera yo'q")}</p>
          <p className="max-w-md text-xs text-gray-400">
            {tr("GoHotels Vision agenti o'rnatilgan, kamera qo'shilgan va qurilma tokeni saqlangan bo'lishi kerak. Agent birinchi yuzni yuborishi bilan kamera shu ro'yxatda paydo bo'ladi.")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordered.map((camera) => (
            <CameraRow
              key={camera.id}
              camera={camera}
              branches={branches as Branch[]}
              currentBranchId={currentBranchId}
              canManage={canManage}
              onError={setError}
            />
          ))}
        </div>
      )}

      {!canManage && cameras.length > 0 && (
        <p className="text-xs text-gray-400">
          {tr("Filialni o'zgartirish uchun xodimlarni boshqarish ruxsati kerak.")}
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
