import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { DashboardPage } from "./features/dashboard/pages/DashboardPage";
import { BookingPage } from "./features/reservations/pages/BookingPage";
import { ReservationsPage } from "./features/reservations/pages/ReservationsPage";
import { RoomsPage } from "./features/rooms/pages/RoomsPage";
import { GuestsPage } from "./features/guests/pages/GuestsPage";
import { FinancePage } from "./features/finance/pages/FinancePage";
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
          <Route path="guests" element={<GuestsPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="settings" element={<div>Sozlamalar (Tez kunda)</div>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
