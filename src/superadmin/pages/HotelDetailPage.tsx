import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  BedDouble,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import {
  useBranches,
  useCreateStaff,
  useDeleteBranch,
  useHotelRooms,
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
  PanelSelect,
} from "../components/ui"

const STAFF_STATUS: Record<string, string> = {
  ACTIVE: "Faol",
  INACTIVE: "To'xtatilgan",
  TERMINATED: "Ishdan bo'shatilgan",
}

/** Xodim rollari — backend qabul qiladigan qiymatlar. */
const USER_TYPES: [string, string][] = [
  ["ADMIN", "Administrator"],
  ["MANAGER", "Menejer"],
  ["RECEPTIONIST", "Qabulxona"],
  ["HOUSEKEEPER", "Farrosh"],
  ["MAINTENANCE", "Usta"],
  ["ACCOUNTANT", "Buxgalter"],
]

const ROOM_STATUS: Record<string, string> = {
  AVAILABLE: "Bo'sh",
  OCCUPIED: "Band",
  RESERVED: "Bron qilingan",
  CLEANING: "Tozalanmoqda",
  MAINTENANCE: "Ta'mirda",
  OUT_OF_ORDER: "Ishlamaydi",
}

/** Bitta mehmonxona: filiallari va xodimlari. */
export function HotelDetailPage() {
  const { hotelId = "" } = useParams()
  const [tab, setTab] = useState<"branches" | "rooms" | "staff">("branches")

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

      <div className="mb-4 flex gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1">
        {(
          [
            ["branches", "Filiallar"],
            ["rooms", "Xonalar"],
            ["staff", "Xodimlar"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === key
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "branches" && <BranchesTab hotelId={hotelId} />}
      {tab === "rooms" && <RoomsTab hotelId={hotelId} />}
      {tab === "staff" && <StaffTab hotelId={hotelId} />}
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
  const createStaff = useCreateStaff()
  const [target, setTarget] = useState<HotelStaff | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<{
    username: string
    password: string
    first_name: string
    last_name: string
    user_type: string
  } | null>(null)

  const submitNew = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft) return
    setError(null)
    try {
      await createStaff.mutateAsync({ hotelId, ...draft })
      setNotice(`${draft.username} qo'shildi`)
      setDraft(null)
      window.setTimeout(() => setNotice(null), 4000)
    } catch (e) {
      setError(panelError(e))
    }
  }

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
      <div className="mb-3 flex justify-end">
        <PanelButton
          onClick={() =>
            setDraft({
              username: "",
              password: "",
              first_name: "",
              last_name: "",
              user_type: "RECEPTIONIST",
            })
          }
        >
          <UserPlus className="h-4 w-4" />
          Xodim qo'shish
        </PanelButton>
      </div>

      {error && <PanelNotice>{error}</PanelNotice>}
      {notice && <PanelNotice tone="success">{notice}</PanelNotice>}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
        </div>
      ) : staff.length === 0 ? (
        <PanelEmpty>Xodim yo'q</PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Xodim</th>
                <th className="px-3 py-2 font-medium">Login</th>
                <th className="px-3 py-2 font-medium">Roli</th>
                <th className="px-3 py-2 font-medium">Holat</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {staff.map((person) => (
                <tr key={person.id} className="hover:bg-white/[0.02]">
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
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/5 text-slate-400"
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
        open={!!draft}
        title="Yangi xodim"
        onClose={() => setDraft(null)}
      >
        <form onSubmit={submitNew} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <PanelInput
              label="Ism"
              value={draft?.first_name || ""}
              onChange={(e) =>
                setDraft((d) => d && { ...d, first_name: e.target.value })
              }
              required
            />
            <PanelInput
              label="Familiya"
              value={draft?.last_name || ""}
              onChange={(e) =>
                setDraft((d) => d && { ...d, last_name: e.target.value })
              }
              required
            />
          </div>
          <PanelInput
            label="Login"
            value={draft?.username || ""}
            onChange={(e) =>
              setDraft((d) => d && { ...d, username: e.target.value })
            }
            autoComplete="off"
            required
          />
          <PanelInput
            label="Parol"
            type="text"
            value={draft?.password || ""}
            onChange={(e) =>
              setDraft((d) => d && { ...d, password: e.target.value })
            }
            minLength={6}
            autoComplete="new-password"
            required
          />
          <PanelSelect
            label="Roli"
            value={draft?.user_type || "RECEPTIONIST"}
            onChange={(e) =>
              setDraft((d) => d && { ...d, user_type: e.target.value })
            }
          >
            {USER_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </PanelSelect>
          <p className="text-[11px] text-slate-500">
            Xodim asosiy filialga biriktiriladi va shu login bilan tizimga
            kiradi.
          </p>
          {error && <PanelNotice>{error}</PanelNotice>}
          <div className="flex justify-end gap-2 pt-1">
            <PanelButton
              type="button"
              variant="ghost"
              onClick={() => setDraft(null)}
            >
              Bekor qilish
            </PanelButton>
            <PanelButton type="submit" disabled={createStaff.isPending}>
              {createStaff.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Qo'shish
            </PanelButton>
          </div>
        </form>
      </PanelDialog>

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

/** Mehmonxonaning barcha xonalari — faqat ko'rish uchun. */
function RoomsTab({ hotelId }: { hotelId: string }) {
  const { data: rooms = [], isLoading } = useHotelRooms(hotelId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
      </div>
    )
  }

  if (rooms.length === 0) return <PanelEmpty>Xona yo'q</PanelEmpty>

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
            <tr>
              <th className="px-3 py-2.5 font-medium">Xona</th>
              <th className="px-3 py-2.5 font-medium">Qavat</th>
              <th className="px-3 py-2.5 font-medium">Turi</th>
              <th className="px-3 py-2.5 font-medium">Sig'imi</th>
              <th className="px-3 py-2.5 text-right font-medium">Narxi</th>
              <th className="px-3 py-2.5 font-medium">Holat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rooms.map((room) => (
              <tr key={room.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 font-medium text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <BedDouble className="h-3.5 w-3.5 text-slate-600" />
                    {room.room_number}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-400">{room.floor}</td>
                <td className="px-3 py-2.5 text-slate-400">{room.room_type}</td>
                <td className="px-3 py-2.5 text-slate-400">
                  {room.capacity ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                  {room.base_price.toLocaleString("uz-UZ", {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px]",
                      room.status === "AVAILABLE"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/5 text-slate-400"
                    )}
                  >
                    {ROOM_STATUS[room.status] || room.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
