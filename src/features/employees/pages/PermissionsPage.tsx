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
import { tr, trc } from "@/i18n"

const selectClass =
  "w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

// Modul nomlarini o'zbekchaga o'girish (backend `module` maydoni)
export const MODULE_LABELS: Record<string, string> = {
  reservation: tr("Bronlar"),
  guest: tr("Mehmonlar"),
  room: tr("Xonalar"),
  housekeeping: tr("Xo'jalik ishlari"),
  finance: tr("Moliya"),
  report: tr("Hisobotlar"),
  employee: tr("Xodimlar"),
  service: tr("Xizmatlar"),
  hotel: tr("Mehmonxona"),
  branch: tr("Filiallar"),
  floor: tr("Qavatlar"),
  audit: tr("Audit"),
  file: tr("Fayllar"),
  expense: tr("Xarajatlar"),
  feedback: tr("Talab, taklif va shikoyatlar"),
}

// Menejer (EMPLOYEE, permission.assign ruxsati bilan) faqat shu shablon
// doirasidagi ruxsatlarni bera oladi — backend ham xuddi shuni tekshiradi
const HOUSEKEEPER_TEMPLATE = PERMISSION_TEMPLATES.find((t) => t.id === "housekeeper")

// --- Ruxsat kodlarining O'ZBEKCHA nomlari ---
// Ma'lum kodlar uchun tabiiy ibora; ro'yxatda yo'qlari uchun kod bo'laklaridan
// avtomatik yasaladi (pastdagi uzPermissionLabel)
export const UZ_PERMISSION_LABELS: Record<string, string> = {
  // Talab, taklif va shikoyatlar — qabulxona/menejer bu kodlarsiz ham kiradi,
  // kodlar boshqa rollarga (masalan buxgalter) alohida berish uchun
  "feedback.view": tr("Murojaatlarni ko'rish"),
  "feedback.create": tr("Murojaat kiritish"),
  "feedback.manage": tr("Murojaatlarni boshqarish (javob, holat, o'chirish)"),
  "reservation.create": tr("Bron yaratish"),
  "reservation.update": tr("Bronni tahrirlash"),
  "reservation.view": tr("Bronlarni ko'rish"),
  "reservation.cancel": trc("perm", "Bronni bekor qilish"),
  "reservation.delete": tr("Bronni o'chirish"),
  "guest.create": trc("perm", "Mehmon qo'shish"),
  "guest.update": tr("Mehmonni tahrirlash"),
  "guest.view": tr("Mehmonlarni ko'rish"),
  "guest.delete": tr("Mehmonni o'chirish"),
  "guest.checkin": tr("Mehmonni kirish qilish"),
  "guest.checkout": tr("Mehmonni chiqarish"),
  "room.view": tr("Xonalarni ko'rish"),
  "room.create": trc("perm", "Xona qo'shish"),
  "room.update": tr("Xonani tahrirlash"),
  "room.delete": tr("Xonani o'chirish"),
  "room.manage": tr("Xonalarni to'liq boshqarish"),
  "room.status.update": tr("Xona holatini o'zgartirish"),
  "room_type.create": tr("Xona turi qo'shish"),
  "room_type.update": tr("Xona turini tahrirlash"),
  "room_type.delete": tr("Xona turini o'chirish"),
  "floor.create": trc("perm", "Qavat qo'shish"),
  "floor.update": tr("Qavatni tahrirlash"),
  "floor.delete": tr("Qavatni o'chirish"),
  "housekeeping.task.create": tr("Vazifa yaratish"),
  "housekeeping.task.update": tr("Vazifani yangilash"),
  "housekeeping.task.assign": tr("Vazifaga mas'ul biriktirish"),
  "housekeeping.task.view": tr("Vazifalarni ko'rish"),
  "housekeeping.cleaning.start": tr("Tozalashni boshlash"),
  "housekeeping.cleaning.complete": tr("Tozalashni yakunlash"),
  "finance.view": tr("Moliyani ko'rish"),
  "finance.invoice.create": tr("Hisob-faktura yaratish"),
  "finance.invoice.view": tr("Hisob-fakturalarni ko'rish"),
  "finance.payment.create": tr("To'lov qabul qilish"),
  "finance.payment.view": tr("To'lovlarni ko'rish"),
  "report.view": tr("Hisobotlarni ko'rish"),
  "report.generate": tr("Hisobot shakllantirish"),
  "employee.view": tr("Xodimlarni ko'rish"),
  "employee.create": trc("perm", "Xodim qo'shish"),
  "employee.update": tr("Xodimni tahrirlash"),
  "employee.delete": tr("Xodimni o'chirish"),
  "employee.manage": tr("Xodimlarni to'liq boshqarish"),
  "permission.view": tr("Ruxsatlarni ko'rish"),
  "permission.assign": tr("Ruxsat biriktirish"),
  "service.view": tr("Xizmatlarni ko'rish"),
  "service.create": tr("Xizmat qo'shish"),
  "service.update": tr("Xizmatni tahrirlash"),
  "service.delete": tr("Xizmatni o'chirish"),
  "service.manage": tr("Xizmatlarni to'liq boshqarish"),
  "hotel_service.manage": tr("Mehmonxona xizmatlarini boshqarish"),
  "expense.view": tr("Xarajatlarni ko'rish"),
  "expense.create": tr("Xarajat kiritish"),
  "expense.delete": tr("Xarajatni o'chirish"),
  "file.upload": tr("Fayl yuklash"),
  "file.delete": tr("Faylni o'chirish"),
  "file.view": tr("Fayllarni ko'rish"),
  "audit.view": tr("Audit loglarini ko'rish"),
  "hotel.view": tr("Mehmonxonani ko'rish"),
  "hotel.update": tr("Mehmonxonani tahrirlash"),
  "branch.view": tr("Filiallarni ko'rish"),
  "branch.update": tr("Filialni tahrirlash"),
}

