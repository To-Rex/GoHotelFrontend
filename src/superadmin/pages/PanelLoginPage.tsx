import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, Lock, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { panelError } from "../api/client"
import { panelLogin } from "../api/panel"

/**
 * Panel kirish sahifasi.
 *
 * Asosiy `/login` sahifasi ham shu yerga olib keladi: u xodim kirishi
 * muvaffaqiyatsiz bo'lganda panel kirishini sinab ko'radi. Bu sahifa
 * to'g'ridan-to'g'ri manzil bilan ochilganda ham ishlaydi.
 *
 * Ko'rinishi mehmonxona kirish sahifasidan ATAYLAB farq qiladi — qora
 * fon: xodim tasodifan bu yerga tushib qolsa, boshqa joyda ekanini
 * darhol tushunsin.
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl"
      >
        <div className="space-y-1 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </span>
          <h1 className="pt-2 text-lg font-bold text-slate-100">
            Boshqaruv paneli
          </h1>
          <p className="text-xs text-slate-400">
            Tizim egasi uchun — barcha mehmonxonalar ustidan nazorat
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Pochta</label>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
              placeholder="pochta@example.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Parol</label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-slate-700 bg-slate-950 text-slate-100"
              required
            />
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lock className="mr-2 h-4 w-4" />
          )}
          Kirish
        </Button>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
        >
          Mehmonxona tizimiga qaytish
        </button>
      </form>
    </div>
  )
}
