'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';
import apiClient from '@/lib/api-client';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, logout } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Clear stale auth data ONLY if user navigated here explicitly
  // (not during the brief mount that can happen during login->dashboard redirect)
  useEffect(() => {
    // Use a small delay to avoid wiping tokens during redirect transitions
    const timer = setTimeout(() => {
      // Only clear if the page is still mounted and visible
      if (document.visibilityState === 'visible' && window.location.pathname === '/login') {
        const hasStaleToken = localStorage.getItem('accessToken');
        if (hasStaleToken) {
          logout();
        }
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - run only once on mount

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/auth/login', data);

      if (response.data.success) {
        const { accessToken, user, store } = response.data.data;

        // Set auth state
        setAuth(user, store, accessToken);

        // Wait for Zustand persist middleware to write to localStorage
        await new Promise(resolve => setTimeout(resolve, 50));

        // Use replace to avoid adding to browser history
        router.replace('/dashboard');
      }
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message || 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">MARI Jewellers</h1>
            <p className="text-gray-600 mt-2">ERP System</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@marijewellers.com"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Helper Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Default credentials: admin@marijewellers.com / Admin@123
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          © 2025 MARI Jewellers. All rights reserved.
        </p>
      </div>
    </div>
  );
}
