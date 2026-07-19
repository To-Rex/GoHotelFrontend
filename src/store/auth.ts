import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE";

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: Role;
  hotel_id?: string;
  branch_id?: string;
  // Backend `/auth/me` da qaytaradigan ruxsat kodlari (faqat EMPLOYEE uchun to'ladi).
  // `undefined` — profil hali yuklanmagan (eski sessiya).
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      // Profilni (shu jumladan ruxsatlarni) tokenlarga tegmasdan yangilash
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
