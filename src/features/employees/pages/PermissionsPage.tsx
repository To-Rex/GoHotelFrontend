import { useState, useMemo, useEffect } from "react"
import { ShieldCheck, Loader2, CheckCircle2 } from "lucide-react"
import {
  useEmployees,
  usePermissionsList,
  useUserPermissions,
  useSetUserPermissions,
} from "../api/employees"
import type { Permission } from "@/types/api"
import {
  PERMISSION_TEMPLATES,
  templatePermissionIds,
  findMatchingTemplate,
} from "../permissionTemplates"
import { usePermissions } from "@/lib/permissions"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const selectClass =
  "w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

// Modul nomlarini o'zbekchaga o'girish (backend `module` maydoni)
export const MODULE_LABELS: Record<string, string> = {
  reservation: "Bronlar",
  guest: "Mehmonlar",
  room: "Xonalar",
  housekeeping: "Xo'jalik ishlari",
  finance: "Moliya",
  report: "Hisobotlar",
  employee: "Xodimlar",
  service: "Xizmatlar",
  hotel: "Mehmonxona",
  branch: "Filiallar",
  floor: "Qavatlar",
  audit: "Audit",
  file: "Fayllar",
  expense: "Xarajatlar",
}

// Menejer (EMPLOYEE, permission.assign ruxsati bilan) faqat shu shablon
// doirasidagi ruxsatlarni bera oladi — backend ham xuddi shuni tekshiradi
const HOUSEKEEPER_TEMPLATE = PERMISSION_TEMPLATES.find((t) => t.id === "housekeeper")

// --- Ruxsat kodlarining O'ZBEKCHA nomlari ---
// Ma'lum kodlar uchun tabiiy ibora; ro'yxatda yo'qlari uchun kod bo'laklaridan
// avtomatik yasaladi (pastdagi uzPermissionLabel)
export const UZ_PERMISSION_LABELS: Record<string, string> = {
  "reservation.create": "Bron yaratish",
  "reservation.update": "Bronni tahrirlash",
  "reservation.view": "Bronlarni ko'rish",
  "reservation.cancel": "Bronni bekor qilish",
  "reservation.delete": "Bronni o'chirish",
  "guest.create": "Mehmon qo'shish",
  "guest.update": "Mehmonni tahrirlash",
  "guest.view": "Mehmonlarni ko'rish",
  "guest.delete": "Mehmonni o'chirish",
  "guest.checkin": "Mehmonni kirish qilish",
  "guest.checkout": "Mehmonni chiqarish",
  "room.view": "Xonalarni ko'rish",
  "room.create": "Xona qo'shish",
  "room.update": "Xonani tahrirlash",
  "room.delete": "Xonani o'chirish",
  "room.manage": "Xonalarni to'liq boshqarish",
  "room.status.update": "Xona holatini o'zgartirish",
  "room_type.create": "Xona turi qo'shish",
  "room_type.update": "Xona turini tahrirlash",
  "room_type.delete": "Xona turini o'chirish",
  "floor.create": "Qavat qo'shish",
  "floor.update": "Qavatni tahrirlash",
  "floor.delete": "Qavatni o'chirish",
  "housekeeping.task.create": "Vazifa yaratish",
  "housekeeping.task.update": "Vazifani yangilash",
  "housekeeping.task.assign": "Vazifaga mas'ul biriktirish",
  "housekeeping.task.view": "Vazifalarni ko'rish",
  "housekeeping.cleaning.start": "Tozalashni boshlash",
  "housekeeping.cleaning.complete": "Tozalashni yakunlash",
  "finance.view": "Moliyani ko'rish",
  "finance.invoice.create": "Hisob-faktura yaratish",
  "finance.invoice.view": "Hisob-fakturalarni ko'rish",
  "finance.payment.create": "To'lov qabul qilish",
  "finance.payment.view": "To'lovlarni ko'rish",
  "report.view": "Hisobotlarni ko'rish",
  "report.generate": "Hisobot shakllantirish",
  "employee.view": "Xodimlarni ko'rish",
  "employee.create": "Xodim qo'shish",
  "employee.update": "Xodimni tahrirlash",
  "employee.delete": "Xodimni o'chirish",
  "employee.manage": "Xodimlarni to'liq boshqarish",
  "permission.view": "Ruxsatlarni ko'rish",
  "permission.assign": "Ruxsat biriktirish",
  "service.view": "Xizmatlarni ko'rish",
  "service.create": "Xizmat qo'shish",
  "service.update": "Xizmatni tahrirlash",
  "service.delete": "Xizmatni o'chirish",
  "service.manage": "Xizmatlarni to'liq boshqarish",
  "hotel_service.manage": "Mehmonxona xizmatlarini boshqarish",
  "expense.view": "Xarajatlarni ko'rish",
  "expense.create": "Xarajat kiritish",
  "expense.delete": "Xarajatni o'chirish",
  "file.upload": "Fayl yuklash",
  "file.delete": "Faylni o'chirish",
  "file.view": "Fayllarni ko'rish",
  "audit.view": "Audit loglarini ko'rish",
  "hotel.view": "Mehmonxonani ko'rish",
  "hotel.update": "Mehmonxonani tahrirlash",
  "branch.view": "Filiallarni ko'rish",
  "branch.update": "Filialni tahrirlash",
}

