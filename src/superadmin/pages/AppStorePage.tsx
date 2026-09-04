import { useRef, useState } from "react"
import {
  Download,
  FileUp,
  Loader2,
  MonitorDown,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatFileSize } from "@/features/apps/api/apps"
import { panelApi, panelError } from "../api/client"
import {
  useDeletePanelApp,
  usePanelApps,
  useUploadPanelApp,
  type PanelAppRelease,
} from "../api/panel"
import {
  PanelButton,
  PanelDialog,
  PanelEmpty,
  PanelHeading,
  PanelInput,
  PanelNotice,
  PanelSelect,
} from "../components/ui"

/**
 * Dasturlar do'koni — panel tomoni.
 *
 * Egasi Android APK va Windows o'rnatuvchilarini shu yerga yuklaydi;
 * mehmonxona administratorlari ularni o'z tizimidagi "Ilovalar"
 * sahifasidan yuklab oladi. Yuklab olishlar soni har fayl yonida —
 * yangi versiya qancha tarqalgani ko'rinib turadi.
 */

const PLATFORM_META = {
  ANDROID: { label: "Android", icon: Smartphone, tone: "text-emerald-400" },
  WINDOWS: { label: "Windows", icon: MonitorDown, tone: "text-sky-400" },
} as const

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

interface Draft {
  platform: "ANDROID" | "WINDOWS"
  name: string
  version: string
  notes: string
  file: File | null
}

const EMPTY_DRAFT: Draft = {
  platform: "ANDROID",
  name: "",
  version: "",
  notes: "",
  file: null,
}

