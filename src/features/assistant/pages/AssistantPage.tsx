import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import {
  BarChart3,
  Bot,
  CalendarPlus,
  CalendarRange,
  FileSpreadsheet,
  ListTodo,
  Lock,
  Map as MapIcon,
  MessageSquarePlus,
  MessagesSquare,
  Settings,
  Sparkles,
  X,
} from "lucide-react"

import { MAIN_NAV_LINKS, MANAGEMENT_NAV_LINKS } from "@/components/layout/navLinks"
import { tr } from "@/i18n"
import { usePermissions } from "@/lib/permissions"
import { useDebouncedValue } from "@/lib/useDebouncedValue"

import {
  aiKeys,
  stopTurn,
  useAiMe,
  useConversation,
  useConversations,
  useCreateConversation,
  usePlans,
  type AiAction,
  type AiLimits,
  type AiMessage,
} from "../api/assistant"
import { StreamHttpError, streamMessage, type SendBody } from "../api/stream"
import { ChatMessage, type MessageHandlers } from "../components/ChatMessage"
import { Composer } from "../components/Composer"
import { PanelToggle, SidePanel } from "../components/SidePanel"
import { ConversationList, PlansPanel, UsageMeter } from "../components/Sidebars"
import {
  HISTORY_OVERLAY_MAX,
  HISTORY_WIDTH,
  PANEL_PARAM,
  PLANS_OVERLAY_MAX,
  PLANS_WIDTH,
  panelDock,
  parsePanelParam,
  type PanelKey,
} from "../lib/panels"
import { groupPlans } from "../lib/plans"
import { appendBlock, appendDelta, replaceAction, upsertStep } from "../lib/segments"
import { useElementWidth } from "../lib/useElementWidth"

/* "Yordamchi" — AI chat. Xodim o'z roli doirasida savol beradi, hisobot,
   grafik va Excel oladi, ish buyuradi (bron, xarajat...) — yozuvchi amal
   faqat karta orqali, xodim tasdiqlaganda bajariladi. Suhbatlar har
   xodimga alohida saqlanadi. Suhbatlar tarixi (chapda) va rejalar (o'ngda)
   boshida yopiq — chat butun kenglikni oladi; sarlavhadagi tugma bilan
   siljib chiqadi (lib/panels.ts). */

// i18n:keys
const SUGGESTIONS: { icon: typeof Sparkles; text: string }[] = [
  { icon: BarChart3, text: "Shu hafta kunlar bo'yicha tushum grafigini ko'rsat" },
  { icon: CalendarRange, text: "Ertaga qaysi xonalar bo'sh?" },
  { icon: FileSpreadsheet, text: "Bu oy xarajatlarini toifalar bo'yicha Excelga chiqar" },
  { icon: CalendarPlus, text: "Ertaga 9:00 da kassani tekshirishni eslat" },
  { icon: MapIcon, text: "Bronni qayerda qilaman?" },
  { icon: Sparkles, text: "Bugun nimalarga e'tibor berishim kerak?" },
]
const ACCESS_TEXT: Record<string, () => string> = {
  not_configured: () => tr("Yordamchi hali sozlanmagan. Sozlovchi AI provayder va kalitni kiritishi kerak."),
  disabled: () => tr("Yordamchi mehmonxonada o'chirilgan."),
  not_member: () => tr("Yordamchi sizga ochilmagan — kerak bo'lsa sozlovchiga murojaat qiling."),
}

function liveMessage(conversationId: string): AiMessage {
  return {
    id: "live",
    conversation_id: conversationId,
    role: "assistant",
    text: "",
    blocks: [],
    steps: [],
    provider: null,
    model: null,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: null,
    error: null,
    created_at: new Date().toISOString(),
  }
}

function localUser(conversationId: string, text: string): AiMessage {
  return { ...liveMessage(conversationId), id: `local-${Date.now()}`, role: "user", text }
}

