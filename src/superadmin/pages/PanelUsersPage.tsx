import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import {
  useCreatePanelUser,
  useDeletePanelUser,
  usePanelUsers,
  useResetPanelUserPassword,
  useSetPanelUserActive,
  type PanelUser,
} from "../api/panel"
import {
  PanelButton,
  PanelDialog,
  PanelHeading,
  PanelInput,
  PanelNotice,
} from "../components/ui"

/**
 * Panelga kira oladigan odamlar.
 *
 * Qo'shish, to'xtatish va o'chirish — faqat tizim egasi qo'lida.
 * Boshqalar ro'yxatni ko'radi, lekin o'zgartira olmaydi: panel butun
 * tizim ustidan nazorat beradi va kimga ruxsat berishni egasi hal
 * qiladi.
 */
export function PanelUsersPage() {
  const { isRoot } = useOutletContext<{ isRoot: boolean }>()
  const { data: users = [], isLoading } = usePanelUsers()
  const create = useCreatePanelUser()
  const setActive = useSetPanelUserActive()
  const resetPassword = useResetPanelUserPassword()
  const remove = useDeletePanelUser()

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ email: "", password: "", label: "" })
  const [target, setTarget] = useState<PanelUser | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 4000)
  }

  const submitNew = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await create.mutateAsync(form)
      setAdding(false)
      setForm({ email: "", password: "", label: "" })
      flash("Qo'shildi — endi shu pochta va parol bilan kira oladi")
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
      setTarget(null)
      setPassword("")
      flash("Parol almashtirildi")
    } catch (e) {
      setError(panelError(e))
    }
  }

  const toggle = async (user: PanelUser) => {
    setError(null)
    try {
      await setActive.mutateAsync({ id: user.id, is_active: !user.is_active })
    } catch (e) {
      setError(panelError(e))
    }
  }

  const drop = async (user: PanelUser) => {
    if (!confirm(`${user.email} panel ro'yxatidan o'chiriladi. Davom etasizmi?`))
      return
    setError(null)
    try {
      await remove.mutateAsync(user.id)
      flash("O'chirildi")
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <div>
      <PanelHeading
        title="Panel foydalanuvchilari"
        subtitle="Boshqaruv paneliga kira oladigan odamlar"
        action={
          isRoot ? (
            <PanelButton onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              Qo'shish
            </PanelButton>
          ) : undefined
        }
      />

      {error && <PanelNotice>{error}</PanelNotice>}
      {notice && <PanelNotice tone="success">{notice}</PanelNotice>}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Kim</th>
                <th className="px-3 py-2 font-medium">Pochta</th>
                <th className="px-3 py-2 font-medium">Oxirgi kirish</th>
                <th className="px-3 py-2 font-medium">Holat</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 text-slate-200">
                      {user.is_root && (
                        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                      )}
                      {user.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {/* Egasining pochtasi ochiq saqlanmaydi */}
                    {user.email || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {user.last_login_at
                      ? `${user.last_login_at.slice(0, 10)} ${user.last_login_at.slice(11, 16)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        user.is_active
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      )}
                    >
                      {user.is_active ? "Faol" : "To'xtatilgan"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {isRoot && !user.is_root && (
                      <div className="flex justify-end gap-1.5">
                        <PanelButton
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setTarget(user)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Parol
                        </PanelButton>
                        <PanelButton
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => toggle(user)}
                        >
                          {user.is_active ? "To'xtatish" : "Faollashtirish"}
                        </PanelButton>
                        <PanelButton
                          variant="danger"
                          className="h-7 px-2 text-xs"
                          onClick={() => drop(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </PanelButton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PanelDialog
        open={adding}
        title="Panelga odam qo'shish"
        onClose={() => setAdding(false)}
      >
        <form onSubmit={submitNew} className="space-y-3">
          <PanelInput
            label="Pochta"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <PanelInput
            label="Parol"
            type="text"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            minLength={8}
            required
          />
          <PanelInput
            label="Nomi (ixtiyoriy)"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
          <p className="text-[11px] text-slate-500">
            Parolni odamga o'zingiz yetkazasiz. U shu pochta va parol bilan
            kiradi.
          </p>
          {error && <PanelNotice>{error}</PanelNotice>}
          <div className="flex justify-end gap-2">
            <PanelButton
              type="button"
              variant="ghost"
              onClick={() => setAdding(false)}
            >
              Bekor qilish
            </PanelButton>
            <PanelButton type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Qo'shish
            </PanelButton>
          </div>
        </form>
      </PanelDialog>

      <PanelDialog
        open={!!target}
        title={`${target?.email || ""} — yangi parol`}
        onClose={() => setTarget(null)}
      >
        <form onSubmit={submitPassword} className="space-y-3">
          <PanelInput
            label="Yangi parol"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
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
