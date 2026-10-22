import {
  Activity,
  BellRing,
  CheckCircle2,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Timer,
  TriangleAlert,
  Users,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import { useSystemStatus } from "../api/panel"
import {
  PanelBadge,
  PanelButton,
  PanelCard,
  PanelHeading,
  PanelNotice,
  PanelSection,
  PanelStat,
} from "../components/ui"
import { tr } from "@/i18n"

/**
 * Tizim holati — baza, fayl ombori, push, rejalashtiruvchi, resurslar va
 * ma'lumotlardagi konfliktlar bir qarashda. Har 30 soniyada o'zi yangilanadi.
 */
const COUNT_LABELS: Record<string, string> = {
  hotels: tr("Mehmonxonalar"),
  branches: tr("Filiallar"),
  users: tr("Xodimlar"),
  guests: tr("Mehmonlar"),
  reservations: tr("Bronlar"),
  payments: tr("To'lovlar"),
  invoices: tr("Hisob-fakturalar"),
  expenses: tr("Xarajatlar"),
  shift_sessions: tr("Smenalar"),
  user_sessions: tr("Sessiyalar"),
  trusted_devices: tr("Ishonchli qurilmalar"),
  reservation_penalties: tr("Jarimalar"),
  guest_feedback: tr("Mehmon murojaatlari"),
  shop_sales: tr("Do'kon savdolari"),
  housekeeping_tasks: tr("Xo'jalik vazifalari"),
  notifications: tr("Bildirishnomalar"),
  audit_logs: tr("Harakatlar tarixi"),
  face_sightings: tr("Kamera ko'rinishlari"),
  app_releases: tr("Do'kondagi dasturlar"),
  panel_users: tr("Panel foydalanuvchilari"),
}

type ConflictSeverity = "critical" | "warning"

const CONFLICT_GROUPS: {
  title: string
  items: { key: string; label: string; severity: ConflictSeverity }[]
}[] = [
  {
    title: tr("Ma'lumotlar konfliktlari"),
    items: [
      { key: "double_bookings", label: tr("Ustma-ust bronlar"), severity: "critical" },
      { key: "hourly_overlaps", label: tr("Soatlik to'qnashuvlar"), severity: "critical" },
      { key: "active_in_archived_rooms", label: tr("Arxiv xonada faol bron"), severity: "critical" },
      { key: "stale_occupied_rooms", label: tr("Mehmoni yo'q band xonalar"), severity: "warning" },
      { key: "checked_in_rooms_not_occupied", label: tr("Xona holati mos emas"), severity: "warning" },
      { key: "room_branch_mismatch", label: tr("Xona filiali mos emas"), severity: "critical" },
      { key: "user_branch_mismatch", label: tr("Xodim filiali mos emas"), severity: "critical" },
    ],
  },
  {
    title: tr("Operatsion ogohlantirishlar"),
    items: [
      { key: "open_shifts_inactive_staff", label: tr("Faol bo'lmagan xodimda smena"), severity: "warning" },
      { key: "pending_handovers", label: tr("Tasdiq kutayotgan kassalar"), severity: "warning" },
      { key: "stuck_tasks", label: tr("24 soatdan oshgan vazifalar"), severity: "warning" },
      { key: "overpaid_invoices", label: tr("Ortiqcha to'langan hisoblar"), severity: "warning" },
      { key: "overpaid_reservations", label: tr("Ortiqcha to'langan bronlar"), severity: "warning" },
    ],
  },
  {
    title: tr("Baza bloklari"),
    items: [
      { key: "blocked_queries", label: tr("Bloklangan so'rovlar"), severity: "critical" },
      { key: "long_running_queries", label: tr("Uzoq so'rovlar"), severity: "warning" },
      { key: "idle_in_transactions", label: tr("Bekor tranzaksiyalar"), severity: "warning" },
    ],
  },
]

function formatBytes(value?: number | null): string {
  if (value == null) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let number = value
  let unit = 0
  while (number >= 1024 && unit < units.length - 1) {
    number /= 1024
    unit += 1
  }
  return `${number >= 10 || unit === 0 ? Math.round(number) : number.toFixed(1)} ${units[unit]}`
}

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return tr("{{d}} kun {{h}} soat", { d, h })
  if (h > 0) return tr("{{h}} soat {{m}} daq", { h, m })
  return tr("{{m}} daq", { m })
}