export default function AssistantPage() {
  const qc = useQueryClient()
  const me = useAiMe()
  const allowed = !!me.data?.allowed
  const [params, setParams] = useSearchParams()
  const activeId = params.get("c")
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 300)
  const conversations = useConversations(q || undefined, allowed)
  const conversation = useConversation(allowed ? activeId : null)
  const create = useCreateConversation()
  const { canRoute } = usePermissions()
  // Rejalar paneli bilan bir xil so'rov (kesh umumiy) — tugmadagi belgi uchun
  const plans = usePlans("recent", allowed)
  const planGroups = useMemo(() => groupPlans(plans.data ?? []), [plans.data])
  const urgentPlans = planGroups.overdue.length + planGroups.today.length

  const [messages, setMessages] = useState<AiMessage[]>([])
  const [live, setLive] = useState<AiMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [limits, setLimits] = useState<AiLimits | null>(null)
  // Yon panellar — boshida yopiq. Joy yetsa chat yonida turadi, yetmasa tortma.
  const [rootRef, rootWidth] = useElementWidth<HTMLDivElement>()
  const dock = panelDock(rootWidth)
  const [panels, setPanels] = useState<Record<PanelKey, boolean>>({ history: false, plans: false })
  const lastOpenedRef = useRef<PanelKey>("history")
  const abortRef = useRef<AbortController | null>(null)
  const streamConvRef = useRef<string | null>(null)
  const queueRef = useRef<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)

  // Xodimga ochiq sahifalar — yordamchi faqat shularni tavsiya qiladi
  const pages = useMemo(
    () => [...MAIN_NAV_LINKS, ...MANAGEMENT_NAV_LINKS].map((l) => l.href).filter((h) => canRoute(h)),
    [canRoute],
  )

  const closeHistory = useCallback(() => setPanels((p) => (p.history ? { ...p, history: false } : p)), [])
  const closePlans = useCallback(() => setPanels((p) => (p.plans ? { ...p, plans: false } : p)), [])
  const togglePanel = (key: PanelKey) => {
    if (panels[key]) {
      setPanels((p) => ({ ...p, [key]: false }))
      return
    }
    lastOpenedRef.current = key
    // Ikkalasi yonma-yon sig'masa — ikkinchisi yopiladi, chat torayib ketmasin
    setPanels((p) => (dock.both ? { ...p, [key]: true } : { history: key === "history", plans: key === "plans" }))
  }

  // Oyna torayib, ochiq ikkala panel yonma-yon sig'may qolsa — avvalroq ochilgani yopiladi
  useLayoutEffect(() => {
    if (!panels.history || !panels.plans || dock.both) return
    const older: PanelKey = lastOpenedRef.current === "history" ? "plans" : "history"
    setPanels((p) => ({ ...p, [older]: false }))
  }, [panels.history, panels.plans, dock.both])

  // Havola orqali ochish (/assistant?panel=plans) — panel ochiladi, parametr olib tashlanadi
  const panelParam = parsePanelParam(params.get(PANEL_PARAM))
  useEffect(() => {
    if (!panelParam) return
    lastOpenedRef.current = panelParam
    setPanels({ history: panelParam === "history", plans: panelParam === "plans" })
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(PANEL_PARAM)
        return next
      },
      { replace: true },
    )
  }, [panelParam, setParams])

  // Serverdagi tarix — oqim yo'q paytda (oqim tugagach qayta o'qiladi)
  useEffect(() => {
    if (!busy) setMessages(conversation.data?.messages ?? [])
  }, [conversation.data, busy])

  // Sahifa yangilanganda javob hali tayyorlanayotgan bo'lsa — kutib turamiz
  const serverRunning = !!conversation.data?.running && !busy
  useEffect(() => {
    if (!serverRunning || !activeId) return
    const t = setInterval(() => qc.invalidateQueries({ queryKey: aiKeys.conversation(activeId) }), 2500)
    return () => clearInterval(t)
  }, [serverRunning, activeId, qc])

  // Boshqa suhbatga o'tilsa — eski oqim to'xtatiladi (server javobni baribir
  // saqlaydi). Yangi suhbat ochilib, uning o'z oqimi boshlanganda emas.
  useEffect(() => {
    if (streamConvRef.current && streamConvRef.current !== activeId) abortRef.current?.abort()
  }, [activeId])

  // Pastga avtomatik aylantirish — xodim yuqoriga chiqib o'qiyotgan bo'lsa emas
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [messages, live])

  const refresh = useCallback(
    (id: string) => {
      qc.invalidateQueries({ queryKey: aiKeys.conversation(id) })
      qc.invalidateQueries({ queryKey: ["ai", "conversations"] })
      qc.invalidateQueries({ queryKey: aiKeys.me })
      qc.invalidateQueries({ queryKey: ["ai", "plans"] })
    },
    [qc],
  )

  const send = useCallback(
    async (body: SendBody) => {
      if (busy) return
      setNotice(null)
      let id = activeId
      if (!id) {
        try {
          id = (await create.mutateAsync(undefined)).id
        } catch (e) {
          setNotice(e instanceof Error ? e.message : tr("Suhbat ochilmadi"))
          return
        }
        setParams({ c: id }, { replace: true })
      }
      const convId = id
      stickRef.current = true
      setBusy(true)
      const optimistic = body.text ? localUser(convId, body.text) : null
      if (optimistic) setMessages((ms) => [...ms, optimistic])
      let draft = liveMessage(convId)
      const apply = (fn: (m: AiMessage) => AiMessage) => {
        draft = fn(draft)
        setLive(draft)
      }
      setLive(draft)
      const ctrl = new AbortController()
      abortRef.current = ctrl
      streamConvRef.current = convId
      let finished = false
      try {
        await streamMessage(
          convId,
          { ...body, pages, page: null },
          {
            onUser: (m) =>
              setMessages((ms) => (optimistic ? ms.map((x) => (x.id === optimistic.id ? m : x)) : [...ms, m])),
            onStart: (aid) => apply((m) => ({ ...m, id: aid })),
            onDelta: (t) => apply((m) => ({ ...m, text: m.text + t, blocks: appendDelta(m.blocks, t) })),
            onBlock: (b) => apply((m) => ({ ...m, blocks: appendBlock(m.blocks, b) })),
            onStep: (s) => apply((m) => ({ ...m, steps: upsertStep(m.steps, s) })),
            onError: (e) => apply((m) => ({ ...m, error: e.message })),
            onDone: (p) => {
              finished = true
              setMessages((ms) => [...ms, p.message])
              setLive(null)
              setLimits(p.limits)
            },
          },
          ctrl.signal,
        )
      } catch (e) {
        if (ctrl.signal.aborted) {
          // To'xtatildi — server navbatni yakunlab saqlaydi, tarix qayta o'qiladi
        } else if (e instanceof StreamHttpError) {
          if (optimistic) setMessages((ms) => ms.filter((x) => x.id !== optimistic.id))
          setNotice(
            e.code === "AI_LIMIT_REACHED"
              ? tr("Oylik token limitingiz tugagan — administratorga murojaat qiling.")
              : e.code === "AI_BUSY"
                ? tr("Yordamchi hali oldingi savolga javob bermoqda — biroz kuting.")
                : e.message,
          )
        } else {
          setNotice(tr("Aloqa uzildi — javob serverda saqlanadi, sahifani yangilab ko'ring."))
        }
      } finally {
        if (!finished) setLive(null)
        abortRef.current = null
        streamConvRef.current = null
        setBusy(false)
        refresh(convId)
      }
    },
    [busy, activeId, create, setParams, pages, refresh],
  )

  // Tasdiqlangan kartadan keyin avtomatik davom (navbatda bo'lsa — keyinroq)
  const onContinue = useCallback(
    (actionId: string) => {
      if (busy) queueRef.current.push(actionId)
      else void send({ continue_action: actionId })
    },
    [busy, send],
  )
  useEffect(() => {
    if (!busy && queueRef.current.length) {
      const next = queueRef.current.shift()!
      void send({ continue_action: next })
    }
  }, [busy, send])

  const handlers: MessageHandlers = useMemo(
    () => ({
      onActionUpdate: (a: AiAction) => {
        setMessages((ms) => replaceAction(ms, a))
        if (activeId) qc.invalidateQueries({ queryKey: aiKeys.conversation(activeId) })
      },
      onContinue,
      onReply: (text: string) => void send({ text }),
    }),
    [onContinue, send, activeId, qc],
  )

  const stop = async () => {
    abortRef.current?.abort()
    if (activeId) await stopTurn(activeId).catch(() => undefined)
  }

  const newChat = () => {
    abortRef.current?.abort()
    setParams({}, { replace: false })
    setMessages([])
    setNotice(null)
    // Tortma bo'lib chiqqan bo'lsa — yopiladi; chat yonida tursa — ochiq qoladi
    if (!dock.history) closeHistory()
  }

  const select = (id: string) => {
    setParams({ c: id })
    setNotice(null)
    if (!dock.history) closeHistory()
  }

  // ------------------------------------------------------------ ko'rinish --

  if (me.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{tr("Yuklanmoqda...")}</div>
    )
  }
  if (!me.data?.allowed) {
    const reason = me.data?.reason ?? "not_member"
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </span>
          <p className="mt-3 font-semibold text-foreground">{tr("Yordamchi")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{(ACCESS_TEXT[reason] ?? ACCESS_TEXT.not_member)()}</p>
          {me.data?.can_configure && (
            <Link
              to="/settings#ai-assistant"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Settings className="h-4 w-4" />
              {tr("Sozlamalarni ochish")}
            </Link>
          )}
        </div>
      </div>
    )
  }

  const shownLimits = limits ?? me.data.limits
  const blocked = !!shownLimits?.blocked
  const all = live ? [...messages, live] : messages
  const title = conversation.data?.title ?? (activeId ? "" : tr("Yangi suhbat"))
  return (
    <div ref={rootRef} className="flex h-full min-h-0 bg-background">
      {/* Suhbatlar tarixi — chapda, tugma bilan siljib chiqadi */}
      <SidePanel
        id="ai-history-panel"
        side="left"
        open={panels.history}
        docked={dock.history}
        width={HISTORY_WIDTH}
        overlayMaxWidth={HISTORY_OVERLAY_MAX}
        label={tr("Suhbatlar")}
        onClose={closeHistory}
      >
        <ConversationList
          items={conversations.data ?? []}
          activeId={activeId}
          loading={conversations.isLoading}
          search={search}
          onSearch={setSearch}
          onSelect={select}
          onNew={newChat}
          onDeleted={(id) => id === activeId && newChat()}
          onClose={closeHistory}
        />
      </SidePanel>

      <section className="@container flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 sm:gap-2 sm:px-3">
          <PanelToggle
            active={panels.history}
            controls="ai-history-panel"
            onClick={() => togglePanel("history")}
            icon={MessagesSquare}
            label={tr("Suhbatlar")}
          />
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-semibold text-foreground">{title || tr("Suhbat")}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {[me.data.provider_label, me.data.model].filter(Boolean).join(" · ")}
            </p>
          </div>
          {/* Tarix yopiq bo'lsa ham yangi suhbatni bir bosishda boshlash mumkin */}
          {activeId && (
            <button
              type="button"
              onClick={newChat}
              title={tr("Yangi suhbat")}
              aria-label={tr("Yangi suhbat")}
              className="flex-shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          )}
          <UsageMeter limits={shownLimits} />
          <PanelToggle
            active={panels.plans}
            controls="ai-plans-panel"
            onClick={() => togglePanel("plans")}
            icon={ListTodo}
            label={tr("Rejalar")}
            badge={urgentPlans}
            badgeTone={planGroups.overdue.length ? "danger" : "primary"}
            badgeLabel={tr("Bugungi va muddati o'tgan rejalar: {{count}}", { count: urgentPlans })}
          />
        </header>

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-5 sm:px-5">
            {!all.length && !conversation.isLoading ? (
              <div className="py-6 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-500/25">
                  <Bot className="h-7 w-7" />
                </span>
                <p className="mt-3 text-lg font-bold text-foreground">{tr("Qanday yordam beray?")}</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  {tr("Hisobot, grafik va Excel tayyorlayman, bron yoki xarajat kabi ishlarni tasdiqlashingiz uchun kartaga tayyorlab beraman, eslatmalar qo'yaman.")}
                </p>
                <div className="mx-auto mt-5 grid max-w-xl gap-2 text-left sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      type="button"
                      disabled={busy || blocked}
                      onClick={() => void send({ text: tr(s.text) })}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground/90 transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                    >
                      <s.icon className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span>{tr(s.text)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              all.map((m, i) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  live={m.id === live?.id && busy}
                  isLast={i === all.length - 1}
                  handlers={handlers}
                />
              ))
            )}
            {serverRunning && (
              <p className="text-center text-xs text-muted-foreground">{tr("Javob tayyorlanmoqda…")}</p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-border bg-card/60 px-3 pb-3 pt-2 sm:px-5">
          <div className="mx-auto w-full max-w-3xl space-y-1.5">
            {notice && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="flex-1">{notice}</span>
                <button type="button" onClick={() => setNotice(null)} className="text-amber-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </p>
            )}
            <Composer
              onSend={(text) => void send({ text })}
              onStop={stop}
              busy={busy}
              disabled={blocked || serverRunning}
              autoFocus
              placeholder={blocked ? tr("Oylik token limiti tugagan") : undefined}
            />
            <p className="text-center text-[10px] text-muted-foreground">
              {tr("Yordamchi xato qilishi mumkin — kartalarni tekshirib tasdiqlang. Ma'lumotlar o'chirilmaydi.")}
            </p>
          </div>
        </div>
      </section>

      {/* Rejalar — o'ngda, tugma bilan siljib chiqadi */}
      <SidePanel
        id="ai-plans-panel"
        side="right"
        open={panels.plans}
        docked={dock.plans}
        width={PLANS_WIDTH}
        overlayMaxWidth={PLANS_OVERLAY_MAX}
        label={tr("Rejalar")}
        onClose={closePlans}
      >
        <PlansPanel onClose={closePlans} />
      </SidePanel>
    </div>
  )
}
