import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  const router = useRouter();
  const { user, store, isAuthenticated, _hasHydrated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Don't do anything until Zustand has rehydrated from localStorage
    if (!_hasHydrated) {
      return;
    }

    // Already redirected, don't run again
    if (hasRedirected.current) {
      return;
    }

    // After hydration, check if we have valid auth state
    if (isAuthenticated && user && store) {
      // Fully authenticated
      setIsChecking(false);
      return;
    }

    // Hydrated but no auth state — check if there's a token in localStorage
    // (covers the case where setAuth just wrote but persist hasn't flushed yet)
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      // Token exists but Zustand state is empty. This can happen if the page
      // was refreshed right after login and persist hasn't written yet.
      // Give it one more render cycle to settle.
      const timer = setTimeout(() => {
        const currentState = useAuthStore.getState();
        if (currentState.isAuthenticated && currentState.user && currentState.store) {
          setIsChecking(false);
        } else {
          // Token is stale / Zustand state never recovered — redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('auth-storage');
          hasRedirected.current = true;
          setIsChecking(false);
          router.replace('/login');
        }
      }, 300);
      return () => clearTimeout(timer);
    }

    // Check if user is authenticated but missing role (stale state from before role implementation)
    if (isAuthenticated && user && !user.role) {
      import('@/lib/api-client').then(({ apiClient }) => {
        apiClient.get('/auth/me')
          .then(({ data }) => {
            if (data.success && data.data.user) {
              useAuthStore.getState().setUser(data.data.user);
            }
          })
          .catch((error) => {
            console.error('Failed to refresh user profile:', error);
          });
      });
    }

    // No token, no auth state — redirect to login
    hasRedirected.current = true;
    setIsChecking(false);
    router.replace('/login');
  }, [_hasHydrated, isAuthenticated, user, store, router]);

  return {
    isChecking,
    isAuthenticated: isAuthenticated && !isChecking,
    user,
    store,
  };
}
