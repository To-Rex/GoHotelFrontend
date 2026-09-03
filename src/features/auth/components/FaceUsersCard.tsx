import { useCallback, useEffect, useState } from "react"
import { Loader2, ScanFace, ShieldOff, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  deleteUserFaceProfiles,
  getFaceUsers,
  type FaceUser,
} from "@/features/auth/api/face"

/**
 * Xodimlarning yuz holati va uni bekor qilish — menejer/administrator uchun.
 *
 * Nega kerak: yuz tanilmay qolsa (soqol, ko'zoynak, jarohat yoki shunchaki
 * sifatsiz kadr) xodim tizimga umuman kira olmaydi. Kirish uchun yuz kerak,
 * yuzni almashtirish uchun esa kirish kerak — bu yopiq halqa. Uni faqat
 * tashqaridan uzish mumkin.
 *
 * O'chirilgandan keyin xodim parol bilan kiradi va tizim undan darhol yangi
 * yuz biriktirishni so'raydi.
 */

export function FaceUsersCard() {
  const [users, setUsers] = useState<FaceUser[] | null>(null)
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await getFaceUsers())
      setError(null)
    } catch (e) {
      setError(apiErrorMessage(e))
      setUsers([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reset = async (u: FaceUser) => {
    if (
      !confirm(
        `${u.name} ning yuzi o'chiriladi. U parol bilan kiradi va tizim undan yangi yuz biriktirishni so'raydi. Davom etasizmi?`
      )
    )
      return
    setBusyId(u.user_id)
    setError(null)
    try {
      await deleteUserFaceProfiles(u.user_id)
      setNotice(`${u.name} — yuz o'chirildi`)
      window.setTimeout(() => setNotice(null), 3000)
      await load()
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const q = search.trim().toLowerCase()
  const shown = (users || []).filter(
    (u) =>
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
  )

  if (users === null) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Yuklanmoqda...
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </p>
      )}

      {users.length > 5 && (
        <Input
          className="h-9"
          placeholder="Xodim ismi yoki logini..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      <ul className="space-y-1.5">
        {shown.map((u) => (
          <li
            key={u.user_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium leading-tight text-gray-900">
                {u.name}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    u.enrolled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {u.enrolled ? `Yuz bor (${u.face_count})` : "Yuz yo'q"}
                </span>
              </p>
              <p className="text-[11px] leading-tight text-gray-400">
                {u.username}
              </p>
            </div>

            {u.enrolled ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-red-600 hover:bg-red-50"
                disabled={busyId === u.user_id}
                onClick={() => reset(u)}
              >
                {busyId === u.user_id ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                )}
                Yuzni o'chirish
              </Button>
            ) : (
              /* Yuzi yo'q xodimdan tizim keyingi kirishida o'zi so'raydi —
                 bu yerda qiladigan ish yo'q */
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <ScanFace className="h-3.5 w-3.5" />
                Kirganda so'raladi
              </span>
            )}
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <ShieldOff className="h-4 w-4" />
          {q ? "Xodim topilmadi" : "Xodimlar ro'yxati bo'sh"}
        </p>
      )}
    </div>
  )
}