// Lug'atda bo'lmagan kodlar uchun avtomatik o'zbekcha nom yasash
const UZ_ACTIONS: Record<string, string> = {
  view: "ko'rish",
  create: "yaratish",
  update: "tahrirlash",
  delete: "o'chirish",
  manage: "boshqarish",
  assign: "biriktirish",
  cancel: "bekor qilish",
  upload: "yuklash",
  download: "yuklab olish",
  start: "boshlash",
  complete: "yakunlash",
  generate: "shakllantirish",
  export: "eksport qilish",
}
const UZ_SUBJECTS: Record<string, string> = {
  reservation: "Bron",
  guest: "Mehmon",
  room: "Xona",
  room_type: "Xona turi",
  floor: "Qavat",
  housekeeping: "Xo'jalik",
  task: "vazifa",
  cleaning: "tozalash",
  finance: "Moliya",
  invoice: "hisob-faktura",
  payment: "to'lov",
  report: "Hisobot",
  employee: "Xodim",
  permission: "Ruxsat",
  service: "Xizmat",
  hotel: "Mehmonxona",
  hotel_service: "Mehmonxona xizmati",
  branch: "Filial",
  audit: "Audit",
  file: "Fayl",
  expense: "Xarajat",
  status: "holat",
  amenity: "Qulaylik",
}

export function uzPermissionLabel(code: string, fallback: string): string {
  if (UZ_PERMISSION_LABELS[code]) return UZ_PERMISSION_LABELS[code]
  const parts = code.split(".")
  if (parts.length < 2) return fallback
  const action = UZ_ACTIONS[parts[parts.length - 1]]
  if (!action) return fallback
  const subject = parts
    .slice(0, -1)
    .map((s) => UZ_SUBJECTS[s] || s)
    .join(" ")
  return `${subject} — ${action}`
}

