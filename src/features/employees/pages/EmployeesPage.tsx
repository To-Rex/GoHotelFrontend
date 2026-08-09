import { useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  X,
  Search,
  LayoutGrid,
  List,
  Phone,
  Building2,
  CalendarDays,
} from "lucide-react"
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  usePermissionsList,
  useSetUserPermissions,
  uploadEmployeePhoto,
  useEmployeePhotos,
  EMPLOYEE_PHOTO_ACCEPT,
  EMPLOYEE_PHOTO_MAX_BYTES,
} from "../api/employees"
import { PERMISSION_TEMPLATES, templatePermissionIds } from "../permissionTemplates"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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

  // Yangi xodimga beriladigan rol shablonlari: menejer (admin emas) faqat
  // "Farrosh" rolini bera oladi — backend ham xuddi shuni tekshiradi;
  // ADMIN/SUPER_ADMIN istalgan rolni tanlashi mumkin.
  const roleOptions = useMemo(
    () => PERMISSION_TEMPLATES.filter((t) => isAdmin || t.id === "housekeeper"),
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
  // Yangi xodimga biriktiriladigan rol shabloni (bo'sh — rolsiz)
  const [roleTemplateId, setRoleTemplateId] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
    handlePhoto(null)
    setErrorMsg(null)
    setModalOpen(true)
  }

  const onSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg("Ism va familiyani kiriting")
      return
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          branch_id: branchId || undefined,
          status,
        })
        // Yangi surat tanlangan bo'lsa — yuklaymiz (xato saqlashni buzmaydi)
        const photoErr = await uploadPhotoFor(editing.id)
        if (photoErr) {
          setModalOpen(false)
          alert("Ma'lumotlar saqlandi, lekin surat yuklanmadi:\n" + photoErr)
          return
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
      {viewMode === "grid" &&
        (filtered.length === 0 ? (
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
        ))}

      {viewMode === "table" && (
      <div className="rounded-2xl border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>F.I.Sh</TableHead>
              <TableHead>Roli</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Ishga olingan</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="text-right">Amallar</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-gray-400">
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
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Xodimni tahrirlash" : "Yangi xodim"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Ism *</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Familiya *</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            {!editing && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Login *</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Kamida 3 belgi"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Parol *</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kamida 6 belgi"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Filial *</label>
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
                  <label className="text-sm font-medium">Holat</label>
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
                  <label className="text-sm font-medium">Ishga olish sanasi</label>
                  <Input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                  />
                </div>
              )}
            </div>
            {/* Rol — faqat yangi xodim qo'shishda; menejer faqat Farroshni
                tanlay oladi, admin barcha rollarni */}
            {!editing && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Rol {!isAdmin && "*"}</label>
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
              </div>
            )}
            {/* Xodim surati (ixtiyoriy) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Xodim surati (ixtiyoriy)</label>
              <div className="flex items-center gap-3">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Surat"
                    className="h-14 w-14 rounded-full border border-gray-200 object-cover"
                  />
                ) : editing && photosMap[editing.id] ? (
                  <img
                    src={photosMap[editing.id]}
                    alt="Joriy surat"
                    className="h-14 w-14 rounded-full border border-gray-200 object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-500">
                    <UserCog className="h-6 w-6" />
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
                    <Upload className="h-3.5 w-3.5" />
                    {photoPreview ? "Almashtirish" : "Surat tanlash"}
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
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={() => handlePhoto(null)}
                      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                      Olib tashlash
                    </button>
                  )}
                </div>
              </div>
            </div>

            {errorMsg && (
              <p className="text-sm text-red-500 whitespace-pre-line">{errorMsg}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
