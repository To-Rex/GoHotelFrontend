import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/* AI yordamchi ("Yordamchi" sahifasi) — server: /api/v1/ai/*.

   Kim nimani ko'radi (server tekshiradi, bu yerda faqat ko'rinish):
   - Suhbat — sozlovchi ro'yxatga qo'shgan xodimlar (administrator ham
     ro'yxatda bo'lmasa — yo'q); sozlovchi va tizim ma'muri — doim.
   - Sarf va xodim limiti — administrator, tizim ma'muri, sozlovchi.
   - Xavfli so'rovlar jurnali — faqat tizim ma'muri va sozlovchi.
   - Sozlash (provider, kalit, kim ishlatadi) — sozlovchi va tizim ma'muri.

   Xabar yuborish oqim (SSE) bilan — stream.ts. */

export interface AiLimits {
  month_tokens: number
  monthly_limit: number | null
  hotel_monthly_limit: number | null
  hotel_month_tokens: number | null
  remaining: number | null
  blocked: boolean
}

export interface AiMe {
  enabled: boolean
  allowed: boolean
  /** not_configured | disabled | not_member | ok */
  reason: string
  can_configure: boolean
  can_manage_usage: boolean
  can_view_incidents: boolean
  provider: string | null
  provider_label: string | null
  model: string | null
  limits: AiLimits | null
}

// --- bloklar (server: app/application/services/ai/render.py) ---

export interface TableColumn {
  key: string
  label: string
  kind: "text" | "number" | "money" | "date" | "datetime"
}

export interface TextSegment {
  type: "text"
  text: string
}

export interface TableBlock {
  type: "table"
  id: string
  title: string
  columns: TableColumn[]
  rows: Record<string, unknown>[]
  total: number
}

export interface ChartBlock {
  type: "chart"
  id: string
  chart: "bar" | "line" | "area" | "pie"
  title: string
  unit: string | null
  x: { key: string; label: string }
  series: { key: string; label: string }[]
  data: Record<string, string | number>[]
  truncated: boolean
}

export interface StatsBlock {
  type: "stats"
  id: string
  items: { label: string; value: number | string; unit: string | null; hint: string | null; tone: "good" | "bad" | "warn" | "neutral" | null }[]
}

export interface FileBlock {
  type: "file"
  id: string
  file_id: string
  name: string
  size: number
  rows: number
}

export interface NavBlock {
  type: "nav"
  id: string
  path: string
  label: string
  note: string | null
}

export interface RepliesBlock {
  type: "replies"
  id: string
  options: string[]
}

export interface ActionField {
  name: string
  label: string
  kind: "text" | "textarea" | "number" | "integer" | "date" | "datetime" | "select" | "checkbox" | "id" | "json"
  required: boolean
  value: unknown
  display: string | null
  options: { value: string; label: string }[] | null
  in_body: boolean
  hint: string | null
}

export type ActionStatus =
  | "proposed" | "executing" | "executed" | "failed" | "rejected" | "undoing" | "undone" | "undo_failed"
  | "expired" | "unknown"

export interface AiAction {
  id: string
  kind: string
  title: string
  summary: string | null
  method: string
  path: string
  status: ActionStatus
  risk: "low" | "medium" | "high"
  page: string | null
  note: string | null
  undo_supported: boolean
  can_undo: boolean
  continue_after: boolean
  error: string | null
  result: Record<string, unknown> | null
  fields: ActionField[]
  created_at: string | null
  executed_at: string | null
  undone_at: string | null
}

export interface ActionBlock {
  type: "action"
  id: string
  action: AiAction
  mode?: "undo"
}

export interface AiPlan {
  id: string
  title: string
  note: string | null
  kind: "reminder" | "task" | "note"
  status: "open" | "done" | "cancelled"
  due_at: string | null
  /** "2026-11-23T09:00" — mehmonxona vaqti */
  due_local: string | null
  overdue: boolean
  notified_at: string | null
  done_at: string | null
  created_via: "ai" | "manual"
  conversation_id: string | null
  created_at: string | null
}

export interface PlanBlock {
  type: "plan"
  id: string
  plan: AiPlan
}

export interface EventBlock {
  type: "event"
  kind: "action_done"
  action_id: string
}

export type Block =
  | TextSegment | TableBlock | ChartBlock | StatsBlock | FileBlock | NavBlock | RepliesBlock | ActionBlock | PlanBlock
  | EventBlock

