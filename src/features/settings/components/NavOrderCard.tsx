import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, RotateCcw } from "lucide-react"
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
}: {
  title: string
  items: NavLink[]
  onMove: (index: number, direction: -1 | 1) => void
}) => (
  <div>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
      {title}
    </p>
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
      {items.map((link, index) => (
        <li
          key={link.href}
          className="flex items-center gap-3 bg-white px-3 py-2 transition-colors hover:bg-gray-50"
        >
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

export const NavOrderCard = () => {
  const { data: navOrder } = useNavOrder()
  const saveMutation = useSaveNavOrder()
  const [main, setMain] = useState<NavLink[]>(MAIN_NAV_LINKS)
  const [admin, setAdmin] = useState<NavLink[]>(MANAGEMENT_NAV_LINKS)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Serverdagi tartib kelgach ro'yxatlar shunga keltiriladi. Saqlangan
  // tartibda yo'q sahifa yo'qolmaydi — o'z guruhi oxirida qoladi.
  useEffect(() => {
    if (!navOrder) return
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
    setList(next)
    setSaved(false)
  }

  const resetOrder = () => {
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
        />
        <Group
          title="Administratsiya"
          items={admin}
          onMove={(i, d) => move(admin, setAdmin, i, d)}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        Xodim faqat o'ziga ruxsat berilgan sahifalarni ko'radi — tartib esa
        hamma uchun bir xil bo'ladi.
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