export const PermissionsPage = () => {
  const { can, isAdmin } = usePermissions()
  const canAssign = can("permission.assign")

  const { data: employees = [], isLoading: employeesLoading } = useEmployees()
  const { data: allPermissions = [], isLoading: permsLoading } = usePermissionsList()

  // Menejer o'zgartira oladigan ruxsatlar to'plami (Farrosh shabloni).
  // ADMIN/SUPER_ADMIN uchun cheklov yo'q — isAdmin bypass ishlatiladi.
  const allowedIdSet = useMemo(() => {
    if (!HOUSEKEEPER_TEMPLATE) return new Set<string>()
    return new Set(templatePermissionIds(HOUSEKEEPER_TEMPLATE, allPermissions))
  }, [allPermissions])

  const canEditPerm = (id: string) =>
    canAssign && (isAdmin || allowedIdSet.has(id))

  // Ruxsatlar faqat EMPLOYEE uchun ma'noga ega — ADMIN hamma narsaga ega
  const employeeUsers = useMemo(
    () => employees.filter((e) => e.user_type === "EMPLOYEE"),
    [employees]
  )

  const [selectedId, setSelectedId] = useState("")
  useEffect(() => {
    if (!selectedId && employeeUsers.length > 0) setSelectedId(employeeUsers[0].id)
  }, [employeeUsers, selectedId])

  const selectedEmployee = employeeUsers.find((e) => e.id === selectedId) || null

  const { data: userPerms = [], isFetching: userPermsLoading } =
    useUserPermissions(selectedId || undefined)
  const setPermsMutation = useSetUserPermissions()

  const assignedIds = useMemo(() => userPerms.map((p) => p.id), [userPerms])

  // Qoralama: foydalanuvchi o'zgartirmaguncha null — server holati ko'rsatiladi
  const [draft, setDraft] = useState<string[] | null>(null)
  const selected = draft ?? assignedIds

  // Boshqa xodim tanlanganda qoralama tozalanadi
  useEffect(() => {
    setDraft(null)
    setSuccessMsg(null)
  }, [selectedId])

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modul bo'yicha guruhlash
  const grouped = useMemo(() => {
    const map: Record<string, Permission[]> = {}
    for (const p of allPermissions) {
      const key = p.module || "boshqa"
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [allPermissions])

  const toggle = (id: string) => {
    if (!canEditPerm(id)) return
    setSuccessMsg(null)
    setDraft((prev) => {
      const cur = prev ?? assignedIds
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    })
  }

  const toggleModule = (perms: Permission[]) => {
    if (!canAssign) return
    // Menejer uchun faqat ruxsat etilgan (Farrosh) kodlari almashtiriladi
    const editable = perms.filter((p) => isAdmin || allowedIdSet.has(p.id))
    if (editable.length === 0) return
    setSuccessMsg(null)
    setDraft((prev) => {
      const cur = prev ?? assignedIds
      const ids = editable.map((p) => p.id)
      const allSelected = ids.every((id) => cur.includes(id))
      if (allSelected) return cur.filter((id) => !ids.includes(id))
      return [...new Set([...cur, ...ids])]
    })
  }

  const selectAll = () => {
    if (!canAssign) return
    setSuccessMsg(null)
    setDraft(allPermissions.map((p) => p.id))
  }

  // --- Rol shablonlari ---
  // Bazada mavjud kodlarga mos kelmaydigan (bo'sh) shablonlar yashiriladi.
  // Menejer (admin emas) uchun faqat "Farrosh" shabloni ko'rsatiladi.
  const visibleTemplates = useMemo(
    () =>
      PERMISSION_TEMPLATES.filter((t) => isAdmin || t.id === "housekeeper")
        .map((t) => ({
          template: t,
          ids: templatePermissionIds(t, allPermissions),
        }))
        .filter((x) => x.ids.length > 0),
    [allPermissions, isAdmin]
  )

  // Tanlangan to'plam aynan qaysi shablonga mos kelishini aniqlaymiz
  const activeTemplate = useMemo(
    () => findMatchingTemplate(selected, allPermissions),
    [selected, allPermissions]
  )

  const applyTemplate = (ids: string[]) => {
    if (!canAssign) return
    setSuccessMsg(null)
    if (isAdmin) {
      setDraft(ids)
    } else {
      // Menejer shablonni qo'llaganda Farrosh to'plamidan tashqaridagi
      // mavjud ruxsatlar saqlanadi — ularni faqat administrator boshqaradi
      setDraft((prev) => {
        const cur = prev ?? assignedIds
        return [
          ...cur.filter((id) => !allowedIdSet.has(id)),
          ...ids.filter((id) => allowedIdSet.has(id)),
        ]
      })
    }
  }

  const clearAll = () => {
    if (!canAssign) return
    setSuccessMsg(null)
    setDraft([])
  }

  const hasChanges =
    draft !== null &&
    (draft.length !== assignedIds.length ||
      draft.some((id) => !assignedIds.includes(id)))

  const onSave = async () => {
    if (!selectedId || draft === null) return
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await setPermsMutation.mutateAsync({
        userId: selectedId,
        permissionIds: draft,
        currentIds: assignedIds,
      })
      setDraft(null)
      setSuccessMsg("Ruxsatlar saqlandi. Xodim qayta kirganda kuchga kiradi.")
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
    }
  }

  if (employeesLoading || permsLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Ruxsatnomalar</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Ruxsatnomalar</h1>
            <p className="text-sm text-gray-500">
              Xodimlarga tizim bo'limlari bo'yicha ruxsatlar berish
            </p>
          </div>
        </div>
        {canAssign && selectedEmployee && (
          <Button onClick={onSave} disabled={!hasChanges || setPermsMutation.isPending}>
            {setPermsMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Saqlash
          </Button>
        )}
      </div>

      {employeeUsers.length === 0 ? (
        <div className="rounded-md border py-12 text-center text-sm text-gray-400">
          Xodimlar topilmadi. Avval "Xodimlar" bo'limida xodim qo'shing.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="max-w-sm flex-1 min-w-[220px] space-y-1">
              <label className="text-sm font-medium">Xodim</label>
              <select
                className={selectClass}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {employeeUsers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} (@{e.username})
                  </option>
                ))}
              </select>
            </div>
            {canAssign && isAdmin && (
              <div className="flex gap-2 pb-0.5">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Hammasini tanlash
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Tozalash
                </Button>
              </div>
            )}
            <div className="pb-1.5 text-sm text-gray-500">
              Tanlangan: <span className="font-semibold">{selected.length}</span> /{" "}
              {allPermissions.length}
              {selected.length > 0 && (
                <span
                  className={cn(
                    "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    activeTemplate
                      ? "bg-primary-50 text-primary-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {activeTemplate ? activeTemplate.name : "Maxsus tanlov"}
                </span>
              )}
            </div>
          </div>

          {/* Menejer uchun cheklov haqida eslatma */}
          {canAssign && !isAdmin && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
              Siz menejer sifatida faqat «Farrosh» roli doirasidagi ruxsatlarni
              bera olasiz yoki olib tashlay olasiz. Boshqa ruxsatlarni faqat
              administrator boshqaradi.
            </div>
          )}

          {/* Rol shablonlari — bir bosishda tayyor ruxsatlar to'plami */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Rol shablonlari</p>
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
              {visibleTemplates.map(({ template, ids }) => {
                const Icon = template.icon
                const isActive = activeTemplate?.id === template.id
                return (
                  <button
                    key={template.id}
                    type="button"
                    disabled={!canAssign}
                    onClick={() => applyTemplate(ids)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                      isActive
                        ? "border-primary-500 ring-2 ring-primary-500/30 bg-primary-50/40"
                        : "border-gray-200 hover:border-primary-300 hover:bg-gray-50",
                      !canAssign && "cursor-default opacity-70"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                        template.accent
                      )}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">
                        {template.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 leading-snug">
                        {template.description}
                      </span>
                      <span className="mt-1 block text-[11px] text-gray-400">
                        {ids.length} ta ruxsat
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600 whitespace-pre-line">
              {errorMsg}
            </div>
          )}

          {/* Batafsil ruxsatlar ro'yxati faqat administratorga ko'rsatiladi —
              menejer uchun shablon kartasining o'zi yetarli */}
          {isAdmin &&
            (userPermsLoading && draft === null ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
              {grouped.map(([module, perms]) => {
                const selectedCount = perms.filter((p) =>
                  selected.includes(p.id)
                ).length
                // Menejer o'zgartira oladigan ruxsatlar (modul ichida)
                const editablePerms = perms.filter(
                  (p) => isAdmin || allowedIdSet.has(p.id)
                )
                return (
                  <div key={module} className="rounded-2xl border bg-white overflow-hidden">
                    <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary-600" />
                        <span className="text-sm font-semibold">
                          {MODULE_LABELS[module] || module}
                        </span>
                        <span className="text-xs text-gray-400">
                          {selectedCount}/{perms.length}
                        </span>
                      </div>
                      {canAssign && editablePerms.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleModule(perms)}
                          className="text-xs font-medium text-primary-700 hover:text-primary-800"
                        >
                          {editablePerms.every((p) => selected.includes(p.id))
                            ? "Bekor qilish"
                            : "Hammasi"}
                        </button>
                      )}
                    </div>
                    <div className="p-3 space-y-1.5">
                      {perms.map((p) => {
                        const editable = canEditPerm(p.id)
                        return (
                          <label
                            key={p.id}
                            title={
                              canAssign && !editable
                                ? "Bu ruxsatni faqat administrator o'zgartira oladi"
                                : undefined
                            }
                            className={cn(
                              "flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm",
                              editable
                                ? "cursor-pointer hover:bg-gray-50"
                                : "cursor-default",
                              canAssign && !editable && "opacity-60"
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              checked={selected.includes(p.id)}
                              onChange={() => toggle(p.id)}
                              disabled={!editable}
                            />
                            <span className="min-w-0">
                              {/* Ruxsat nomi — o'zbekcha (inglizchasi title'da) */}
                              <span className="block leading-tight" title={p.name}>
                                {uzPermissionLabel(p.code, p.name)}
                              </span>
                              <span className="block text-[11px] text-gray-400 font-mono leading-tight">
                                {p.code}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
