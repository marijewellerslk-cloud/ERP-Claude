'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Loader2, Plus, ShoppingCart, Package, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/navigation/sidebar';
import apiClient from '@/lib/api-client';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname(); // Import usePathname
  const { logout } = useAuthStore();
  const { isChecking, user, store } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Define route permissions
  const routePermissions: Record<string, string[]> = {
    '/inventory': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'stock_controller'],
    '/sales': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
    '/customers': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
    '/leads': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
    '/custom-orders': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
    '/repairs': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
    '/loans': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
    '/hrm': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
    '/karigars': ['superadmin', 'super_admin', 'owner', 'general_manager', 'stock_controller'],
    '/job-cards': ['superadmin', 'super_admin', 'owner', 'general_manager', 'stock_controller'],
    '/suppliers': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'stock_controller'],
    '/command-center': ['superadmin', 'super_admin', 'owner', 'general_manager'],
    '/accounting': ['superadmin', 'super_admin', 'owner', 'accountant'],
    '/reports': ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'accountant'],
    '/metal-position': ['superadmin', 'super_admin', 'owner', 'general_manager', 'stock_controller'],
    '/market-analysis': ['superadmin', 'super_admin', 'owner', 'general_manager'],
    '/settings': ['superadmin', 'super_admin', 'owner'],
  };

  useEffect(() => {
    if (isChecking || !user) return;

    // Check if current path requires specific permissions
    const protectedRoute = Object.keys(routePermissions).find(route => pathname.startsWith(route));

    if (protectedRoute) {
      const allowedRoles = routePermissions[protectedRoute];
      if (user.role && !allowedRoles.includes(user.role)) {
        // Redirect to dashboard if unauthorized
        // We can also redirect to a dedicated 403 page
        router.replace('/dashboard');
        // You might want to show a toast here as well
      }
    }
  }, [pathname, user, isChecking]);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      router.replace('/login');
    }
  };

  // Show loading spinner while checking authentication
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Only render dashboard if authenticated
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        user={user ? { email: user.email, role: user.role } : undefined}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              {/* Hamburger Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="p-2"
              >
                <Menu className="h-6 w-6" />
              </Button>

              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-gray-900 leading-none">MARI Jewellers</h1>
                {store && (
                  <span className="text-xs text-blue-600 font-medium">
                    {store.name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Actions */}
              <div className="hidden md:flex items-center gap-2 mr-4 border-r pr-4 border-gray-200">
                <Link href="/sales">
                  <Button variant="ghost" size="sm" className="hidden lg:flex gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    New Sale
                  </Button>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/inventory/batches/new">
                  <Button variant="ghost" size="sm" className="hidden lg:flex gap-2">
                    <Package className="h-4 w-4" />
                    New Batch
                  </Button>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Package className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/customers/new">
                  <Button variant="ghost" size="sm" className="hidden lg:flex gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add Customer
                  </Button>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-4">
                {user && (
                  <div className="hidden sm:block text-sm text-gray-700">
                    <span className="font-medium">{user.fullName}</span>
                    <span className="text-gray-500 ml-2">({user.email})</span>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
