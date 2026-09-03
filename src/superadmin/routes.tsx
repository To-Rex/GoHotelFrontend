import { Route } from "react-router-dom"

import { HotelDetailPage } from "./pages/HotelDetailPage"
import { HotelsPage } from "./pages/HotelsPage"
import { OverviewPage } from "./pages/OverviewPage"
import { PanelLayout } from "./pages/PanelLayout"
import { PanelLoginPage } from "./pages/PanelLoginPage"
import { PanelUsersPage } from "./pages/PanelUsersPage"
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
        <Route path="hotels" element={<HotelsPage />} />
        <Route path="hotels/:hotelId" element={<HotelDetailPage />} />
        <Route path="users" element={<PanelUsersPage />} />
        <Route path="security" element={<SecurityPage />} />
      </Route>
    </>
  )
}
