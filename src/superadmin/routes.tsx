import { Route } from "react-router-dom"

import { ApiLogsPage } from "./pages/ApiLogsPage"
import { AppStorePage } from "./pages/AppStorePage"
import { AuditPage } from "./pages/AuditPage"
import { FinancePage } from "./pages/FinancePage"
import { GuestsPage } from "./pages/GuestsPage"
import { HotelDetailPage } from "./pages/HotelDetailPage"
import { HotelsPage } from "./pages/HotelsPage"
import { OverviewPage } from "./pages/OverviewPage"
import { PanelLayout } from "./pages/PanelLayout"
import { PanelLoginPage } from "./pages/PanelLoginPage"
import { PanelUsersPage } from "./pages/PanelUsersPage"
import { ReservationsPage } from "./pages/ReservationsPage"
import { SecurityPage } from "./pages/SecurityPage"

/**
 * Panel marshrutlari — bitta joyda.
 *
 * `App.tsx` ga faqat shu funksiya chaqiruvi qo'shiladi: panel o'sib
 * borsa ham asosiy marshrutlar fayli o'zgarmaydi.
 */
export function panelRoutes() {
  return (
    <>
      <Route path="/panel/login" element={<PanelLoginPage />} />
      <Route path="/panel" element={<PanelLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="hotels" element={<HotelsPage />} />
        <Route path="hotels/:hotelId" element={<HotelDetailPage />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="apps" element={<AppStorePage />} />
        <Route path="users" element={<PanelUsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="api-logs" element={<ApiLogsPage />} />
        <Route path="security" element={<SecurityPage />} />
      </Route>
    </>
  )
}