// Lug'atda bo'lmagan kodlar uchun avtomatik o'zbekcha nom yasash
const UZ_ACTIONS: Record<string, string> = {
  view: tr("ko'rish"),
  create: tr("yaratish"),
  update: tr("tahrirlash"),
  delete: tr("o'chirish"),
  manage: tr("boshqarish"),
  assign: tr("biriktirish"),
  cancel: tr("bekor qilish"),
  upload: tr("yuklash"),
  download: tr("yuklab olish"),
  start: tr("boshlash"),
  complete: tr("yakunlash"),
  generate: tr("shakllantirish"),
  export: tr("eksport qilish"),
}
const UZ_SUBJECTS: Record<string, string> = {
  reservation: tr("Bron"),
  guest: tr("Mehmon"),
  room: tr("Xona"),
  room_type: tr("Xona turi"),
  floor: tr("Qavat"),
  housekeeping: tr("Xo'jalik"),
  task: tr("vazifa"),
  cleaning: tr("tozalash"),
  finance: tr("Moliya"),
  invoice: tr("hisob-faktura"),
  payment: tr("to'lov"),
  report: tr("Hisobot"),
  employee: tr("Xodim"),
  permission: tr("Ruxsat"),
  service: tr("Xizmat"),
  hotel: tr("Mehmonxona"),
  hotel_service: tr("Mehmonxona xizmati"),
  branch: tr("Filial"),
  audit: tr("Audit"),
  file: tr("Fayl"),
  expense: tr("Xarajat"),
  feedback: tr("Murojaat"),
  status: tr("holat"),
  amenity: tr("Qulaylik"),
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
      // Guruh kaliti xom qoladi (saralash tildan qat'i nazar bir xil);
      // ekranda tr(module) — "boshqa" lug'atga i18n:keys orqali kiradi
      const key = p.module || /* i18n:keys */ "boshqa"
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
      setSuccessMsg(tr("Ruxsatlar saqlandi. Xodim qayta kirganda kuchga kiradi."))
    } catch (e) {
      setErrorMsg(apiErrorMessage(e))
    }
  }

  if (employeesLoading || permsLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{tr("Ruxsatnomalar")}</h1>
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
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{tr("Ruxsatnomalar")}</h1>
            <p className="text-sm text-gray-500">
              {tr("Xodimlarga tizim bo'limlari bo'yicha ruxsatlar berish")}
            </p>
          </div>
        </div>
        {canAssign && selectedEmployee && (
          <Button onClick={onSave} disabled={!hasChanges || setPermsMutation.isPending}>
            {setPermsMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {tr("Saqlash")}
          </Button>
        )}
      </div>

      {employeeUsers.length === 0 ? (
        <div className="rounded-md border py-12 text-center text-sm text-gray-400">
          {tr("Xodimlar topilmadi. Avval \"Xodimlar\" bo'limida xodim qo'shing.")}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="max-w-sm flex-1 min-w-[220px] space-y-1">
              <label className="text-sm font-medium">{tr("Xodim")}</label>
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
                  {tr("Hammasini tanlash")}
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  {trc("clear", "Tozalash")}
                </Button>
              </div>
            )}
            <div className="pb-1.5 text-sm text-gray-500">
              {tr("Tanlangan:")}{" "}<span className="font-semibold">{selected.length}</span> /{" "}
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
                  {activeTemplate ? activeTemplate.name : tr("Maxsus tanlov")}
                </span>
              )}
            </div>
          </div>

          {/* Menejer uchun cheklov haqida eslatma */}
          {canAssign && !isAdmin && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
              {tr("Siz menejer sifatida faqat «Farrosh» roli doirasidagi ruxsatlarni bera olasiz yoki olib tashlay olasiz. Boshqa ruxsatlarni faqat administrator boshqaradi.")}
            </div>
          )}

          {/* Rol shablonlari — bir bosishda tayyor ruxsatlar to'plami */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">{tr("Rol shablonlari")}</p>
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
                        {tr("{{count}} ta ruxsat", { count: ids.length })}
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
                          {MODULE_LABELS[module] || tr(module)}
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
                            ? trc("clear", "Bekor qilish")
                            : tr("Hammasi")}
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
                                ? tr("Bu ruxsatni faqat administrator o'zgartira oladi")
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