export interface StepInfo {
  id: string
  tool: string
  label: string
  detail: string | null
  status: "running" | "done" | "error"
}

export interface AiMessage {
  id: string
  conversation_id: string
  role: "user" | "assistant"
  text: string
  blocks: Block[]
  steps: StepInfo[]
  provider: string | null
  model: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number | null
  error: string | null
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  created_at: string | null
  updated_at: string | null
  preview?: string | null
}

export interface ConversationDetail extends Conversation {
  messages: AiMessage[]
  running: boolean
}

// --- so'rovlar ---

export const aiKeys = {
  me: ["ai", "me"] as const,
  conversations: (q?: string) => ["ai", "conversations", q ?? ""] as const,
  conversation: (id: string) => ["ai", "conversation", id] as const,
  plans: (status: string) => ["ai", "plans", status] as const,
  due: ["ai", "plans-due"] as const,
  settings: ["ai", "settings"] as const,
  usage: (month: string) => ["ai", "usage", month] as const,
  incidents: (filter: string) => ["ai", "incidents", filter] as const,
}

/** Yordamchi ochiqmi — menyu va sahifa shu bilan qaror qiladi. */
export function useAiMe(enabled = true) {
  return useQuery({
    queryKey: aiKeys.me,
    queryFn: async () => (await api.get<AiMe>("/ai/me")).data,
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}

export function useConversations(q?: string, enabled = true) {
  return useQuery({
    queryKey: aiKeys.conversations(q),
    queryFn: async () =>
      (await api.get<{ items: Conversation[] }>("/ai/conversations", { params: q ? { q } : {} })).data.items,
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: aiKeys.conversation(id ?? "none"),
    queryFn: async () => (await api.get<ConversationDetail>(`/ai/conversations/${id}`)).data,
    enabled: !!id,
  })
}

export function useCreateConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (title?: string) => (await api.post<Conversation>("/ai/conversations", { title })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "conversations"] }),
  })
}

export function useRenameConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) =>
      (await api.patch<Conversation>(`/ai/conversations/${id}`, { title })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "conversations"] }),
  })
}

export function useDeleteConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/ai/conversations/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "conversations"] }),
  })
}

export async function stopTurn(conversationId: string) {
  return (await api.post<{ stopped: boolean }>(`/ai/conversations/${conversationId}/stop`)).data
}

// --- amal kartalari ---

export async function confirmAction(id: string, values?: Record<string, unknown>) {
  return (await api.post<AiAction>(`/ai/actions/${id}/confirm`, { values: values ?? null })).data
}

export async function rejectAction(id: string) {
  return (await api.post<AiAction>(`/ai/actions/${id}/reject`)).data
}

export async function undoAction(id: string) {
  return (await api.post<AiAction>(`/ai/actions/${id}/undo`)).data
}

