import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  LockOpen,
  ReceiptText,
  RotateCcw,
  X,
} from "lucide-react"

import { tr } from "@/i18n"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"

import { useFiscalConfig } from "../api/fiscal"
import { runFiscalQueue, useFiscalDevice, useFiscalStore } from "../lib/engine"
import {
  eposShift,
  eposStatus,
  fiscalActive,
  type EposStatus,
} from "../lib/epos"

/* Fiskal modul (E-POS) — kassadagi yordamchi.

   `FiscalAgent` (MainLayout'da bitta): fiskal modul shu qurilmada faol
   bo'lsa, fiskal navbatni fonda yuboradi — to'lov qayerdan olinganidan
   qat'i nazar (bron, chiqish, moliya, do'kon, mobil ilova, qaytarim).
   Yuborilmagan chek bo'lsa pastda ogohlantirish chiqadi.

   `FiscalNavButton` (navbarda): holat, fiskal smena (Z-hisobot) va navbat.
   Fiskal modul yoqilmagan filialda ikkalasi ham hech narsa ko'rsatmaydi. */

/** Pul harakati bo'lishi mumkin bo'lgan so'rovlar — keyin navbat darhol tekshiriladi. */
const MONEY_URL = /\/(payments?|pay|check-?out|cancel|refund|reservations|shop\/sales|invoices|move)/i

