import { useEffect, useRef, useState } from "react"
import { format, addDays, parseISO } from "date-fns"
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoomStatusNote } from "@/features/rooms/components/RoomStatusNote"
import type { RoomStatusDetail } from "@/features/rooms/lib/roomStatusInfo"
import { isBlockedAlways } from "@/features/rooms/lib/roomBookable"
import { DEBT_BAR_CLASS, debtHint, debtLevelOf } from "../lib/booking"
import {
  canExtendTo,
  extendCeiling,
  extendTarget,
  isExtendable,
  nextBusyStart,
} from "../lib/extend"

const DAY_MINUTES = 24 * 60
// Bitta soat ustunining kengligi (px) — lenta gorizontal aylantiriladi,
// shuning uchun istalgan soatni (kun boshidan oxirigacha) ko'rish mumkin.
const HOUR_WIDTH = 88
// "Butun kun" rejimida zichroq masshtab — kun bir qarashda ko'rinadi
const HOUR_WIDTH_COMPACT = 44
// Chap tomondagi xona ustunining kengligi (w-56 = 224px)
const ROOM_COL_WIDTH = 224
// Tez bron uchun tayyor davomiyliklar (soatlarda)

// Xonaning MAXSUS holatlari — bronlardan ko'rinmaydigan holatlar belgi bilan
// ko'rsatiladi (Bo'sh/Band bronlardan hisoblanadi, bular esa alohida)
const ROOM_STATUS_LABELS: Record<string, string> = {
  CLEANING: "Tozalanmoqda",
  MAINTENANCE: "Ta'mirda",
  INSPECTION: "Tekshiruvda",
  OUT_OF_SERVICE: "Xizmatdan tashqari",
}

const roomStatusBadge: Record<string, string> = {
  CLEANING: "bg-amber-100 text-amber-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  INSPECTION: "bg-purple-100 text-purple-700",
  OUT_OF_SERVICE: "bg-gray-200 text-gray-600",
}

// Xona katagining o'zi holat rangida bo'yaladi — holat bir qarashda yaqqol
// ko'rinadi (/rooms sahifasidagi rang sxemasi bilan bir xil). Bo'sh xona
// ODDIY oq. Sticky ustun timeline ustidan o'tgani uchun ranglar TO'LIQ
// qoplaydigan (shaffof emas) tanlangan.
const roomCellAccent: Record<string, string> = {
  RESERVED: "bg-blue-50 border-l-blue-400",
  OCCUPIED: "bg-red-50 border-l-red-400",
  CLEANING: "bg-amber-50 border-l-amber-400",
  MAINTENANCE: "bg-orange-50 border-l-orange-400",
  INSPECTION: "bg-purple-50 border-l-purple-400",
  OUT_OF_SERVICE: "bg-gray-100 border-l-gray-400",
}
// Soatlik bronlar orasidagi majburiy tanaffus (daqiqa) — mijoz chiqib ketgach
// xonani tayyorlash uchun. BookingPage va backenddagi qiymat bilan bir xil.
const TURNOVER_MIN = 15
// Cho'zishda vaqt shu qadamga yaxlitlanadi — piksel aniqligidagi
// 21:07 kabi vaqtlar chiqmasligi uchun
const EXTEND_STEP_MIN = 15

export interface HourlyBoardProps {
  /** Ko'rsatilayotgan kun — "yyyy-MM-dd" */
  date: string
  onDateChange: (date: string) => void
  /** Xonalar qavatlar bo'yicha guruhlangan holda */
  roomGroups: Array<{ key: string; label: string; rooms: any[] }>
  /** Yig'ilgan qavatlar (kalendar tabi bilan umumiy holat) */
  collapsedFloors: Set<string>
  onToggleFloor: (key: string) => void
  reservations: any[]
  /**
   * Bo'sh vaqt oralig'i bosilganda. `dateStr` — bron qaysi kunga tegishli
   * (yarim tundan keyingi ustunlar ertangi kunga tushadi).
   */
  onSlotClick: (room: any, startMin: number, endMin: number, dateStr: string) => void
  /** Mavjud bron bosilganda */
  onReservationClick: (res: any) => void
  canCreate: boolean
  getRoomPrice: (room: any) => number
  getGuestName: (res: any) => string
  statusColors: Record<string, string>
  /** Xonaga biriktirilgan faol xo'jalik vazifasi turi (room_id -> task_type) */
  activeTaskTypeByRoom?: Record<string, string>
  /** Xona holati tafsiloti (tozalash qachon boshlangani va h.k.). */
  statusDetailByRoom?: Record<string, RoomStatusDetail | null>
  /**
   * Bronni surib cho'zish mumkinmi — faqat ADMINISTRATOR uchun.
   * Boshqa rollarda dastak umuman chizilmaydi.
   */
  canExtend?: boolean
  /**
   * Cho'zish tasdiqlangach. `checkOut` — yangi tugash payti
   * ("2026-09-03T23:00:00"), zonasiz: bu xodim ko'rgan devor soati.
   */
  onExtend?: (res: any, checkOut: string) => void
}