/** Excel faylni token bilan yuklab olib saqlash (havola sarlavhasiz ishlamaydi). */
export async function downloadAiFile(fileId: string, name: string) {
  const res = await api.get(`/ai/files/${fileId}`, { responseType: "blob" })
  const url = URL.createObjectURL(res.data as Blob)
  try {
    const a = document.createElement("a")
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

// --- rejalar ---

export function usePlans(status: "recent" | "open" | "done" | "cancelled" = "recent", enabled = true) {
  return useQuery({
    queryKey: aiKeys.plans(status),
    queryFn: async () => (await api.get<{ items: AiPlan[] }>("/ai/plans", { params: { status } })).data.items,
    enabled,
  })
}

/** Vaqti kelgan eslatmalar — sayt ichida ko'rsatish uchun (har daqiqa). */
export function useDuePlans(enabled: boolean) {
  return useQuery({
    queryKey: aiKeys.due,
    queryFn: async () => (await api.get<{ items: AiPlan[] }>("/ai/plans/due")).data.items,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { title: string; kind: AiPlan["kind"]; due_at?: string | null; note?: string | null }) =>
      (await api.post<AiPlan>("/ai/plans", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "plans"] }),
  })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Pick<AiPlan, "title" | "note" | "kind" | "status">> & {
      due_at?: string | null
    }) => (await api.patch<AiPlan>(`/ai/plans/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "plans"] })
      qc.invalidateQueries({ queryKey: aiKeys.due })
    },
  })
}

// --- sozlama (sozlovchi) ---

export interface ProviderInfo {
  key: string
  label: string
  base_url: string | null
  default_model: string | null
  models: string[]
  needs_base_url: boolean
}

export interface AiSettings {
  enabled: boolean
  provider: string
  model: string | null
  base_url: string | null
  has_key: boolean
  key_hint: string | null
  default_monthly_limit: number | null
  hotel_monthly_limit: number | null
  price_input: number | null
  price_output: number | null
  mask_sensitive: boolean
  updated_at: string | null
}

export interface AiMember {
  user_id: string
  name: string
  username: string
  user_type: string
  status: string
  branch_id: string | null
  allowed: boolean
  monthly_limit: number | null
  month_tokens: number
  month_cost: number | null
  month_messages: number
  last_used_at: string | null
  effective_limit?: number | null
  system?: boolean
}

export function useAiSettings(enabled = true) {
  return useQuery({
    queryKey: aiKeys.settings,
    queryFn: async () =>
      (await api.get<{ settings: AiSettings; providers: ProviderInfo[]; members: AiMember[] }>("/ai/settings")).data,
    enabled,
  })
}

export type AiSettingsUpdate = Partial<
  Pick<AiSettings, "enabled" | "provider" | "model" | "base_url" | "default_monthly_limit" | "hotel_monthly_limit" |
    "price_input" | "price_output" | "mask_sensitive">
> & { api_key?: string; clear_key?: boolean }

export function useSaveAiSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: AiSettingsUpdate) => (await api.put<{ settings: AiSettings }>("/ai/settings", data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiKeys.settings })
      qc.invalidateQueries({ queryKey: aiKeys.me })
    },
  })
}

export function useSaveAiMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { user_id: string; allowed?: boolean; monthly_limit?: number | null }[]) =>
      (await api.put<{ changed: number; members: AiMember[] }>("/ai/settings/members", { items })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiKeys.settings })
      qc.invalidateQueries({ queryKey: ["ai", "usage"] })
    },
  })
}

export interface TestResult {
  ok: boolean
  reply?: string
  latency_ms?: number
  code?: string
  message?: string
  detail?: string | null
}

export async function testAiConnection(data: { provider?: string; model?: string; base_url?: string; api_key?: string }) {
  return (await api.post<TestResult>("/ai/settings/test", data)).data
}

export async function listProviderModels(data: { provider?: string; base_url?: string; api_key?: string }) {
  return (await api.post<{ ok: boolean; models: string[]; message?: string }>("/ai/settings/models", data)).data
}

// --- sarf (administrator) ---

export interface AiUsage {
  month: string
  totals: { input: number; output: number; tokens: number; messages: number; cost_usd: number | null; active_users: number }
  hotel_monthly_limit: number | null
  default_monthly_limit: number | null
  daily: { date: string; input: number; output: number; tokens: number; messages: number }[]
  members: AiMember[]
}

export function useAiUsage(month: string, enabled = true) {
  return useQuery({
    queryKey: aiKeys.usage(month),
    queryFn: async () => (await api.get<AiUsage>("/ai/usage", { params: { month } })).data,
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useSaveLimits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { user_id: string; monthly_limit: number | null }[]) =>
      (await api.put<{ changed: number }>("/ai/usage/limits", { items })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "usage"] })
      qc.invalidateQueries({ queryKey: aiKeys.settings })
    },
  })
}

// --- xavfli so'rovlar (tizim ma'muri, sozlovchi) ---

export interface AiIncident {
  id: string
  category: string
  category_label: string
  source: "heuristic" | "model" | "server"
  reason: string | null
  question: string
  answer: string | null
  user_id: string
  user_name: string | null
  conversation_id: string | null
  reviewed: boolean
  reviewed_at: string | null
  created_at: string | null
}

export function useIncidents(filter: { reviewed?: boolean; category?: string }, enabled = true) {
  return useQuery({
    queryKey: aiKeys.incidents(JSON.stringify(filter)),
    queryFn: async () =>
      (await api.get<{ items: AiIncident[]; total: number; unreviewed: number; categories: Record<string, string> }>(
        "/ai/incidents",
        { params: { ...filter, limit: 200 } },
      )).data,
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useReviewIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reviewed }: { id: string; reviewed: boolean }) =>
      (await api.post(`/ai/incidents/${id}/review`, { reviewed })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "incidents"] }),
  })
}
