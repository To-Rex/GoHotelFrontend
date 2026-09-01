import { useState } from "react"
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Monitor,
  Plus,
  ShieldOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBranches } from "@/features/rooms/api/rooms"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import {
  useCreateVisionDevice,
  useRevokeVisionDevice,
  useVisionDevices,
  type VisionDeviceCreated,
} from "../api/vision"

/**
 * Kamera agenti o'rnatilgan kompyuterlar va ularning tokenlari.
 *
 * Agent xodim hisobi bilan ishlay olmaydi: u oylab uzluksiz turadi, xodim
 * tokeni esa ikki soatda tugaydi. Shuning uchun har kompyuterga alohida,
 * muddatsiz qurilma tokeni beriladi va u mehmonxonaga bog'lanadi — qidiruv
 * doirasi ham shu yerdan keladi.
 *
 * Token bazada OCHIQ saqlanmaydi, faqat SHA-256 xeshi. Ya'ni u shu yerda
 * bir marta ko'rsatiladi va boshqa hech qayerdan o'qib bo'lmaydi.
 */

function timeAgo(iso?: string | null): string {
  if (!iso) return "hech qachon ulanmagan"
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "hozirgina"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} daq. oldin`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} soat oldin`
  return `${Math.floor(hours / 24)} kun oldin`
}

/** Yangi yaratilgan token — bir marta ko'rsatiladigan panel. */
function NewTokenPanel({
  device,
  onDone,
}: {
  device: VisionDeviceCreated
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(device.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard ruxsati bo'lmasa token baribir ko'rinib turibdi —
      // qo'lda nusxalash mumkin, shuning uchun xato ko'rsatmaymiz.
    }
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
        <p className="text-sm text-emerald-900">
          <span className="font-semibold">«{device.name}» uchun token tayyor.</span>{" "}
          U faqat hozir ko'rsatiladi — bazada ochiq saqlanmaydi. Nusxalab, agent
          o'rnatilgan kompyuterga kiriting.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-gray-800">
          {device.token}
        </code>
        <Button type="button" size="sm" onClick={copy} className="flex-shrink-0">
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copied ? "Nusxalandi" : "Nusxalash"}
        </Button>
      </div>

      <div className="rounded-lg bg-white/70 p-3">
        <p className="text-xs font-medium text-gray-700">Agentga kiritish:</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-gray-600">
          <li>Kompyuterda <b>GoHotels Vision</b> ilovasini oching</li>
          <li>Pastdagi <b>Token</b> tugmasini bosing</li>
          <li>Shu tokenni qo'yib, <b>Tekshirish</b> so'ng <b>Saqlash</b></li>
        </ol>
      </div>

      <Button type="button" size="sm" variant="outline" onClick={onDone}>
        Nusxaladim, yopish
      </Button>
    </div>
  )
}

export function VisionDevicesCard() {
  const { can } = usePermissions()
  const canManage = can("employee.manage")
  const { data: devices = [], isLoading, isError } = useVisionDevices()
  const { data: branches = [] } = useBranches()
  const create = useCreateVisionDevice()
  const revoke = useRevokeVisionDevice()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [branchId, setBranchId] = useState("")
  const [fresh, setFresh] = useState<VisionDeviceCreated | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) {
      setError("Nom kiritilishi shart")
      return
    }
    setError(null)
    try {
      const device = await create.mutateAsync({
        name: name.trim(),
        branch_id: branchId || null,
      })
      setFresh(device)
      setAdding(false)
      setName("")
      setBranchId("")
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Token yaratib bo'lmadi.")
    }
  }

  const doRevoke = async (id: string, deviceName: string) => {
    if (
      !window.confirm(
        `«${deviceName}» tokeni bekor qilinsinmi?\n\nO'sha kompyuterdagi agent darhol ulana olmay qoladi va yangi token kiritish kerak bo'ladi.`
      )
    )
      return
    setError(null)
    try {
      await revoke.mutateAsync(id)
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Bekor qilib bo'lmadi.")
    }
  }

  return (
    <div className="space-y-4">
      {fresh && <NewTokenPanel device={fresh} onDone={() => setFresh(null)} />}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Har bir kamera kompyuteriga bitta token. Token muddatsiz va shu
          mehmonxonaga bog'langan.
        </p>
        {canManage && !adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Yangi qurilma
          </Button>
        )}
      </div>

      {adding && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Qurilma nomi
              </label>
              <Input
                autoFocus
                placeholder="Masalan: Qabulxona PC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Filial (ixtiyoriy)
              </label>
              <select
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">— keyin kamera bo'yicha belgilanadi —</option>
                {(branches as Array<{ id: string; name: string }>).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Kameraning filiali kamera darajasida ham belgilanadi, shuning
              uchun bu yerda majburiy emas — bitta kompyuter turli
              filiallarning kameralarini boqishi mumkin. */}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={submit} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Token yaratish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
            >
              Bekor qilish
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-20 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Qurilmalar ro'yxatini olishda xatolik. Backend yangilanganmi —
          tekshiring.
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <Monitor className="h-7 w-7 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">Hali qurilma yo'q</p>
          <p className="max-w-md text-xs text-gray-400">
            Kamera kompyuteriga GoHotels Vision ilovasini o'rnating, so'ng shu
            yerda token yarating va uni ilovaga kiriting.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div
              key={d.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border p-3",
                d.is_active ? "border-gray-200" : "border-gray-200 bg-gray-50 opacity-70"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                  d.is_active ? "bg-primary-50 text-primary-600" : "bg-gray-100 text-gray-400"
                )}
              >
                <Monitor className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {d.name}
                  {!d.is_active && (
                    <span className="ml-2 text-xs font-normal text-red-600">
                      bekor qilingan
                    </span>
                  )}
                </p>
                <p className="truncate text-[11px] text-gray-500">
                  token …{d.token_hint} · {timeAgo(d.last_seen_at)} ·{" "}
                  {d.events_received} hodisa
                  {d.device_id ? ` · ${d.device_id}` : ""}
                </p>
              </div>
              {canManage && d.is_active && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={revoke.isPending}
                  onClick={() => doRevoke(d.id, d.name)}
                >
                  <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                  Bekor qilish
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
