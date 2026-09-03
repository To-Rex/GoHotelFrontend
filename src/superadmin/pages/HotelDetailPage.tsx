import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, KeyRound, Loader2, Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import {
  useBranches,
  useDeleteBranch,
  useHotelStaff,
  useHotels,
  useResetStaffPassword,
  useSaveBranch,
  useSetStaffStatus,
  type HotelStaff,
  type PanelBranch,
} from "../api/panel"
import {
  PanelButton,
  PanelCard,
  PanelDialog,
  PanelEmpty,
  PanelHeading,
  PanelInput,
  PanelNotice,
} from "../components/ui"

const STAFF_STATUS: Record<string, string> = {
  ACTIVE: "Faol",
  INACTIVE: "To'xtatilgan",
  TERMINATED: "Ishdan bo'shatilgan",
}

/** Bitta mehmonxona: filiallari va xodimlari. */
export function HotelDetailPage() {
  const { hotelId = "" } = useParams()
  const [tab, setTab] = useState<"branches" | "staff">("branches")

  // Ro'yxat allaqachon yuklangan bo'lsa nom shundan olinadi — alohida
  // so'rov yubormaymiz
  const { data: hotels = [] } = useHotels()
  const hotel = hotels.find((h) => h.id === hotelId)

  return (
    <div>
      <Link
        to="/panel/hotels"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Mehmonxonalar
      </Link>

      <PanelHeading
        title={hotel?.name || "Mehmonxona"}
        subtitle={
          hotel ? `${hotel.code}${hotel.city ? ` · ${hotel.city}` : ""}` : undefined
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
        {(
          [
            ["branches", "Filiallar"],
            ["staff", "Xodimlar"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === key
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "branches" ? (
        <BranchesTab hotelId={hotelId} />
      ) : (
        <StaffTab hotelId={hotelId} />
      )}
    </div>
  )
}

function BranchesTab({ hotelId }: { hotelId: string }) {
  const { data: branches = [], isLoading } = useBranches(hotelId)
  const save = useSaveBranch()
  const remove = useDeleteBranch()
  const [editing, setEditing] = useState<Partial<PanelBranch> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setError(null)
    try {
      await save.mutateAsync({ ...editing, hotelId })
      setEditing(null)
    } catch (e) {
      setError(panelError(e))
    }
  }

  const drop = async (branch: PanelBranch) => {
    if (!confirm(`"${branch.name}" filiali o'chiriladi. Davom etasizmi?`)) return
    setError(null)
    try {
      await remove.mutateAsync(branch.id)
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <PanelButton onClick={() => setEditing({})}>
          <Plus className="h-4 w-4" />
          Filial qo'shish
        </PanelButton>
      </div>

      {error && <PanelNotice>{error}</PanelNotice>}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
        </div>
      ) : branches.length === 0 ? (
        <PanelEmpty>Filial yo'q</PanelEmpty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {branches.map((branch) => (
            <PanelCard key={branch.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-100">
                    <span className="truncate">{branch.name}</span>
                    {branch.is_main_branch && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        asosiy
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {branch.code}
                    {branch.city ? ` · ${branch.city}` : ""} ·{" "}
                    {branch.room_count ?? 0} xona
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <PanelButton
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setEditing(branch)}
                >
                  Tahrirlash
                </PanelButton>
                <PanelButton
                  variant="danger"
                  className="h-8 text-xs"
                  onClick={() => drop(branch)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  O'chirish
                </PanelButton>
              </div>
            </PanelCard>
          ))}
        </div>
      )}

      <PanelDialog
        open={!!editing}
        title={editing?.id ? "Filialni tahrirlash" : "Yangi filial"}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submit} className="space-y-3">
          <PanelInput
            label="Nomi"
            value={editing?.name || ""}
            onChange={(e) => setEditing((b) => ({ ...b, name: e.target.value }))}
            required
          />
          <PanelInput
            label="Kod"
            value={editing?.code || ""}
            onChange={(e) => setEditing((b) => ({ ...b, code: e.target.value }))}
            maxLength={20}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <PanelInput
              label="Shahar"
              value={editing?.city || ""}
              onChange={(e) =>
                setEditing((b) => ({ ...b, city: e.target.value }))
              }
            />
            <PanelInput
              label="Telefon"
              value={editing?.phone || ""}
              onChange={(e) =>
                setEditing((b) => ({ ...b, phone: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={!!editing?.is_main_branch}
              onChange={(e) =>
                setEditing((b) => ({ ...b, is_main_branch: e.target.checked }))
              }
            />
            Asosiy filial
          </label>

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

function StaffTab({ hotelId }: { hotelId: string }) {
  const { data: staff = [], isLoading } = useHotelStaff(hotelId)
  const setStatus = useSetStaffStatus()
  const resetPassword = useResetStaffPassword()
  const [target, setTarget] = useState<HotelStaff | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!target) return
    setError(null)
    try {
      await resetPassword.mutateAsync({ id: target.id, password })
      setNotice(`${target.username} uchun parol almashtirildi`)
      setTarget(null)
      setPassword("")
      window.setTimeout(() => setNotice(null), 4000)
    } catch (e) {
      setError(panelError(e))
    }
  }

  const toggle = async (person: HotelStaff) => {
    const next = person.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setError(null)
    try {
      await setStatus.mutateAsync({ id: person.id, status: next })
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <div>
      {error && <PanelNotice>{error}</PanelNotice>}
      {notice && <PanelNotice tone="success">{notice}</PanelNotice>}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
        </div>
      ) : staff.length === 0 ? (
        <PanelEmpty>Xodim yo'q</PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Xodim</th>
                <th className="px-3 py-2 font-medium">Login</th>
                <th className="px-3 py-2 font-medium">Roli</th>
                <th className="px-3 py-2 font-medium">Holat</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {staff.map((person) => (
                <tr key={person.id}>
                  <td className="px-3 py-2 text-slate-200">
                    {person.first_name} {person.last_name}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{person.username}</td>
                  <td className="px-3 py-2 text-slate-400">{person.user_type}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        person.status === "ACTIVE"
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      )}
                    >
                      {STAFF_STATUS[person.status] || person.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <PanelButton
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setTarget(person)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Parol
                      </PanelButton>
                      <PanelButton
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => toggle(person)}
                      >
                        {person.status === "ACTIVE" ? "To'xtatish" : "Faollashtirish"}
                      </PanelButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PanelDialog
        open={!!target}
        title={`${target?.username || ""} — yangi parol`}
        onClose={() => setTarget(null)}
      >
        <form onSubmit={submitPassword} className="space-y-3">
          <PanelInput
            label="Yangi parol"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <p className="text-[11px] text-slate-500">
            Parolni xodimga o'zingiz yetkazasiz — tizim uni hech qayerga
            yubormaydi.
          </p>
          {error && <PanelNotice>{error}</PanelNotice>}
          <div className="flex justify-end gap-2">
            <PanelButton
              type="button"
              variant="ghost"
              onClick={() => setTarget(null)}
            >
              Bekor qilish
            </PanelButton>
            <PanelButton type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Almashtirish
            </PanelButton>
          </div>
        </form>
      </PanelDialog>
    </div>
  )
}
