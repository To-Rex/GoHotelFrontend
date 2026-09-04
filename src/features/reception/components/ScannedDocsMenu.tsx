import { useEffect, useRef, useState } from "react"
import { BadgeCheck, IdCard, ScanLine, User, X } from "lucide-react"

import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import {
  useAcknowledgeScan,
  useDocumentScans,
  type DocumentScan,
} from "../api/scans"
import { pickAutoOpen } from "../lib/scanPick"

/**
 * Telefonda skanerlangan hujjatlar — navbardagi kuzatuvchi.
 *
 * Resepsiya xodimi mehmonning pasportini telefonda suratga oladi; server
 * uni o'qib, natijani shu yerga uzatadi va bandlov oynasi O'ZI ochiladi:
 * mehmon bazada bo'lsa tanlangan holda, bo'lmasa maydonlari to'ldirilgan
 * holda. Xodim kompyuter oldiga qaytganda ish deyarli tugagan bo'ladi.
 *
 * Uch qaror:
 *
 * 1. **Faqat SHU sessiya boshlangandan keyingi skan o'zi ochiladi.**
 *    Sahifa yangilanganda bir soat oldingi skan ekranga otilib chiqsa,
 *    xodim nima bo'layotganini tushunmasdi. Eskilari menyuda turadi.
 * 2. **Ochilgan yozuv darhol yopiladi.** Aks holda bir necha ekran bir
 *    xil oynani ochib, bitta mehmonga ikkita bron yaratilardi.
 * 3. **Skan yo'q bo'lsa tugma chizilmaydi.** Doim bo'sh turadigan tugma
 *    navbarda joy egallaydi va hech narsa aytmaydi.
 */

const POLL_MS = 6000

const TYPE_LABEL: Record<string, string> = {
  ID_CARD: "ID karta",
  PASSPORT: "Passport",
}

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

export function ScannedDocsMenu({
  onScan,
}: {
  /** Skan tanlanganda — yangi bandlov dialogini ochadi */
  onScan: (scan: DocumentScan) => void
}) {
  const { can, isAdmin } = usePermissions()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const acknowledge = useAcknowledgeScan()

  // Skanerlar bron bilan ishlaydigan xodimga tegishli — serverdagi
  // ruxsat ro'yxati bilan bir xil
  const allowed = isAdmin || can("reservation.read") || can("reservation.create")

  const { data: scans = [], isError } = useDocumentScans(allowed, POLL_MS)

  /* Qaysi yozuv o'zi ochilishi kerakligi — `scanPick` da, qoidalar
     izohi bilan. Bu yerda faqat holat: nimalar ochilgan va kuzatuv
     qachon boshlangan. */
  const openedRef = useRef<Set<string>>(new Set())
  //: Kuzatuvchi ishga tushgan payt — undan oldingi skan o'zi ochilmaydi
  const startedAtRef = useRef<number>(Date.now())

  const pick = (scan: DocumentScan) => {
    openedRef.current.add(scan.id)
    setOpen(false)
    onScan(scan)
    // Yopilgan yozuv boshqa ekranda qayta ochilmaydi
    acknowledge.mutate(scan.id)
  }

  useEffect(() => {
    if (!allowed || scans.length === 0) return
    const fresh = pickAutoOpen(scans, {
      since: startedAtRef.current,
      opened: openedRef.current,
    })
    if (fresh) pick(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scans, allowed])

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
  if (scans.length === 0 && !open) return null

  const dismiss = (event: React.MouseEvent, scan: DocumentScan) => {
    event.stopPropagation()
    acknowledge.mutate(scan.id)
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Telefonda skanerlangan hujjatlar"
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-muted",
          open && "bg-muted"
        )}
      >
        <ScanLine size={18} className="text-muted-foreground" />
        {scans.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
            {scans.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Skanerlangan hujjatlar</p>
            <p className="text-[11px] text-muted-foreground">
              Telefondan yuborilgan — bosilganda bandlov oynasi ochiladi
            </p>
          </div>

          {scans.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Hozircha skan yo'q
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {scans.map((scan) => (
                <li key={scan.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => pick(scan)}
                    onKeyDown={(e) => e.key === "Enter" && pick(scan)}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                        scan.matched
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                          : "bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400"
                      )}
                    >
                      {scan.matched ? <User size={16} /> : <IdCard size={16} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-sm font-medium">
                        {scan.guest_name || scan.full_name || "Nomsiz hujjat"}
                        {scan.verified && (
                          <BadgeCheck
                            size={13}
                            className="flex-shrink-0 text-emerald-600"
                          />
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {TYPE_LABEL[scan.document_type] || scan.document_type}
                        {scan.document_number ? ` · ${scan.document_number}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {scan.matched
                          ? "Bazadan topildi — bron ochiladi"
                          : "Yangi mijoz — maydonlar to'ldiriladi"}
                        {scan.created_at ? ` · ${timeAgo(scan.created_at)}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => dismiss(e, scan)}
                      title="Yopish"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
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
    </div>
  )
}