export function FiscalAgent() {
  const user = useAuthStore((s) => s.user)
  const { data: cfg } = useFiscalConfig(!!user)
  const device = useFiscalDevice((s) => s.device)
  const failed = useFiscalStore((s) => s.failed)
  const working = useFiscalStore((s) => s.working)
  const [dismissed, setDismissed] = useState<string | null>(null)
  // `device` o'qiladi: belgi o'zgarganda faollik qayta hisoblanadi
  const active = fiscalActive(cfg) && (cfg.transport === "server" || device)

  useEffect(() => {
    if (!active) return
    let timer: number | undefined
    const kick = (delay = 0) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void runFiscalQueue(), delay)
    }
    kick(1500)
    const interval = window.setInterval(() => void runFiscalQueue(), 30_000)
    const onVisible = () => document.visibilityState === "visible" && kick(500)
    document.addEventListener("visibilitychange", onVisible)
    const interceptor = api.interceptors.response.use((response) => {
      const method = (response.config.method || "get").toLowerCase()
      const url = response.config.url || ""
      if (method !== "get" && !url.includes("/fiscal/") && MONEY_URL.test(url)) kick(1200)
      return response
    })
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      api.interceptors.response.eject(interceptor)
    }
  }, [active])

  if (!active || failed.length === 0) return null
  const signature = failed.map((r) => `${r.id}:${r.attempts}`).join(",")
  if (dismissed === signature) return null
  const first = failed[0]

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-card p-3 shadow-lg">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {tr("Fiskal chek yuborilmadi ({{n}} ta)", { n: failed.length })}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {[first.title, first.error].filter(Boolean).join(" — ")}
          </p>
          <button
            type="button"
            onClick={() => void runFiscalQueue()}
            disabled={working}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {tr("Qayta urinish")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(signature)}
          title={tr("Yopish")}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function FiscalNavButton() {
  const user = useAuthStore((s) => s.user)
  const { data: cfg } = useFiscalConfig(!!user)
  const { device, setDevice } = useFiscalDevice()
  const waiting = useFiscalStore((s) => s.waiting)
  const failed = useFiscalStore((s) => s.failed)
  const working = useFiscalStore((s) => s.working)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<EposStatus | null>(null)
  const [busy, setBusy] = useState<"status" | "open" | "close" | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const visible = !!cfg?.enabled && cfg.can_operate
  const usable = !!cfg && cfg.token_set && (cfg.transport === "server" || device)

  const refresh = async () => {
    if (!cfg) return
    setBusy("status")
    setStatus(await eposStatus(cfg))
    setBusy(null)
  }

  // Navbat yuborib bo'lingach holat qayta o'qiladi: chek yuborishda fiskal
  // smena o'zi ochilgan bo'lishi mumkin — oynadagi ma'lumot eskirib qolmasin
  const wasWorking = useRef(false)
  useEffect(() => {
    const finished = wasWorking.current && !working
    wasWorking.current = working
    if (finished && open && cfg && (cfg.transport === "server" || device)) {
      void eposStatus(cfg).then(setStatus)
    }
  }, [working, open, cfg, device])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!visible || !cfg) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    setMessage(null)
    if (next && usable) void refresh()
  }

  const shift = async (action: "open" | "close") => {
    setBusy(action)
    setMessage(null)
    const res = await eposShift(cfg, action)
    setBusy(null)
    setMessage(
      res.ok
        ? { ok: true, text: action === "open" ? tr("Fiskal smena ochildi") : tr("Fiskal smena yopildi (Z-hisobot)") }
        : { ok: false, text: res.error || tr("E-POS xatosi") }
    )
    void refresh()
  }

  const tone =
    failed.length || !cfg.token_set ? "bg-red-500" : !usable ? "bg-gray-300" : waiting ? "bg-amber-500" : "bg-emerald-500"

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title={tr("Fiskal modul (E-POS)")}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {working ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ReceiptText className="h-[18px] w-[18px]" />}
        <span className={cn("absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-card", tone)} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(88vw,21rem)] rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{tr("Fiskal modul (E-POS)")}</p>
            <span className="text-[11px] text-muted-foreground">{cfg.company_inn && `STIR ${cfg.company_inn}`}</span>
          </div>

          {!cfg.token_set && (
            <p className="mt-3 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] leading-snug text-red-700">
              {tr("E-POS token kiritilmagan — fiskal cheklar yuborilmaydi. Sozlovchi uni Sozlamalar → «Fiskal modul (E-POS)» bo'limida kiritadi.")}
            </p>
          )}
          {cfg.transport === "browser" && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary-600"
                checked={device}
                onChange={(e) => {
                  setDevice(e.target.checked)
                  setStatus(null)
                  setMessage(null)
                  // Belgilanishi bilan aloqa darhol tekshiriladi
                  if (e.target.checked) void refresh()
                }}
              />
              <span>
                <span className="block text-xs font-medium text-foreground">{tr("Shu kompyuterda fiskal modul bor")}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {tr("Belgilansa, fiskal cheklar shu kompyuterdagi E-POS orqali yuboriladi")}
                </span>
              </span>
            </label>
          )}

          {usable && (
            <>
              <div className="mt-3 space-y-1.5 text-xs">
                <Row label={tr("E-POS aloqasi")}>
                  {busy === "status" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : status?.ok ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {status.version || tr("ulangan")}
                    </span>
                  ) : (
                    <span className="text-red-600">{status?.error || "—"}</span>
                  )}
                </Row>
                <Row label={tr("Fiskal smena")}>
                  {status?.shiftOpen === undefined ? (
                    <span className="text-muted-foreground">—</span>
                  ) : status.shiftOpen ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <LockOpen className="h-3.5 w-3.5" />
                      {tr("ochiq")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      {tr("yopiq")}
                    </span>
                  )}
                </Row>
                <Row label={tr("Navbatda")}>
                  <span className={cn("font-medium", failed.length ? "text-red-600" : "text-foreground")}>
                    {failed.length
                      ? tr("{{n}} ta (xato: {{f}})", { n: waiting, f: failed.length })
                      : tr("{{n}} ta", { n: waiting })}
                  </span>
                </Row>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void shift("open")}
                  disabled={busy !== null || status?.shiftOpen === true}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {busy === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockOpen className="h-3.5 w-3.5" />}
                  {tr("Smenani ochish")}
                </button>
                <button
                  type="button"
                  onClick={() => void shift("close")}
                  disabled={busy !== null || status?.shiftOpen === false}
                  title={tr("Z-hisobot — fiskal smena yopiladi va soliqqa yuboriladi")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {busy === "close" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  {tr("Smenani yopish (Z)")}
                </button>
              </div>

              {(waiting > 0 || failed.length > 0) && (
                <button
                  type="button"
                  onClick={() => void runFiscalQueue()}
                  disabled={working}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  {tr("Navbatni yuborish")}
                </button>
              )}
              {failed[0]?.error && (
                <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] leading-snug text-red-700">
                  {failed[0].error}
                </p>
              )}
            </>
          )}
          {message && (
            <p
              className={cn(
                "mt-2 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug",
                message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}
            >
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}
