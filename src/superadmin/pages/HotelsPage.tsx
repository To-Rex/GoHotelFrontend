import { useState } from "react"
import { Link } from "react-router-dom"
import { Building2, Loader2, PauseCircle, Pencil, Plus, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import {
  useDeactivateHotel,
  useHotels,
  useSaveHotel,
  type PanelHotel,
} from "../api/panel"
import {
  PanelButton,
  PanelCard,
  PanelDialog,
  PanelEmpty,
  PanelHeading,
  PanelInput,
  PanelNotice,
  PanelSelect,
} from "../components/ui"

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Faol",
  INACTIVE: "To'xtatilgan",
  SUSPENDED: "Vaqtincha to'xtatilgan",
}

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-emerald-900/60 text-emerald-300",
  INACTIVE: "bg-slate-800 text-slate-400",
  SUSPENDED: "bg-amber-900/60 text-amber-300",
}

/** Barcha mehmonxonalar: ro'yxat, qidiruv, qo'shish va tahrirlash. */
export function HotelsPage() {
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Partial<PanelHotel> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: hotels = [], isLoading } = useHotels(search)
  const save = useSaveHotel()
  const deactivate = useDeactivateHotel()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setError(null)
    try {
      await save.mutateAsync(editing)
      setEditing(null)
    } catch (e) {
      setError(panelError(e))
    }
  }

  const stop = async (hotel: PanelHotel) => {
    if (
      !confirm(
        `"${hotel.name}" to'xtatiladi. Xodimlar tizimga kira olmaydi, lekin ` +
          `barcha ma'lumot va tarix saqlanadi. Davom etasizmi?`
      )
    )
      return
    try {
      await deactivate.mutateAsync(hotel.id)
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <div>
      <PanelHeading
        title="Mehmonxonalar"
        subtitle="Tizimdagi barcha obyektlar"
        action={
          <PanelButton onClick={() => setEditing({ stars: 3, status: "ACTIVE" })}>
            <Plus className="h-4 w-4" />
            Qo'shish
          </PanelButton>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nomi, kodi yoki shahri..."
          className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
        />
      </div>

      {error && <PanelNotice>{error}</PanelNotice>}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : hotels.length === 0 ? (
        <PanelEmpty>
          {search ? "Qidiruv bo'yicha topilmadi" : "Hozircha mehmonxona yo'q"}
        </PanelEmpty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hotels.map((hotel) => (
            <PanelCard key={hotel.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-100">
                    <Building2 className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <span className="truncate">{hotel.name}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {hotel.code}
                    {hotel.city ? ` · ${hotel.city}` : ""} · {hotel.stars}★
                  </p>
                </div>
                <span
                  className={cn(
                    "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    statusStyle[hotel.status] || statusStyle.INACTIVE
                  )}
                >
                  {STATUS_LABELS[hotel.status] || hotel.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-center">
                {[
                  ["Filial", hotel.branch_count],
                  ["Xona", hotel.room_count],
                  ["Xodim", hotel.user_count],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-sm font-bold tabular-nums text-slate-200">
                      {value ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/panel/hotels/${hotel.id}`}
                  className="inline-flex h-8 items-center rounded-md border border-slate-700 px-2.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Boshqarish
                </Link>
                <PanelButton
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setEditing(hotel)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Tahrirlash
                </PanelButton>
                {hotel.status === "ACTIVE" && (
                  <PanelButton
                    variant="danger"
                    className="h-8 text-xs"
                    onClick={() => stop(hotel)}
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                    To'xtatish
                  </PanelButton>
                )}
              </div>
            </PanelCard>
          ))}
        </div>
      )}

      <PanelDialog
        open={!!editing}
        title={editing?.id ? "Mehmonxonani tahrirlash" : "Yangi mehmonxona"}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submit} className="space-y-3">
          <PanelInput
            label="Nomi"
            value={editing?.name || ""}
            onChange={(e) =>
              setEditing((h) => ({ ...h, name: e.target.value }))
            }
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <PanelInput
              label="Kod"
              value={editing?.code || ""}
              onChange={(e) =>
                setEditing((h) => ({ ...h, code: e.target.value }))
              }
              maxLength={10}
              required
            />
            <PanelInput
              label="Yulduz"
              type="number"
              min={1}
              max={7}
              value={editing?.stars ?? 3}
              onChange={(e) =>
                setEditing((h) => ({ ...h, stars: Number(e.target.value) }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PanelInput
              label="Shahar"
              value={editing?.city || ""}
              onChange={(e) =>
                setEditing((h) => ({ ...h, city: e.target.value }))
              }
            />
            <PanelInput
              label="Davlat"
              value={editing?.country || ""}
              onChange={(e) =>
                setEditing((h) => ({ ...h, country: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PanelInput
              label="Telefon"
              value={editing?.phone || ""}
              onChange={(e) =>
                setEditing((h) => ({ ...h, phone: e.target.value }))
              }
            />
            <PanelInput
              label="Pochta"
              type="email"
              value={editing?.email || ""}
              onChange={(e) =>
                setEditing((h) => ({ ...h, email: e.target.value }))
              }
            />
          </div>
          {editing?.id && (
            <PanelSelect
              label="Holat"
              value={editing?.status || "ACTIVE"}
              onChange={(e) =>
                setEditing((h) => ({ ...h, status: e.target.value }))
              }
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </PanelSelect>
          )}

          {error && <PanelNotice>{error}</PanelNotice>}

          <div className="flex justify-end gap-2 pt-1">
            <PanelButton
              type="button"
              variant="ghost"
              onClick={() => setEditing(null)}
            >
              Bekor qilish
            </PanelButton>
            <PanelButton type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Saqlash
            </PanelButton>
          </div>
        </form>
      </PanelDialog>
    </div>
  )
}
