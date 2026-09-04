import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { LandingRedirect } from "./components/layout/LandingRedirect";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { DevicePendingPage } from "./features/auth/pages/DevicePendingPage";
import { ServiceStoppedPage } from "./features/auth/pages/ServiceStoppedPage";
import { DashboardPage } from "./features/dashboard/pages/DashboardPage";
import { BookingPage } from "./features/reservations/pages/BookingPage";
import { RoomsPage } from "./features/rooms/pages/RoomsPage";
import { FloorsPage } from "./features/rooms/pages/FloorsPage";
import { GuestsPage } from "./features/guests/pages/GuestsPage";
import { FinancePage } from "./features/finance/pages/FinancePage";
import { RoomTypesPage } from "./features/rooms/pages/RoomTypesPage";
import { AmenitiesPage } from "./features/amenities/pages/AmenitiesPage";
import { ServicesPage } from "./features/services/pages/ServicesPage";
import { HousekeepingPage } from "./features/housekeeping/pages/HousekeepingPage";
import { EmployeesPage } from "./features/employees/pages/EmployeesPage";
import { PermissionsPage } from "./features/employees/pages/PermissionsPage";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import { ReceiptDesignPage } from "./features/settings/pages/ReceiptDesignPage";
import { ExpensesPage } from "./features/expenses/pages/ExpensesPage";
import { DevicesPage } from "./features/devices/pages/DevicesPage";
import { ShopPage } from "./features/shop/pages/ShopPage";
import { MyReportsPage } from "./features/reports/pages/MyReportsPage";
import { CashReportsPage } from "./features/shifts/pages/CashReportsPage";
import { ShiftsHistoryPage } from "./features/shifts/pages/ShiftsHistoryPage";
import { ProfilePage } from "./features/profile/pages/ProfilePage";
import { LandingPage } from "./features/landing/pages/LandingPage";
import { WarehousePage } from "./features/shop/pages/WarehousePage";
import { MessagesPage } from "./features/messages/pages/MessagesPage";
import { AppsPage as AppStoreDownloadsPage } from "./features/apps/pages/AppsPage";
import { useAuthStore } from "./store/auth";

// Ildiz darvozasi: tizimga kirganlar avvalgidek boshqaruv panelini ko'radi,
// anonim mehmon esa aynan "/" manzilda landing sahifasini ko'radi (SEO:
// asosiy URL to'liq kontentli bo'lishi shart). Boshqa himoyalangan yo'llar
// avvalgidek login sahifasiga yo'naltiriladi.
const RootGate = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) {
    return location.pathname === "/" ? (
      <LandingPage />
    ) : (
      <Navigate to="/login" replace />
    );
  }
  return <MainLayout />;
};

import { panelRoutes } from "./superadmin/routes";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/device-pending" element={<DevicePendingPage />} />
        {/* Mehmonxona xizmati to'xtatilganda ko'rinadigan sahifa —
            himoyalangan yo'llardan tashqarida turadi */}
        <Route path="/service-stopped" element={<ServiceStoppedPage />} />

        {/* Boshqaruv paneli — alohida tizim (src/superadmin). O'z kirishi
            va o'z tokeni bor, mehmonxona sessiyasiga bog'liq emas. */}
        {panelRoutes()}
        {/* Landing (marketing) sahifasi — ochiq, autentifikatsiyasiz */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/leanding" element={<LandingPage />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<RootGate />}>
          <Route index element={<DashboardPage />} />
          {/* Kirish sahifasi: yon menyudagi birinchi ochiq sahifaga yo'naltiradi */}
          <Route path="start" element={<LandingRedirect />} />
          <Route path="booking" element={<BookingPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="floors" element={<FloorsPage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="devices" element={<DevicesPage />} />
          {/* Dasturlar do'koni — panel yuklagan Android/Windows fayllari */}
          <Route path="apps" element={<AppStoreDownloadsPage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="my-reports" element={<MyReportsPage />} />
          <Route path="cash-reports" element={<CashReportsPage />} />
          <Route path="shifts" element={<ShiftsHistoryPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="warehouse" element={<WarehousePage />} />
          <Route path="messages" element={<MessagesPage />} />
          {/* Boshqaruv bo'limlari (admin/menejer) */}
          <Route path="room-types" element={<RoomTypesPage />} />
          <Route path="amenities" element={<AmenitiesPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="housekeeping" element={<HousekeepingPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/receipt" element={<ReceiptDesignPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
