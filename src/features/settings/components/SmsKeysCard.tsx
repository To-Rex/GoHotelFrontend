import { useState } from "react"
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  MessageSquareText,
  Send,
  Trash2,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { useBranches } from "@/features/rooms/api/rooms"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  useBranchSms,
  useDeleteBranchSms,
  useSaveBranchSms,
  useTestBranchSms,
} from "../api/sms"

/**
 * SMS xabarnomalar (Xabarchi) — har filialga alohida API kalit.
 *
 * Kalit kiritilgan filialda mijozga SMS ketadi: bron yaratilganda
 * (tasdiqlash) va to'lov qabul qilinganda (kvitansiya). Kalit serverda
 * shifrlangan saqlanadi — bu yerda faqat niqoblangan ko'rinishi turadi.
 * Sinov tugmasi haqiqiy SMS yuborib, kalit ishlayotganini darhol
 * ko'rsatadi.
 */
export function SmsKeysCard() {
  const { data: branches = [], isLoading } = useBranches()

  return (
    <section
      id="sms-keys"
      className="overflow-hidden rounded-2xl border bg-white scroll-mt-4"
    >
      <div className="flex items-start gap-3 border-b bg-gray-50/70 px-5 py-4">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <MessageSquareText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900">SMS xabarnomalar</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            Har filialga Xabarchi API kaliti biriktiriladi. Kalit kiritilgan
            filialda mijozga bron yaratilganda va to'lov qabul qilinganda SMS
            yuboriladi. Kalit serverda shifrlangan holda saqlanadi.
          </p>
        </div>
      </div>
      <div className="space-y-3 p-5">
        {isLoading ? (
          <p className="text-sm text-gray-400">Filiallar yuklanmoqda...</p>
        ) : branches.length === 0 ? (
          <p className="text-sm text-gray-400">Filiallar topilmadi</p>
        ) : (
          branches.map((b: any) => <BranchSmsRow key={b.id} branch={b} />)
        )}
      </div>
    </section>
  )
}

function BranchSmsRow({ branch }: { branch: any }) {
  const { data: status, isLoading } = useBranchSms(branch.id)
  const save = useSaveBranchSms()
  const remove = useDeleteBranchSms()
  const test = useTestBranchSms()

  const [key, setKey] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const busy = save.isPending || remove.isPending || test.isPending

  const handleSave = async () => {
    if (!key.trim()) {
      setNote({ ok: false, text: "API kalitni kiriting (xab_live_...)" })
      return
    }
    try {
      await save.mutateAsync({ branchId: branch.id, apiKey: key.trim() })
      setKey("")
      setNote({ ok: true, text: "Kalit saqlandi" })
    } catch (e) {
      setNote({ ok: false, text: apiErrorMessage(e) })
    }
  }

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(branch.id)
      setNote({ ok: true, text: "Kalit o'chirildi — bu filialda SMS yuborilmaydi" })
    } catch (e) {
      setNote({ ok: false, text: apiErrorMessage(e) })
    }
  }

  const handleTest = async () => {
    if (!phone.trim()) {
      setNote({ ok: false, text: "Sinov uchun telefon raqamini kiriting" })
      return
    }
    try {
      const res = await test.mutateAsync({ branchId: branch.id, phone: phone.trim() })
      setNote({ ok: true, text: "Sinov SMS yuborildi: " + res.phone })
    } catch (e) {
      setNote({ ok: false, text: apiErrorMessage(e) })
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{branch.name}</span>
        {isLoading ? (
          <span className="text-xs text-gray-400">yuklanmoqda...</span>
        ) : status?.configured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Ulangan · {status.key_hint}
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            Ulanmagan
          </span>
        )}
        {status?.configured && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            title="Kalitni o'chirish"
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            O'chirish
          </button>
        )}
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <KeyRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            className="h-9 pl-8 font-mono text-xs"
            placeholder={
              status?.configured
                ? "Yangi kalit kiritib almashtirish mumkin"
                : "xab_live_..."
            }
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
        >
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Saqlash
        </button>
      </div>

      {status?.configured && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            className="h-9 text-xs"
            placeholder="Sinov uchun telefon: +998 90 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:opacity-60"
          >
            {test.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Sinov SMS
          </button>
        </div>
      )}

      {note && (
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            note.ok ? "text-emerald-600" : "text-red-600"
          )}
        >
          {note.text}
        </p>
      )}
    </div>
  )
}
