import { useEffect, useMemo, useState } from "react"
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
  Receipt,
  Info,
} from "lucide-react"
import { usePermissions } from "@/lib/permissions"
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
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Sinov rejimi: do'kon backend'ga hali ulanmagan — mahsulotlar va     */
/* sotuvlar faqat shu brauzerda (localStorage) saqlanadi. Backend      */
/* qo'shilganda bu qatlam API hook'lariga almashtiriladi.              */
/* ------------------------------------------------------------------ */

interface ShopProduct {
  id: string
  name: string
  category: string
  price: number
  stock: number
  emoji: string
}

interface SaleItem {
  productId: string
  name: string
  price: number
  qty: number
}

interface ShopSale {
  id: string
  datetime: string // ISO
  items: SaleItem[]
  total: number
  method: string
}

const CATEGORIES = ["Ichimliklar", "Shirinliklar", "Gazaklar", "Boshqa"]

const EMOJI_SUGGESTIONS = ["🥤", "💧", "☕", "🧃", "🍫", "🍬", "🍪", "🍩", "🍟", "🥜", "🍿", "🧴", "🚬", "🍋"]

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

const SEED_PRODUCTS: ShopProduct[] = [
  { id: "p1", name: "Coca-Cola 0.5L", category: "Ichimliklar", price: 8000, stock: 24, emoji: "🥤" },
  { id: "p2", name: "Fanta 0.5L", category: "Ichimliklar", price: 8000, stock: 18, emoji: "🥤" },
  { id: "p3", name: "Suv 0.5L", category: "Ichimliklar", price: 3000, stock: 40, emoji: "💧" },
  { id: "p4", name: "Suv 1.5L", category: "Ichimliklar", price: 5000, stock: 30, emoji: "💧" },
  { id: "p5", name: "Red Bull 0.25L", category: "Ichimliklar", price: 15000, stock: 12, emoji: "🧃" },
  { id: "p6", name: "Kofe 3in1", category: "Ichimliklar", price: 3000, stock: 50, emoji: "☕" },
  { id: "p7", name: "Snickers", category: "Shirinliklar", price: 10000, stock: 20, emoji: "🍫" },
  { id: "p8", name: "KitKat", category: "Shirinliklar", price: 9000, stock: 16, emoji: "🍫" },
  { id: "p9", name: "Alpen Gold", category: "Shirinliklar", price: 18000, stock: 10, emoji: "🍫" },
  { id: "p10", name: "Pechenye", category: "Shirinliklar", price: 7000, stock: 25, emoji: "🍪" },
  { id: "p11", name: "Lays chips", category: "Gazaklar", price: 12000, stock: 15, emoji: "🍟" },
  { id: "p12", name: "Pista", category: "Gazaklar", price: 14000, stock: 12, emoji: "🥜" },
  { id: "p13", name: "Orbit saqich", category: "Boshqa", price: 4000, stock: 35, emoji: "🍬" },
]

const LS_PRODUCTS = "gohotel_shop_products_demo"
const LS_SALES = "gohotel_shop_sales_demo"

