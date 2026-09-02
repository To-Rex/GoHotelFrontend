import { useMemo, useState } from "react"
import {
  Ban,
  Check,
  Laptop,
  Loader2,
  MonitorSmartphone,
  Pencil,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiErrorMessage } from "@/lib/apiError"
import { describeDevice, getDeviceId } from "@/lib/deviceId"
import { cn } from "@/lib/utils"
import {
  useDeleteDevice,
  useDevices,
  useSetDeviceStatus,
  type DeviceStatus,
  type TrustedDevice,
} from "../api/devices"

/**
 * Qurilmalarni tasdiqlash — administrator sahifasi.
 *
 * Xodim faqat shu ro'yxatda "Tasdiqlangan" holatidagi qurilmadan kira
 * oladi. Yangi qurilmadan urinish jimgina rad etilmaydi: u ro'yxatga
 * "Kutmoqda" bo'lib tushadi, ya'ni administrator kimni tasdiqlash
 * kerakligini ko'radi. Aks holda xodim "nega kira olmayapman" deb qolardi.
 */

const STATUS_LABELS: Record<DeviceStatus, string> = {
  PENDING: "Kutmoqda",
  APPROVED: "Tasdiqlangan",
  BLOCKED: "Taqiqlangan",
}

const statusBadge: Record<DeviceStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  BLOCKED: "bg-red-100 text-red-600",
}

const statusDot: Record<DeviceStatus, string> = {
  PENDING: "bg-amber-500",
  APPROVED: "bg-emerald-500",
  BLOCKED: "bg-red-500",
}

const fmtDate = (value?: string | null): string | null => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

export const DevicesPage = () => {
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "">("")
  const { data: devices = [], isLoading } = useDevices(statusFilter)
  const setStatus = useSetDeviceStatus()
  const removeDevice = useDeleteDevice()

  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState("")

  // Administrator o'zi turgan qurilmani ajratib ko'rishi kerak — uni
  // adashib taqiqlab qo'ymasligi uchun
  const myDeviceId = useMemo(() => getDeviceId(), [])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const d of devices) m[d.status] = (m[d.status] || 0) + 1
    return m
  }, [devices])

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const saveLabel = (device: TrustedDevice) =>
    act(async () => {
      await setStatus.mutateAsync({
        id: device.id,
        status: device.status,
        label: labelDraft,
      })
      setEditing(null)
    })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Qurilmalar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Qurilmalar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Xodimlar faqat tasdiqlangan qurilmadan kira oladi. Yangi qurilmadan
          urinish shu ro'yxatga tushadi va tasdiqni kutadi. Administrator bu
          tekshiruvdan ozod — u istalgan qurilmadan login, parol va yuz bilan
          kira oladi.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {/* Holat filtri */}
      <div className="flex flex-wrap gap-1.5">
        {([["", "Barchasi"], ...Object.entries(STATUS_LABELS)] as [string, string][]).map(
          ([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setStatusFilter(value as DeviceStatus | "")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === value
                  ? "border-primary-600 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {value && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    statusDot[value as DeviceStatus]
                  )}
                />
              )}
              {label}
              {value && counts[value] ? ` (${counts[value]})` : ""}
            </button>
          )
        )}
      </div>

      {devices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-14 text-gray-400">
          <MonitorSmartphone className="h-8 w-8" />
          <p className="text-sm">
            {statusFilter
              ? "Bu holatda qurilma yo'q"
              : "Hali birorta qurilma ro'yxatga tushmagan"}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {devices.map((d) => {
            const isMine = d.device_id === myDeviceId
            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-2xl border bg-white p-3.5",
                  d.status === "PENDING" && "border-amber-200 bg-amber-50/40"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                      <Laptop className="h-4.5 w-4.5" size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold leading-tight text-gray-900">
                          {d.label || describeDevice(d.user_agent || "")}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            statusBadge[d.status]
                          )}
                        >
                          {STATUS_LABELS[d.status]}
                        </span>
                        {isMine && (
                          <span
                            title="Siz hozir shu qurilmadan turibsiz"
                            className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-700"
                          >
                            Shu qurilma
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 break-all text-[11px] leading-tight text-gray-400">
                        {d.device_id}
                      </p>
                      <p className="mt-0.5 text-xs leading-tight text-gray-500">
                        {[
                          d.ip_address,
                          fmtDate(d.last_seen_at) &&
                            `oxirgi urinish: ${fmtDate(d.last_seen_at)}`,
                          fmtDate(d.approved_at) &&
                            `tasdiqlangan: ${fmtDate(d.approved_at)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {d.status !== "APPROVED" && (
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          act(() =>
                            setStatus.mutateAsync({ id: d.id, status: "APPROVED" })
                          )
                        }
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Tasdiqlash
                      </Button>
                    )}
                    {d.status !== "BLOCKED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-red-600 hover:bg-red-50"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          act(() =>
                            setStatus.mutateAsync({ id: d.id, status: "BLOCKED" })
                          )
                        }
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" />
                        Taqiqlash
                      </Button>
                    )}
                    <button
                      type="button"
                      title="Nom qo'yish"
                      onClick={() => {
                        setEditing(d.id)
                        setLabelDraft(d.label || "")
                      }}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Ro'yxatdan o'chirish"
                      disabled={removeDevice.isPending}
                      onClick={() => {
                        if (
                          !confirm(
                            "Qurilma ro'yxatdan o'chiriladi. Keyingi urinishda u yangi sifatida qaytadi va yana tasdiq kutadi. Davom etasizmi?"
                          )
                        )
                          return
                        act(() => removeDevice.mutateAsync(d.id))
                      }}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {editing === d.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2.5">
                    <Input
                      className="h-8 w-56 text-sm"
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      placeholder="Masalan: Resepsiya kompyuteri"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={setStatus.isPending}
                      onClick={() => saveLabel(d)}
                    >
                      {setStatus.isPending && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Saqlash
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setEditing(null)}
                    >
                      Bekor qilish
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
