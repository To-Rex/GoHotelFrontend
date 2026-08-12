import { useMemo, useState } from "react"
import { format, subDays } from "date-fns"
import {
  Store,
  Search,
  Plus,
  Minus,
  Trash2,
  Pencil,
  ShoppingCart,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  CheckCircle2,
  PackageOpen,
  PackagePlus,
  Receipt,
  BedDouble,
  Loader2,
  Layers,
  Printer,
  Settings2,
  RefreshCw,
  X,
} from "lucide-react"
import {
  useShopProducts,
  useShopSales,
  useCreateShopProduct,
  useUpdateShopProduct,
  useDeleteShopProduct,
  useAddShopBatch,
  useCreateShopSale,
  usePayShopSale,
  useCancelShopSale,
  type ShopProduct,
  type ShopSale,
} from "../api/shop"
import { useReservations } from "@/features/reservations/api/reservations"
import { useGuests } from "@/features/guests/api/guests"
import { useRooms } from "@/features/rooms/api/rooms"
import type { Reservation } from "@/types/api"
import { usePermissions } from "@/lib/permissions"
import { apiErrorMessage } from "@/lib/apiError"
import { useAuthStore } from "@/store/auth"
import {
  DEFAULT_TPRINTS_URL,
  getAutoPrint,
  getPrinterUrl,
  setPrinterUrl as savePrinterUrl,
  setAutoPrint,
  pingPrinter,
  printTest,
  printShopReceipt,
} from "@/lib/tprints"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const CATEGORIES = ["Ichimliklar", "Shirinliklar", "Gazaklar", "Boshqa"]

const EMOJI_SUGGESTIONS = ["🥤", "💧", "☕", "🧃", "🍫", "🍬", "🍪", "🍩", "🍟", "🥜", "🍿", "🧴"]

const PAYMENT_METHODS = [
  { key: "CASH", label: "Naqd", icon: Banknote },
  { key: "CARD", label: "Karta", icon: CreditCard },
  { key: "TRANSFER", label: "O'tkazma", icon: ArrowRightLeft },
]

const METHOD_LABELS: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

interface CartLine {
  productId: string
  qty: number
}

/* Savat summasi FIFO bo'yicha aniq hisoblanadi: server bilan bir xil —
   eng eski partiyadan boshlab, har partiya o'z narxida */
function fifoTotal(p: ShopProduct, qty: number): number {
  let left = qty
  let sum = 0
  for (const b of p.batches) {
    if (left <= 0) break
    if (b.remaining <= 0) continue
    const take = Math.min(b.remaining, left)
    sum += take * Number(b.sale_price)
    left -= take
  }
  return sum
}