export function AppStorePage() {
  const { data: releases = [], isLoading } = usePanelApps()
  const upload = useUploadPanelApp()
  const remove = useDeletePanelApp()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft?.file) return
    setError(null)
    try {
      await upload.mutateAsync({
        platform: draft.platform,
        name: draft.name,
        version: draft.version,
        notes: draft.notes,
        file: draft.file,
      })
      setNotice(`"${draft.name}" do'konga qo'shildi`)
      setDraft(null)
      window.setTimeout(() => setNotice(null), 4000)
    } catch (e) {
      setError(panelError(e))
    }
  }

  const drop = async (release: PanelAppRelease) => {
    if (
      !confirm(
        `"${release.name}" do'kondan o'chiriladi. Mehmonxonalar uni boshqa ` +
          `yuklab ololmaydi. Davom etasizmi?`
      )
    )
      return
    setError(null)
    try {
      await remove.mutateAsync(release.id)
    } catch (e) {
      setError(panelError(e))
    }
  }

  const grab = async (release: PanelAppRelease) => {
    setError(null)
    setDownloading(release.id)
    try {
      const { data } = await panelApi.get<Blob>(`/apps/${release.id}/download`, {
        responseType: "blob",
        timeout: 10 * 60 * 1000,
      })
      const url = URL.createObjectURL(data)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = release.original_name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(panelError(e))
    } finally {
      setDownloading(null)
    }
  }

  const pickFile = (file: File | null) => {
    setDraft((d) => {
      if (!d) return d
      // Nom bo'sh bo'lsa fayl nomidan taklif qilinadi — egasi qayta termaydi
      const suggested =
        d.name || (file ? file.name.replace(/\.[^.]+$/, "") : "")
      return { ...d, file, name: suggested }
    })
  }

  return (
    <div>
      <PanelHeading
        title="Dasturlar do'koni"
        subtitle="Mehmonxona administratorlari yuklab oladigan fayllar"
        action={
          <PanelButton onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="h-4 w-4" />
            Dastur yuklash
          </PanelButton>
        }
      />

      {error && <PanelNotice>{error}</PanelNotice>}
      {notice && <PanelNotice tone="success">{notice}</PanelNotice>}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : releases.length === 0 ? (
        <PanelEmpty>
          Do'kon bo'sh — "Dastur yuklash" bilan birinchi faylni qo'shing
        </PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Dastur</th>
                  <th className="px-3 py-2.5 font-medium">Platforma</th>
                  <th className="px-3 py-2.5 font-medium">Fayl</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Yuklab olingan
                  </th>
                  <th className="px-3 py-2.5 font-medium">Qo'shilgan</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {releases.map((release) => {
                  const meta = PLATFORM_META[release.platform]
                  return (
                    <tr key={release.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-200">
                          {release.name}
                          {release.version && (
                            <span className="ml-1.5 text-xs text-slate-500">
                              v{release.version}
                            </span>
                          )}
                        </p>
                        {release.notes && (
                          <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                            {release.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs",
                            meta.tone
                          )}
                        >
                          <meta.icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        {release.original_name}
                        <span className="text-slate-600">
                          {" "}
                          · {formatFileSize(release.file_size)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                        {release.download_count}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-400">
                        {formatDate(release.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <PanelButton
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={downloading === release.id}
                            onClick={() => grab(release)}
                          >
                            {downloading === release.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </PanelButton>
                          <PanelButton
                            variant="danger"
                            className="h-7 px-2 text-xs"
                            onClick={() => drop(release)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </PanelButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PanelDialog
        open={!!draft}
        title="Yangi dastur"
        onClose={() => (upload.isPending ? null : setDraft(null))}
      >
        <form onSubmit={submit} className="space-y-3">
          <PanelSelect
            label="Platforma"
            value={draft?.platform || "ANDROID"}
            onChange={(e) =>
              setDraft(
                (d) =>
                  d && { ...d, platform: e.target.value as Draft["platform"] }
              )
            }
          >
            <option value="ANDROID">Android (APK)</option>
            <option value="WINDOWS">Windows (EXE / MSI)</option>
          </PanelSelect>

          {/* Fayl tanlash — yashirin input ustidagi katta tugma */}
          <div>
            <span className="text-xs font-medium text-slate-400">Fayl</span>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".apk,.aab,.exe,.msi,.msix,.zip"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-3 text-left text-sm text-slate-300 transition-colors hover:border-emerald-500/50 hover:bg-white/[0.03]"
            >
              <FileUp className="h-4 w-4 flex-shrink-0 text-slate-500" />
              {draft?.file ? (
                <span className="min-w-0">
                  <span className="block truncate">{draft.file.name}</span>
                  <span className="text-xs text-slate-500">
                    {formatFileSize(draft.file.size)}
                  </span>
                </span>
              ) : (
                <span className="text-slate-500">
                  APK yoki Windows o'rnatuvchisini tanlang...
                </span>
              )}
            </button>
          </div>

          <PanelInput
            label="Nomi"
            value={draft?.name || ""}
            onChange={(e) =>
              setDraft((d) => d && { ...d, name: e.target.value })
            }
            placeholder="GoHotel Staff"
            required
          />
          <PanelInput
            label="Versiya (ixtiyoriy)"
            value={draft?.version || ""}
            onChange={(e) =>
              setDraft((d) => d && { ...d, version: e.target.value })
            }
            placeholder="1.4.0"
          />
          <PanelInput
            label="Izoh (ixtiyoriy)"
            value={draft?.notes || ""}
            onChange={(e) =>
              setDraft((d) => d && { ...d, notes: e.target.value })
            }
            placeholder="Nima o'zgardi — administratorlarga ko'rinadi"
          />

          {error && <PanelNotice>{error}</PanelNotice>}

          <div className="flex justify-end gap-2 pt-1">
            <PanelButton
              type="button"
              variant="ghost"
              disabled={upload.isPending}
              onClick={() => setDraft(null)}
            >
              Bekor qilish
            </PanelButton>
            <PanelButton
              type="submit"
              disabled={upload.isPending || !draft?.file}
            >
              {upload.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {upload.isPending ? "Yuklanmoqda..." : "Yuklash"}
            </PanelButton>
          </div>
        </form>
      </PanelDialog>
    </div>
  )
}
