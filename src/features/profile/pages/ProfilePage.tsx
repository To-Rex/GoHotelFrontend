import { useMemo } from "react"
import { format } from "date-fns"
import {
  UserRound,
  Phone,
  Mail,
  Building2,
  Clock,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  History,
} from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { usePermissions } from "@/lib/permissions"
import { useBranches } from "@/features/rooms/api/rooms"
import { useEmployeePhotos } from "@/features/employees/api/employees"
import {
  MODULE_LABELS,
  uzPermissionLabel,
} from "@/features/employees/pages/PermissionsPage"
import { cn } from "@/lib/utils"

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super administrator",
  ADMIN: "Administrator",
  EMPLOYEE: "Xodim",
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Faol",
  INACTIVE: "Nofaol",
  TERMINATED: "Ishdan bo'shatilgan",
}

const statusBadge: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-amber-100 text-amber-700",
  TERMINATED: "bg-red-100 text-red-600",
}

/* Profil sahifasi — foydalanuvchi O'ZI haqidagi barcha ma'lumotlar:
   shaxsiy ma'lumotlar, ish jadvali va unga berilgan ruxsatlar ro'yxati
   (o'zbekcha nomlari bilan, modullar kesimida). Faqat ko'rish uchun —
   o'zgartirishlar avvalgidek admin orqali qilinadi. */
export const ProfilePage = () => {
  const user = useAuthStore((s) => s.user)
  const { isAdmin, permissions } = usePermissions()
  const { data: branches = [] } = useBranches()
  // Surat xodimlar sahifasidagi bilan bir xil manbadan (ruxsat bo'lmasa
  // jimgina bosh harfli avatar ko'rinadi)
  const { data: photosMap = {} } = useEmployeePhotos()

  const branchName =
    (user?.branch_id && branches.find((b) => b.id === user.branch_id)?.name) || "—"

  const initials =
    `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase() || "?"

  const photo = user?.id ? photosMap[user.id] : undefined

  // Ruxsatlarni modul kesimida guruhlash (kod prefiksi bo'yicha)
  const permissionGroups = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const code of permissions) {
      const module = code.split(".")[0] || "boshqa"
      if (!groups[module]) groups[module] = []
      groups[module].push(code)
    }
    return Object.entries(groups)
      .map(([module, codes]) => ({
        module,
        label: MODULE_LABELS[module] || module,
        codes: codes.sort(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [permissions])

  const infoCards = [
    {
      icon: Phone,
      accent: "text-sky-600",
      label: "Telefon",
      value: user?.phone || "—",
    },
    {
      icon: Mail,
      accent: "text-violet-600",
      label: "Email",
      value: user?.email || "—",
    },
    {
      icon: Building2,
      accent: "text-amber-600",
      label: "Filial",
      value: branchName,
    },
    {
      icon: Clock,
      accent: "text-emerald-600",
      label: "Ish jadvali",
      value:
        user?.work_start && user?.work_end
          ? `${user.work_start}–${user.work_end}`
          : "—",
      sub: user?.work_hours_per_day
        ? `kuniga ${user.work_hours_per_day} soat`
        : undefined,
    },
    {
      icon: History,
      accent: "text-primary-600",
      label: "Oxirgi kirish",
      value: user?.last_login_at
        ? format(new Date(user.last_login_at), "dd.MM.yyyy HH:mm")
        : "—",
    },
    {
      icon: KeyRound,
      accent: "text-orange-600",
      label: "Login",
      value: user?.username ? `@${user.username}` : "—",
    },
  ]

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
          <UserRound className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Profil</h1>
          <p className="text-sm text-gray-500">
            Hisobingiz haqidagi ma'lumotlar va sizga berilgan ruxsatlar
          </p>
        </div>
      </div>

      {/* Asosiy karta — surat, ism, rol va holat */}
      <div className="rounded-2xl border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="h-24 w-24 rounded-full border-2 border-primary-100 object-cover shadow-sm"
            />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-3xl font-bold text-primary-700">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-sm text-gray-400">@{user?.username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                {ROLE_LABELS[user?.user_type || ""] || user?.user_type}
              </span>
              {user?.status && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    statusBadge[user.status] || statusBadge.ACTIVE
                  )}
                >
                  {STATUS_LABELS[user.status] || user.status}
                </span>
              )}
              {user?.hotel_name && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {user.hotel_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ma'lumot kartalari */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
        {infoCards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-gray-500">{c.label}</p>
              <c.icon className={cn("h-4 w-4 flex-shrink-0", c.accent)} />
            </div>
            <p className="mt-1.5 truncate text-base font-bold text-gray-900">
              {c.value}
            </p>
            {c.sub && <p className="truncate text-[11px] text-gray-400">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Ruxsatlar */}
      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between gap-2 border-b bg-gray-50/70 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Mening ruxsatlarim
          </h2>
          {!isAdmin && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
              {permissions.length} ta
            </span>
          )}
        </div>

        <div className="p-4">
          {isAdmin ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-bold text-emerald-800">
                  Administrator — to'liq ruxsat
                </p>
                <p className="text-xs text-emerald-700/80">
                  Tizimning barcha bo'limlari va amallariga cheklovsiz kirish
                  huquqiga egasiz.
                </p>
              </div>
            </div>
          ) : permissions.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-gray-400">
              Sizga hali ruxsatlar biriktirilmagan — administratorga murojaat
              qiling.
            </p>
          ) : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
              {permissionGroups.map((g) => (
                <div key={g.module} className="rounded-xl border p-3.5">
                  <p className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-gray-500">
                    {g.label}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                      {g.codes.length}
                    </span>
                  </p>
                  <div className="space-y-1.5">
                    {g.codes.map((code) => (
                      <p
                        key={code}
                        className="flex items-center gap-1.5 text-sm text-gray-700"
                        title={code}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                        {uzPermissionLabel(code, code)}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
