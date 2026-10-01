import { useState } from "react"
import { KeyRound, Loader2, Plus, SlidersHorizontal, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import {
  useConfigurators,
  useCreateConfigurator,
  useDeleteConfigurator,
  useResetStaffPassword,
  useSetConfiguratorStatus,
  type Configurator,
} from "../api/panel"
import {
  PanelButton,
  PanelDialog,
  PanelEmpty,
  PanelHeading,
  PanelInput,
  PanelNotice,
} from "../components/ui"
import { tr } from "@/i18n"

/**
 * Sozlovchilar — mehmonxonalarni talabiga ko'ra sozlab beradigan odamlar.
 *
 * Sozlovchi hech qaysi mehmonxonaga bog'lanmagan: asosiy tizimga (panelga
 * emas) login va parol bilan kiradi, istalgan mehmonxona va filialni
 * tanlaydi va o'sha mehmonxonada administrator kabi ishlaydi. Sozlamalar
 * sahifasi faqat unga (va tizim ma'muriga) ochiq.
 */
const EMPTY_FORM = { username: "", password: "", first_name: "", last_name: "", phone: "" }

export function ConfiguratorsPage() {
  const { data: people = [], isLoading } = useConfigurators()
  const create = useCreateConfigurator()
  const setStatus = useSetConfiguratorStatus()
  const resetPassword = useResetStaffPassword()
  const remove = useDeleteConfigurator()

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [target, setTarget] = useState<Configurator | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 4000)
  }

  const fullName = (p: Configurator) => `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.username

  const submitNew = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await create.mutateAsync({
        username: form.username.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
      })
      setAdding(false)
      setForm(EMPTY_FORM)
      flash(tr("Sozlovchi qo'shildi — u asosiy tizimga shu login va parol bilan kiradi"))
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
      flash(tr("Parol almashtirildi"))
    } catch (e) {
      setError(panelError(e))
    }
  }

  const toggle = async (person: Configurator) => {
    setError(null)
    try {
      await setStatus.mutateAsync({
        id: person.id,
        status: person.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      })
    } catch (e) {
      setError(panelError(e))
    }
  }

  const drop = async (person: Configurator) => {
    if (!confirm(tr("{{name}} sozlovchilar ro'yxatidan o'chiriladi. Davom etasizmi?", { name: fullName(person) })))
      return
    setError(null)
    try {
      await remove.mutateAsync(person.id)
      flash(tr("O'chirildi"))
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <div>
      <PanelHeading
        title={tr("Sozlovchilar")}
        subtitle={tr("Istalgan mehmonxona va filialga o'tib, uni talabiga ko'ra sozlab beradigan hisoblar")}
        action={
          <PanelButton onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            {tr("Qo'shish")}
          </PanelButton>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-violet-900/60 bg-violet-950/30 px-4 py-3 text-xs leading-relaxed text-violet-200/90">
        <SlidersHorizontal className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-300" />
        <p>
          {tr("Sozlovchi asosiy tizimga kiradi, mehmonxona va filialni tanlaydi va o'sha mehmonxonada administrator kabi ishlaydi. Sozlamalar sahifasi faqat sozlovchiga ochiq — mehmonxona administratori va xodimlar uni ko'rmaydi.")}
        </p>
      </div>

      {error && <PanelNotice>{error}</PanelNotice>}
      {notice && <PanelNotice tone="success">{notice}</PanelNotice>}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : people.length === 0 ? (
        <PanelEmpty>{tr("Hozircha sozlovchi yo'q")}</PanelEmpty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-900 text-left text-xs text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">{tr("Kim")}</th>
                <th className="px-3 py-2 font-medium">{tr("Login")}</th>
                <th className="px-3 py-2 font-medium">{tr("Telefon")}</th>
                <th className="px-3 py-2 font-medium">{tr("Oxirgi kirish")}</th>
                <th className="px-3 py-2 font-medium">{tr("Holat")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {people.map((person) => (
                <tr key={person.id}>
                  <td className="px-3 py-2 text-slate-200">{fullName(person)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{person.username}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {person.phone || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {person.last_login_at
                      ? `${person.last_login_at.slice(0, 10)} ${person.last_login_at.slice(11, 16)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        person.status === "ACTIVE"
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      )}
                    >
                      {person.status === "ACTIVE" ? tr("Faol") : tr("To'xtatilgan")}
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
                        {tr("Parol")}
                      </PanelButton>
                      <PanelButton
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => toggle(person)}
                      >
                        {person.status === "ACTIVE" ? tr("To'xtatish") : tr("Faollashtirish")}
                      </PanelButton>
                      <PanelButton
                        variant="danger"
                        className="h-7 px-2 text-xs"
                        onClick={() => drop(person)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </PanelButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PanelDialog open={adding} title={tr("Sozlovchi qo'shish")} onClose={() => setAdding(false)}>
        <form onSubmit={submitNew} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <PanelInput
              label={tr("Ism")}
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              required
            />
            <PanelInput
              label={tr("Familiya (ixtiyoriy)")}
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
          </div>
          <PanelInput
            label={tr("Login")}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            minLength={3}
            autoComplete="off"
            required
          />
          <PanelInput
            label={tr("Parol")}
            type="text"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            minLength={6}
            autoComplete="new-password"
            required
          />
          <PanelInput
            label={tr("Telefon (ixtiyoriy)")}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <p className="text-[11px] text-slate-500">
            {tr("Login va parolni odamga o'zingiz yetkazasiz. U asosiy tizimga (panelga emas) kiradi va mehmonxonani tanlaydi.")}
          </p>
          {error && <PanelNotice>{error}</PanelNotice>}
          <div className="flex justify-end gap-2">
            <PanelButton type="button" variant="ghost" onClick={() => setAdding(false)}>
              {tr("Bekor qilish")}
            </PanelButton>
            <PanelButton type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr("Qo'shish")}
            </PanelButton>
          </div>
        </form>
      </PanelDialog>

      <PanelDialog
        open={!!target}
        title={tr("{{v}} — yangi parol", { v: target ? fullName(target) : "" })}
        onClose={() => setTarget(null)}
      >
        <form onSubmit={submitPassword} className="space-y-3">
          <PanelInput
            label={tr("Yangi parol")}
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
          {error && <PanelNotice>{error}</PanelNotice>}
          <div className="flex justify-end gap-2">
            <PanelButton type="button" variant="ghost" onClick={() => setTarget(null)}>
              {tr("Bekor qilish")}
            </PanelButton>
            <PanelButton type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr("Almashtirish")}
            </PanelButton>
          </div>
        </form>
      </PanelDialog>
    </div>
  )
}
