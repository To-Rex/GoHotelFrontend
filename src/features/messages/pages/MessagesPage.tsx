import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  DoorOpen,
  Clock,
} from "lucide-react"
import {
  DEFAULT_MESSAGE_DAYS,
  useStaffMessages,
  useSendStaffMessage,
  useMarkMessageDone,
  type StaffMessage,
} from "../api/messages"
import { useRooms } from "@/features/rooms/api/rooms"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const initialsOf = (name: string | null | undefined) =>
  (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

const timeLabel = (iso: string | null) => {
  if (!iso) return "—"
  const d = new Date(iso)
  const today = format(new Date(), "yyyy-MM-dd")
  return format(d, "yyyy-MM-dd") === today
    ? `bugun ${format(d, "HH:mm")}`
    : format(d, "dd.MM HH:mm")
}

export const MessagesPage = () => {
  const user = useAuthStore((s) => s.user)
  /* Taxta standart holatda oxirgi ikki kunni ko'rsatadi: xabarlar qisqa
     umrli va eski yozuvlar orasida bugungisini topib bo'lmay qoladi.
     "Avvalgilari" bosilsa hammasi keladi. OCHIQ xabarlar esa ikkala
     holatda ham ko'rinadi — buni server ta'minlaydi. */
  const [showAll, setShowAll] = useState(false)
  const { data: messages = [], isLoading } = useStaffMessages(
    30_000,
    showAll ? 0 : DEFAULT_MESSAGE_DAYS
  )
  // Xonalar ro'yxati ixtiyoriy qulaylik — ruxsati yo'q xodimda (masalan
  // farroshda) bo'sh keladi va tanlov ko'rsatilmaydi; xona raqamini
  // matnning o'zida yozib yuboraveradi
  const { data: rooms = [] } = useRooms()
  const sendMutation = useSendStaffMessage()
  const doneMutation = useMarkMessageDone()

  const [body, setBody] = useState("")
  const [roomId, setRoomId] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "DONE">("ALL")
  const [doneBusyId, setDoneBusyId] = useState<string | null>(null)

  const sortedRooms = useMemo(
    () =>
      [...(rooms as any[])].sort((a, b) =>
        String(a.room_number).localeCompare(String(b.room_number), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [rooms]
  )

  const openCount = messages.filter((m) => m.status === "OPEN").length
  const doneCount = messages.length - openCount
  const shown = messages.filter((m) => (filter === "ALL" ? true : m.status === filter))

  const onSend = async () => {
    if (!body.trim()) {
      setSendError("Xabar matnini kiriting")
      return
    }
    setSendError(null)
    try {
      await sendMutation.mutateAsync({ body: body.trim(), room_id: roomId || null })
      setBody("")
      setRoomId("")
    } catch (e) {
      setSendError(apiErrorMessage(e))
    }
  }

  const onDone = async (m: StaffMessage) => {
    setDoneBusyId(m.id)
    try {
      await doneMutation.mutateAsync(m.id)
    } catch (e) {
      alert(apiErrorMessage(e))
    } finally {
      setDoneBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* SARLAVHA */}
      <div className="animate-dash-rise flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Xabarlar</h1>
            <p className="text-sm text-gray-500">
              Xodimlar o'rtasidagi so'rov va xabarlar
              {openCount > 0 && (
                <>
                  {" "}
                  · <span className="font-semibold text-amber-600">{openCount} ta ochiq</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* YANGI XABAR / SO'ROV */}
      <div
        className="animate-dash-rise rounded-2xl border bg-white p-4"
        style={{ animationDelay: "60ms" }}
      >
        <label className="text-xs font-medium text-gray-600">
          Yangi xabar yoki so'rov
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Masalan: 104-xona bo'shaganini tekshirib qo'ying..."
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {sortedRooms.length > 0 && (
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex h-9 items-center rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Xona (ixtiyoriy)</option>
              {sortedRooms.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.room_number}-xona
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            className="ml-auto gap-1.5"
            disabled={sendMutation.isPending}
            onClick={onSend}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Yuborish
          </Button>
        </div>
        {sendError && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {sendError}
          </p>
        )}
      </div>

      {/* FILTR */}
      <div
        className="animate-dash-rise flex flex-wrap gap-1.5"
        style={{ animationDelay: "120ms" }}
      >
        {(
          [
            { key: "ALL", label: `Barchasi (${messages.length})` },
            { key: "OPEN", label: `Ochiq (${openCount})` },
            { key: "DONE", label: `Bajarilgan (${doneCount})` },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary-600 bg-primary-50 text-primary-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            {f.label}
          </button>
        ))}

        {/* Oyna almashtirgichi — filtrlar yonida, chunki ikkalasi ham
            "nima ko'rinadi" degan savolga javob beradi. */}
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="ml-auto rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          title={
            showAll
              ? "Faqat oxirgi ikki kunlik xabarlarni ko'rsatish"
              : "Ikki kundan avvalgi xabarlarni ham ko'rsatish"
          }
        >
          {showAll ? "Oxirgi 2 kun" : "Avvalgilarini ko'rsatish"}
        </button>
      </div>

      {/* Qaysi oyna ochiq ekani ro'yxat tepasida aytiladi: bo'sh taxta
          "xabar yo'q" emas, "bu oynada yo'q" bo'lishi mumkin. */}
      {!isLoading && (
        <p className="-mt-1 text-[11px] text-gray-400">
          {showAll
            ? "Barcha xabarlar ko'rsatilmoqda"
            : `Oxirgi ${DEFAULT_MESSAGE_DAYS} kunlik xabarlar · bajarilmagan so'rovlar muddatidan qat'i nazar ko'rinadi`}
        </p>
      )}

      {/* RO'YXAT */}
      <div className="animate-dash-rise space-y-2.5" style={{ animationDelay: "180ms" }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-gray-400">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <MessageSquare className="h-7 w-7" />
            </span>
            <p className="text-sm">
              {filter === "ALL" ? "Hozircha xabarlar yo'q" : "Bu bo'limda xabar yo'q"}
            </p>
            {!showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Avvalgi xabarlarni ko'rsatish
              </button>
            )}
          </div>
        ) : (
          shown.map((m) => {
            const mine = m.created_by === user?.id
            return (
              <div
                key={m.id}
                className={cn(
                  "rounded-2xl border bg-white p-4 transition-shadow hover:shadow-sm",
                  m.status === "OPEN" ? "border-gray-200" : "border-gray-100 opacity-80"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      mine
                        ? "bg-primary-100 text-primary-700"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {initialsOf(m.created_by_name)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {m.created_by_name || "Xodim"}
                    {mine && (
                      <span className="ml-1 text-[11px] font-normal text-gray-400">
                        (siz)
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock className="h-3 w-3" />
                    {timeLabel(m.created_at)}
                  </span>
                  {m.room_number && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      <DoorOpen className="h-3 w-3" />
                      {m.room_number}-xona
                    </span>
                  )}
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                      m.status === "OPEN"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {m.status === "OPEN" ? "Ochiq" : "Bajarildi"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
                  {m.body}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  {m.status === "DONE" ? (
                    <p className="flex items-center gap-1 text-[11px] text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {m.done_by_name || "Xodim"} bajardi
                      {m.done_at ? ` · ${timeLabel(m.done_at)}` : ""}
                    </p>
                  ) : (
                    <span />
                  )}
                  {m.status === "OPEN" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto gap-1.5"
                      disabled={doneBusyId === m.id}
                      onClick={() => onDone(m)}
                    >
                      {doneBusyId === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Bajarildi
                    </Button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