function Status({
  ok,
  label,
  tone = "neutral",
}: {
  ok: boolean
  label?: string
  tone?: "neutral" | "success" | "warning" | "danger" | "info"
}) {
  return (
    <PanelBadge tone={ok ? tone === "neutral" ? "success" : tone : "danger"}>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {label ?? (ok ? tr("Ishlayapti") : tr("Ishlamayapti"))}
    </PanelBadge>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value ?? "—"}</span>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: typeof Server
  title: string
  status?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <PanelCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-slate-100">
          <Icon className="h-4 w-4 text-slate-500" />
          {title}
        </p>
        {status}
      </div>
      <div className="divide-y divide-white/[0.06]">{children}</div>
    </PanelCard>
  )
}

function ConflictRow({
  label,
  value,
  severity,
}: {
  label: string
  value: number | null | undefined
  severity: ConflictSeverity
}) {
  const bad = value != null && value > 0
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="min-w-0 truncate text-[13px] text-slate-300">{label}</span>
      {bad ? (
        <PanelBadge tone={severity === "critical" ? "danger" : "warning"}>
          {value}
        </PanelBadge>
      ) : value == null ? (
        <PanelBadge tone="neutral">?</PanelBadge>
      ) : (
        <PanelBadge tone="success">OK</PanelBadge>
      )}
    </div>
  )
}

