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
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import { useSystemStatus } from "../api/panel"
import { PanelButton, PanelCard, PanelHeading, PanelNotice } from "../components/ui"
import { tr } from "@/i18n"

/**
 * Tizim holati — baza, fayl ombori, push, rejalashtiruvchi va yozuvlar soni
 * bir qarashda. Har 30 soniyada o'zi yangilanadi.
 */

const COUNT_LABELS: Record<string, string> = {
  hotels: tr("Mehmonxonalar"),
  branches: tr("Filiallar"),
  users: tr("Xodimlar"),
  guests: tr("Mehmonlar"),
  reservations: tr("Bronlar"),
  payments: tr("To'lovlar"),
  shop_sales: tr("Do'kon savdolari"),
  housekeeping_tasks: tr("Xo'jalik vazifalari"),
  notifications: tr("Bildirishnomalar"),
  audit_logs: tr("Harakatlar tarixi"),
  face_sightings: tr("Kamera ko'rinishlari"),
  app_releases: tr("Do'kondagi dasturlar"),
}

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return tr("{{d}} kun {{h}} soat", { d, h })
  if (h > 0) return tr("{{h}} soat {{m}} daq", { h, m })
  return tr("{{m}} daq", { m })
}

function Status({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label ?? (ok ? tr("Ishlayapti") : tr("Ishlamayapti"))}
    </span>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
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
        <p className="flex items-center gap-2 font-semibold text-slate-100">
          <Icon className="h-4 w-4 text-slate-500" />
          {title}
        </p>
        {status}
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </PanelCard>
  )
}

export function SystemPage() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useSystemStatus()

  return (
    <div>
      <PanelHeading
        title={tr("Tizim holati")}
        subtitle={tr("Baza, fayl ombori, push va rejalashtiruvchi — bir qarashda")}
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
        <>
          <p className="mb-3 text-xs text-slate-500">
            {tr("Yangilangan: {{time}}", { time: new Date(dataUpdatedAt).toLocaleTimeString() })}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Section icon={Server} title={tr("Dastur")} status={<Status ok label={`v${data.app.version}`} />}>
              <Row label={tr("Muhit")} value={data.app.env} />
              <Row label={tr("Ishlab turibdi")} value={uptime(data.app.uptime_seconds)} />
              <Row label={tr("Server vaqti")} value={new Date(data.app.server_time).toLocaleString()} />
              <Row label={tr("Vaqt mintaqasi")} value={`UTC${data.app.tz_offset_minutes >= 0 ? "+" : ""}${data.app.tz_offset_minutes / 60}`} />
            </Section>

            <Section icon={Database} title={tr("Ma'lumotlar bazasi")} status={<Status ok={data.database.ok} />}>
              {data.database.ok ? (
                <>
                  <Row label={tr("PostgreSQL")} value={data.database.version} />
                  <Row label={tr("Hajmi")} value={data.database.size} />
                  <Row label={tr("Ulanishlar")} value={data.database.connections} />
                  <Row label={tr("Migratsiya")} value={<span className="font-mono text-xs">{data.database.migration}</span>} />
                  <Row label={tr("Ochiq sessiyalar")} value={data.database.live_sessions} />
                  <Row label={tr("Ochiq smenalar")} value={data.database.open_shifts} />
                </>
              ) : (
                <p className="py-2 text-xs text-red-300">{data.database.error}</p>
              )}
            </Section>

            <Section icon={HardDrive} title={tr("Fayl ombori (MinIO)")} status={<Status ok={data.storage.ok} />}>
              <Row label={tr("Manzil")} value={<span className="font-mono text-xs">{data.storage.endpoint}</span>} />
              {data.storage.ok ? (
                (data.storage.buckets ?? []).map((b) => (
                  <Row key={b.name} label={b.name} value={<Status ok={b.exists} label={b.exists ? tr("bor") : tr("yo'q")} />} />
                ))
              ) : (
                <p className="py-2 text-xs text-red-300">{data.storage.error}</p>
              )}
            </Section>

            <Section icon={BellRing} title={tr("Push (Firebase)")} status={<Status ok={data.push.ok} label={data.push.ok ? tr("Sozlangan") : tr("Sozlanmagan")} />}>
              <Row label={tr("Loyiha")} value={data.push.project_id ?? "—"} />
              <Row label={tr("Kalit panelda saqlangan")} value={data.push.panel_key_stored ? tr("ha") : tr("yo'q")} />
              {data.push.updated_at && (
                <Row label={tr("Yangilangan")} value={new Date(data.push.updated_at).toLocaleString()} />
              )}
              {data.push.error && <p className="py-2 text-xs text-red-300">{data.push.error}</p>}
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

            <Section icon={Activity} title={tr("Yozuvlar soni")}>
              <div className="grid grid-cols-2 gap-x-4 py-1">
                {Object.entries(data.database.counts ?? {}).map(([table, n]) => (
                  <div key={table} className="flex justify-between gap-2 py-1 text-sm">
                    <span className="truncate text-slate-500">{COUNT_LABELS[table] ?? table}</span>
                    <span className="tabular-nums text-slate-200">{new Intl.NumberFormat("ru-RU").format(n)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  )
}
