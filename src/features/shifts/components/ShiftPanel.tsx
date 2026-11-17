import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import {
  Wallet,
  Play,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRightLeft,
  ShieldCheck,
  Clock,
  KeyRound,
} from "lucide-react"
import {
  useShiftState,
  useOpenShift,
  useContinueShift,
  useCloseCash,
  useEndShift,
  useAcceptShift,
  useForceCloseShift,
  useApproveHandover,
  useExpectedCash,
  isWorkEnded,
  isCutDue,
  isCashStaff,
  type ShiftSession,
} from "../api/shifts"
import { useAuthStore } from "@/store/auth"
import { usePermissions } from "@/lib/permissions"
import { apiErrorMessage } from "@/lib/apiError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import { NonCashMethods } from "./NonCashMethods"
import { CashCutPicker } from "./CashCutPicker"
import {
  amountDue,
  cashLeftAfter,
  hasCuts,
  selectedCut,
  type CutChoice,
} from "../lib/cashCuts"

const fmtMoney = (n: number | null | undefined) => Number(n || 0).toLocaleString()

/* Smena paneli (/my-reports tepasida, faqat kassali rejimda ko'rinadi).
   Holatlar: sessiya yo'q (ochish) → faol (davom/kassa/tugallash) →
   topshirilgan (kutish) | blok (qabul qilish / majburiy yopish). */