const loadLS = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const ShopPage = () => {
  const { isAdmin, can } = usePermissions()
  // Mahsulotlarni boshqarish — /services boshqaruvi bilan bir xil doira
  // (admin va menejer); sotish esa sahifani ko'rgan har bir xodimga ochiq
  const canManage =
    isAdmin || can("service.manage", "service.create", "service.update", "hotel_service.manage")

  const [products, setProducts] = useState<ShopProduct[]>(() =>
    loadLS<ShopProduct[]>(LS_PRODUCTS, SEED_PRODUCTS)
  )
  const [sales, setSales] = useState<ShopSale[]>(() => loadLS<ShopSale[]>(LS_SALES, []))

  useEffect(() => {
    try {
      localStorage.setItem(LS_PRODUCTS, JSON.stringify(products))
    } catch {}
  }, [products])
  useEffect(() => {
    try {
      localStorage.setItem(LS_SALES, JSON.stringify(sales))
    } catch {}
  }, [sales])

  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("Barchasi")
  const [cart, setCart] = useState<SaleItem[]>([])
  const [method, setMethod] = useState("CASH")
  const [soldBanner, setSoldBanner] = useState<string | null>(null)

  // Mahsulot qo'shish/tahrirlash dialogi
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ShopProduct | null>(null)
  const [pName, setPName] = useState("")
  const [pCategory, setPCategory] = useState(CATEGORIES[0])
  const [pPrice, setPPrice] = useState("")
  const [pStock, setPStock] = useState("")
  const [pEmoji, setPEmoji] = useState(EMOJI_SUGGESTIONS[0])
  const [formError, setFormError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== "Barchasi" && p.category !== category) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, search, category])

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  const stockOf = (id: string) => products.find((p) => p.id === id)?.stock ?? 0
  const inCart = (id: string) => cart.find((i) => i.productId === id)?.qty ?? 0

  const addToCart = (p: ShopProduct) => {
    if (inCart(p.id) >= p.stock) return
    setCart((prev) => {
      const ex = prev.find((i) => i.productId === p.id)
      if (ex) {
        return prev.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i
          const max = stockOf(productId)
          return { ...i, qty: Math.min(Math.max(i.qty + delta, 0), max) }
        })
        .filter((i) => i.qty > 0)
    )
  }

  const sell = () => {
    if (!cart.length) return
    const sale: ShopSale = {
      id: newId(),
      datetime: new Date().toISOString(),
      items: cart,
      total: cartTotal,
      method,
    }
    // Ombor qoldig'ini kamaytiramiz
    setProducts((prev) =>
      prev.map((p) => {
        const item = cart.find((i) => i.productId === p.id)
        return item ? { ...p, stock: Math.max(p.stock - item.qty, 0) } : p
      })
    )
    setSales((prev) => [sale, ...prev].slice(0, 200))
    setCart([])
    setSoldBanner(`${fmt(sale.total)} So'm — sotuv qayd etildi`)
    window.setTimeout(() => setSoldBanner(null), 3000)
  }

  // ---- Bugungi sotuvlar statistikasi ----
  const todayKey = new Date().toDateString()
  const todaySales = sales.filter((s) => new Date(s.datetime).toDateString() === todayKey)
  const todayRevenue = todaySales.reduce((s, x) => s + x.total, 0)
  const todayItems = todaySales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0)

  // ---- Mahsulot dialogi ----
  const openCreate = () => {
    setEditing(null)
    setPName("")
    setPCategory(CATEGORIES[0])
    setPPrice("")
    setPStock("")
    setPEmoji(EMOJI_SUGGESTIONS[0])
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (p: ShopProduct) => {
    setEditing(p)
    setPName(p.name)
    setPCategory(p.category)
    setPPrice(String(p.price))
    setPStock(String(p.stock))
    setPEmoji(p.emoji)
    setFormError(null)
    setModalOpen(true)
  }

  const submitProduct = () => {
    if (!pName.trim()) {
      setFormError("Mahsulot nomini kiriting")
      return
    }
    const price = Number(pPrice)
    if (!price || price <= 0) {
      setFormError("Narx 0 dan katta bo'lishi kerak")
      return
    }
    const stock = Math.max(parseInt(pStock, 10) || 0, 0)
    if (editing) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? { ...p, name: pName.trim(), category: pCategory, price, stock, emoji: pEmoji }
            : p
        )
      )
    } else {
      setProducts((prev) => [
        { id: newId(), name: pName.trim(), category: pCategory, price, stock, emoji: pEmoji },
        ...prev,
      ])
    }
    setModalOpen(false)
  }

  const deleteProduct = (p: ShopProduct) => {
    if (!confirm(`"${p.name}" mahsulotini o'chirasizmi?`)) return
    setProducts((prev) => prev.filter((x) => x.id !== p.id))
    setCart((prev) => prev.filter((i) => i.productId !== p.id))
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
              Ichimliklar, shirinliklar va boshqa mahsulotlar sotuvi
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus size={16} /> Mahsulot qo'shish
          </Button>
        )}
      </div>

      {/* Sinov rejimi eslatmasi */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          <b>Sinov rejimi:</b> do'kon hozircha serverga ulanmagan — mahsulotlar va sotuvlar faqat
          shu qurilmada saqlanadi. Backend qo'shilgach barcha sotuvlar hisobotlarga kiradi.
        </span>
      </div>

      {/* Bugungi ko'rsatkichlar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt size={15} /> Bugungi sotuvlar
          </div>
          <p className="mt-1 text-2xl font-bold">{todaySales.length} ta</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingCart size={15} /> Sotilgan mahsulotlar
          </div>
          <p className="mt-1 text-2xl font-bold">{todayItems} dona</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Banknote size={15} /> Bugungi tushum
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{fmt(todayRevenue)} So'm</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
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

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center text-muted-foreground">
              <PackageOpen size={32} className="opacity-60" />
              <p className="text-sm">Mahsulot topilmadi</p>
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
                      out
                        ? "opacity-55"
                        : "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    )}
                    onClick={() => !out && addToCart(p)}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{p.emoji}</span>
                      {inCart(p.id) > 0 && (
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                          {inCart(p.id)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.category}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-sm font-bold text-primary">{fmt(p.price)} So'm</span>
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
                    {canManage && (
                      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(p)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border hover:text-foreground"
                          title="Tahrirlash"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteProduct(p)
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

          {/* Bugungi sotuvlar jadvali */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Bugungi sotuvlar</h2>
              <span className="text-xs text-muted-foreground">{todaySales.length} ta</span>
            </div>
            {todaySales.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Bugun hali sotuv bo'lmadi
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vaqt</TableHead>
                      <TableHead>Mahsulotlar</TableHead>
                      <TableHead>To'lov</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaySales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(s.datetime).toLocaleTimeString("uz-UZ", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="max-w-[320px] text-sm">
                          {s.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            {METHOD_LABELS[s.method] || s.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-semibold">
                          {fmt(s.total)} So'm
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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

            {cart.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
                <ShoppingCart size={28} className="opacity-50" />
                <p className="text-sm">Savat bo'sh</p>
                <p className="text-xs">Sotish uchun mahsulot ustiga bosing</p>
              </div>
            ) : (
              <div className="max-h-[320px] space-y-1 overflow-y-auto px-3 py-2">
                {cart.map((i) => (
                  <div
                    key={i.productId}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-2 hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt(i.price)} × {i.qty} ={" "}
                        <span className="font-semibold text-foreground">{fmt(i.price * i.qty)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => changeQty(i.productId, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                      <button
                        onClick={() => changeQty(i.productId, 1)}
                        disabled={i.qty >= stockOf(i.productId)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t border-border p-4">
              {/* To'lov usuli */}
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

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Jami:</span>
                <span className="text-xl font-bold">{fmt(cartTotal)} So'm</span>
              </div>

              <Button onClick={sell} disabled={!cart.length} className="h-11 w-full gap-2 text-base font-semibold">
                <CheckCircle2 size={18} /> Sotish
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Mahsulot qo'shish/tahrirlash ---------- */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
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
                  {EMOJI_SUGGESTIONS.slice(0, 7).map((e) => (
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Narxi (So'm)</label>
                <Input
                  type="number"
                  min={0}
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  placeholder="8000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ombordagi soni</label>
                <Input
                  type="number"
                  min={0}
                  value={pStock}
                  onChange={(e) => setPStock(e.target.value)}
                  placeholder="20"
                />
              </div>
            </div>
            {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={submitProduct}>{editing ? "Saqlash" : "Qo'shish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
