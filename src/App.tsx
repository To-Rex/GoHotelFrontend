import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { DashboardPage } from "./features/dashboard/pages/DashboardPage";
import { BookingPage } from "./features/reservations/pages/BookingPage";
import { ReservationsPage } from "./features/reservations/pages/ReservationsPage";
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
import { ExpensesPage } from "./features/expenses/pages/ExpensesPage";
import { ShopPage } from "./features/shop/pages/ShopPage";
import { MyReportsPage } from "./features/reports/pages/MyReportsPage";
import { ShiftsHistoryPage } from "./features/shifts/pages/ShiftsHistoryPage";
import { WarehousePage } from "./features/shop/pages/WarehousePage";
import { useAuthStore } from "./store/auth";

// Auth Guard Component
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="booking" element={<BookingPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="floors" element={<FloorsPage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="my-reports" element={<MyReportsPage />} />
          <Route path="shifts" element={<ShiftsHistoryPage />} />
          <Route path="warehouse" element={<WarehousePage />} />
          {/* Boshqaruv bo'limlari (admin/menejer) */}
          <Route path="room-types" element={<RoomTypesPage />} />
          <Route path="amenities" element={<AmenitiesPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="housekeeping" element={<HousekeepingPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