export const ShopPage = () => {
  const { isAdmin, can } = usePermissions()
  const canManage =
    isAdmin || can("service.manage", "service.create", "service.update", "hotel_service.manage")

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState(todayStr)

  const { data: products = [], isLoading: productsLoading } = useShopProducts(canManage)
  const { data: sales = [], isLoading: salesLoading } = useShopSales(dateFrom, dateTo)
  const { data: reservations = [] } = useReservations()
  const { data: guests = [] } = useGuests()
  const { data: rooms = [] } = useRooms()

  const createProduct = useCreateShopProduct()
  const updateProduct = useUpdateShopProduct()
  const deleteProduct = useDeleteShopProduct()
  const addBatch = useAddShopBatch()
  const createSale = useCreateShopSale()
  const paySale = usePayShopSale()
  const cancelSale = useCancelShopSale()

  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Barchasi")
  const [cart, setCart] = useState<CartLine[]>([])
  const [saleMode, setSaleMode] = useState<"DIRECT" | "RESERVATION">("DIRECT")
  const [method, setMethod] = useState("CASH")
  const [reservationId, setReservationId] = useState("")
  const [sellError, setSellError] = useState<string | null>(null)
  const [soldBanner, setSoldBanner] = useState<string | null>(null)

  // Faol bronlar — bronga yozish uchun (xona raqami + mehmon ismi bilan)
  const activeReservations = useMemo(() => {
    const roomNo = (id: string) => (rooms as any[]).find((r) => r.id === id)?.room_number ?? "?"
    const guestName = (id: string) => {
      const g = (guests as any[]).find((x) => x.id === id)
      return g ? `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() : ""
    }
    return (reservations as Reservation[])
      .filter((r) => r.status === "CONFIRMED" || r.status === "CHECKED_IN")
      .map((r) => ({
        id: r.id,
        label: `${roomNo(r.room_id)}-xona — ${guestName(r.guest_id) || r.reservation_number}`,
        room: roomNo(r.room_id),
      }))
      .sort((a, b) => String(a.room).localeCompare(String(b.room), undefined, { numeric: true }))
  }, [reservations, rooms, guests])

  const productById = (id: string) => (products as ShopProduct[]).find((p) => p.id === id)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (products as ShopProduct[]).filter((p) => {
      if (category !== "Barchasi" && p.category !== category) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, search, category])

  const inCart = (id: string) => cart.find((i) => i.productId === id)?.qty ?? 0
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cart.reduce((s, i) => {
    const p = productById(i.productId)
    return p ? s + fifoTotal(p, i.qty) : s
  }, 0)

  const addToCart = (p: ShopProduct) => {
    if (!p.is_active || inCart(p.id) >= p.stock) return
    setSellError(null)
    setCart((prev) => {
      const ex = prev.find((i) => i.productId === p.id)
      if (ex) return prev.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { productId: p.id, qty: 1 }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i
          const max = productById(productId)?.stock ?? 0
          return { ...i, qty: Math.min(Math.max(i.qty + delta, 0), max) }
        })
        .filter((i) => i.qty > 0)
    )
  }

  const sell = async () => {
    if (!cart.length || createSale.isPending) return
    setSellError(null)
    try {
      const sale = await createSale.mutateAsync({
        items: cart.map((i) => ({ product_id: i.productId, quantity: i.qty })),
        payment_method: saleMode === "DIRECT" ? method : null,
        reservation_id: saleMode === "RESERVATION" ? reservationId || null : null,
      })
      setCart([])
      setSoldBanner(
        sale.status === "PAID"
          ? `${fmt(sale.total_amount)} So'm — sotuv qayd etildi`
          : `${fmt(sale.total_amount)} So'm — bron hisobiga yozildi`
      )
      window.setTimeout(() => setSoldBanner(null), 3500)
      // Chek yoqilgan bo'lsa avtomatik chiqariladi (kutmasdan, fonda)
      if (receiptOn) void doPrintReceipt(sale)
    } catch (e) {
      setSellError(apiErrorMessage(e))
    }
  }

  const sellDisabled =
    !cart.length ||
    createSale.isPending ||
    (saleMode === "RESERVATION" && !reservationId)

  // ---- Statistika (tanlangan davr) ----
  const paidSales = (sales as ShopSale[]).filter((s) => s.status === "PAID")
  const pendingSales = (sales as ShopSale[]).filter((s) => s.status === "PENDING")
  const paidRevenue = paidSales.reduce((s, x) => s + Number(x.total_amount), 0)
  const pendingRevenue = pendingSales.reduce((s, x) => s + Number(x.total_amount), 0)
  const itemsSold = (sales as ShopSale[]).reduce(
    (s, x) => s + x.items.reduce((a, i) => a + i.quantity, 0),
    0
  )

  const presets = [
    { key: "today", label: "Bugun", from: todayStr, to: todayStr },
    { key: "week", label: "7 kun", from: format(subDays(new Date(), 6), "yyyy-MM-dd"), to: todayStr },
    { key: "month", label: "30 kun", from: format(subDays(new Date(), 29), "yyyy-MM-dd"), to: todayStr },
  ]

  // ---- Mahsulot dialogi ----
  const [productModal, setProductModal] = useState(false)
  const [editing, setEditing] = useState<ShopProduct | null>(null)
  const [pName, setPName] = useState("")
  const [pCategory, setPCategory] = useState(CATEGORIES[0])
  const [pEmoji, setPEmoji] = useState(EMOJI_SUGGESTIONS[0])
  const [pActive, setPActive] = useState(true)
  const [pError, setPError] = useState<string | null>(null)

  const openCreateProduct = () => {
    setEditing(null)
    setPName("")
    setPCategory(CATEGORIES[0])
    setPEmoji(EMOJI_SUGGESTIONS[0])
    setPActive(true)
    setPError(null)
    setProductModal(true)
  }

  const openEditProduct = (p: ShopProduct) => {
    setEditing(p)
    setPName(p.name)
    setPCategory(p.category || CATEGORIES[CATEGORIES.length - 1])
    setPEmoji(p.emoji || EMOJI_SUGGESTIONS[0])
    setPActive(p.is_active)
    setPError(null)
    setProductModal(true)
  }

  const submitProduct = async () => {
    if (!pName.trim()) {
      setPError("Mahsulot nomini kiriting")
      return
    }
    try {
      if (editing) {
        await updateProduct.mutateAsync({
          id: editing.id,
          name: pName.trim(),
          category: pCategory,
          emoji: pEmoji,
          is_active: pActive,
        })
      } else {
        await createProduct.mutateAsync({
          name: pName.trim(),
          category: pCategory,
          emoji: pEmoji,
        })
      }
      setProductModal(false)
    } catch (e) {
      setPError(apiErrorMessage(e))
    }
  }

  const onDeleteProduct = async (p: ShopProduct) => {
    if (!confirm(`"${p.name}" mahsulotini o'chirasizmi?`)) return
    try {
      await deleteProduct.mutateAsync(p.id)
      setCart((prev) => prev.filter((i) => i.productId !== p.id))
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  // ---- Partiya dialogi ----
  const [batchModal, setBatchModal] = useState(false)
  const [batchProduct, setBatchProduct] = useState<ShopProduct | null>(null)
  const [bQty, setBQty] = useState("")
  const [bSalePrice, setBSalePrice] = useState("")
  const [bCostPrice, setBCostPrice] = useState("")
  const [bError, setBError] = useState<string | null>(null)

  const openBatch = (p: ShopProduct) => {
    setBatchProduct(p)
    setBQty("")
    // Oxirgi partiya narxini taklif qilamiz — ko'pincha o'zgarmaydi
    const lastBatch = p.batches[p.batches.length - 1]
    setBSalePrice(lastBatch ? String(lastBatch.sale_price) : "")
    setBCostPrice("")
    setBError(null)
    setBatchModal(true)
  }

  const submitBatch = async () => {
    if (!batchProduct) return
    const qty = parseInt(bQty, 10)
    const price = Number(bSalePrice)
    if (!qty || qty <= 0) {
      setBError("Miqdor 0 dan katta bo'lishi kerak")
      return
    }
    if (!price || price <= 0) {
      setBError("Sotish narxi 0 dan katta bo'lishi kerak")
      return
    }
    try {
      await addBatch.mutateAsync({
        productId: batchProduct.id,
        quantity: qty,
        sale_price: price,
        cost_price: Number(bCostPrice) > 0 ? Number(bCostPrice) : undefined,
      })
      setBatchModal(false)
    } catch (e) {
      setBError(apiErrorMessage(e))
    }
  }

  // ---- Sotuv tafsilotlari ----
  const [detailSale, setDetailSale] = useState<ShopSale | null>(null)
  const [detailModal, setDetailModal] = useState(false)

  const openDetail = (s: ShopSale) => {
    setDetailSale(s)
    setDetailModal(true)
  }

  // Mijoz ismi: serverdan keladi; kelmasa bron ro'yxatidan lokal topamiz
  const detailGuestName = useMemo(() => {
    if (!detailSale) return null
    if (detailSale.guest_name) return detailSale.guest_name
    if (!detailSale.reservation_id) return null
    const res = (reservations as Reservation[]).find(
      (r) => r.id === detailSale.reservation_id
    )
    if (!res) return null
    const g = (guests as any[]).find((x) => x.id === res.guest_id)
    return g ? `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() || null : null
  }, [detailSale, reservations, guests])

  // ---- PENDING sotuvni to'lash ----
  const [payModal, setPayModal] = useState(false)
  const [payTarget, setPayTarget] = useState<ShopSale | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  const openPay = (s: ShopSale) => {
    setPayTarget(s)
    setPayError(null)
    setPayModal(true)
  }

  const doPay = async (m: string) => {
    if (!payTarget) return
    try {
      const updated = await paySale.mutateAsync({ id: payTarget.id, payment_method: m })
      setPayModal(false)
      // To'lov cheki — chek rejimi yoqiq bo'lsa
      if (receiptOn && updated) void doPrintReceipt(updated)
    } catch (e) {
      setPayError(apiErrorMessage(e))
    }
  }

  const onCancelSale = async (s: ShopSale) => {
    if (!confirm("Sotuv bekor qilinib, mahsulotlar omborga qaytarilsinmi?")) return
    try {
      await cancelSale.mutateAsync(s.id)
    } catch (e) {
      alert(apiErrorMessage(e))
    }
  }

  // ---- Chek printeri (TPrints, lokal print-server) ----
  const user = useAuthStore((s) => s.user)
  const [receiptOn, setReceiptOn] = useState(getAutoPrint)
  const [printerModal, setPrinterModal] = useState(false)
  const [printerUrl, setPrinterUrlInput] = useState(getPrinterUrl)
  const [printerTest, setPrinterTest] = useState<{ ok: boolean; msg: string } | null>(null)
  const [printerBusy, setPrinterBusy] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [printRetrySale, setPrintRetrySale] = useState<ShopSale | null>(null)
  const [detailPrinting, setDetailPrinting] = useState(false)

  const toggleReceipt = () =>
    setReceiptOn((v) => {
      setAutoPrint(!v)
      return !v
    })

  // Mijoz ismi (chek uchun): serverdan kelmasa bron ro'yxatidan topamiz
  const guestNameFor = (sale: ShopSale): string | null => {
    if (sale.guest_name) return sale.guest_name
    if (!sale.reservation_id) return null
    const res = (reservations as Reservation[]).find((r) => r.id === sale.reservation_id)
    if (!res) return null
    const g = (guests as any[]).find((x) => x.id === res.guest_id)
    return g ? `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() || null : null
  }

  // Chek chiqarish — xatoda sotuv jarayonini TO'XTATMAYDI (sotuv allaqachon
  // saqlangan), faqat ogohlantirish va qayta urinish imkonini ko'rsatadi
  const doPrintReceipt = async (sale: ShopSale) => {
    const r = await printShopReceipt(sale, user?.hotel_name || "GoHotel", guestNameFor(sale))
    if (!r.ok) {
      setPrintError(r.error || "Chek chiqmadi")
      setPrintRetrySale(sale)
    } else {
      setPrintError(null)
      setPrintRetrySale(null)
    }
    return r.ok
  }

  const checkPrinter = async () => {
    savePrinterUrl(printerUrl)
    setPrinterBusy(true)
    setPrinterTest(await pingPrinter())
    setPrinterBusy(false)
  }

  const sendTestPrint = async () => {
    savePrinterUrl(printerUrl)
    setPrinterBusy(true)
    const r = await printTest()
    setPrinterTest(
      r.ok
        ? { ok: true, msg: "Sinov chek yuborildi — printerni tekshiring" }
        : { ok: false, msg: r.error || "Xato" }
    )
    setPrinterBusy(false)
  }

  const savePrinter = () => {
    savePrinterUrl(printerUrl)
    setPrinterTest(null)
    setPrinterModal(false)
  }

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Do'kon</h1>
            <p className="text-sm text-muted-foreground">
              Sotuvlar FIFO partiyalar asosida — narx eng eski partiyadan olinadi
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openCreateProduct} className="gap-2">
            <Plus size={16} /> Mahsulot qo'shish
          </Button>
        )}
      </div>

      {/* Davr + ko'rsatkichlar */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => {
          const active = dateFrom === p.from && dateTo === p.to
          return (
            <button
              key={p.key}
              onClick={() => {
                setDateFrom(p.from)
                setDateTo(p.to)
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          )
        })}
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 w-[140px] text-sm"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 w-[140px] text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt size={15} /> Sotuvlar
          </div>
          <p className="mt-1 text-2xl font-bold">{(sales as ShopSale[]).length} ta</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingCart size={15} /> Sotilgan mahsulot
          </div>
          <p className="mt-1 text-2xl font-bold">{itemsSold} dona</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Banknote size={15} /> Tushum (to'langan)
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{fmt(paidRevenue)} So'm</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BedDouble size={15} /> Bronlarda (kutilmoqda)
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">{fmt(pendingRevenue)} So'm</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_370px]">
        {/* ---------- Katalog ---------- */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mahsulot qidirish..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["Barchasi", ...CATEGORIES].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center text-muted-foreground">
              <PackageOpen size={32} className="opacity-60" />
              <p className="text-sm">Mahsulot topilmadi</p>
              {canManage && (
                <Button variant="outline" size="sm" onClick={openCreateProduct} className="mt-1 gap-1.5">
                  <Plus size={14} /> Birinchi mahsulotni qo'shing
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => {
                const left = p.stock - inCart(p.id)
                const out = p.stock <= 0
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "group relative flex flex-col rounded-xl border border-border bg-card p-3.5 transition-all",
                      !p.is_active && "opacity-50",
                      out || !p.is_active
                        ? "opacity-55"
                        : "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    )}
                    onClick={() => addToCart(p)}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{p.emoji || "📦"}</span>
                      {inCart(p.id) > 0 && (
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                          {inCart(p.id)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {p.category || "—"}
                      {p.batches.filter((b) => b.remaining > 0).length > 1 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] text-primary"
                          title="Bir nechta partiya — narx FIFO bo'yicha"
                        >
                          <Layers size={11} />
                          {p.batches.filter((b) => b.remaining > 0).length}
                        </span>
                      )}
                    </p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-sm font-bold text-primary">
                        {p.current_price != null ? `${fmt(p.current_price)} So'm` : "Narx yo'q"}
                      </span>
                      {out ? (
                        <Badge variant="destructive" className="text-[10px]">Tugagan</Badge>
                      ) : (
                        <span
                          className={cn(
                            "text-[11px]",
                            left <= 3 ? "font-medium text-amber-600" : "text-muted-foreground"
                          )}
                        >
                          {left} dona
                        </span>
                      )}
                    </div>
                    {!p.is_active && (
                      <Badge variant="secondary" className="absolute left-2 top-2 text-[10px]">
                        Nofaol
                      </Badge>
                    )}
                    {canManage && (
                      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openBatch(p)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-emerald-600 shadow-sm ring-1 ring-border hover:bg-emerald-600 hover:text-white"
                          title="Partiya qo'shish (kirim)"
                        >
                          <PackagePlus size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditProduct(p)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border hover:text-foreground"
                          title="Tahrirlash"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteProduct(p)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-destructive shadow-sm ring-1 ring-border hover:bg-destructive hover:text-white"
                          title="O'chirish"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Sotuvlar jadvali */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Sotuvlar</h2>
              <span className="text-xs text-muted-foreground">
                {(sales as ShopSale[]).length} ta
              </span>
            </div>
            {salesLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (sales as ShopSale[]).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tanlangan davrda sotuv yo'q
              </p>
            ) : (
              <>
                {/* MOBIL: sotuvlar karta ko'rinishida (jadval planshet/desktopda) */}
                <div className="space-y-2.5 p-3 md:hidden">
                  {(sales as ShopSale[]).map((s) => (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      title="Batafsil ko'rish"
                      onClick={() => openDetail(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") openDetail(s)
                      }}
                      className="cursor-pointer rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-muted/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {s.created_at ? format(new Date(s.created_at), "dd.MM HH:mm") : "—"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {s.created_by_name || "—"}
                          </p>
                        </div>
                        {s.status === "PAID" ? (
                          <Badge variant="secondary" className="flex-shrink-0 text-[11px]">
                            {METHOD_LABELS[s.payment_method || ""] || s.payment_method}
                          </Badge>
                        ) : (
                          <Badge className="flex-shrink-0 bg-amber-100 text-[11px] text-amber-700 hover:bg-amber-100">
                            Bron: {s.reservation_number || "—"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm">
                        {s.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                        <span className="text-sm font-semibold">{fmt(s.total_amount)} So'm</span>
                        <div className="flex items-center gap-1">
                          {s.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                openPay(s)
                              }}
                            >
                              <Banknote size={13} /> To'lash
                            </Button>
                          )}
                          {canManage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onCancelSale(s)
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Bekor qilish (ombor qaytadi)"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
                <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vaqt</TableHead>
                      <TableHead>Mahsulotlar</TableHead>
                      <TableHead>Sotuvchi</TableHead>
                      <TableHead>To'lov</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead className="w-[1%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sales as ShopSale[]).map((s) => (
                      <TableRow
                        key={s.id}
                        onClick={() => openDetail(s)}
                        className="cursor-pointer"
                        title="Batafsil ko'rish"
                      >
                        <TableCell className="whitespace-nowrap text-sm">
                          {s.created_at ? format(new Date(s.created_at), "dd.MM HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="max-w-[300px] text-sm">
                          {s.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {s.created_by_name || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.status === "PAID" ? (
                            <Badge variant="secondary" className="text-[11px]">
                              {METHOD_LABELS[s.payment_method || ""] || s.payment_method}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-[11px] text-amber-700 hover:bg-amber-100">
                              Bron: {s.reservation_number || "—"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-semibold">
                          {fmt(s.total_amount)} So'm
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {s.status === "PENDING" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openPay(s)
                                }}
                              >
                                <Banknote size={13} /> To'lash
                              </Button>
                            )}
                            {canManage && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onCancelSale(s)
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="Bekor qilish (ombor qaytadi)"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---------- Savat ---------- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ShoppingCart size={16} /> Savat
                {cartCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  Tozalash
                </button>
              )}
            </div>

            {soldBanner && (
              <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={16} /> {soldBanner}
              </div>
            )}

            {/* Chek chiqmagan holat — sotuv saqlangan, faqat print xatosi */}
            {printError && (
              <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-700">
                <Printer size={14} className="flex-shrink-0" />
                <span className="min-w-0 flex-1 text-xs font-medium">{printError}</span>
                {printRetrySale && (
                  <button
                    onClick={() => void doPrintReceipt(printRetrySale)}
                    className="flex flex-shrink-0 items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-[11px] font-semibold hover:bg-amber-100"
                  >
                    <RefreshCw size={11} /> Qayta
                  </button>
                )}
                <button
                  onClick={() => {
                    setPrintError(null)
                    setPrintRetrySale(null)
                  }}
                  className="flex-shrink-0 text-amber-600 transition-opacity hover:opacity-70"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
                <ShoppingCart size={28} className="opacity-50" />
                <p className="text-sm">Savat bo'sh</p>
                <p className="text-xs">Sotish uchun mahsulot ustiga bosing</p>
              </div>
            ) : (
              <div className="max-h-[280px] space-y-1 overflow-y-auto px-3 py-2">
                {cart.map((line) => {
                  const p = productById(line.productId)
                  if (!p) return null
                  const lineTotal = fifoTotal(p, line.qty)
                  return (
                    <div
                      key={line.productId}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-2 hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.qty} dona ={" "}
                          <span className="font-semibold text-foreground">{fmt(lineTotal)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => changeQty(line.productId, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{line.qty}</span>
                        <button
                          onClick={() => changeQty(line.productId, 1)}
                          disabled={line.qty >= p.stock}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="space-y-3 border-t border-border p-4">
              {/* Sotuv turi */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setSaleMode("DIRECT")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    saleMode === "DIRECT"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Banknote size={14} /> Oddiy sotuv
                </button>
                <button
                  onClick={() => setSaleMode("RESERVATION")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    saleMode === "RESERVATION"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <BedDouble size={14} /> Bronga yozish
                </button>
              </div>

              {saleMode === "DIRECT" ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMethod(m.key)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                        method === m.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <m.icon size={15} />
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <select
                    value={reservationId}
                    onChange={(e) => setReservationId(e.target.value)}
                    className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Bronni tanlang...</option>
                    {activeReservations.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    To'lov keyin olinadi — mehmon chiqishida "To'lash" tugmasi bilan yopiladi
                  </p>
                </div>
              )}

              {sellError && (
                <p className="text-sm font-medium text-destructive">{sellError}</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Jami:</span>
                <span className="text-xl font-bold">{fmt(cartTotal)} So'm</span>
              </div>

              {/* Chek rejimi — o'chirilsa cheksiz sotiladi (hech narsa o'zgarmaydi) */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleReceipt}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span
                    className={cn(
                      "flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors",
                      receiptOn ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full bg-white shadow transition-transform",
                        receiptOn && "translate-x-4"
                      )}
                    />
                  </span>
                  <Printer size={13} />
                  {receiptOn ? "Chek chiqariladi" : "Cheksiz sotish"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrinterUrlInput(getPrinterUrl())
                    setPrinterTest(null)
                    setPrinterModal(true)
                  }}
                  title="Chek printeri sozlamalari"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Settings2 size={14} />
                </button>
              </div>

              <Button
                onClick={sell}
                disabled={sellDisabled}
                className="h-11 w-full gap-2 text-base font-semibold"
              >
                {createSale.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {saleMode === "RESERVATION" ? "Bronga yozish" : "Sotish"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Mahsulot dialogi ---------- */}
      <Dialog open={productModal} onOpenChange={setProductModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Nomi</label>
              <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Coca-Cola 0.5L" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Kategoriya</label>
                <select
                  value={pCategory}
                  onChange={(e) => setPCategory(e.target.value)}
                  className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Belgi</label>
                <div className="flex flex-wrap gap-1">
                  {EMOJI_SUGGESTIONS.slice(0, 6).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setPEmoji(e)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md border text-base",
                        pEmoji === e ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pActive}
                  onChange={(e) => setPActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Faol (sotuvda ko'rinadi)
              </label>
            )}
            {!editing && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Mahsulot yaratilgach, unga <b>partiya qo'shing</b> (miqdor + narx) — shundan
                keyin sotuvga chiqadi.
              </p>
            )}
            {pError && <p className="text-sm font-medium text-destructive">{pError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModal(false)}>
              Bekor qilish
            </Button>
            <Button onClick={submitProduct} disabled={createProduct.isPending || updateProduct.isPending}>
              {(createProduct.isPending || updateProduct.isPending) && (
                <Loader2 size={15} className="mr-1.5 animate-spin" />
              )}
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Partiya dialogi ---------- */}
      <Dialog open={batchModal} onOpenChange={setBatchModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Partiya qo'shish — {batchProduct?.emoji} {batchProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {batchProduct && batchProduct.batches.length > 0 && (
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Mavjud partiyalar:{" "}
                {batchProduct.batches
                  .filter((b) => b.remaining > 0)
                  .map((b) => `${b.remaining} dona @ ${fmt(b.sale_price)}`)
                  .join(", ") || "qoldiq yo'q"}
                . Yangi partiya navbatga qo'shiladi — avval eskisi sotiladi (FIFO).
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Miqdor (dona)</label>
                <Input
                  type="number"
                  min={1}
                  value={bQty}
                  onChange={(e) => setBQty(e.target.value)}
                  placeholder="24"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Sotish narxi (So'm)</label>
                <Input
                  type="number"
                  min={0}
                  value={bSalePrice}
                  onChange={(e) => setBSalePrice(e.target.value)}
                  placeholder="8000"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Olish narxi (ixtiyoriy, foyda hisobi uchun)
              </label>
              <Input
                type="number"
                min={0}
                value={bCostPrice}
                onChange={(e) => setBCostPrice(e.target.value)}
                placeholder="6000"
              />
            </div>
            {bError && <p className="text-sm font-medium text-destructive">{bError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchModal(false)}>
              Bekor qilish
            </Button>
            <Button onClick={submitBatch} disabled={addBatch.isPending}>
              {addBatch.isPending && <Loader2 size={15} className="mr-1.5 animate-spin" />}
              Kirim qilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Sotuv tafsilotlari dialogi ---------- */}
      <Dialog open={detailModal} onOpenChange={setDetailModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={18} /> Sotuv tafsilotlari
            </DialogTitle>
          </DialogHeader>
          {detailSale && (
            <div className="space-y-4">
              {/* Umumiy ma'lumot */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/60 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Holat</p>
                  {detailSale.status === "PAID" ? (
                    <Badge className="mt-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      To'langan
                    </Badge>
                  ) : (
                    <Badge className="mt-0.5 bg-amber-100 text-amber-700 hover:bg-amber-100">
                      Bronda (kutilmoqda)
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">To'lov usuli</p>
                  <p className="mt-0.5 font-medium">
                    {detailSale.payment_method
                      ? METHOD_LABELS[detailSale.payment_method] || detailSale.payment_method
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sotuv vaqti</p>
                  <p className="mt-0.5 font-medium">
                    {detailSale.created_at
                      ? format(new Date(detailSale.created_at), "dd.MM.yyyy HH:mm")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">To'langan vaqt</p>
                  <p className="mt-0.5 font-medium">
                    {detailSale.paid_at
                      ? format(new Date(detailSale.paid_at), "dd.MM.yyyy HH:mm")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sotuvchi</p>
                  <p className="mt-0.5 font-medium">{detailSale.created_by_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bron</p>
                  <p className="mt-0.5 font-medium">{detailSale.reservation_number || "—"}</p>
                </div>
                {detailSale.reservation_id && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Mijoz</p>
                    <p className="mt-0.5 font-medium">{detailGuestName || "—"}</p>
                  </div>
                )}
              </div>

              {/* Mahsulot qatorlari — FIFO bo'yicha har partiya alohida narxda */}
              <div className="rounded-lg border border-border">
                {/* MOBIL: mahsulot qatorlari karta ko'rinishida (jadval planshet/desktopda) */}
                <div className="space-y-2.5 p-3 md:hidden">
                  {detailSale.items.map((i, idx) => (
                    <div key={idx} className="rounded-2xl border border-border bg-card p-3.5">
                      <p className="text-sm font-medium">{i.product_name}</p>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {fmt(i.unit_price)} ×{i.quantity}
                        </span>
                        <span className="font-semibold">{fmt(i.total_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* DESKTOP/PLANSHET: jadval ko'rinishi */}
                <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="text-right">Narx</TableHead>
                      <TableHead className="text-right">Soni</TableHead>
                      <TableHead className="text-right">Jami</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailSale.items.map((i, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm font-medium">{i.product_name}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm">
                          {fmt(i.unit_price)}
                        </TableCell>
                        <TableCell className="text-right text-sm">×{i.quantity}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-semibold">
                          {fmt(i.total_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">Jami:</span>
                  <span className="text-lg font-bold">{fmt(detailSale.total_amount)} So'm</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {/* Chekni qayta chiqarish — istalgan sotuv uchun */}
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  disabled={detailPrinting}
                  onClick={async () => {
                    setDetailPrinting(true)
                    await doPrintReceipt(detailSale)
                    setDetailPrinting(false)
                  }}
                >
                  {detailPrinting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Printer size={16} />
                  )}
                  Chek chiqarish
                </Button>
                {detailSale.status === "PENDING" && (
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => {
                      setDetailModal(false)
                      openPay(detailSale)
                    }}
                  >
                    <Banknote size={16} /> To'lovni qabul qilish
                  </Button>
                )}
              </div>
              {printError && (
                <p className="text-xs font-medium text-amber-600">{printError}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Chek printeri sozlamalari (TPrints) ---------- */}
      <Dialog open={printerModal} onOpenChange={setPrinterModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer size={18} /> Chek printeri (TPrints)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Print-server manzili
              </label>
              <Input
                value={printerUrl}
                onChange={(e) => setPrinterUrlInput(e.target.value)}
                placeholder={DEFAULT_TPRINTS_URL}
                className="mt-1"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Chek chiqishi uchun kassa kompyuterida TPrints dasturi ishlab
                turishi kerak. Odatiy manzil:{" "}
                <b className="text-foreground">http://127.0.0.1:9100</b>. Printer
                boshqa kompyuterda bo'lsa, o'sha kompyuter IP manzilini yozing
                (masalan http://192.168.1.102:9100). Sozlama shu qurilmaning
                o'zida saqlanadi.
              </p>
            </div>
            {printerTest && (
              <p
                className={cn(
                  "text-xs font-medium",
                  printerTest.ok ? "text-emerald-600" : "text-destructive"
                )}
              >
                {printerTest.msg}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={printerBusy}
                onClick={checkPrinter}
              >
                {printerBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Tekshirish
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={printerBusy}
                onClick={sendTestPrint}
              >
                <Receipt size={14} /> Sinov chek
              </Button>
              <Button size="sm" className="ml-auto" onClick={savePrinter}>
                Saqlash
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- To'lash dialogi ---------- */}
      <Dialog open={payModal} onOpenChange={setPayModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>To'lovni qabul qilish</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {payTarget?.reservation_number && (
                <>
                  Bron: <b>{payTarget.reservation_number}</b> ·{" "}
                </>
              )}
              Summa:{" "}
              <b className="text-foreground">{fmt(payTarget?.total_amount || 0)} So'm</b>
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => doPay(m.key)}
                  disabled={paySale.isPending}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border px-2 py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                >
                  <m.icon size={16} />
                  {m.label}
                </button>
              ))}
            </div>
            {payError && <p className="text-sm font-medium text-destructive">{payError}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
