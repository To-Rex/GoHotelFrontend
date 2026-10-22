import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, ShieldCheck } from "lucide-react"

import { panelError } from "../api/client"
import { panelLogin } from "../api/panel"
import { PanelButton, PanelInput, PanelNotice } from "../components/ui"
import { tr, trc } from "@/i18n"

/**
 * Panel kirish sahifasi.
 *
 * Asosiy `/login` sahifasi ham shu yerga olib keladi: u xodim kirishi
 * muvaffaqiyatsiz bo'lganda panel kirishini sinab ko'radi. Bu sahifa
 * to'g'ridan-to'g'ri manzil bilan ochilganda ham ishlaydi.
 *
 * Ko'rinishi mehmonxona kirish sahifasidan ATAYLAB farq qiladi — qora
 * fon: xodim tasodifan bu yerga tushib qolsa, boshqa joyda ekanini
 * darhol tushunsin. Dizayn minimal: gradient yo'q, faqat tekis sirt.
 */
export function PanelLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await panelLogin(email, password)
      navigate("/panel", { replace: true })
    } catch (e) {
      setError(panelError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0b0d] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-400/15 bg-emerald-400/10">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">
              {tr("Boshqaruv paneli")}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {tr("Tizim egasi uchun — barcha mehmonxonalar ustidan nazorat")}
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-white/[0.07] bg-[#101216] p-6"
        >
          <PanelInput
            label={tr("Pochta")}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tr("pochta@example.com")}
            required
          />
          <PanelInput
            label={tr("Parol")}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <PanelNotice>{error}</PanelNotice>}

          <PanelButton type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {trc("login", "Kirish")}
          </PanelButton>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full text-center text-[11px] text-slate-600 transition-colors hover:text-slate-400"
          >
            {tr("Mehmonxona tizimiga qaytish")}
          </button>
        </form>
      </div>
    </div>
  )
}