// Faol vazifa turlari yorlig'i va ranglari (BookingPage bilan bir xil)
const TASK_TYPE_LABELS: Record<string, string> = {
  CLEANING: "Tozalash",
  DEEP_CLEANING: "Chuqur tozalash",
  MAINTENANCE: "Ta'mirlash",
  INSPECTION: "Tekshiruv",
  TURN_DOWN: "Kechki tayyorlash",
}

const taskTypeBadge: Record<string, string> = {
  CLEANING: "bg-amber-100 text-amber-700",
  DEEP_CLEANING: "bg-amber-100 text-amber-800",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  INSPECTION: "bg-purple-100 text-purple-700",
  TURN_DOWN: "bg-sky-100 text-sky-700",
}

function minToTime(min: number): string {
  const m = ((min % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

function timeToMin(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number)
  return h * 60 + m
}

// Sana hisobini mahalliy vaqt zonasida bajaramiz (toISOString UTC ga o'tkazib
// yuboradi va +5 zonada kunni noto'g'ri suradi).
function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), "yyyy-MM-dd")
}

// Taxtadagi bron/band oraliq — vaqt "mutlaq minut" o'qida:
// 0 = tanlangan kunning 00:00 i, 1440 = ertangi kunning 00:00 i.
interface Interval {
  start: number
  end: number
  res: any
  daily: boolean
  // Yangi bronga TO'SIQ bo'ladimi: chiqilgan (CHECKED_OUT) va kelmagan
  // (NO_SHOW) bronlar taxtada ko'rinadi, lekin xonani band qilmaydi —
  // mehmon erta chiqib ketgan bo'lsa xona darhol yana bron qilinadi
  blocking: boolean
}

/**
 * Kalendarsiz, soatlik bron taxtasi.
 *
 * Vaqt o'qi tanlangan kunning 00:00 idan boshlanadi va kerak bo'lsa ertangi
 * kunga o'tadi: kech soatlarda (masalan 23:30) oyna 18:00 dan 04:00 gacha
 * cho'ziladi, shunda tundagi bo'sh soatlarга ham shu yerdan bron qilinadi.
 *
 * Asosiy stsenariy — eshikdan kirib kelgan mehmonni hoziroq joylashtirish:
 * joriy vaqt chizig'i, "hozir bo'sh" belgisi va bir bosishda hozirgi vaqtdan
 * boshlanadigan tez bron tugmalari mavjud.
 */
