import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Printer,
  Loader2,
  CheckCircle2,
  RotateCcw,
  QrCode,
  Receipt,
  type LucideIcon,
} from "lucide-react"
import {
  useReceiptSettings,
  useSaveReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptSettings,
} from "@/features/shop/api/shop"
import { printSampleReceipt } from "@/lib/tprints"
import { useAuthStore } from "@/store/auth"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Jonli ko'rinishdagi namunaviy sotuv qatorlari
const SAMPLE_ITEMS = [
  { name: "Coca-Cola 0.5", qty: 2, total: 24000 },
  { name: "Shokolad", qty: 1, total: 18000 },
  { name: "Suv 1L", qty: 3, total: 15000 },
]

// Matn maydoni: yorliq + input + ixtiyoriy izoh (barcha maydonlarda bir xil)
function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  maxLength?: number
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1"
      />
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

// Ha/yo'q sozlama qatori (almashtirgich bilan)
function ToggleRow({
  icon: Icon,
  label,
  desc,
  on,
  onToggle,
}: {
  icon: LucideIcon
  label: string
  desc: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-[11px] text-gray-500">{desc}</span>
      </span>
      <span
        className={cn(
          "flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors",
          on ? "bg-primary-600" : "bg-gray-400/40"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform",
            on && "translate-x-4"
          )}
        />
      </span>
    </button>
  )
}

