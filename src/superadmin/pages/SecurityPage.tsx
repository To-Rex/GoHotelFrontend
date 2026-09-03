import { useState } from "react"
import { KeyRound, Loader2, ShieldCheck } from "lucide-react"

import { panelError } from "../api/client"
import { useChangeOwnPassword } from "../api/panel"
import {
  PanelButton,
  PanelCard,
  PanelHeading,
  PanelInput,
  PanelNotice,
} from "../components/ui"

/**
 * O'z parolini almashtirish.
 *
 * Eski parolni bilish SHART: ochiq qolgan brauzerdan foydalanib
 * parolni almashtirib qo'yish mumkin bo'lmasligi kerak.
 */
export function SecurityPage() {
  const change = useChangeOwnPassword()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [repeat, setRepeat] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (next !== repeat) {
      setError("Yangi parollar bir xil emas")
      return
    }
    try {
      await change.mutateAsync({ current_password: current, new_password: next })
      setCurrent("")
      setNext("")
      setRepeat("")
      setNotice("Parol almashtirildi. Keyingi kirishda yangisini ishlating.")
    } catch (e) {
      setError(panelError(e))
    }
  }

  return (
    <div className="max-w-lg">
      <PanelHeading title="Xavfsizlik" subtitle="Kirish parolini boshqarish" />

      <PanelCard>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-2 pb-1">
            <KeyRound className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-200">
              Parolni almashtirish
            </span>
          </div>

          <PanelInput
            label="Joriy parol"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <PanelInput
            label="Yangi parol"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
          />
          <PanelInput
            label="Yangi parolni takrorlang"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            minLength={8}
            required
          />

          {error && <PanelNotice>{error}</PanelNotice>}
          {notice && <PanelNotice tone="success">{notice}</PanelNotice>}

          <PanelButton type="submit" disabled={change.isPending}>
            {change.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Saqlash
          </PanelButton>
        </form>
      </PanelCard>

      <PanelCard className="mt-3">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 flex-shrink-0 text-emerald-400" />
          <div className="space-y-1 text-xs leading-relaxed text-slate-400">
            <p className="font-medium text-slate-300">
              Kirish ma'lumoti qanday saqlanadi
            </p>
            <p>
              Tizim egasining pochtasi kodda ochiq matnda emas — faqat
              SHA-256 yig'indisi turadi, ya'ni uni kodni o'qib bilib
              bo'lmaydi. Parol bcrypt bilan hashlangan va undan asl parolni
              tiklab bo'lmaydi.
            </p>
            <p>
              Parolni shu yerda almashtirsangiz yangi hash bazaga yoziladi va
              koddagi boshlang'ich qiymat boshqa ishlatilmaydi.
            </p>
          </div>
        </div>
      </PanelCard>
    </div>
  )
}
