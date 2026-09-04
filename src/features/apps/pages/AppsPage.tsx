import { useState } from "react"
import {
  AppWindow,
  Download,
  Loader2,
  MonitorDown,
  Smartphone,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSeo } from "@/lib/seo"
import { cn } from "@/lib/utils"
import {
  downloadAppRelease,
  formatFileSize,
  useAppReleases,
  type AppRelease,
} from "../api/apps"

/**
 * Dasturlar do'koni — mehmonxona administratori uchun.
 *
 * Boshqaruv paneli yuklagan Android va Windows dasturlari shu yerda
 * turadi: administrator xodimlarning telefoniga APK'ni, kompyuterga
 * Windows dasturini shu sahifadan olib o'rnatadi.
 */

const PLATFORM_META = {
  ANDROID: {
    label: "Android",
    hint: "Telefonlarga o'rnatish uchun APK fayllar",
    icon: Smartphone,
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  WINDOWS: {
    label: "Windows",
    hint: "Kompyuterga o'rnatish uchun dasturlar",
    icon: MonitorDown,
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  },
} as const

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export const AppsPage = () => {
  useSeo({
    title: "Ilovalar — GoHotel",
    description: "Mehmonxona uchun Android va Windows dasturlari.",
    canonicalPath: "/apps",
    noindex: true,
  })

  const { data: releases = [], isLoading, isError } = useAppReleases()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const grab = async (release: AppRelease) => {
    setError(null)
    setDownloading(release.id)
    try {
      await downloadAppRelease(release)
    } catch {
      setError(
        `"${release.name}" yuklab olinmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.`
      )
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ilovalar</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Mehmonxona uchun rasmiy dasturlar — yuklab olib o'rnating
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Ro'yxatni olishda xatolik. Sahifani yangilab ko'ring.
        </p>
      ) : releases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <AppWindow className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">Hozircha dastur yo'q</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dasturlar tizim egasi tomonidan joylanadi va shu yerda paydo
            bo'ladi
          </p>
        </div>
      ) : (
        (Object.keys(PLATFORM_META) as (keyof typeof PLATFORM_META)[]).map(
          (platform) => {
            const rows = releases.filter((r) => r.platform === platform)
            if (rows.length === 0) return null
            const meta = PLATFORM_META[platform]
            return (
              <section key={platform}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      meta.tone
                    )}
                  >
                    <meta.icon size={16} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold leading-tight">
                      {meta.label}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {meta.hint}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {rows.map((release) => (
                    <div
                      key={release.id}
                      className="flex flex-col rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {release.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {release.version ? `v${release.version} · ` : ""}
                            {formatFileSize(release.file_size)}
                            {release.created_at
                              ? ` · ${formatDate(release.created_at)}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      {release.notes && (
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                          {release.notes}
                        </p>
                      )}

                      <div className="mt-auto pt-3">
                        <Button
                          className="w-full"
                          disabled={downloading === release.id}
                          onClick={() => grab(release)}
                        >
                          {downloading === release.id ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-1.5 h-4 w-4" />
                          )}
                          {downloading === release.id
                            ? "Yuklanmoqda..."
                            : "Yuklab olish"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          }
        )
      )}
    </div>
  )
}
