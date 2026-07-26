import { useState, useMemo } from "react"
import { UserCog, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from "../api/employees"
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
  const { can } = usePermissions()
  const canCreate = can("employee.create")
  const canEdit = can("employee.update")
  const canDelete = can("employee.delete")
  const user = useAuthStore((s) => s.user)

  const { data: employees = [], isLoading } = useEmployees()
  const { data: branches = [] } = useBranches()

  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee()
  const deleteMutation = useDeleteEmployee()

  const branchMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const b of branches) m[b.id] = b.name
    return m
  }, [branches])

  const [search, setSearch] = useState("")
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
        await createMutation.mutateAsync({
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

  const saving = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Xodimlar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Xodimlar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mehmonxona xodimlarini boshqarish
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Xodim qo'shish
          </Button>
        )}
      </div>

      <div className="max-w-xs">
        <Input
          placeholder="Qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
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
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                        <UserCog className="h-4 w-4" />
                      </span>
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
