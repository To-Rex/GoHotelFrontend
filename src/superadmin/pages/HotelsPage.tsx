import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  Check,
  Copy,
  LayoutGrid,
  List,
  Loader2,
  LogIn,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import {
  useDeactivateHotel,
  useEnterHotel,
  useHotels,
  useSaveHotel,
  type PanelHotel,
} from "../api/panel"
import { HotelPurgeDialog } from "../components/HotelPurgeDialog"
import {
  PanelBadge,
  PanelButton,
  PanelCard,
  PanelDialog,
  PanelEmpty,
  PanelHeading,
  PanelInput,
  PanelNotice,
  PanelSelect,
} from "../components/ui"
import { tr, trc } from "@/i18n"

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: tr("Faol"),
  INACTIVE: tr("To'xtatilgan"),
  SUSPENDED: tr("Vaqtincha to'xtatilgan"),
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  INACTIVE: "danger",
  SUSPENDED: "warning",
}

type View = "grid" | "list"

/** Barcha mehmonxonalar: ro'yxat, qidiruv, filtr, saralash, qo'shish va tahrirlash. */
export function HotelsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sortBy, setSortBy] = useState("name")
  const [view, setView] = useState<View>("grid")
  const [editing, setEditing] = useState<Partial<PanelHotel> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [purging, setPurging] = useState<PanelHotel | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { data: hotels = [], isLoading } = useHotels(search)
  const save = useSaveHotel()
  const deactivate = useDeactivateHotel()
  const enter = useEnterHotel()

  const rows = useMemo(() => {
    const filtered = hotels.filter(
      (hotel) => !statusFilter || hotel.status === statusFilter
    )
    return [...filtered].sort((a, b) => {
      if (sortBy === "branches") {
        return (b.branch_count ?? 0) - (a.branch_count ?? 0)
      }
      if (sortBy === "rooms") {
        return (b.room_count ?? 0) - (a.room_count ?? 0)
      }
      if (sortBy === "users") {
        return (b.user_count ?? 0) - (a.user_count ?? 0)
      }
      if (sortBy === "status") {
        return (
          Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") ||
          a.name.localeCompare(b.name)
        )
      }
      return a.name.localeCompare(b.name)
    })
  }, [hotels, sortBy, statusFilter])

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // clipboard ruxsati bo'lmasa — hech narsa
    }
  }

  const open = async (hotel: PanelHotel) => {
    setError(null)
    try {
      await enter.mutateAsync({ hotelId: hotel.id })
    } catch (e) {
      setError(panelError(e))
    }
  }

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
        tr("\"{{name}}\" to'xtatiladi.\n\n", { name: hotel.name }) +
          tr("Xodimlar tizimga kira olmaydi — ular sabab yozilgan ekranni ") +
          tr("ko'radi. Ochiq turgan sessiyalar ham darhol to'xtaydi.\n\n") +
          tr("Barcha ma'lumot va tarix saqlanadi, xohlagan payt qayta ") +
          tr("faollashtirasiz. Davom etasizmi?")
      )
    )
      return
    setError(null)
    try {
      await deactivate.mutateAsync(hotel.id)
    } catch (e) {
      setError(panelError(e))
    }
  }

  const resume = async (hotel: PanelHotel) => {
    setError(null)
    try {
      await save.mutateAsync({ id: hotel.id, status: "ACTIVE" })
    } catch (e) {
      setError(panelError(e))
    }
  }

  const actions = (hotel: PanelHotel) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <PanelButton
        className="h-8 px-2.5 text-xs"
        title={tr("Asosiy tizimni shu mehmonxonada ochish (sozlovchi huquqida)")}
        disabled={enter.isPending}
        onClick={() => void open(hotel)}
      >
        <LogIn className="h-3.5 w-3.5" />
        {tr("Kirish")}
      </PanelButton>
      <Link
        to={`/panel/hotels/${hotel.id}`}
        className="inline-flex h-8 items-center rounded-lg border border-white/[0.09] px-2.5 text-xs text-slate-300 hover:bg-white/[0.04]"
      >
        {tr("Boshqarish")}
      </Link>
      <PanelButton
        variant="ghost"
        className="h-8 px-2.5 text-xs"
        onClick={() => setEditing(hotel)}
      >
        <Pencil className="h-3.5 w-3.5" />
        {tr("Tahrirlash")}
      </PanelButton>
      {hotel.status === "ACTIVE" ? (
        <PanelButton
          variant="danger"
          className="h-8 px-2.5 text-xs"
          onClick={() => void stop(hotel)}
        >
          <PauseCircle className="h-3.5 w-3.5" />
          {tr("To'xtatish")}
        </PanelButton>
      ) : (
        <PanelButton
          className="h-8 px-2.5 text-xs"
          disabled={save.isPending}
          onClick={() => void resume(hotel)}
        >
          <PlayCircle className="h-3.5 w-3.5" />
          {tr("Faollashtirish")}
        </PanelButton>
      )}
      <PanelButton
        variant="danger"
        className="h-8 px-2.5 text-xs"
        title={tr("Mehmonxonani butunlay o'chirish")}
        onClick={() => setPurging(hotel)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </PanelButton>
    </div>
  )

  return (
    <div>
      <PanelHeading
        title={tr("Mehmonxonalar")}
        subtitle={tr("Tizimdagi barcha obyektlar — qidirish, filtrlash va to'liq boshqarish")}
        action={
          <PanelButton onClick={() => setEditing({ stars: 3, status: "ACTIVE" })}>
            <Plus className="h-4 w-4" />
            {tr("Qo'shish")}
          </PanelButton>
        }
      />

      <div className="mb-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_10rem_11rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Nomi, kodi yoki shahri...")}
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#0b0d10] pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/15"
          />
        </div>
        <PanelSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={tr("Holat")}
        >
          <option value="">{tr("Barcha holatlar")}</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </PanelSelect>
        <PanelSelect
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label={tr("Saralash")}
        >
          <option value="name">{tr("Nomi bo'yicha")}</option>
          <option value="status">{tr("Holat bo'yicha")}</option>
          <option value="branches">{tr("Filiallar soni")}</option>
          <option value="rooms">{tr("Xonalar soni")}</option>
          <option value="users">{tr("Xodimlar soni")}</option>
        </PanelSelect>
        <div className="flex h-9 items-center gap-0.5 rounded-lg border border-white/[0.08] bg-[#0b0d10] p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            title={tr("Karta")}
            aria-label={tr("Karta")}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md transition-colors",
              view === "grid"
                ? "bg-white/[0.07] text-slate-200"
                : "text-slate-600 hover:text-slate-300"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            title={tr("Jadval")}
            aria-label={tr("Jadval")}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md transition-colors",
              view === "list"
                ? "bg-white/[0.07] text-slate-200"
                : "text-slate-600 hover:text-slate-300"
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <PanelNotice>{error}</PanelNotice>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : rows.length === 0 ? (
        <PanelEmpty>
          {search || statusFilter
            ? tr("Qidiruv bo'yicha topilmadi")
            : tr("Hozircha mehmonxona yo'q")}
        </PanelEmpty>
      ) : view === "grid" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((hotel) => (
            <PanelCard key={hotel.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-100">
                    <Building2 className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <span className="truncate">{hotel.name}</span>
                    <PanelBadge tone={STATUS_TONE[hotel.status] || "neutral"}>
                      {STATUS_LABELS[hotel.status] || hotel.status}
                    </PanelBadge>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {hotel.code}
                    {hotel.city ? ` · ${hotel.city}` : ""} · {hotel.stars}★
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyId(hotel.id)}
                  title={tr("Nusxalash")}
                  className="flex-shrink-0 rounded-md p-1 text-slate-600 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
                >
                  {copiedId === hotel.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {hotel.status !== "ACTIVE" && (
                <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-500">
                  {tr("Xodimlar tizimga kira olmaydi — ular sabab yozilgan ekranni ko'radi. Ma'lumotlar saqlanmoqda.")}
                </p>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
                {[
                  [trc("count", "Filial"), hotel.branch_count],
                  [trc("count", "Xona"), hotel.room_count],
                  [trc("count", "Xodim"), hotel.user_count],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-sm font-semibold tabular-nums text-slate-200">
                      {value ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-600">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-white/[0.06] pt-3">
                {actions(hotel)}
              </div>
            </PanelCard>
          ))}
        </div>
      ) : (
        <PanelCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[11px] text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tr("Mehmonxona")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Holat")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Filiallar")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Xonalar")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Xodimlar")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Aloqa")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{tr("Amallar")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((hotel) => (
                  <tr key={hotel.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-medium text-slate-200">
                        {hotel.name}
                        <button
                          type="button"
                          onClick={() => void copyId(hotel.id)}
                          title={tr("Nusxalash")}
                          className="rounded p-0.5 text-slate-600 hover:text-slate-300"
                        >
                          {copiedId === hotel.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {hotel.code}
                        {hotel.city ? ` · ${hotel.city}` : ""} · {hotel.stars}★
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <PanelBadge tone={STATUS_TONE[hotel.status] || "neutral"}>
                        {STATUS_LABELS[hotel.status] || hotel.status}
                      </PanelBadge>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">{hotel.branch_count ?? 0}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{hotel.room_count ?? 0}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{hotel.user_count ?? 0}</td>
                    <td className="px-3 py-3 text-[11px] text-slate-500">
                      <p>{hotel.phone || "—"}</p>
                      <p>{hotel.email || ""}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">{actions(hotel)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      )}

      <HotelPurgeDialog hotel={purging} onClose={() => setPurging(null)} />

      <PanelDialog
        open={!!editing}
        title={editing?.id ? tr("Mehmonxonani tahrirlash") : tr("Yangi mehmonxona")}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submit} className="space-y-3">
          <PanelInput
            label={tr("Nomi")}
            value={editing?.name || ""}
            onChange={(e) => setEditing((h) => ({ ...h, name: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <PanelInput
              label={tr("Kod")}
              value={editing?.code || ""}
              onChange={(e) => setEditing((h) => ({ ...h, code: e.target.value }))}
              maxLength={10}
              required
            />
            <PanelInput
              label={tr("Yulduz")}
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
              label={tr("Shahar")}
              value={editing?.city || ""}
              onChange={(e) => setEditing((h) => ({ ...h, city: e.target.value }))}
            />
            <PanelInput
              label={tr("Davlat")}
              value={editing?.country || ""}
              onChange={(e) => setEditing((h) => ({ ...h, country: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PanelInput
              label={tr("Telefon")}
              value={editing?.phone || ""}
              onChange={(e) => setEditing((h) => ({ ...h, phone: e.target.value }))}
            />
            <PanelInput
              label={tr("Pochta")}
              type="email"
              value={editing?.email || ""}
              onChange={(e) => setEditing((h) => ({ ...h, email: e.target.value }))}
            />
          </div>
          {editing?.id && (
            <PanelSelect
              label={tr("Holat")}
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
            <PanelButton type="button" variant="ghost" onClick={() => setEditing(null)}>
              {tr("Bekor qilish")}
            </PanelButton>
            <PanelButton type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr("Saqlash")}
            </PanelButton>
          </div>
        </form>
      </PanelDialog>
    </div>
  )
}