export function HourlyBoard({
  date,
  onDateChange,
  roomGroups,
  collapsedFloors,
  onToggleFloor,
  reservations,
  onSlotClick,
  onReservationClick,
  canCreate,
  getRoomPrice,
  getGuestName,
  statusColors,
  activeTaskTypeByRoom = {},
  statusDetailByRoom = {},
  canExtend = false,
  onExtend,
}: HourlyBoardProps) {
  // Joriy vaqt — har 30 soniyada yangilanadi
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Faqat hozir bo'sh xonalarni ko'rsatish filtri
  const [onlyFree, setOnlyFree] = useState(false)
  // Butun kunni (00:00-24:00) ko'rsatish rejimi
  const [fullDay, setFullDay] = useState(false)
  // Oynani soatlar bo'yicha surish (manfiy — o'tgan soatlarni ko'rish uchun)
  // Kun almashsa ko'rinish boshlang'ich holatga qaytadi
  useEffect(() => {
    setFullDay(false)
  }, [date])

  const today = format(now, "yyyy-MM-dd")
  const isToday = date === today
  // O'tgan sana — faqat ko'rish uchun, yangi bron qilib bo'lmaydi
  const isPastDate = date < today
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextDate = shiftDate(date, 1)

  // --- To'liq kun lentasi (gorizontal aylantiriladigan) ---
  // Barcha soatlar 00:00 dan boshlab chiziladi — istalgan o'tgan/kelgusi
  // soatga scroll yoki sichqoncha bilan surib borish mumkin. Bugungi kunda
  // ertangi kunning dastlabki 6 soati ham qo'shiladi (tungi bronlar uchun).
  const renderEndHour = isToday ? 30 : 24
  const hourW = fullDay ? HOUR_WIDTH_COMPACT : HOUR_WIDTH
  const timelineWidth = renderEndHour * hourW
  const visibleHours = Array.from({ length: renderEndHour }, (_, i) => i)
  const winStart = 0
  const winEnd = renderEndHour * 60
  const pct = (min: number) => ((min - winStart) / (winEnd - winStart)) * 100

  // --- Scroll / pan boshqaruvi ---
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const suppressClick = useRef(false)
  const panState = useRef<{
    x: number
    y: number
    left: number
    top: number
    moved: boolean
  } | null>(null)

  const scrollToNow = (behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current
    if (!el) return
    // Joriy vaqtdan 2 soat oldinni chap chetga keltiramiz
    const targetMin = isToday ? Math.max(0, nowMin - 120) : 0
    el.scrollTo({ left: (targetMin / 60) * hourW, behavior })
  }

  // Kun yoki masshtab o'zgarganda joriy vaqt atrofiga olib boramiz
  useEffect(() => {
    scrollToNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, fullDay])

  const scrollByHours = (h: number) => {
    scrollRef.current?.scrollBy({ left: h * hourW, behavior: "smooth" })
  }

  // Sichqoncha bilan surish (drag-to-pan): 5px dan ortiq siljish pan
  // hisoblanadi va undan keyingi click bosilgan element ustida ishlamaydi —
  // katak/bron bosish funksiyalari buzilmaydi.
  const onPanDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    }
  }
  const onPanMove = (e: React.MouseEvent) => {
    const st = panState.current
    const el = scrollRef.current
    if (!st || !el) return
    const dx = e.clientX - st.x
    const dy = e.clientY - st.y
    if (!st.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) st.moved = true
    if (st.moved) {
      el.scrollLeft = st.left - dx
      el.scrollTop = st.top - dy
    }
  }
  const onPanEnd = () => {
    if (panState.current?.moved) {
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 50)
    }
    panState.current = null
  }

  // Sana qaysi kunga to'g'ri kelishi (mutlaq o'qdagi siljish)
  const dayOffset = (d: string): number | null =>
    d === date ? 0 : d === nextDate ? DAY_MINUTES : null

  // --- Bronlarni mutlaq o'qqa joylash ---
  const intervalsByRoom: Record<string, Interval[]> = {}
  const pushInterval = (roomId: string, iv: Interval) => {
    if (!intervalsByRoom[roomId]) intervalsByRoom[roomId] = []
    intervalsByRoom[roomId].push(iv)
  }

  // Muddatidan oldin chiqilgan bronning HAQIQIY chiqish momenti (mutlaq minut).
  // Blok shu vaqtgacha qisqartiriladi — asl rejadagi vaqtgacha cho'zilib,
  // boshqa soatlarga xalaqit berib turmaydi. checkout_requested_at — mehmon
  // chiqqan payt; bo'lmasa updated_at (chiqish rasmiylashtirilgan payt).
  const actualEndAbs = (r: any): number | null => {
    if (r.status !== "CHECKED_OUT") return null
    const iso = r.checkout_requested_at || r.updated_at
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    if (ds < date) return -1 // oynadan oldinroq chiqib ketgan
    const off = dayOffset(ds)
    if (off === null) return null // oynadan keyin chiqqan — kesish shart emas
    return off + d.getHours() * 60 + d.getMinutes()
  }

  for (const r of reservations) {
    if (r.status === "CANCELLED") continue
    const blocking = r.status !== "CHECKED_OUT" && r.status !== "NO_SHOW"

    if (r.booking_type === "HOURLY") {
      if (!r.check_in_datetime || !r.check_out_datetime) continue
      const ciOff = dayOffset(r.check_in_datetime.slice(0, 10))
      const coOff = dayOffset(r.check_out_datetime.slice(0, 10))
      if (ciOff === null && coOff === null) continue
      // Oynadan oldin boshlangan / keyin tugaydigan bronlar chegarada kesiladi
      const start =
        ciOff !== null ? ciOff + timeToMin(r.check_in_datetime.slice(11, 16)) : 0
      let end =
        coOff !== null
          ? coOff + timeToMin(r.check_out_datetime.slice(11, 16))
          : 2 * DAY_MINUTES
      // Erta chiqilgan bron faqat haqiqiy chiqish vaqtigacha joy egallaydi
      const actual = actualEndAbs(r)
      if (actual !== null && actual < end) end = Math.max(actual, start)
      pushInterval(r.room_id, { start, end, res: r, daily: false, blocking })
    } else {
      if (!r.check_in_date || !r.check_out_date) continue
      // Kunlik bron ko'rinadigan ikkala kunning qaysi birini qamrasa — o'sha kun
      // to'liq band hisoblanadi
      ;[date, nextDate].forEach((d, idx) => {
        if (r.check_in_date <= d && d <= r.check_out_date) {
          const segStart = idx * DAY_MINUTES
          let segEnd = (idx + 1) * DAY_MINUTES
          // Erta chiqilgan kunlik bron: chiqish kunida blok haqiqiy vaqtgacha
          // qisqaradi, keyingi kunlarda esa umuman ko'rsatilmaydi
          const actual = actualEndAbs(r)
          if (actual !== null) {
            if (actual <= segStart) return
            segEnd = Math.min(segEnd, actual)
          }
          pushInterval(r.room_id, {
            start: segStart,
            end: segEnd,
            res: r,
            daily: true,
            blocking,
          })
        }
      })
    }
  }

  const busyOf = (roomId: string): Interval[] =>
    (intervalsByRoom[roomId] || []).slice().sort((a, b) => a.start - b.start)

  // Faqat haqiqatan to'sadigan bronlar — bo'sh vaqt hisob-kitoblari uchun
  const blockingOf = (roomId: string): Interval[] =>
    busyOf(roomId).filter((b) => b.blocking)

  // Soatlik bron tugagach xona yana TURNOVER_MIN daqiqa band hisoblanadi
  // (tozalash tanaffusi). Kunlik bronlarga tanaffus qo'shilmaydi.
  const availEnd = (b: Interval) => (b.daily ? b.end : b.end + TURNOVER_MIN)

  // Berilgan nuqtadan boshlab qancha daqiqa bo'sh (keyingi band oralig'igacha).
  // Keyingi bron oldidan ham tanaffus qoldiriladi — bizning mijoz chiqib
  // ketishi uchun.
  const freeMinutesFrom = (roomId: string, startMin: number): number => {
    const busy = blockingOf(roomId)
    if (busy.some((b) => b.start <= startMin && startMin < availEnd(b))) return 0
    const nextBusy = busy
      .filter((b) => b.start > startMin)
      .reduce((m, b) => Math.min(m, b.start), 2 * DAY_MINUTES)
    const limit = nextBusy < 2 * DAY_MINUTES ? nextBusy - TURNOVER_MIN : nextBusy
    return Math.max(0, limit - startMin)
  }

  // Tez bron boshlanishi: joriy vaqtni 15 daqiqagacha pastga yaxlitlaymiz
  const quickStartFor = (roomId: string): number => {
    const rounded = Math.floor(nowMin / 15) * 15
    return freeMinutesFrom(roomId, rounded) > 0 ? rounded : nowMin
  }

  const isFreeNow = (roomId: string): boolean =>
    isToday && freeMinutesFrom(roomId, nowMin) > 0

  // Mutlaq minutni (room, boshlanish, tugash) -> ota-komponent kutgan
  // "kun + kun ichidagi minut" ko'rinishiga o'tkazish
  const emitSlot = (room: any, startAbs: number, endAbs: number) => {
    const dayIdx = Math.floor(startAbs / DAY_MINUTES)
    const dateStr = dayIdx === 0 ? date : shiftDate(date, dayIdx)
    onSlotClick(room, startAbs - dayIdx * DAY_MINUTES, endAbs - dayIdx * DAY_MINUTES, dateStr)
  }

  // Blokning oyna ichidagi joylashuvi; butunlay tashqarida bo'lsa — null.
  // `endOverride` — surish paytidagi vaqtinchalik tugash vaqti: blok
  // sichqoncha ortidan darhol cho'ziladi, so'rov esa qo'yib yuborilganda
  // ketadi.
  const blockPosition = (iv: Interval, endOverride?: number) => {
    const end = endOverride ?? iv.end
    const safeEnd = Math.max(end, iv.start + 15)
    if (safeEnd <= winStart || iv.start >= winEnd) return null
    const left = pct(Math.max(iv.start, winStart))
    const right = pct(Math.min(safeEnd, winEnd))
    return {
      left,
      width: right - left,
      label: `${minToTime(iv.start)} - ${minToTime(end)}`,
    }
  }

  // --- Bronni surib cho'zish (o'ng chetdagi dastak) ---
  //
  // Chegara — shu xonadagi keyingi bron; u bo'lmasa lentaning oxiri.
  // Bu yerdagi hisob faqat ko'rsatish uchun: haqiqiy ruxsatni server
  // beradi va u ham AYNAN shu qoidaga amal qiladi.
  const extendLimitFor = (iv: Interval): number => {
    const others = blockingOf(iv.res.room_id).filter((b) => b.res.id !== iv.res.id)
    return extendCeiling(nextBusyStart(others, iv.end), {
      turnover: TURNOVER_MIN,
      hourly: !iv.daily,
      ceiling: winEnd,
    })
  }

  // Soatlik taxtada faqat SOATLIK bron cho'ziladi: kunlik bron kun
  // aniqligida o'lchanadi va uni Kalendar tabida kunlar bo'ylab surish
  // ancha aniqroq chiqadi.
  const canExtendInterval = (iv: Interval): boolean =>
    canExtend &&
    !!onExtend &&
    !iv.daily &&
    isExtendable(iv.res.status) &&
    canExtendTo(iv.end, extendLimitFor(iv), EXTEND_STEP_MIN)

  const [extendDrag, setExtendDrag] = useState<{
    resId: string
    end: number
  } | null>(null)
  // Surish holati refda: window hodisalari eski qiymatni ko'rmasligi uchun
  const extendRef = useRef<{
    iv: Interval
    startX: number
    limit: number
    end: number
  } | null>(null)

  const beginExtend = (e: React.MouseEvent, iv: Interval) => {
    if (e.button !== 0) return
    // Lentani surish (pan) va bronni bosish ishga tushmasligi kerak
    e.preventDefault()
    e.stopPropagation()
    extendRef.current = {
      iv,
      startX: e.clientX,
      limit: extendLimitFor(iv),
      end: iv.end,
    }
    setExtendDrag({ resId: iv.res.id, end: iv.end })
  }

  useEffect(() => {
    if (!extendDrag) return

    const onMove = (e: MouseEvent) => {
      const st = extendRef.current
      if (!st) return
      const deltaMin = ((e.clientX - st.startX) / hourW) * 60
      const next = extendTarget(st.iv.end, deltaMin, st.limit, EXTEND_STEP_MIN)
      if (next !== st.end) {
        st.end = next
        setExtendDrag({ resId: st.iv.res.id, end: next })
      }
    }

    const onUp = () => {
      const st = extendRef.current
      extendRef.current = null
      setExtendDrag(null)
      if (!st || st.end <= st.iv.end) return
      // Dastakdan keyingi click bronni ochib yubormasin
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 50)
      const dayIdx = Math.floor(st.end / DAY_MINUTES)
      const dateStr = dayIdx === 0 ? date : shiftDate(date, dayIdx)
      onExtend?.(st.iv.res, `${dateStr}T${minToTime(st.end)}:00`)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extendDrag?.resId, hourW])

  // Bosilgan soatdan keyingi bo'sh oraliq (maks. 2 soat).
  // O'tgan vaqtga bron qilinmaydi: to'liq o'tib ketgan soatlar umuman
  // bosilmaydi, joriy soat esa hozirgi vaqtdan boshlanadi.
  const freeSlotAt = (roomId: string, hour: number): [number, number] | null => {
    if (isPastDate) return null // o'tgan sanaga bron qilinmaydi
    const hourStart = hour * 60
    if (isToday && hourStart + 60 <= nowMin) return null // soat allaqachon o'tgan
    let start = isToday ? Math.max(hourStart, Math.floor(nowMin / 15) * 15) : hourStart
    // Bosilgan nuqta band bo'lsa — boshlanishni bron tugashi + tanaffusga
    // surib qo'yamiz: 10:00-11:40 bron bo'lsa, 11 soati bosilganda 11:55
    // taklif qilinadi. Ro'yxat saralangan, shuning uchun ketma-ket bronlar
    // zanjiri ham bitta o'tishda hisobga olinadi.
    for (const b of blockingOf(roomId)) {
      if (b.start <= start && start < availEnd(b)) start = availEnd(b)
    }
    // Surilgan boshlanish bosilgan soat katagidan chiqib ketsa — katak to'liq band
    if (start >= hourStart + 60) return null
    const free = freeMinutesFrom(roomId, start)
    if (free <= 0) return null
    return [start, start + Math.min(120, free)]
  }

  // Tez bron: hozirgi vaqtdan boshlab N soat
  const quickBook = (room: any, hours: number) => {
    const start = quickStartFor(room.id)
    const free = freeMinutesFrom(room.id, start)
    if (free <= 0) return
    emitSlot(room, start, start + Math.min(hours * 60, free))
  }

  const visibleGroups = onlyFree
    ? roomGroups
        .map((g) => ({ ...g, rooms: g.rooms.filter((r: any) => isFreeNow(r.id)) }))
        .filter((g) => g.rooms.length > 0)
    : roomGroups

  const totalRooms = roomGroups.reduce((n, g) => n + g.rooms.length, 0)
  const freeNowCount = roomGroups.reduce(
    (n, g) => n + g.rooms.filter((r: any) => isFreeNow(r.id)).length,
    0
  )
  // Oyna ertangi kunga o'tadimi (sarlavhada ko'rsatish uchun)
  const crossesMidnight = renderEndHour > 24

  return (
    /* flex-1 min-h-0: ota flex ustunida QOLGAN joyni egallaydi. h-full bo'lsa
       otaning 100% balandligini olib, tepadagi tab paneli hisobiga pastdan
       tashqariga chiqib ketardi — oxirgi xona ko'rinmay qolardi */
    <div className="flex flex-col flex-1 min-h-0">
      {/* Kun tanlash va tezkor holat paneli */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-2.5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          {/* Sana navigatsiyasi — bitta ixcham segment */}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button
              className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-50"
              onClick={() => onDateChange(shiftDate(date, -1))}
              title="Oldingi kun"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              className="h-9 border-x border-gray-200 px-3 text-sm font-semibold text-gray-900 focus:outline-none"
            />
            <button
              className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-50"
              onClick={() => onDateChange(shiftDate(date, 1))}
              title="Keyingi kun"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            className={cn(
              "h-8 px-3 rounded-md text-sm font-medium transition-colors",
              isToday ? "bg-primary-50 text-primary-700" : "text-gray-500 hover:bg-gray-50"
            )}
            onClick={() => onDateChange(today)}
          >
            Bugun
          </button>
          {crossesMidnight && (
            <span className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1">
              Ertangi kun soatlari ham ko'rsatilgan
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isToday && (
            <>
              <div className="text-sm text-gray-600">
                Hozir bo'sh: <span className="font-bold text-emerald-600">{freeNowCount}</span>
                <span className="text-gray-400"> / {totalRooms}</span>
              </div>
              {/* Lentani soatlar bo'ylab surish — istalgan o'tgan/kelgusi
                  soatni ko'rish mumkin (sichqoncha bilan surish ham ishlaydi) */}
              <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => scrollByHours(-3)}
                  className="h-8 px-2 text-gray-500 hover:bg-gray-50"
                  title="Oldingi soatlarni ko'rish"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToNow("smooth")}
                  className="h-8 px-2 text-[11px] font-medium text-primary-700 hover:bg-primary-50"
                  title="Hozirgi vaqtga qaytish"
                >
                  Hozir
                </button>
                <button
                  type="button"
                  onClick={() => scrollByHours(3)}
                  className="h-8 px-2 text-gray-500 hover:bg-gray-50"
                  title="Keyingi soatlarni ko'rish"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setFullDay((v) => !v)}
                className="h-8 px-3 rounded-md text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                title={
                  fullDay
                    ? "Joriy vaqt atrofidagi soatlarni ko'rsatish"
                    : "Butun kunni (00:00-24:00) ko'rsatish"
                }
              >
                {fullDay ? "Hozirgi vaqt" : "Butun kun"}
              </button>
              <button
                type="button"
                onClick={() => setOnlyFree((v) => !v)}
                className={cn(
                  "h-8 px-3 rounded-md text-xs font-medium border transition-colors",
                  onlyFree
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                )}
              >
                {onlyFree ? "Barcha xonalar" : "Faqat bo'sh xonalar"}
              </button>
            </>
          )}
          {!isToday && (
            <span className="text-xs text-gray-400">
              {isPastDate
                ? "O'tgan sana — bron qilib bo'lmaydi, faqat ko'rish"
                : "Tez bron faqat bugungi kun uchun ishlaydi"}
            </span>
          )}
        </div>
      </div>

      {/* Soat sarlavhalari + xonalar — gorizontal aylantiriladigan lenta */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-gray-50 select-none"
        onMouseDown={onPanDown}
        onMouseMove={onPanMove}
        onMouseUp={onPanEnd}
        onMouseLeave={onPanEnd}
        onClickCapture={(e) => {
          // Pan (surish) dan keyingi tasodifiy click bosilgan elementga o'tmaydi
          if (suppressClick.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <div style={{ width: ROOM_COL_WIDTH + timelineWidth }}>
          {/* Sarlavha qatori */}
          <div className="sticky top-0 z-20 flex bg-white border-b border-gray-200 shadow-sm">
            <div className="sticky left-0 z-30 flex-shrink-0 w-56 h-10 flex items-center px-4 bg-gray-50 border-r border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Xonalar
              </span>
            </div>
            <div className="flex">
              {visibleHours.map((h) => {
                const nextDay = h >= 24
                const isNowHour = isToday && Math.floor(nowMin / 60) === h
                return (
                  <div
                    key={h}
                    style={{ width: hourW }}
                    className={cn(
                      "flex-shrink-0 h-10 flex items-center justify-center gap-1 border-r border-gray-100",
                      nextDay && "bg-indigo-50/60",
                      isNowHour && "bg-red-50"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        isNowHour
                          ? "text-red-600 font-bold"
                          : nextDay
                            ? "text-indigo-500"
                            : "text-gray-400"
                      )}
                    >
                      {String(h % 24).padStart(2, "0")}
                    </span>
                    {nextDay && (
                      <span className="text-[9px] font-bold text-indigo-400">+1</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Xona qatorlari — qavatlar bo'yicha guruhlangan */}
          {visibleGroups.map((group) => {
            const collapsed = collapsedFloors.has(group.key)
            return (
              <div key={group.key}>
                {/* Qavat sarlavhasi — bosilsa qavat yig'iladi/ochiladi */}
                <div
                  className="flex bg-gray-100 border-y border-gray-200 cursor-pointer hover:bg-gray-200/70 transition-colors"
                  onClick={() => onToggleFloor(group.key)}
                  title={collapsed ? "Qavatni ochish" : "Qavatni yig'ish"}
                >
                  <div className="sticky left-0 z-10 flex-shrink-0 w-56 flex items-center gap-2 px-4 h-8 bg-gray-100 border-r border-gray-200">
                    {collapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                    )}
                    <Layers className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider truncate">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-gray-400">({group.rooms.length})</span>
                  </div>
                  <div className="flex-1 h-8" />
                </div>

                {!collapsed &&
                  group.rooms.map((room: any) => {
                    const intervals = busyOf(room.id)
                    const freeNow = isFreeNow(room.id)
                    const freeMin = freeNow ? freeMinutesFrom(room.id, quickStartFor(room.id)) : 0
                    return (
                      <div
                        key={room.id}
                        className="flex border-b border-gray-100 bg-white hover:bg-gray-50/40 transition-colors"
                        style={{ height: 64 }}
                      >
                        {/* Xona katagi bosilsa — hozirgi vaqtdan 1 soatlik
                            yangi bandlov ochiladi (avvalgi "1 soat" tugmasi kabi) */}
                        <div
                          className={cn(
                            "sticky left-0 z-10 flex-shrink-0 w-56 flex flex-col justify-center px-4 border-r border-gray-200 border-l-4 gap-1",
                            roomCellAccent[room.current_status] ||
                              "bg-white border-l-transparent",
                            isToday && freeNow && canCreate && freeMin > 0 &&
                              "cursor-pointer hover:bg-primary-50 transition-colors"
                          )}
                          onClick={
                            isToday && freeNow && canCreate && freeMin > 0
                              ? () => quickBook(room, 1)
                              : undefined
                          }
                          title={
                            isToday && freeNow && canCreate && freeMin > 0
                              ? `${minToTime(quickStartFor(room.id))} dan 1 soatlik bron qilish`
                              : undefined
                          }
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-gray-900">
                              {room.room_number}
                            </span>
                            {isToday &&
                              (freeNow ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  Bo'sh
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                  Band
                                </span>
                              ))}
                            {/* Xonaning maxsus holati (tozalanmoqda/ta'mirda/...) */}
                            {ROOM_STATUS_LABELS[room.current_status] && (
                              <span
                                className={cn(
                                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                                  roomStatusBadge[room.current_status]
                                )}
                              >
                                {ROOM_STATUS_LABELS[room.current_status]}
                              </span>
                            )}
                            {/* Faol xo'jalik vazifasi (holat belgisi bo'lmasa) */}
                            {!ROOM_STATUS_LABELS[room.current_status] &&
                              activeTaskTypeByRoom[room.id] && (
                                <span
                                  title="Xonaga xo'jalik vazifasi biriktirilgan"
                                  className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                                    taskTypeBadge[activeTaskTypeByRoom[room.id]]
                                  )}
                                >
                                  {TASK_TYPE_LABELS[activeTaskTypeByRoom[room.id]] ||
                                    activeTaskTypeByRoom[room.id]}
                                </span>
                              )}
                            {/* Qachondan beri shu holatda. Lentada joy tor —
                                ixcham ko'rinish, to'liq matni tooltipda. */}
                            {statusDetailByRoom[room.id] && (
                              <RoomStatusNote
                                detail={statusDetailByRoom[room.id]!}
                                compact
                              />
                            )}
                          </div>

                          <span className="text-[11px] text-gray-400 truncate">
                            {room.room_type?.name || "Standard"}
                            {getRoomPrice(room) > 0 &&
                              ` · ${getRoomPrice(room).toLocaleString()} So'm`}
                          </span>
                        </div>

                        <div className="relative flex-shrink-0" style={{ width: timelineWidth }}>
                          {/* Soat kataklari (bo'sh joy — bosish mumkin) */}
                          <div className="flex h-full">
                            {visibleHours.map((h) => {
                              const slot = freeSlotAt(room.id, h)
                              /* Ta'mir/tekshiruv/xizmatdan tashqari xonada
                                 yangi bron boshlanmaydi — bo'sh soat ko'rinsa
                                 ham. Tozalanayotgan xona bosiladi: dialog
                                 sanaga qarab qaror qiladi. */
                              const roomBlocked = isBlockedAlways(
                                room.current_status
                              )
                              const clickable = canCreate && !!slot && !roomBlocked
                              const isPast = isToday && h < Math.floor(nowMin / 60)
                              const nextDay = h >= 24
                              return (
                                <div
                                  key={h}
                                  style={{ width: hourW }}
                                  className={cn(
                                    "flex-shrink-0 border-r border-gray-50 h-full group",
                                    isPast && "bg-gray-50/60",
                                    nextDay && "bg-indigo-50/30",
                                    clickable && "cursor-pointer hover:bg-primary-50"
                                  )}
                                  onClick={() => {
                                    if (clickable && slot) emitSlot(room, slot[0], slot[1])
                                  }}
                                  title={
                                    clickable && slot
                                      ? `${minToTime(slot[0])}${nextDay ? " (ertangi kun)" : ""} dan bron qilish`
                                      : undefined
                                  }
                                >
                                  {clickable && slot && (
                                    <div className="h-full w-full flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Plus className="h-3 w-3 text-primary-500" />
                                      {/* Aniq taklif vaqti — band brondan keyin
                                          surilgan boshlanish darhol ko'rinadi */}
                                      <span className="text-[10px] font-semibold text-primary-600">
                                        {minToTime(slot[0])}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Bronlar (kunlik va soatlik) */}
                          {intervals.map((iv, i) => {
                            const dragging = extendDrag?.resId === iv.res.id
                            const pos = blockPosition(
                              iv,
                              dragging ? extendDrag.end : undefined
                            )
                            if (!pos) return null
                            // Juda tor blokda dastak butun blokni egallab
                            // olardi va bronni bosib bo'lmay qolardi
                            const wideEnough =
                              (pos.width / 100) * timelineWidth >= 28
                            const extendable = wideEnough && canExtendInterval(iv)
                            return (
                              <div
                                key={`${iv.res.id}-${i}`}
                                className={cn(
                                  "absolute top-2 bottom-2 rounded-lg flex flex-col justify-center px-2 cursor-pointer overflow-hidden hover:brightness-95 transition-all",
                                  statusColors[iv.res.status] || statusColors.PENDING,
                                  // Qarz bo'lsa qizil: chiqib ketgan va
                                  // to'lamagan bron butunlay qizil bo'ladi
                                  DEBT_BAR_CLASS[debtLevelOf(iv.res)],
                                  // Surish paytida blok ajralib turadi va
                                  // kengayish animatsiyasiz, darhol chiziladi
                                  dragging && "ring-2 ring-primary-400 z-20 transition-none"
                                )}
                                style={{ left: `${pos.left}%`, width: `${pos.width}%` }}
                                onClick={() => {
                                  if (suppressClick.current) return
                                  onReservationClick(iv.res)
                                }}
                                title={`${getGuestName(iv.res)} · ${
                                  iv.daily ? "Kunlik bron" : pos.label
                                }${debtHint(iv.res)}${
                                  extendable ? " · o'ng chetidan tortib cho'zing" : ""
                                }`}
                              >
                                <span className="text-[11px] font-bold leading-tight truncate">
                                  {iv.daily ? "Kunlik bron" : pos.label}
                                </span>
                                <span className="text-[10px] opacity-80 leading-tight truncate">
                                  {dragging
                                    ? `→ ${minToTime(extendDrag.end)}`
                                    : getGuestName(iv.res)}
                                </span>

                                {/* Cho'zish dastagi — faqat administratorda.
                                    Blok ichida, o'ng chetida turadi va uni
                                    bosish bronni ochmaydi. */}
                                {extendable && (
                                  <span
                                    role="separator"
                                    aria-label="Bronni cho'zish"
                                    onMouseDown={(e) => beginExtend(e, iv)}
                                    className={cn(
                                      "absolute inset-y-0 right-0 w-2.5 cursor-col-resize",
                                      "flex items-center justify-center",
                                      "bg-black/10 hover:bg-black/25",
                                      dragging && "bg-black/30"
                                    )}
                                  >
                                    <span className="h-4 w-0.5 rounded-full bg-white/80" />
                                  </span>
                                )}
                              </div>
                            )
                          })}

                          {/* Joriy vaqt chizig'i (ko'rinadigan oyna ichida bo'lsa) */}
                          {isToday && nowMin >= winStart && nowMin <= winEnd && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                              style={{ left: `${pct(nowMin)}%` }}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )
          })}

          {visibleGroups.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400">
              {onlyFree ? "Hozir bo'sh xona yo'q" : "Xonalar topilmadi"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
