import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  permissions?: string[];
}

interface Store {
  id: string;
  name: string;
  code: string;
}

interface AuthState {
  user: User | null;
  store: Store | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setAuth: (user: User, store: Store, accessToken: string) => void;
  logout: () => void;
  setStore: (store: Store) => void;
  setUser: (user: User) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      store: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setAuth: (user, store, accessToken) => {
        localStorage.setItem('accessToken', accessToken);
        set({
          user,
          store,
          isAuthenticated: true,
        });
      },

      logout: () => {
        // Clear localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('auth-storage');

        // Clear all cookies
        if (typeof document !== 'undefined') {
          document.cookie.split(';').forEach((cookie) => {
            const cookieName = cookie.split('=')[0].trim();
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          });
        }

        // Clear zustand state
        set({
          user: null,
          store: null,
          isAuthenticated: false,
        });
      },

      setStore: (store) => {
        set({ store });
      },

      setUser: (user) => {
        set({ user });
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        store: state.store,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[AuthStore] Rehydration complete');
        state?.setHasHydrated(true);
      },
    }
  )
);
