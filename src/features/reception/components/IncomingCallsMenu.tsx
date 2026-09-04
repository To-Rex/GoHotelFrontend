import { useEffect, useRef, useState } from "react"
import {
  BedDouble,
  Maximize2,
  Phone,
  PhoneIncoming,
  User,
  X,
} from "lucide-react"

import { OverlayDialog } from "@/components/ui/overlay-dialog"

import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useAcknowledgeCall, useIncomingCalls, type IncomingCall } from "../api/calls"

/**
 * Kiruvchi qo'ng'iroqlar — navbardagi kichik panel.
 *
 * Mehmon qo'ng'iroq qilganda qabulxona qurilmasi raqamni serverga
 * yuboradi, server uni bazadan qidiradi va natija shu yerda paydo
 * bo'ladi: ismi, xonasi. Xodim go'shakni ko'targanda kim gapirayotganini
 * biladi — ismini so'rab, keyin qidirib o'tirmaydi.
 *
 * Kamera tanigan mehmonlar panelidan ATAYLAB alohida: manbasi boshqa
 * (kamera emas, telefon), ma'lumoti boshqa (surat yo'q, raqam bor) va
 * bittasi ishlamay qolsa ikkinchisi ishlab turishi kerak.
 *
 * Uch qaror:
 *
 * 1. **Topilmagan qo'ng'iroq ham ko'rsatiladi.** Yangi mijoz bo'lishi
 *    mumkin va raqami bron ochishda asqotadi.
 * 2. **Ko'rilgan yozuv yopiladi.** Aks holda bitta qo'ng'iroq ro'yxatda
 *    soatlab osilib turardi.
 * 3. **Qo'ng'iroq yo'q bo'lsa tugma chizilmaydi.** Doim bo'sh turadigan
 *    tugma navbarda joy egallaydi va hech narsa aytmaydi.
 */

const WINDOW_MINUTES = 30
const POLL_MS = 8000

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  )
  if (seconds < 60) return "hozirgina"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} daq. oldin`
  return `${Math.floor(minutes / 60)} soat oldin`
}

export function IncomingCallsMenu({
  onPickGuest,
}: {
  /** Mehmon tanlanganda — yangi bandlov dialogini ochadi */
  onPickGuest: (guestId: string) => void
}) {
  const { can, isAdmin } = usePermissions()
  const [open, setOpen] = useState(false)
  /* Katta ko'rinish: telefon jiringlayotganda kichik panelga engashib
     o'qish noqulay — katta oynada raqam va ism yirik ko'rinadi */
  const [expanded, setExpanded] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const acknowledge = useAcknowledgeCall()

  // Qo'ng'iroqlar bron bilan ishlaydigan xodimga tegishli — serverdagi
  // ruxsat ro'yxati bilan bir xil
  const allowed = isAdmin || can("reservation.read") || can("reservation.create")

  const { data: calls = [], isError } = useIncomingCalls(allowed, POLL_MS)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!allowed || isError) return null
  if (calls.length === 0 && !open && !expanded) return null

  const pick = (call: IncomingCall) => {
    if (!call.guest_id) return
    setOpen(false)
    setExpanded(false)
    onPickGuest(call.guest_id)
  }

  const dismiss = (event: React.MouseEvent, call: IncomingCall) => {
    event.stopPropagation()
    acknowledge.mutate(call.id)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          open
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted"
        )}
        title="Kiruvchi qo'ng'iroqlar"
        aria-label="Kiruvchi qo'ng'iroqlar"
      >
        <PhoneIncoming size={18} />
        {calls.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
            {calls.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Phone size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Qo'ng'iroqlar</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              oxirgi {WINDOW_MINUTES} daqiqa
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setExpanded(true)
              }}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Kattaroq ko'rish"
              aria-label="Kattaroq ko'rish"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {calls.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Yaqinda qo'ng'iroq bo'lmadi
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {calls.map((call) => (
                <li key={call.id}>
                  <div
                    role={call.guest_id ? "button" : undefined}
                    tabIndex={call.guest_id ? 0 : undefined}
                    onClick={() => pick(call)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") pick(call)
                    }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors",
                      call.guest_id && "cursor-pointer hover:bg-muted/60"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                        call.matched
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <User size={16} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {call.guest_name || "Notanish raqam"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {call.phone}
                        {call.received_at ? ` · ${timeAgo(call.received_at)}` : ""}
                      </p>
                      {call.room_number && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-primary-700">
                          <BedDouble size={11} />
                          {call.room_number}-xonada turibdi
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => dismiss(e, call)}
                      title="Yopish"
                      aria-label="Yopish"
                      className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <OverlayDialog
        open={expanded}
        onClose={() => setExpanded(false)}
        icon={<PhoneIncoming size={18} className="text-muted-foreground" />}
        title="Kiruvchi qo'ng'iroqlar"
        subtitle={`Oxirgi ${WINDOW_MINUTES} daqiqa`}
        maxWidth="max-w-xl"
      >
        {calls.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Yaqinda qo'ng'iroq bo'lmadi
          </p>
        ) : (
          <ul className="space-y-2">
            {calls.map((call) => (
              <li
                key={call.id}
                className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3.5"
              >
                <span
                  className={cn(
                    "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
                    call.matched
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <User size={22} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">
                    {call.guest_name || "Notanish raqam"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {call.phone}
                    {call.received_at ? ` · ${timeAgo(call.received_at)}` : ""}
                  </p>
                  {call.room_number && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary-700">
                      <BedDouble size={12} />
                      {call.room_number}-xonada turibdi
                    </p>
                  )}
                </div>

                {call.guest_id && (
                  <button
                    type="button"
                    onClick={() => pick(call)}
                    className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
                  >
                    Bandlov ochish
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => dismiss(e, call)}
                  title="Yopish"
                  aria-label="Yopish"
                  className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </OverlayDialog>
    </div>
  )
}
