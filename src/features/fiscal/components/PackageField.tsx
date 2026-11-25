import { useState } from "react"
import { Loader2, Search } from "lucide-react"

import { tr } from "@/i18n"
import { cn } from "@/lib/utils"

import { loadConfig } from "../lib/engine"
import { eposPackages } from "../lib/epos"

/* O'ram (o'lchov birligi) kodi maydoni.

   Kod qo'lda yozilishi ham mumkin, lekin E-POS IKPU ga mos kelmagan o'ram
   kodini rad etadi. Shuning uchun yonidagi tugma E-POS'dan shu IKPU uchun
   ruxsat etilgan kodlar ro'yxatini oladi — tanlash kifoya. */
export function PackageField({
  classCode,
  value,
  onChange,
  className,
}: {
  classCode: string
  value: string
  onChange: (code: string) => void
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<{ code: string; name: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lookup = async () => {
    setBusy(true)
    setError(null)
    setItems(null)
    const cfg = await loadConfig(true)
    if (!cfg) {
      setError(tr("Serverga ulanib bo'lmadi"))
    } else {
      const res = await eposPackages(cfg, classCode)
      if (!res.ok) setError(res.error || tr("E-POS xatosi"))
      else if (res.items.length === 0) setError(tr("Bu IKPU uchun o'ram kodi topilmadi — kodni tekshiring"))
      else if (res.items.length === 1) onChange(res.items[0].code)
      else setItems(res.items)
    }
    setBusy(false)
  }

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          className={cn(className, "min-w-0 flex-1")}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
        />
        <button
          type="button"
          onClick={lookup}
          disabled={busy || classCode.length !== 17}
          title={tr("O'ram kodlarini E-POS'dan olish (avval 17 xonali IKPU kiriting)")}
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </div>
      {items && (
        <ul className="absolute right-0 z-20 mt-1 max-h-56 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 text-xs shadow-lg">
          {items.map((p) => (
            <li key={p.code}>
              <button
                type="button"
                onClick={() => {
                  onChange(p.code)
                  setItems(null)
                }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-50"
              >
                <span className="font-mono font-semibold text-gray-900">{p.code}</span>
                <span className="text-gray-600">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-[11px] leading-snug text-red-600">{error}</p>}
    </div>
  )
}