export const ShiftPanel = () => {
  const user = useAuthStore((s) => s.user)
  const { isAdmin, can } = usePermissions()
  const canForce = isAdmin || can("shift.force_close")

  const { data: state } = useShiftState(!!user)

  const openMutation = useOpenShift()
  const continueMutation = useContinueShift()
  const closeCashMutation = useCloseCash()
  const endShiftMutation = useEndShift()
  const acceptMutation = useAcceptShift()
  const forceMutation = useForceCloseShift()
  // Tasdiq rejimi: topshirilgan kassani admin/menejer tasdiqlaydi
  const approveMutation = useApproveHandover()

  // Sanash dialogi: "cash" — kassani topshirish, "end" — smenani tugallash
  const [countDialog, setCountDialog] = useState<"cash" | "end" | null>(null)
  // Faol sessiya panelida naqdsiz to'lovlar tarkibi ham ko'rsatiladi, shuning
  // uchun so'rov dialog yopiq bo'lsa ham yoniq turadi. "Ko'r sanash"
  // buzilmaydi: kutilgan NAQD summa faqat dialog ochilganda ko'rsatiladi,
  // panelda esa faqat naqdsiz usullar qatori o'qiladi.
  const myActive = !!state?.my_session && state.my_session.status === "ACTIVE"
  // Dialog ochilganda kassada bo'lishi kerak bo'lgan summa (tarkibi bilan)
  const {
    data: expectedData,
    isFetching: expectedFetching,
    refetch: refetchExpected,
  } = useExpectedCash(!!countDialog || myActive)
  // Kunlik kesim bo'yicha topshirish: qaysi kesimgacha (`null` — xodim hali
  // tanlamagan, standart: oxirgi kesimgacha). Faqat "Kassani topshirish"da;
  // smenani tugallashda kassa keyingi xodimga butunligicha o'tadi.
  const [cutChoice, setCutChoice] = useState<CutChoice | null>(null)
  const cutMode = countDialog === "cash" && hasCuts(expectedData)
  const activeCut = cutMode ? selectedCut(expectedData, cutChoice) : null
  // Topshiriladigan summa: tanlangan kesimgacha yoki kassadagi hamma pul
  const dueNow = amountDue(expectedData, activeCut)
  const [counted, setCounted] = useState("")
  const [notes, setNotes] = useState("")
  const [countError, setCountError] = useState<string | null>(null)
  // Dialog ochilganda kutilgan summa maydonga AVTOMATIK yozib qo'yiladi —
  // xodim istasa o'zgartiradi.
  //
  // Bu yerda ikkita nozik shart bor:
  //
  // 1. KESHDAGI eski qiymatda qotib qolmaslik. Dialog ochilganda so'rov
  //    keshdagi summani darhol qaytaradi va yangisini fonda oladi. Ilgari
  //    to'ldirish "bir marta bajarildi" deb qulflanardi, ya'ni u eski
  //    qiymatga tushib qolar, keyin kelgan yangi hisob e'tiborsiz qolardi —
  //    yangi bron qilingandan keyin dialog eski summani ko'rsatardi va faqat
  //    sahifa yangilangandan keyin to'g'rilanardi. Endi hisob har yangilanganda
  //    maydon ham yangilanadi, shuning uchun kesh qiymati bilan darhol
  //    to'ldirsak ham u yangisi kelishi bilan almashadi.
  // 2. Xodim kiritgan qiymatni bosib ketmaslik: u bir marta tahrirlagach,
  //    hisob yangilansa ham maydonga tegilmaydi.
  const editedRef = useRef(false)
  useEffect(() => {
    if (!countDialog) {
      editedRef.current = false
      return
    }
    if (editedRef.current || !expectedData) return
    // Kesim tanlovi o'zgarsa summa ham almashadi (`dueNow`, `cutChoice`)
    const v = Math.max(0, Math.round(dueNow))
    setCounted(String(v))
    setCountError(null)
  }, [countDialog, expectedData, dueNow, cutChoice])
  // Yopilgandan keyingi hisobot (kutilgan/sanalgan/farq)
  const [report, setReport] = useState<ShiftSession | null>(null)

  // Qabul qilish (parol bilan)
  const [acceptPassword, setAcceptPassword] = useState("")
  const [acceptError, setAcceptError] = useState<string | null>(null)

  // Majburiy yopish
  const [forceDialog, setForceDialog] = useState(false)
  const [forceCounted, setForceCounted] = useState("")
  // Majburiy yopishda kassa keyingi xodimga o'tsinmi. Standart — HA: aks
  // holda kassadagi pul hisobdan chiqib ketadi va keyingi xodim uni qabul
  // qilmagan holda ish boshlab, smena topshirishda ortiqcha pul chiqaradi.
  const [forceHandOver, setForceHandOver] = useState(true)
  const [forceNotes, setForceNotes] = useState("")
  const [forceError, setForceError] = useState<string | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)

  if (!user || !state || state.mode !== "cash") return null

  const my = state.my_session
  const blocking = state.blocking_session
  const workEnded = isWorkEnded(user)
  const cutDue = isCutDue(state)
  // Kesim majburiymi (sozlamadan). Eski javobda maydon bo'lmasa — majburiy.
  const cutRequired = state.day_close_required !== false
  // Kassa bilan ishlaydigan xodim (resepshn/kassir) — smena ochadi/topshiradi;
  // menejer/admin esa blokni majburiy yopish uchun banner ko'radi
  const cashStaff = isCashStaff(user)

  const submitCount = async () => {
    // Bo'sh maydon Number("")=0 bo'lib jimgina o'tib ketmasligi kerak
    if (counted.trim() === "") {
      setCountError(tr("Kassadagi haqiqiy summani kiriting"))
      return
    }
    const n = Number(counted.replace(/\s/g, ""))
    if (Number.isNaN(n) || n < 0) {
      setCountError(tr("Kassadagi haqiqiy summani kiriting"))
      return
    }
    setCountError(null)
    try {
      const payload = { counted_cash: n, notes: notes || undefined }
      const res =
        countDialog === "cash"
          ? await closeCashMutation.mutateAsync({
              ...payload,
              // Kesim tanlangan bo'lsa — faqat o'sha kesimgacha topshiriladi
              cut_at: activeCut?.cut_at,
            })
          : await endShiftMutation.mutateAsync(payload)
      setCountDialog(null)
      setCounted("")
      setNotes("")
      setReport(res)
    } catch (e) {
      setCountError(apiErrorMessage(e))
    }
  }

  // Sanash dialogini ochish: tanlov tozalanadi va hisob yangidan olinadi —
  // kesim variantlari vaqtga bog'liq (yangi kesim kelgan bo'lishi mumkin)
  const openCount = (kind: "cash" | "end") => {
    setCutChoice(null)
    setCountDialog(kind)
    void refetchExpected()
  }

  // Kesim tanlovi: summa maydoni yangi tanlovga qayta to'ldiriladi
  const chooseCut = (choice: CutChoice) => {
    editedRef.current = false
    setCutChoice(choice)
  }

  const submitAccept = async () => {
    if (!acceptPassword) {
      setAcceptError(tr("Parolingizni kiriting"))
      return
    }
    setAcceptError(null)
    try {
      await acceptMutation.mutateAsync({ password: acceptPassword })
      setAcceptPassword("")
    } catch (e) {
      setAcceptError(apiErrorMessage(e))
    }
  }

  // Tasdiq rejimi: topshirilgan kassani tasdiqlash (admin/menejer)
  const submitApprove = async () => {
    if (!blocking) return
    setActionError(null)
    try {
      await approveMutation.mutateAsync({ sessionId: blocking.id })
    } catch (e) {
      setActionError(apiErrorMessage(e))
    }
  }

  const submitForce = async () => {
    if (!blocking) return
    setForceError(null)
    try {
      const n = forceCounted.trim() ? Number(forceCounted.replace(/\s/g, "")) : undefined
      if (n !== undefined && (Number.isNaN(n) || n < 0)) {
        setForceError(tr("Summa noto'g'ri"))
        return
      }
      await forceMutation.mutateAsync({
        session_id: blocking.id,
        counted_cash: n,
        notes: forceNotes || undefined,
        hand_over: forceHandOver,
      })
      setForceDialog(false)
      setForceCounted("")
      setForceNotes("")
      setForceHandOver(true)
    } catch (e) {
      setForceError(apiErrorMessage(e))
    }
  }

  const doAction = async (fn: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      setActionError(apiErrorMessage(e))
    }
  }

  const saving =
    openMutation.isPending || continueMutation.isPending || acceptMutation.isPending

  return (
    <div className="space-y-3">
      {/* BLOK: boshqa xodimning yopilmagan smenasi */}
      {!my && blocking && (cashStaff || canForce) && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50/70 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-red-700">
                {blocking.user_name}{" "}{tr("smenasi hali topshirilmagan")}
              </p>
              <p className="mt-0.5 text-sm text-red-600/80">
                {blocking.status === "PENDING_HANDOVER"
                  ? blocking.pending_approval
                    ? tr("Smena tugallangan — kassa admin/menejer tasdig'ini kutmoqda. Tasdiqlangach sessiya yopiladi va (xodim davom etsa) yangi kassa 0 so'mdan ochiladi.")
                    : tr("Smena tugallangan — qabul qilib olishingiz mumkin. Kassadagi pul sizga o'tadi va yangi smenangizning BOSHLANG'ICH kassasi bo'ladi; avvalgi tushum-chiqim hisobi avvalgi xodimda qoladi.")
                  : tr("Xodim smenani tugallamagan. Menejer yoki administrator majburiy yopishi kerak.")}
              </p>

              {/* Topshirilayotgan kassa — qabul qiluvchi sanab tekshirishi kerak */}
              {blocking.status === "PENDING_HANDOVER" &&
                blocking.counted_cash != null && (
                  <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-red-200">
                    <Wallet className="h-4 w-4 flex-shrink-0 text-red-500" />
                    <span className="text-sm text-gray-600">
                      {tr("Qabul qilinayotgan kassa:")}
                    </span>
                    <b className="text-base tabular-nums text-gray-900">
                      {tr("{{counted_cash}} so'm", { counted_cash: fmtMoney(blocking.counted_cash) })}
                    </b>
                    <span className="text-[11px] text-gray-400">
                      {tr("— pulni sanab tekshiring")}
                    </span>
                  </div>
                )}

              {blocking.status === "PENDING_HANDOVER" && !blocking.pending_approval && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-red-700">
                      {tr("Parolingiz bilan tasdiqlang")}
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-red-400" />
                      <Input
                        type="password"
                        className="w-52 bg-white pl-8"
                        value={acceptPassword}
                        onChange={(e) => setAcceptPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitAccept()}
                        placeholder={tr("Parol")}
                      />
                    </div>
                  </div>
                  <Button onClick={submitAccept} disabled={acceptMutation.isPending}>
                    {acceptMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    {tr("Smenani qabul qilish")}
                  </Button>
                </div>
              )}
              {/* Tasdiq rejimi: qabul parol o'rniga admin/menejer tasdiqlaydi */}
              {blocking.status === "PENDING_HANDOVER" && blocking.pending_approval && canForce && (
                <div className="mt-3">
                  <Button onClick={submitApprove} disabled={approveMutation.isPending}>
                    {approveMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    {tr("Kassani tasdiqlash")}
                  </Button>
                  <p className="mt-1.5 text-xs text-red-600/70">
                    {tr("Tasdiqlangach sessiya yopiladi va (xodim ishda davom etsa) yangi kassa 0 so'mdan ochiladi.")}
                  </p>
                </div>
              )}
              {acceptError && (
                <p className="mt-2 text-sm text-red-600">{acceptError}</p>
              )}

              {canForce && (
                <div className="mt-3 border-t border-red-200 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-100"
                    onClick={() => setForceDialog(true)}
                  >
                    {tr("Majburiy yopish (menejer/admin)")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sessiya yo'q va blok ham yo'q — smenani ochish */}
      {!my && !blocking && cashStaff && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-gray-900">{tr("Smena ochilmagan")}</p>
              <p className="text-sm text-gray-500">
                {tr("Smena ochilmaguncha bron va to'lov qabul qilib bo'lmaydi — tushum hech kimning kassasiga tushmaydi. Kassa 0 so'mdan boshlanadi.")}
              </p>
            </div>
          </div>
          <Button
            onClick={() => doAction(() => openMutation.mutateAsync({ opening_cash: 0 }))}
            disabled={saving}
          >
            {openMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Play className="mr-1.5 h-4 w-4" />
            {tr("Smenani ochish")}
          </Button>
        </div>
      )}

      {/* FAOL sessiya */}
      {my && my.status === "ACTIVE" && (
        <div
          className={cn(
            "rounded-2xl border p-4",
            cutDue
              ? "border-amber-300 bg-amber-50/70"
              : workEnded && !my.continue_after_end
                ? "border-amber-200 bg-amber-50/50"
                : "bg-white"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  cutDue || workEnded
                    ? "bg-amber-100 text-amber-600"
                    : "bg-emerald-100 text-emerald-600"
                )}
              >
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-gray-900">
                  {tr("Smena faol")}
                  {my.continue_after_end && (
                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                      {tr("qo'shimcha vaqt")}
                    </span>
                  )}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  {tr("{{v}} dan beri · boshlang'ich kassa: {{opening_cash}} so'm", { v: my.started_at
                    ? format(new Date(my.started_at), "dd.MM HH:mm")
                    : "—", opening_cash: fmtMoney(my.opening_cash) })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {workEnded && !my.continue_after_end && (
                <Button
                  variant="outline"
                  onClick={() => doAction(() => continueMutation.mutateAsync({}))}
                  disabled={saving}
                >
                  {continueMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Play className="mr-1.5 h-4 w-4" />
                  {tr("Davom etish")}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => openCount("cash")}
                className="border-sky-300 text-sky-700 hover:bg-sky-50"
              >
                <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                {tr("Kassani topshirish")}
              </Button>
              <Button onClick={() => openCount("end")}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {tr("Smenani tugallash")}
              </Button>
            </div>
          </div>

          {/* Naqdsiz to'lovlar — shu smenada qabul qilingan (kassaga
              kirmaydi). Har yangi smenada 0 dan boshlanadi. */}
          <NonCashMethods rows={expectedData?.methods} className="mt-3" />

          {cutDue && (
            <p
              className={cn(
                "mt-3 rounded-xl px-3 py-2 text-sm font-medium",
                cutRequired
                  ? "bg-amber-100/80 text-amber-800"
                  : "bg-sky-50 text-sky-800"
              )}
            >
              {tr("Kunlik kassa kesimi vaqti keldi ({{day_close}}) —", { day_close: state.day_close })}{" "}
              {cutRequired ? (
                <>
                  {tr("kassani topshiring. Topshirilmaguncha bron va to'lov qabul qilib bo'lmaydi; kesimgacha bo'lgan pul topshirilgach ish davom etadi.")}
                </>
              ) : (
                <>
                  {tr("kassani topshirish tavsiya etiladi. Ishni davom ettirishingiz mumkin, lekin topshirilmagan pul kassada yig'ilib boraveradi.")}
                </>
              )}
            </p>
          )}
          {workEnded && !my.continue_after_end && !cutDue && (
            <p className="mt-3 rounded-xl bg-amber-100/60 px-3 py-2 text-sm text-amber-800">
              {tr("Ish vaqtingiz tugadi. Keyingi xodim kelmagan bo'lsa \"Davom etish\" ni bosing, aks holda smenani tugallang.")}
            </p>
          )}
          {actionError && <p className="mt-2 text-sm text-red-500">{actionError}</p>}
        </div>
      )}

      {/* Topshirilgan — qabul kutilmoqda */}
      {my && my.status === "PENDING_HANDOVER" && (
        <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
          <div>
            <p className="font-bold text-sky-800">{tr("Smena tugallandi")}</p>
            <p className="text-sm text-sky-700/80">
              {my.pending_approval
                ? tr("Admin yoki menejer tasdig'i kutilmoqda — tasdiqlangach sessiya yopiladi va yangi kassa 0 so'mdan ochiladi. Bu vaqtda ishlash mumkin emas.")
                : tr("Keyingi xodim o'z logini bilan kirib, parol orqali qabul qilishi kutilmoqda. Hisob-kitobingiz saqlandi.")}
            </p>
          </div>
        </div>
      )}

      {/* Yopilgandan keyingi hisobot */}
      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              {tr("Kassa hisoboti")}
            </DialogTitle>
          </DialogHeader>
          {report && (
            <div className="space-y-2 py-2 text-sm">
              {/* Kunlik kesim bo'yicha topshirildi — qaysi davr uchun */}
              {report.handed_at && report.started_at && report.ended_at && (
                <div className="flex flex-wrap justify-between gap-x-3 rounded-lg bg-sky-50 px-3 py-2 text-sky-700">
                  <span>{tr("Kunlik kesim bo'yicha")}</span>
                  <span className="font-semibold tabular-nums">
                    {format(new Date(report.started_at), "dd.MM HH:mm")} →{" "}
                    {format(new Date(report.ended_at), "dd.MM HH:mm")}
                  </span>
                </div>
              )}
              <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-500">{tr("Kutilgan summa")}</span>
                <span className="font-bold tabular-nums">
                  {tr("{{expected_cash}} so'm", { expected_cash: fmtMoney(report.expected_cash) })}
                </span>
              </div>
              <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-500">{tr("Siz sanagan summa")}</span>
                <span className="font-bold tabular-nums">
                  {tr("{{counted_cash}} so'm", { counted_cash: fmtMoney(report.counted_cash) })}
                </span>
              </div>
              <div
                className={cn(
                  "flex justify-between rounded-lg px-3 py-2",
                  !report.cash_diff
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                )}
              >
                <span>{tr("Farq")}</span>
                <span className="font-bold tabular-nums">
                  {tr("{{v}} so'm", { v: report.cash_diff ? fmtMoney(report.cash_diff) : "0" })}
                  {!report.cash_diff && tr(" — mos keldi")}
                </span>
              </div>
              {report.handed_at && Number(report.carried_cash || 0) > 0 && (
                <div className="flex justify-between rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                  <span>{tr("Kassada qoldirildi")}</span>
                  <span className="font-bold tabular-nums">
                    {tr("{{v}} so'm", { v: fmtMoney(report.carried_cash) })}
                  </span>
                </div>
              )}
              {/* Smenada qabul qilingan naqdsiz to'lovlar — kassaga kirmaydi */}
              {report.methods && (
                <NonCashMethods rows={report.methods} compact className="px-3" />
              )}
              {report.handed_at && (
                <p className="px-3 text-xs leading-relaxed text-gray-500">
                  {tr("Kesimdan keyingi tushum kassada qoldi — u yangi kassa hisobida davom etadi.")}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setReport(null)}>{tr("Yopish")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ko'r sanash dialogi */}
      <Dialog open={!!countDialog} onOpenChange={(o) => !o && setCountDialog(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {countDialog === "cash" ? tr("Kassani topshirish") : tr("Smenani tugallash")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Kunlik kesim bo'yicha topshirish — qaysi kungacha */}
            {cutMode && (
              <CashCutPicker data={expectedData} choice={cutChoice} onChange={chooseCut} />
            )}
            {/* Kassada bo'lishi kerak bo'lgan summa — tarkibi bilan */}
            {expectedData && (
              <div
                className={cn(
                  "rounded-xl border border-primary-100 bg-primary-50/60 px-3.5 py-2.5 transition-opacity",
                  // Fonda yangi hisob olinayotganda raqam eskirgan bo'lishi
                  // mumkin — buni yashirmaymiz, aks holda xodim eski summani
                  // haqiqiy deb o'qib qoladi
                  expectedFetching && "opacity-60"
                )}
              >
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  {activeCut ? tr("Topshiriladigan summa") : tr("Kassada bo'lishi kerak")}
                  {expectedFetching && <Loader2 className="h-3 w-3 animate-spin" />}
                </p>
                <p className="text-xl font-bold tabular-nums text-primary-700">
                  {tr("{{expected_cash}} so'm", { expected_cash: fmtMoney(dueNow) })}
                </p>
                {/* Tarkib: kesim tanlangan bo'lsa — o'sha kesimgacha */}
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                  {tr("Boshlang'ich {{opening_cash}} + naqd to'lovlar {{payments_cash}} + do'kon {{shop_cash}} − naqd xarajatlar {{expenses_cash}}", { opening_cash: fmtMoney((activeCut ?? expectedData).opening_cash), payments_cash: fmtMoney((activeCut ?? expectedData).payments_cash), shop_cash: fmtMoney((activeCut ?? expectedData).shop_cash), expenses_cash: fmtMoney((activeCut ?? expectedData).expenses_cash) })}
                </p>
                {/* Kesimdan keyingi naqd xarajat shu kunlarning pulidan
                    to'langan — u kassada yo'q, shuning uchun topshirilmaydi
                    (kamomad ham yozilmaydi) */}
                {activeCut && activeCut.carried_cash > 0 && (
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                    {tr("Kesimdan keyingi naqd xarajatlar shu puldan to'langan: {{carried}} so'm topshirilmaydi, yangi kassaning boshlang'ich summasi bo'ladi.", { carried: fmtMoney(activeCut.carried_cash) })}
                  </p>
                )}
                {/* Naqdsiz turlar kassaga kirmaydi — alohida ko'rsatiladi */}
                <NonCashMethods
                  rows={(activeCut ?? expectedData).methods}
                  compact
                  className="mt-1.5 border-t border-primary-100/70 pt-1.5"
                />
                {activeCut && cashLeftAfter(expectedData, activeCut) > 0 && (
                  <p className="mt-1.5 border-t border-primary-100/70 pt-1.5 text-[11px] leading-relaxed text-gray-500">
                    {tr("Topshirgach kassada qoladi: {{left}} so'm — yangi kassa hisobida davom etadi.", { left: fmtMoney(cashLeftAfter(expectedData, activeCut)) })}
                  </p>
                )}
              </div>
            )}
            <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600">
              {activeCut ? tr("Shu kunlar uchun") : tr("Kassadagi")}{" "}<b>{activeCut ? tr("topshirayotgan pulni sanab") : tr("haqiqiy pulni sanab")}</b>{" "}{tr("kiriting — farq bo'lsa sizning hisobingizga yoziladi.")}
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                {activeCut ? tr("Topshirilayotgan summa (so'm) *") : tr("Kassadagi haqiqiy summa (so'm) *")}
              </label>
              <Input
                type="number"
                min={0}
                value={counted}
                onChange={(e) => {
                  // Shu paytdan boshlab avtomatik to'ldirish maydonga tegmaydi
                  editedRef.current = true
                  setCounted(e.target.value)
                }}
                placeholder={tr("Masalan: 1 250 000")}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{tr("Izoh")}</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tr("Ixtiyoriy")}
              />
            </div>
            {/* Kesim bo'yicha topshirishda nima bo'lishi yuqorida aytilgan */}
            {countDialog === "cash" && !activeCut && (
              <p className="text-xs text-gray-400">
                {tr("Kassa yopilib, ishni davom ettirishingiz uchun yangi kassa 0 so'mdan ochiladi.")}
              </p>
            )}
            {countDialog === "end" && (
              <p className="text-xs text-gray-400">
                {tr("Smena yopiladi va keyingi xodim qabul qilishi kutiladi.")}
              </p>
            )}
            {countError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {countError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountDialog(null)}>
              {tr("Bekor qilish")}
            </Button>
            <Button
              onClick={submitCount}
              disabled={closeCashMutation.isPending || endShiftMutation.isPending}
            >
              {(closeCashMutation.isPending || endShiftMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tr("Tasdiqlash")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Majburiy yopish dialogi (menejer/admin) */}
      <Dialog open={forceDialog} onOpenChange={setForceDialog}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {tr("Smenani majburiy yopish")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              <b>{blocking?.user_name}</b>{" "}{tr("smenasi majburiy yopiladi. Kassadagi pulni sanab kiritsangiz farq o'sha xodim hisobiga yoziladi; kiritmasangiz kutilgan summa bo'yicha (farqsiz) yopiladi.")}
            </p>

            {/* Kassa taqdiri: keyingi xodimga o'tadimi yoki admin oldimi */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-gray-50 p-3">
              <Checkbox
                checked={forceHandOver}
                onCheckedChange={(v) => setForceHandOver(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <b className="font-medium text-gray-900">
                  {tr("Kassani keyingi xodim qabul qilsin")}
                </b>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                  {forceHandOver
                    ? tr("Smena «topshirilgan» holatda qoladi — keyingi xodim uni o'z paroli bilan qabul qiladi va sanalgan summa uning boshlang'ich kassasi bo'ladi.")
                    : tr("Pulni o'zingiz olasiz: smena butunlay yopiladi va keyingi xodim kassani noldan boshlaydi.")}
                </span>
              </span>
            </label>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                {tr("Kassadagi haqiqiy summa (ixtiyoriy)")}
              </label>
              <Input
                type="number"
                min={0}
                value={forceCounted}
                onChange={(e) => setForceCounted(e.target.value)}
                placeholder={tr("Sanalmagan bo'lsa bo'sh qoldiring")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{tr("Izoh")}</label>
              <Input
                value={forceNotes}
                onChange={(e) => setForceNotes(e.target.value)}
                placeholder={tr("Masalan: xodim telefon ko'tarmadi")}
              />
            </div>
            {forceError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {forceError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceDialog(false)}>
              {tr("Bekor qilish")}
            </Button>
            <Button
              variant="destructive"
              onClick={submitForce}
              disabled={forceMutation.isPending}
            >
              {forceMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tr("Majburiy yopish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
