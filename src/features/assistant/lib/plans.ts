import { hotelClock } from "@/lib/hotelTime"

import type { AiPlan } from "../api/assistant"

export type PlanGroups = Record<"overdue" | "today" | "later" | "nodate" | "closed", AiPlan[]>

/** Rejalarni panel bo'limlariga ajratish. "Bugun" — mehmonxona vaqti bo'yicha.
 *  Panelning o'zi ham, sarlavhadagi tugma belgisi (bugungi + muddati o'tgan)
 *  ham shu bitta qoidaga tayanadi — ikkalasi bir-biriga zid ko'rsatmasin. */
export function groupPlans(plans: AiPlan[], today: string = hotelClock(new Date())?.ymd ?? ""): PlanGroups {
  const out: PlanGroups = { overdue: [], today: [], later: [], nodate: [], closed: [] }
  for (const p of plans) {
    if (p.status !== "open") out.closed.push(p)
    else if (p.overdue) out.overdue.push(p)
    else if (!p.due_local) out.nodate.push(p)
    else if (p.due_local.slice(0, 10) === today) out.today.push(p)
    else out.later.push(p)
  }
  return out
}