export function SystemPage() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useSystemStatus()

  const diagnostics = data?.diagnostics
  const conflicts = diagnostics?.conflicts ?? {}
  const problems = CONFLICT_GROUPS.flatMap((group) =>
    group.items
      .map((item) => ({ ...item, value: conflicts[item.key] ?? null }))
      .filter((item) => item.value != null && item.value > 0)
  )
  const hasCritical = problems.some((item) => item.severity === "critical")
  const capacity = diagnostics?.capacity
  const runtime = diagnostics?.runtime
  const connPct =
    data?.database.connections != null && data.database.max_connections
      ? Math.round(
          (data.database.connections / data.database.max_connections) * 100
        )
      : null
  const diskPct = capacity?.disk_percent ?? null
  const checkedAt = diagnostics?.checked_at
    ? new Date(diagnostics.checked_at).toLocaleTimeString()
    : new Date(dataUpdatedAt).toLocaleTimeString()

  return (
    <div>
      <PanelHeading
        title={tr("Tizim holati")}
        subtitle={tr("Baza, fayl ombori, push, rejalashtiruvchi, resurslar va konfliktlar")}
        action={
          <PanelButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            {tr("Yangilash")}
          </PanelButton>
        }
      />

      {isError && <PanelNotice>{panelError(error)}</PanelNotice>}

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : (
        <div className="space-y-5">
          <PanelCard
            className={cn(
              "flex flex-wrap items-center gap-3",
              hasCritical
                ? "border-rose-500/20 bg-rose-500/[0.04]"
                : problems.length
                  ? "border-amber-500/20 bg-amber-500/[0.04]"
                  : "border-emerald-500/15 bg-emerald-500/[0.03]"
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg",
                hasCritical
                  ? "bg-rose-500/10 text-rose-300"
                  : problems.length
                    ? "bg-amber-500/10 text-amber-300"
                    : "bg-emerald-500/10 text-emerald-300"
              )}
            >
              {problems.length ? (
                <TriangleAlert className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-100">
                {!diagnostics
                  ? tr("Diagnostika mavjud emas — backendni yangilang")
                  : problems.length
                    ? tr("{{count}} ta muammo aniqlandi", { count: problems.length })
                    : tr("Hamma tekshiruvlar toza")}
              </p>
              <p className="text-[11px] text-slate-500">
                {tr("Oxirgi tekshiruv: {{time}}", { time: checkedAt })}
              </p>
            </div>
            <PanelBadge
              tone={hasCritical ? "danger" : problems.length ? "warning" : "success"}
            >
              {problems.length
                ? hasCritical
                  ? tr("Kritik")
                  : tr("Ogohlantirish")
                : tr("OK")}
            </PanelBadge>
          </PanelCard>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PanelStat
              label={tr("Ochiq smenalar")}
              value={data.database.open_shifts ?? 0}
              icon={Timer}
            />
            <PanelStat
              label={tr("Ulanishlar")}
              value={`${data.database.connections ?? 0} / ${data.database.max_connections ?? "?"}`}
              hint={
                connPct != null
                  ? `${connPct}% · ${tr("Faol")}: ${data.database.active_connections ?? 0}`
                  : undefined
              }
              icon={Database}
            />
            <PanelStat
              label={tr("Disk")}
              value={diskPct != null ? `${diskPct}%` : "—"}
              hint={
                capacity?.disk_used != null && capacity.disk_total != null
                  ? `${formatBytes(capacity.disk_used)} / ${formatBytes(capacity.disk_total)}`
                  : undefined
              }
              icon={HardDrive}
            />
            <PanelStat
              label={tr("Jonli sessiyalar")}
              value={data.database.live_sessions ?? 0}
              icon={Users}
            />
          </div>

          <PanelSection
            title={tr("Konfliktlar va ogohlantirishlar")}
            subtitle={tr("0 — muammo yo'q; son — tekshirish kerak")}
          >
            {!diagnostics ? (
              <PanelNotice>{tr("Diagnostika mavjud emas — backendni yangilang")}</PanelNotice>
            ) : (
              <div className="grid gap-3 lg:grid-cols-3">
                {CONFLICT_GROUPS.map((group) => (
                  <PanelCard key={group.title} className="p-0">
                    <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {group.title}
                    </p>
                    <div className="divide-y divide-white/[0.06]">
                      {group.items.map((item) => (
                        <ConflictRow
                          key={item.key}
                          label={item.label}
                          value={conflicts[item.key]}
                          severity={item.severity}
                        />
                      ))}
                    </div>
                  </PanelCard>
                ))}
              </div>
            )}
          </PanelSection>

          <div className="grid gap-3 md:grid-cols-2">
            <Section
              icon={Server}
              title={tr("Dastur")}
              status={<Status ok label={`v${data.app.version}`} />}
            >
              <Row label={tr("Muhit")} value={data.app.env} />
              <Row label={tr("Ishlab turibdi")} value={uptime(data.app.uptime_seconds)} />
              <Row label={tr("Server vaqti")} value={new Date(data.app.server_time).toLocaleString()} />
              <Row
                label={tr("Vaqt mintaqasi")}
                value={`UTC${data.app.tz_offset_minutes >= 0 ? "+" : ""}${data.app.tz_offset_minutes / 60}`}
              />
              {runtime?.python && <Row label="Python" value={runtime.python} />}
              {runtime?.platform && (
                <Row
                  label={tr("Platforma")}
                  value={<span className="font-mono text-xs">{runtime.platform}</span>}
                />
              )}
              {runtime?.pid != null && <Row label="PID" value={runtime.pid} />}
            </Section>

            <Section
              icon={Database}
              title={tr("Ma'lumotlar bazasi")}
              status={<Status ok={data.database.ok} />}
            >
              {data.database.ok ? (
                <>
                  <Row label={tr("PostgreSQL")} value={data.database.version} />
                  <Row label={tr("Hajmi")} value={data.database.size} />
                  <Row
                    label={tr("Ulanishlar")}
                    value={`${data.database.connections ?? 0} / ${data.database.max_connections ?? "?"}${connPct != null ? ` (${connPct}%)` : ""}`}
                  />
                  <Row label={tr("Faol ulanishlar")} value={data.database.active_connections ?? 0} />
                  <Row label={tr("Migratsiya")} value={<span className="font-mono text-xs">{data.database.migration}</span>} />
                  {data.database.postmaster_started_at && (
                    <Row
                      label={tr("Baza ishga tushgan")}
                      value={new Date(data.database.postmaster_started_at).toLocaleString()}
                    />
                  )}
                  <Row label={tr("Ochiq sessiyalar")} value={data.database.live_sessions} />
                  <Row label={tr("Ochiq smenalar")} value={data.database.open_shifts} />
                </>
              ) : (
                <p className="py-2 text-xs text-rose-300">{data.database.error}</p>
              )}
            </Section>

            <Section
              icon={HardDrive}
              title={tr("Fayl ombori (MinIO)")}
              status={<Status ok={data.storage.ok} />}
            >
              <Row label={tr("Manzil")} value={<span className="font-mono text-xs">{data.storage.endpoint}</span>} />
              {data.storage.ok ? (
                (data.storage.buckets ?? []).map((bucket) => (
                  <Row
                    key={bucket.name}
                    label={bucket.name}
                    value={<Status ok={bucket.exists} label={bucket.exists ? tr("bor") : tr("yo'q")} />}
                  />
                ))
              ) : (
                <p className="py-2 text-xs text-rose-300">{data.storage.error}</p>
              )}
            </Section>

            <Section
              icon={BellRing}
              title={tr("Push (Firebase)")}
              status={<Status ok={data.push.ok} label={data.push.ok ? tr("Sozlangan") : tr("Sozlanmagan")} />}
            >
              <Row label={tr("Loyiha")} value={data.push.project_id ?? "—"} />
              <Row label={tr("Kalit panelda saqlangan")} value={data.push.panel_key_stored ? tr("ha") : tr("yo'q")} />
              {data.push.updated_at && (
                <Row label={tr("Yangilangan")} value={new Date(data.push.updated_at).toLocaleString()} />
              )}
              {data.push.error && <p className="py-2 text-xs text-rose-300">{data.push.error}</p>}
            </Section>

            <Section
              icon={Timer}
              title={tr("Avtomatlashtirish")}
              status={<Status ok={data.scheduler.running} label={data.scheduler.running ? tr("Ishlayapti") : tr("To'xtagan")} />}
            >
              <Row label={tr("Avto-chiqish")} value={data.scheduler.auto_checkout_enabled ? tr("yoqilgan") : tr("o'chirilgan")} />
              <Row label={tr("Tekshiruv oralig'i")} value={tr("{{v}} soniya", { v: data.scheduler.interval_seconds })} />
              <Row label={tr("Kechikish chegarasi")} value={tr("{{v}} daqiqa", { v: data.scheduler.grace_minutes })} />
            </Section>

            <Section icon={HardDrive} title={tr("Resurslar")}>
              {capacity?.disk_total != null ? (
                <>
                  <Row
                    label={tr("Disk")}
                    value={`${formatBytes(capacity.disk_used)} / ${formatBytes(capacity.disk_total)} (${capacity.disk_percent ?? 0}%)`}
                  />
                  <Row label={tr("Bo'sh joy")} value={formatBytes(capacity.disk_free)} />
                </>
              ) : (
                <Row label={tr("Disk")} value="—" />
              )}
              {capacity?.load_1m != null ? (
                <Row
                  label={tr("Yuklama (load average)")}
                  value={`${capacity.load_1m} / ${capacity.load_5m} / ${capacity.load_15m}`}
                />
              ) : (
                <Row label={tr("Yuklama (load average)")} value="—" />
              )}
            </Section>

            <Section icon={Activity} title={tr("Yozuvlar soni")}>
              <div className="grid grid-cols-2 gap-x-4 py-1">
                {Object.entries(data.database.counts ?? {}).map(([table, count]) => (
                  <div key={table} className="flex justify-between gap-2 py-1 text-[13px]">
                    <span className="truncate text-slate-500">{COUNT_LABELS[table] ?? table}</span>
                    <span className="tabular-nums text-slate-200">
                      {count == null ? "?" : new Intl.NumberFormat("ru-RU").format(count)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  )
}
