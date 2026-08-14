import { useState, useMemo, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Search,
  LayoutGrid,
  List,
  Phone,
  Building2,
  CalendarDays,
  Clock,
  Camera,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  usePermissionsList,
  useSetUserPermissions,
  useUserPermissions,
  uploadEmployeePhoto,
  useEmployeePhotos,
  EMPLOYEE_PHOTO_ACCEPT,
  EMPLOYEE_PHOTO_MAX_BYTES,
} from "../api/employees"
import {
  PERMISSION_TEMPLATES,
  templatePermissionIds,
  findMatchingTemplate,
} from "../permissionTemplates"
import { useBranches } from "@/features/rooms/api/rooms"
import type { Employee } from "@/types/api"
import { usePermissions } from "@/lib/permissions"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const selectClass =
  "w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

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

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Administrator",
  EMPLOYEE: "Xodim",
}

// Dialog ichidagi forma bo'limi: kichik sarlavha (ikonka bilan) + maydonlar
const FormSection = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserCog
  title: string
  children: ReactNode
}) => (
  <section className="space-y-2.5">
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
      <Icon className="h-3.5 w-3.5 text-primary-500" />
      {title}
    </p>
    {children}
  </section>
)

export const EmployeesPage = () => {
  const { can, isAdmin } = usePermissions()
  const canCreate = can("employee.create")
  const canEdit = can("employee.update")
  const canDelete = can("employee.delete")
  const user = useAuthStore((s) => s.user)

  const { data: employees = [], isLoading } = useEmployees()
  const { data: branches = [] } = useBranches()
  const { data: allPermissions = [] } = usePermissionsList()
  // Xodim suratlari (user id -> URL) — jadval avatarlari uchun
  const { data: photosMap = {} } = useEmployeePhotos()
  const queryClient = useQueryClient()

  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee()
  const deleteMutation = useDeleteEmployee()
  const setPermsMutation = useSetUserPermissions()

  // Rol shablonlari: menejer (admin emas) faqat "Farrosh" va "Texnik xizmat"
  // rollarini bera oladi — backend ham xuddi shuni tekshiradi;
  // ADMIN/SUPER_ADMIN istalgan rolni tanlashi mumkin.
  const roleOptions = useMemo(
    () =>
      PERMISSION_TEMPLATES.filter(
        (t) => isAdmin || t.id === "housekeeper" || t.id === "maintenance"
      ),
    [isAdmin]
  )

  const branchMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const b of branches) m[b.id] = b.name
    return m
  }, [branches])

  const [search, setSearch] = useState("")

  // Ko'rinish: grid (standart) yoki jadval — tanlov brauzerda saqlanadi
  const [viewMode, setViewModeState] = useState<"table" | "grid">(() => {
    try {
      return localStorage.getItem("employees_view_mode") === "table" ? "table" : "grid"
    } catch {
      return "grid"
    }
  })
  const setViewMode = (m: "table" | "grid") => {
    setViewModeState(m)
    try {
      localStorage.setItem("employees_view_mode", m)
    } catch {}
  }

  const filtered = employees.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      e.first_name?.toLowerCase().includes(q) ||
      e.last_name?.toLowerCase().includes(q) ||
      e.username?.toLowerCase().includes(q) ||
      (e.phone || "").includes(q) ||
      (e.email || "").toLowerCase().includes(q)
    )
  })

  // --- Dialog holati (yaratish/tahrirlash bitta dialogda) ---
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [branchId, setBranchId] = useState("")
  const [hireDate, setHireDate] = useState("")
  const [status, setStatus] = useState("ACTIVE")
  // Ish jadvali: soat nechadan nechagacha va kuniga necha soat (default 8)
  const [workStart, setWorkStart] = useState("09:00")
  const [workEnd, setWorkEnd] = useState("18:00")
  const [workHours, setWorkHours] = useState("8")

  // Boshlanish vaqti va kunlik soat kiritiladi — tugash vaqti avtomatik
  // hisoblanadi (tungi smenada yarim tundan oshib ketishi ham mumkin).
  const computeWorkEnd = (start: string, hours: string): string => {
    const [sh, sm] = start.split(":").map(Number)
    const h = parseInt(hours, 10)
    if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(h)) return workEnd
    const total = (sh * 60 + sm + h * 60) % (24 * 60)
    const eh = Math.floor(total / 60)
    const em = total % 60
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`
  }
  const applyWorkStart = (start: string) => {
    setWorkStart(start)
    setWorkEnd(computeWorkEnd(start, workHours))
  }
  const applyWorkHours = (hours: string) => {
    setWorkHours(hours)
    setWorkEnd(computeWorkEnd(workStart, hours))
  }
  // Rol shabloni: yaratishda — biriktiriladigan rol (bo'sh — rolsiz),
  // tahrirlashda — yangi rol (bo'sh — o'zgartirilmaydi)
  const [roleTemplateId, setRoleTemplateId] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Tahrirlanayotgan xodimning joriy ruxsatlari — joriy rolni aniqlash va
  // rol almashtirilganda to'liq almashtirish uchun
  const { data: editingPerms = [] } = useUserPermissions(editing?.id)
  const editingRole = useMemo(
    () =>
      editing
        ? findMatchingTemplate(
            (editingPerms as any[]).map((p: any) => p.id),
            allPermissions
          )
        : null,
    [editing, editingPerms, allPermissions]
  )

  // Xodim surati (yaratishda ham, tahrirlashda ham tanlash mumkin)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const handlePhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    if (!file) {
      setPhoto(null)
      setPhotoPreview(null)
      return
    }
    if (!EMPLOYEE_PHOTO_ACCEPT.split(",").includes(file.type)) {
      setErrorMsg("Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.")
      return
    }
    if (file.size > EMPLOYEE_PHOTO_MAX_BYTES) {
      setErrorMsg("Rasm hajmi 5 MB dan oshmasligi kerak.")
      return
    }
    setErrorMsg(null)
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // Suratni yuklash — xodim saqlangach; xato bersa jarayonni buzmaydi
  const uploadPhotoFor = async (userId: string): Promise<string | null> => {
    if (!photo) return null
    try {
      setUploading(true)
      await uploadEmployeePhoto(userId, photo, user?.hotel_id)
      queryClient.invalidateQueries({ queryKey: ["employeePhotos"] })
      return null
    } catch (err) {
      return apiErrorMessage(err)
    } finally {
      setUploading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFirstName("")
    setLastName("")
    setUsername("")
    setPassword("")
    setEmail("")
    setPhone("")
    setBranchId(user?.branch_id || branches[0]?.id || "")
    setHireDate(new Date().toISOString().slice(0, 10))
    setStatus("ACTIVE")
    setWorkStart("09:00")
    setWorkEnd("17:00")
    setWorkHours("8")
    // Menejer uchun yagona variant — Farrosh; admin xohlasa keyin tanlaydi
    setRoleTemplateId(isAdmin ? "" : "housekeeper")
    handlePhoto(null)
    setErrorMsg(null)
    setModalOpen(true)
  }

  const openEdit = (e: Employee) => {
    setEditing(e)
    setFirstName(e.first_name)
    setLastName(e.last_name)
    setUsername(e.username)
    setPassword("")
    setEmail(e.email || "")
    setPhone(e.phone || "")
    setBranchId(e.branch_id || "")
    setHireDate(e.hire_date || "")
    setStatus(e.status)
    setWorkStart(e.work_start || "09:00")
    setWorkEnd(e.work_end || "18:00")
    setWorkHours(String(e.work_hours_per_day ?? 8))
    // Tahrirlashda rol standart "o'zgartirilmaydi" — tanlansagina almashadi
    setRoleTemplateId("")
    handlePhoto(null)
    setErrorMsg(null)
    setModalOpen(true)
  }

  const onSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg("Ism va familiyani kiriting")
      return
    }
    const hoursNum = parseInt(workHours, 10)
    if (Number.isNaN(hoursNum) || hoursNum < 1 || hoursNum > 24) {
      setErrorMsg("Kunlik ish soati 1 dan 24 gacha bo'lishi kerak")
      return
    }
    try {
      if (editing) {
        // Admin login/parolni ham almashtira oladi (bo'sh parol — o'zgarmaydi)
        const newUsername =
          isAdmin && username.trim() && username.trim() !== editing.username
            ? username.trim()
            : undefined
        const newPassword = isAdmin && password ? password : undefined
        if (newUsername && newUsername.length < 3) {
          setErrorMsg("Login kamida 3 belgidan iborat bo'lishi kerak")
          return
        }
        if (newPassword && newPassword.length < 6) {
          setErrorMsg("Yangi parol kamida 6 belgidan iborat bo'lishi kerak")
          return
        }
        await updateMutation.mutateAsync({
          id: editing.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          branch_id: branchId || undefined,
          status,
          work_hours_per_day: hoursNum,
          work_start: workStart,
          work_end: workEnd,
          username: newUsername,
          password: newPassword,
        })
        // Yangi surat tanlangan bo'lsa — yuklaymiz (xato saqlashni buzmaydi)
        const photoErr = await uploadPhotoFor(editing.id)
        if (photoErr) {
          setModalOpen(false)
          alert("Ma'lumotlar saqlandi, lekin surat yuklanmadi:\n" + photoErr)
          return
        }

        // Rol almashtirilgan bo'lsa — shablon ruxsatlari TO'LIQ almashtiriladi.
        // Menejer faqat Farrosh/Texnik xizmat doirasida — backend tekshiradi.
        if (roleTemplateId && editing.user_type !== "ADMIN") {
          const template = PERMISSION_TEMPLATES.find((t) => t.id === roleTemplateId)
          const permissionIds = template
            ? templatePermissionIds(template, allPermissions)
            : []
          if (permissionIds.length > 0) {
            try {
              await setPermsMutation.mutateAsync({
                userId: editing.id,
                permissionIds,
                currentIds: (editingPerms as any[]).map((p: any) => p.id),
              })
            } catch (permError) {
              setModalOpen(false)
              alert(
                "Ma'lumotlar saqlandi, lekin rolni almashtirishda xatolik:\n" +
                  apiErrorMessage(permError)
              )
              return
            }
          }
        }
      } else {
        if (username.trim().length < 3) {
          setErrorMsg("Login kamida 3 belgidan iborat bo'lishi kerak")
          return
        }
        if (password.length < 6) {
          setErrorMsg("Parol kamida 6 belgidan iborat bo'lishi kerak")
          return
        }
        if (!branchId) {
          setErrorMsg("Filialni tanlang")
          return
        }
        const branch = branches.find((b) => b.id === branchId)
        const hotelId = user?.hotel_id || branch?.hotel_id
        if (!hotelId) {
          setErrorMsg("Mehmonxona aniqlanmadi")
          return
        }
        const created = await createMutation.mutateAsync({
          hotel_id: hotelId,
          branch_id: branchId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: username.trim(),
          password,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          hire_date: hireDate || undefined,
          work_hours_per_day: hoursNum,
          work_start: workStart,
          work_end: workEnd,
        })

        // Surat tanlangan bo'lsa — yuklaymiz. Xodim allaqachon yaratilgan,
        // shuning uchun surat xatosi yaratishni bekor qilmaydi
        const photoErr = await uploadPhotoFor(created.id)
        if (photoErr) {
          alert("Xodim qo'shildi, lekin surat yuklanmadi:\n" + photoErr)
        }

        // Rol tanlangan bo'lsa — shablon ruxsatlarini avtomatik biriktiramiz.
        // Xodim allaqachon yaratilgan, shuning uchun bu bosqich xato bersa ham
        // yaratish bekor bo'lmaydi — faqat ogohlantiramiz.
        const template = PERMISSION_TEMPLATES.find((t) => t.id === roleTemplateId)
        const permissionIds = template
          ? templatePermissionIds(template, allPermissions)
          : []
        if (permissionIds.length > 0) {
          try {
            await setPermsMutation.mutateAsync({
              userId: created.id,
              permissionIds,
              currentIds: [],
            })
          } catch (permError) {
            setModalOpen(false)
            alert(
              "Xodim qo'shildi, lekin rol ruxsatlarini biriktirishda xatolik yuz berdi:\n" +
                apiErrorMessage(permError) +
                "\nRolni keyinroq \"Ruxsatnomalar\" sahifasidan belgilashingiz mumkin."
            )
            return
          }
        }
      }
      setModalOpen(false)
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
    }
  }

  const onDelete = async (e: Employee) => {
    if (!confirm(`${e.first_name} ${e.last_name} xodimini o'chirasizmi?`)) return
    try {
      await deleteMutation.mutateAsync(e.id)
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  const saving =
    createMutation.isPending ||
    updateMutation.isPending ||
    setPermsMutation.isPending ||
    uploading

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Xodimlar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const activeCount = employees.filter((e) => e.status === "ACTIVE").length

  // Xodim kartalari (grid) — "grid" rejimida asosiy ko'rinish, "table"
  // rejimida esa mobil ekranda jadval o'rniga shu kartalar chiqadi
  // (kod dublikat bo'lmasligi uchun bitta konstantaga ajratilgan)
  const gridCards =
    filtered.length === 0 ? (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-14 text-gray-400">
        <UserCog className="h-8 w-8" />
        <p className="text-sm">Xodimlar topilmadi</p>
      </div>
    ) : (
      /* auto-fill: ustunlar soni displayga qarab o'zi moslashadi */
      <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
        {filtered.map((e) => (
          <div
            key={e.id}
            className="group relative rounded-2xl border bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* Katta surat — kartaning markaziy elementi */}
            {photosMap[e.id] ? (
              <img
                src={photosMap[e.id]}
                alt=""
                className="mx-auto h-24 w-24 rounded-full border-2 border-primary-100 object-cover shadow-sm"
              />
            ) : (
              <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">
                {`${e.first_name?.[0] ?? ""}${e.last_name?.[0] ?? ""}`.toUpperCase() ||
                  "?"}
              </span>
            )}

            <p className="mt-3 truncate font-bold text-gray-900">
              {e.first_name} {e.last_name}
            </p>
            <p className="truncate text-xs text-gray-400">@{e.username}</p>

            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                {ROLE_LABELS[e.user_type] || e.user_type}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  statusBadge[e.status] || statusBadge.ACTIVE
                )}
              >
                {STATUS_LABELS[e.status] || e.status}
              </span>
            </div>

            <div className="mt-3.5 space-y-1.5 border-t border-gray-100 pt-3 text-left text-xs text-gray-500">
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">{e.phone || "—"}</span>
              </p>
              <p className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">
                  {(e.branch_id && branchMap[e.branch_id]) || "—"}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">{e.hire_date || "—"}</span>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">
                  {e.work_start || "09:00"}–{e.work_end || "18:00"} ·{" "}
                  {e.work_hours_per_day ?? 8} soat
                </span>
              </p>
            </div>

            {(canEdit || canDelete) && (
              <div className="absolute right-2.5 top-2.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {canEdit && (
                  <button
                    type="button"
                    title="Tahrirlash"
                    onClick={() => openEdit(e)}
                    className="rounded-md bg-white/90 p-1.5 text-gray-400 shadow-sm ring-1 ring-gray-200 hover:text-gray-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {canDelete && e.id !== user?.id && (
                  <button
                    type="button"
                    title="O'chirish"
                    onClick={() => onDelete(e)}
                    className="rounded-md bg-white/90 p-1.5 text-red-400 shadow-sm ring-1 ring-gray-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
            <UserCog className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Xodimlar</h1>
            <p className="text-sm text-gray-500">
              Jami {employees.length} ta xodim ·{" "}
              <span className="font-medium text-emerald-600">{activeCount} faol</span>
              {filtered.length !== employees.length && (
                <span className="font-medium text-primary-700">
                  {" "}
                  · natija: {filtered.length} ta
                </span>
              )}
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Xodim qo'shish
          </Button>
        )}
      </div>

      {/* Qidiruv + ko'rinish almashtirgich */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Ism, login, telefon bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ml-auto flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            title="Jadval ko'rinishi"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "table"
                ? "bg-primary-50 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <List className="h-4 w-4" />
            Jadval
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            title="Grid ko'rinishi"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "grid"
                ? "bg-primary-50 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Grid
          </button>
        </div>
      </div>

      {/* GRID ko'rinishi — xodim kartalari */}
      {viewMode === "grid" && gridCards}

      {viewMode === "table" && (
      <>
      {/* MOBIL: jadval rejimida telefonda mavjud grid kartalar ko'rsatiladi */}
      <div className="md:hidden">{gridCards}</div>

      {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
      <div className="hidden rounded-2xl border bg-white overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>F.I.Sh</TableHead>
              <TableHead>Roli</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Ishga olingan</TableHead>
              <TableHead>Ish vaqti</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="text-right">Amallar</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-gray-400">
                  Xodimlar topilmadi
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {photosMap[e.id] ? (
                        <img
                          src={photosMap[e.id]}
                          alt=""
                          className="h-8 w-8 flex-shrink-0 rounded-full border border-gray-200 object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                          <UserCog className="h-4 w-4" />
                        </span>
                      )}
                      <div>
                        <p className="font-medium leading-tight">
                          {e.first_name} {e.last_name}
                        </p>
                        <p className="text-xs text-gray-400 leading-tight">
                          @{e.username}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {ROLE_LABELS[e.user_type] || e.user_type}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        statusBadge[e.status] || statusBadge.ACTIVE
                      )}
                    >
                      {STATUS_LABELS[e.status] || e.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600">{e.phone || "—"}</TableCell>
                  <TableCell className="text-gray-600">
                    {(e.branch_id && branchMap[e.branch_id]) || "—"}
                  </TableCell>
                  <TableCell className="text-gray-600">{e.hire_date || "—"}</TableCell>
                  <TableCell className="text-gray-600 whitespace-nowrap">
                    {e.work_start || "09:00"}–{e.work_end || "18:00"}
                    <span className="text-xs text-gray-400">
                      {" "}
                      · {e.work_hours_per_day ?? 8} soat
                    </span>
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Tahrirlash
                          </Button>
                        )}
                        {canDelete && e.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => onDelete(e)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            O'chirish
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        {/* overflow-hidden QO'YILMAYDI — dialog asosidagi overflow-y-auto
            ishlashi kerak, aks holda pastdagi Rol bo'limi kichik ekranlarda
            ko'rinmay qoladi (scroll bo'lmaydi) */}
        <DialogContent className="gap-0 p-0 sm:max-w-[580px]">
          {/* Sarlavha — ikonka kartochkasi bilan, scrollda tepada qoladi */}
          <div className="sticky top-0 z-10 flex items-center gap-3 rounded-t-lg border-b bg-white px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
              {editing ? (
                <Pencil className="h-4 w-4 text-white" />
              ) : (
                <Plus className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {editing ? "Xodimni tahrirlash" : "Yangi xodim"}
              </DialogTitle>
              <p className="mt-0.5 text-xs text-gray-500">
                {editing
                  ? `${editing.first_name} ${editing.last_name} · @${editing.username}`
                  : "Ma'lumotlarni to'ldiring — surat va rol ixtiyoriy"}
              </p>
            </div>
          </div>

          <div className="space-y-6 px-5 py-5">
            {/* Surat — bosib tanlanadi, ustiga borganda kamera chiqadi */}
            <div className="flex flex-col items-center gap-1.5">
              <label className="group/photo relative block cursor-pointer" title="Surat tanlash">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Surat"
                    className="h-24 w-24 rounded-full border-2 border-primary-100 object-cover shadow-sm"
                  />
                ) : editing && photosMap[editing.id] ? (
                  <img
                    src={photosMap[editing.id]}
                    alt="Joriy surat"
                    className="h-24 w-24 rounded-full border-2 border-primary-100 object-cover shadow-sm"
                  />
                ) : (
                  <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-gray-300">
                    <UserRound className="h-10 w-10" />
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/photo:opacity-100">
                  <Camera className="h-6 w-6 text-white" />
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow ring-2 ring-white">
                  <Camera className="h-3.5 w-3.5" />
                </span>
                <input
                  type="file"
                  accept={EMPLOYEE_PHOTO_ACCEPT}
                  className="hidden"
                  onChange={(ev) => {
                    handlePhoto(ev.target.files?.[0] ?? null)
                    ev.target.value = ""
                  }}
                />
              </label>
              {photoPreview ? (
                <button
                  type="button"
                  onClick={() => handlePhoto(null)}
                  className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                  Suratni olib tashlash
                </button>
              ) : (
                <p className="text-xs text-gray-400">
                  Surat qo'shish uchun bosing (ixtiyoriy)
                </p>
              )}
            </div>

            <FormSection icon={UserRound} title="Shaxsiy ma'lumotlar">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Ism *</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Familiya *</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Telefon</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </FormSection>

            {/* Kirish hisobi: yaratishda hammaga, tahrirlashda faqat adminga */}
            {(!editing || isAdmin) && (
              <FormSection icon={KeyRound} title="Kirish hisobi">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      Login {!editing && "*"}
                    </label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Kamida 3 belgi"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      {editing ? "Yangi parol" : "Parol *"}
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        editing ? "O'zgartirmaslik uchun bo'sh qoldiring" : "Kamida 6 belgi"
                      }
                    />
                  </div>
                </div>
                {editing && (
                  <p className="text-xs text-gray-400">
                    Login yoki parol o'zgartirilsa, xodim keyingi kirishda yangi
                    ma'lumotlardan foydalanadi.
                  </p>
                )}
              </FormSection>
            )}

            <FormSection icon={Building2} title="Ish joyi">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Filial *</label>
                  <select
                    className={selectClass}
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                  >
                    <option value="">Filialni tanlang</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                {editing ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Holat</label>
                    <select
                      className={selectClass}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      Ishga olish sanasi
                    </label>
                    <Input
                      type="date"
                      value={hireDate}
                      onChange={(e) => setHireDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </FormSection>
            {/* Boshlanish vaqti + kunlik soat kiritiladi, tugashi avto hisoblanadi */}
            <FormSection icon={Clock} title="Ish vaqti">
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      Boshlanishi
                    </label>
                    <Input
                      type="time"
                      className="bg-white"
                      value={workStart}
                      onChange={(e) => applyWorkStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      Kuniga (soat)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      className="bg-white"
                      value={workHours}
                      onChange={(e) => applyWorkHours(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      Tugashi (avto)
                    </label>
                    <Input
                      type="time"
                      value={workEnd}
                      readOnly
                      tabIndex={-1}
                      className="pointer-events-none bg-gray-100 text-gray-500"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Boshlanish vaqti va kunlik soatni kiriting — tugash vaqti
                  avtomatik hisoblanadi.
                </p>
              </div>
            </FormSection>
            {/* Rol — yaratishda biriktiriladi, tahrirlashda almashtiriladi.
                Menejer faqat Farrosh va Texnik xizmatni tanlay oladi,
                admin barcha rollarni (backend ham xuddi shuni tekshiradi) */}
            {!editing ? (
              <FormSection icon={ShieldCheck} title={`Rol${!isAdmin ? " *" : ""}`}>
                <select
                  className={selectClass}
                  value={roleTemplateId}
                  onChange={(e) => setRoleTemplateId(e.target.value)}
                >
                  {isAdmin && <option value="">Rolsiz (keyin belgilanadi)</option>}
                  {roleOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">
                  Tanlangan rolga mos ruxsatlar xodimga avtomatik biriktiriladi.
                </p>
              </FormSection>
            ) : (
              editing.user_type !== "ADMIN" && (
                <FormSection icon={ShieldCheck} title="Rol">
                  <select
                    className={selectClass}
                    value={roleTemplateId}
                    onChange={(e) => setRoleTemplateId(e.target.value)}
                  >
                    <option value="">
                      O'zgartirilmasin (joriy:{" "}
                      {editingRole?.name ||
                        ((editingPerms as any[]).length > 0
                          ? "maxsus to'plam"
                          : "rolsiz")}
                      )
                    </option>
                    {roleOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400">
                    Yangi rol tanlansa, xodim ruxsatlari shu rol shabloni bilan
                    TO'LIQ almashtiriladi.
                    {!isAdmin &&
                      " Menejer faqat Farrosh va Texnik xizmat rollarini biriktira oladi."}
                  </p>
                </FormSection>
              )
            )}

            {errorMsg && (
              <div className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Futer — scrollda pastda qoladi */}
          <div className="sticky bottom-0 z-10 flex justify-end gap-2 rounded-b-lg border-t bg-white px-5 py-3.5">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={onSubmit} disabled={saving} className="min-w-[120px]">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
