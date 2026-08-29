import { useEffect, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  RotateCcw,
  GripVertical,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  MAIN_NAV_LINKS,
  MANAGEMENT_NAV_LINKS,
  type NavLink,
} from "@/components/layout/navLinks"
import { useNavOrder, useSaveNavOrder, applyNavOrder } from "../api/navOrder"

/* Yon menyu tartibi — administrator uchun.

   Tartib mehmonxonaga tegishli, brauzerga emas: saqlangach uni o'sha
   mehmonxonaning BARCHA xodimlari ko'radi.

   Bu yerda sahifalarning to'liq ro'yxati turadi, xodim esa faqat o'ziga
   ruxsat berilganini ko'radi — tartib ularning ichki ketma-ketligini
   belgilaydi, ko'rinishini emas. Ikki guruh alohida tartiblanadi, chunki
   menyuda "Administratsiya" sarlavhasi ular orasini ajratib turadi. */

const Group = ({
  title,
  items,
  onMove,
  onReorder,
}: {
  title: string
  items: NavLink[]
  onMove: (index: number, direction: -1 | 1) => void
  onReorder: (from: number, to: number) => void
}) => {
  /* Sudrash holati SHU guruhga tegishli — shuning uchun bandni bir
     guruhdan ikkinchisiga sudrab bo'lmaydi. Menyuda guruhlar orasida
     "Administratsiya" sarlavhasi turadi, ya'ni bunday ko'chirishning
     ma'nosi ham yo'q. */
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const handleDragOver = (event: React.DragEvent, index: number) => {
    // preventDefault bo'lmasa brauzer tashlashga ruxsat bermaydi
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setOverIndex(index)
    if (dragIndex === null || dragIndex === index) return
    // Jonli ko'chirish: band kursor ostidagi joyga darhol o'tadi
    onReorder(dragIndex, index)
    setDragIndex(index)
  }

  const endDrag = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
  <div>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
      {title}
    </p>
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
      {items.map((link, index) => (
        <li
          key={link.href}
          draggable
          onDragStart={(event) => {
            setDragIndex(index)
            event.dataTransfer.effectAllowed = "move"
            // Firefox sudrashni faqat ma'lumot berilgandagina boshlaydi
            event.dataTransfer.setData("text/plain", link.href)
          }}
          onDragOver={(event) => handleDragOver(event, index)}
          onDrop={(event) => {
            event.preventDefault()
            endDrag()
          }}
          onDragEnd={endDrag}
          title="Ushlab surib joyini o'zgartiring"
          className={cn(
            "flex cursor-grab items-center gap-3 bg-white px-3 py-2 transition-colors active:cursor-grabbing",
            dragIndex === index
              ? "opacity-50 ring-2 ring-inset ring-primary-300"
              : overIndex === index && dragIndex !== null
                ? "bg-primary-50/60"
                : "hover:bg-gray-50"
          )}
        >
          <GripVertical size={15} className="flex-shrink-0 text-gray-300" aria-hidden />
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <link.icon size={15} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
            {link.name}
          </span>
          <span className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              title="Yuqoriga"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors",
                index === 0
                  ? "cursor-not-allowed opacity-30"
                  : "hover:bg-primary-50 hover:text-primary-700"
              )}
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, 1)}
              disabled={index === items.length - 1}
              title="Pastga"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors",
                index === items.length - 1
                  ? "cursor-not-allowed opacity-30"
                  : "hover:bg-primary-50 hover:text-primary-700"
              )}
            >
              <ChevronDown size={16} />
            </button>
          </span>
        </li>
      ))}
    </ul>
  </div>
  )
}

export const NavOrderCard = () => {
  const { data: navOrder } = useNavOrder()
  const saveMutation = useSaveNavOrder()
  const [main, setMain] = useState<NavLink[]>(MAIN_NAV_LINKS)
  const [admin, setAdmin] = useState<NavLink[]>(MANAGEMENT_NAV_LINKS)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Admin ro'yxatni qo'lda o'zgartirgan bo'lsa, fonda kelgan javob uni
  // bosib ketmasligi kerak — aks holda oyna qayta faollashganda tartiblash
  // ishi yo'qoladi
  const dirtyRef = useRef(false)

  // Serverdagi tartib kelgach ro'yxatlar shunga keltiriladi. Saqlangan
  // tartibda yo'q sahifa yo'qolmaydi — o'z guruhi oxirida qoladi.
  useEffect(() => {
    if (!navOrder || dirtyRef.current) return
    setMain(applyNavOrder(MAIN_NAV_LINKS, navOrder.order))
    setAdmin(applyNavOrder(MANAGEMENT_NAV_LINKS, navOrder.order))
  }, [navOrder])

  const move = (
    list: NavLink[],
    setList: (v: NavLink[]) => void,
    index: number,
    direction: -1 | 1
  ) => {
    const target = index + direction
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[index], next[target]] = [next[target], next[index]]
    dirtyRef.current = true
    setList(next)
    setSaved(false)
  }

  /* Sudrab ko'chirish: band `from` dan olinib `to` ga qo'yiladi va
     oradagilar suriladi — o'q tugmalaridagi kabi joy almashish emas. */
  const reorder = (
    list: NavLink[],
    setList: (v: NavLink[]) => void,
    from: number,
    to: number
  ) => {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
      return
    }
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    dirtyRef.current = true
    setList(next)
    setSaved(false)
  }

  const resetOrder = () => {
    // Standart tartibga qaytarish ham o'zgarish — saqlanmaguncha turadi
    dirtyRef.current = true
    setMain(MAIN_NAV_LINKS)
    setAdmin(MANAGEMENT_NAV_LINKS)
    setSaved(false)
  }

  const onSave = async () => {
    setError(null)
    setSaved(false)
    try {
      // Ikkala guruh bitta ro'yxatga qo'shiladi: menyu har bir guruhni
      // shu umumiy tartibga qarab saralaydi
      await saveMutation.mutateAsync([...main, ...admin].map((l) => l.href))
      dirtyRef.current = false
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Group
          title="Asosiy sahifalar"
          items={main}
          onMove={(i, d) => move(main, setMain, i, d)}
          onReorder={(from, to) => reorder(main, setMain, from, to)}
        />
        <Group
          title="Administratsiya"
          items={admin}
          onMove={(i, d) => move(admin, setAdmin, i, d)}
          onReorder={(from, to) => reorder(admin, setAdmin, from, to)}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        Bandni sichqoncha bilan ushlab surib joyini o'zgartiring — yoki
        yonidagi o'q tugmalaridan foydalaning. Xodim faqat o'ziga ruxsat
        berilgan sahifalarni ko'radi, tartib esa hamma uchun bir xil bo'ladi.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <Button
          onClick={onSave}
          disabled={saveMutation.isPending}
          className="min-w-[120px]"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Saqlash
        </Button>
        <Button type="button" variant="outline" onClick={resetOrder} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Standart tartib
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Saqlandi
          </span>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </>
  )
}