export const ReceiptDesignPage = () => {
  const user = useAuthStore((s) => s.user)
  const hotelName = user?.hotel_name || "GoHotel"

  const { data: saved, isLoading } = useReceiptSettings()
  const saveMutation = useSaveReceiptSettings()

  const [form, setForm] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [savedFlag, setSavedFlag] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testBusy, setTestBusy] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Serverdan kelgan dizayn formaga BIR MARTA yuklanadi (keyin foydalanuvchi tahriri ustun)
  useEffect(() => {
    if (saved && !loaded) {
      setForm(saved)
      setLoaded(true)
    }
  }, [saved, loaded])

  const set = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setSavedFlag(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  const onSave = async () => {
    setSaveError(null)
    try {
      await saveMutation.mutateAsync(form)
      setSavedFlag(true)
      window.setTimeout(() => setSavedFlag(false), 3000)
    } catch (e) {
      setSaveError(apiErrorMessage(e))
    }
  }

  const onReset = () => {
    setForm(DEFAULT_RECEIPT_SETTINGS)
    setSavedFlag(false)
  }

  // Joriy (hali saqlanmagan bo'lishi ham mumkin) dizayn bilan sinov chek
  const onTestPrint = async () => {
    setTestBusy(true)
    setTestMsg(null)
    const r = await printSampleReceipt(form, hotelName)
    setTestMsg(
      r.ok
        ? { ok: true, text: "Sinov chek printerga yuborildi" }
        : { ok: false, text: r.error || "Chek chiqmadi" }
    )
    setTestBusy(false)
  }

  const title = form.title.trim() || hotelName
  const sampleTotal = SAMPLE_ITEMS.reduce((s, i) => s + i.total, 0)

  if (isLoading && !loaded) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yuklanmoqda...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
            title="Sozlamalarga qaytish"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-500/25">
            <Printer className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Chek dizayni</h1>
            <p className="text-sm text-gray-500">
              {hotelName} uchun — faqat shu mehmonxonaga amal qiladi
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={onReset}>
            <RotateCcw className="h-4 w-4" /> Standart holat
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={testBusy}
            onClick={onTestPrint}
          >
            {testBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4" />
            )}
            Sinov chek
          </Button>
          <Button className="min-w-[120px] gap-2" disabled={saveMutation.isPending} onClick={onSave}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedFlag ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : null}
            {savedFlag ? "Saqlandi" : "Saqlash"}
          </Button>
        </div>
      </div>

      {(saveError || testMsg) && (
        <div className="space-y-2">
          {saveError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {saveError}
            </p>
          )}
          {testMsg && (
            <p
              className={cn(
                "rounded-lg border px-4 py-2.5 text-sm font-medium",
                testMsg.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              )}
            >
              {testMsg.text}
            </p>
          )}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_auto]">
        {/* ---------- Tahrirlash formasi ---------- */}
        <div className="space-y-4">
          {/* Matnlar */}
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="border-b bg-gray-50/70 px-5 py-3">
              <h2 className="text-sm font-bold text-gray-900">Chek matnlari</h2>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field
                label="Sarlavha"
                value={form.title}
                onChange={(v) => set("title", v)}
                placeholder={hotelName}
                hint="Bo'sh qoldirilsa mehmonxona nomi chiqadi"
                maxLength={64}
              />
              <Field
                label="Ost sarlavha"
                value={form.subtitle}
                onChange={(v) => set("subtitle", v)}
                placeholder="Mini-do'kon cheki"
                maxLength={64}
              />
              <Field
                label="Yuqori izoh (manzil, telefon)"
                value={form.header_note}
                onChange={(v) => set("header_note", v)}
                placeholder="Toshkent sh., Amir Temur 15 · +998 90 123 45 67"
                maxLength={200}
              />
              <Field
                label="Pastki matn"
                value={form.footer_text}
                onChange={(v) => set("footer_text", v)}
                placeholder="Xaridingiz uchun rahmat!"
                maxLength={120}
              />
              <Field
                label="Pastki izoh"
                value={form.footer_note}
                onChange={(v) => set("footer_note", v)}
                placeholder="Wi-Fi: GrandHotel · parol: 12345678"
                maxLength={200}
              />
              <Field
                label="QR-kod havolasi"
                value={form.qr_url}
                onChange={(v) => set("qr_url", v)}
                placeholder="https://instagram.com/mehmonxona"
                hint="Bo'sh bo'lmasa chek oxirida QR-kod chiqadi"
                maxLength={300}
              />
            </div>
          </section>

          {/* Maydonlar va qog'oz */}
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="border-b bg-gray-50/70 px-5 py-3">
              <h2 className="text-sm font-bold text-gray-900">Maydonlar va qog'oz</h2>
            </div>
            <div className="space-y-2.5 p-5">
              <ToggleRow
                icon={Receipt}
                label="Chek raqami"
                desc="Sotuvning qisqa identifikatori ko'rsatiladi"
                on={form.show_check_no}
                onToggle={() => set("show_check_no", !form.show_check_no)}
              />
              <ToggleRow
                icon={Printer}
                label="Sotuvchi ismi"
                desc="Chekni kim sotgani yozib qo'yiladi"
                on={form.show_seller}
                onToggle={() => set("show_seller", !form.show_seller)}
              />
              <ToggleRow
                icon={QrCode}
                label="Mehmon va bron"
                desc="Bronga yozilgan sotuvda mehmon ismi va bron raqami"
                on={form.show_guest}
                onToggle={() => set("show_guest", !form.show_guest)}
              />

              <div className="pt-2">
                <label className="text-xs font-medium text-gray-600">
                  Qog'oz kengligi (termal printer)
                </label>
                <div className="mt-1.5 flex gap-2">
                  {([58, 80] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set("paper", p)}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                        form.paper === p
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {p} mm
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ---------- Jonli ko'rinish ---------- */}
        <div className="mx-auto lg:sticky lg:top-4">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Jonli ko'rinish
          </p>
          {/* Termal chek qog'ozi ko'rinishi — pastki qirrasi tishli */}
          <div
            className={cn(
              "bg-white px-4 pb-5 pt-4 text-zinc-900 shadow-lg ring-1 ring-black/5 transition-all",
              form.paper === 58 ? "w-56" : "w-72"
            )}
            style={{
              clipPath:
                "polygon(0 0, 100% 0, 100% calc(100% - 7px), 96% 100%, 92% calc(100% - 7px), 88% 100%, 84% calc(100% - 7px), 80% 100%, 76% calc(100% - 7px), 72% 100%, 68% calc(100% - 7px), 64% 100%, 60% calc(100% - 7px), 56% 100%, 52% calc(100% - 7px), 48% 100%, 44% calc(100% - 7px), 40% 100%, 36% calc(100% - 7px), 32% 100%, 28% calc(100% - 7px), 24% 100%, 20% calc(100% - 7px), 16% 100%, 12% calc(100% - 7px), 8% 100%, 4% calc(100% - 7px), 0 100%)",
            }}
          >
            <p className="text-center text-base font-extrabold leading-tight">{title}</p>
            {form.subtitle.trim() && (
              <p className="mt-0.5 text-center text-[11px]">{form.subtitle}</p>
            )}
            {form.header_note.trim() && (
              <p className="mt-0.5 text-center text-[10px] text-zinc-600">
                {form.header_note}
              </p>
            )}
            <div className="my-2 border-t border-zinc-800" />
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between gap-2">
                <span>Sana:</span>
                <span>12.08.2026 18:45</span>
              </div>
              {form.show_check_no && (
                <div className="flex justify-between gap-2">
                  <span>Chek:</span>
                  <span>#A1B2C3D4</span>
                </div>
              )}
              {form.show_seller && (
                <div className="flex justify-between gap-2">
                  <span>Sotuvchi:</span>
                  <span>Aziza Karimova</span>
                </div>
              )}
              {form.show_guest && (
                <>
                  <div className="flex justify-between gap-2">
                    <span>Bron:</span>
                    <span>RES-NAMUNA</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Mehmon:</span>
                    <span>Jasur Toshmatov</span>
                  </div>
                </>
              )}
            </div>
            <div className="my-2 border-t border-dashed border-zinc-500" />
            <div className="text-[11px]">
              <div className="flex justify-between gap-2 font-bold">
                <span className="flex-1">Mahsulot</span>
                <span className="w-8 text-center">Soni</span>
                <span className="w-14 text-right">Summa</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {SAMPLE_ITEMS.map((i) => (
                  <div key={i.name} className="flex justify-between gap-2">
                    <span className="flex-1 truncate">{i.name}</span>
                    <span className="w-8 text-center">{i.qty}</span>
                    <span className="w-14 text-right">{i.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="my-2 border-t border-zinc-800" />
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm font-extrabold">JAMI:</span>
              <span className="text-sm font-extrabold">
                {sampleTotal.toLocaleString()} So'm
              </span>
            </div>
            <div className="mt-0.5 flex justify-between gap-2 text-[11px]">
              <span>To'lov:</span>
              <span>Naqd</span>
            </div>
            <div className="my-2 border-t border-dashed border-zinc-500" />
            {form.footer_text.trim() && (
              <p className="text-center text-[11px] font-bold">{form.footer_text}</p>
            )}
            {form.footer_note.trim() && (
              <p className="mt-0.5 text-center text-[10px] text-zinc-600">
                {form.footer_note}
              </p>
            )}
            {form.qr_url.trim() && (
              <div className="mt-2 flex justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded border border-zinc-300">
                  <QrCode className="h-9 w-9 text-zinc-800" />
                </span>
              </div>
            )}
          </div>
          <p className="mt-3 max-w-[18rem] text-center text-[11px] leading-relaxed text-gray-400">
            Namunaviy ma'lumotlar bilan taxminiy ko'rinish. Aniq natija uchun
            "Sinov chek" tugmasi bilan printerda tekshiring.
          </p>
        </div>
      </div>
    </div>
  )
}
