import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { create } from "zustand"
import { CheckCircle2, Loader2, Printer, RotateCcw, X } from "lucide-react"

import { useReceiptSettings } from "@/features/shop/api/shop"
import { printReservationReceipt } from "@/lib/tprints"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import { tr } from "@/i18n"
import {
  buildReservationReceiptData,
  getBookingAutoPrint,
  setBookingAutoPrint,
  shouldPrintAfterPayment,
  type ReceiptExtras,
  type ReceiptReservation,
} from "./receipt"

/* To'lovdan keyin avtomatik bron cheki.

   Chek printeri — kassa kompyuteridagi TPrints (lokal print-server).
   Chiqarish bronni HECH QACHON buzmaydi: pul allaqachon yozilgan, chek
   esa alohida, ixtiyoriy qadam. "Yangi bandlov" oynasi bron yaratilgach
   darhol yopiladi, shuning uchun natija (chiqdi / chiqmadi — qayta urinish)
   sahifa ustidagi kichik xabarda ko'rsatiladi (`ReceiptPrintNotice`,
   MainLayout'da bitta). */

type NoticeState = "printing" | "done" | "error"

interface Notice {
  id: number
  state: NoticeState
  label: string
  error?: string
  retry?: () => void
}

interface ReceiptPrinterStore {
  autoPrint: boolean
  notice: Notice | null
  setAutoPrint: (on: boolean) => void
  setNotice: (notice: Notice | null) => void
}

const useReceiptPrinterStore = create<ReceiptPrinterStore>((set) => ({
  autoPrint: getBookingAutoPrint(),
  notice: null,
  setAutoPrint: (on) => {
    setBookingAutoPrint(on)
    set({ autoPrint: on })
  },
  setNotice: (notice) => set({ notice }),
}))

let noticeSeq = 0

/** Chek chiqarish ishini xabar bilan bajaradi (xato bo'lsa — qayta urinish) */
const runWithNotice = async (
  label: string,
  job: () => Promise<{ ok: boolean; error?: string }>
) => {
  const { setNotice } = useReceiptPrinterStore.getState()
  const id = ++noticeSeq
  setNotice({ id, state: "printing", label })
  let result: { ok: boolean; error?: string }
  try {
    result = await job()
  } catch {
    result = { ok: false }
  }
  // Shu orada boshqa chek boshlangan bo'lsa — uning xabari ustun
  if (useReceiptPrinterStore.getState().notice?.id !== id) return result
  if (result.ok) {
    setNotice({ id, state: "done", label })
    window.setTimeout(() => {
      if (useReceiptPrinterStore.getState().notice?.id === id) setNotice(null)
    }, 3500)
  } else {
    setNotice({
      id,
      state: "error",
      label,
      error: result.error || tr("Chek chiqmadi — printer ulanishini tekshiring"),
      retry: () => void runWithNotice(label, job),
    })
  }
  return result
}

/**
 * Bron chekini avtomatik chiqarish uchun hook.
 *
 * `printAfterPayment` — sozlama yoqilgan va `paidNow > 0` bo'lsa chek
 * chiqaradi (kutmaydi — natija xabarda). Qaytaradi: chek yuborildimi.
 */
export const useBookingReceiptPrinter = () => {
  const autoPrint = useReceiptPrinterStore((s) => s.autoPrint)
  const setAutoPrint = useReceiptPrinterStore((s) => s.setAutoPrint)
  const user = useAuthStore((s) => s.user)
  const { data: design } = useReceiptSettings()

  const printAfterPayment = (
    reservation: ReceiptReservation,
    paidNow: number,
    extras: ReceiptExtras = {}
  ): boolean => {
    if (!shouldPrintAfterPayment(useReceiptPrinterStore.getState().autoPrint, paidNow)) {
      return false
    }
    const createdByName =
      extras.createdByName ??
      ([user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || null)
    const data = buildReservationReceiptData(reservation, { ...extras, createdByName })
    void runWithNotice(tr("Bron {{number}} cheki", { number: reservation.reservation_number }), () =>
      printReservationReceipt(data, user?.hotel_name || "GoHotel", design)
    )
    return true
  }

  return { autoPrint, setAutoPrint, printAfterPayment }
}

/** "To'lov qilinsa chek chiqarish" belgisi — bron oynasi va qo'shimcha
 *  to'lov panelida bir xil (sozlama umumiy, shu kompyuter uchun). */
export function ReceiptAutoPrintToggle({ className }: { className?: string }) {
  const autoPrint = useReceiptPrinterStore((s) => s.autoPrint)
  const setAutoPrint = useReceiptPrinterStore((s) => s.setAutoPrint)
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2 text-xs text-gray-600",
        className
      )}
      title={tr("Sozlama shu kompyuter uchun saqlanadi. Printer manzili Do'kon sahifasidagi printer sozlamasida.")}
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 rounded border-gray-300 accent-primary-600"
        checked={autoPrint}
        onChange={(e) => setAutoPrint(e.target.checked)}
      />
      <Printer className="h-3.5 w-3.5 text-gray-400" />
      {tr("To'lov qilinsa chek chiqarish")}
    </label>
  )
}

/** Chek natijasi — sahifa ustida, o'ng pastda. MainLayout'da bitta. */
export function ReceiptPrintNotice() {
  const notice = useReceiptPrinterStore((s) => s.notice)
  const setNotice = useReceiptPrinterStore((s) => s.setNotice)
  const setAutoPrint = useReceiptPrinterStore((s) => s.setAutoPrint)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || !notice || typeof document === "undefined") return null

  const close = () => setNotice(null)

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed bottom-4 right-4 z-[70] w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-3 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg",
            notice.state === "error"
              ? "bg-red-50 text-red-600"
              : notice.state === "done"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-primary-50 text-primary-600"
          )}
        >
          {notice.state === "printing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : notice.state === "done" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{notice.label}</p>
          <p
            className={cn(
              "text-xs",
              notice.state === "error" ? "text-red-600" : "text-muted-foreground"
            )}
          >
            {notice.state === "printing"
              ? tr("Chek chiqarilmoqda...")
              : notice.state === "done"
                ? tr("Chek chiqdi")
                : notice.error}
          </p>
          {notice.state === "error" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={notice.retry}
                className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700"
              >
                <RotateCcw className="h-3 w-3" />
                {tr("Qayta urinish")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoPrint(false)
                  close()
                }}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                title={tr("Printer yo'q kompyuterda to'lovdan keyin chek chiqarishni o'chiradi (bron oynasida qayta yoqish mumkin)")}
              >
                {tr("Bu kompyuterda chek chiqarmaslik")}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={tr("Yopish")}
          aria-label={tr("Yopish")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  )
}
