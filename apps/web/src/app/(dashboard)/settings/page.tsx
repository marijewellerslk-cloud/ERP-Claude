'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  Palette,
  Users,
  Store,
  Bell,
  Shield,
  Database,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const isSuperAdmin = user?.permissions?.includes('*:*');

  const settingsSections = [
    {
      title: 'Label Designer',
      description: 'Design and manage custom label templates for inventory',
      icon: Palette,
      href: '/settings/label-designer',
      requiresSuperAdmin: false, // Allow all users
    },
    {
      title: 'User Management',
      description: 'Manage users, roles, and permissions',
      icon: Users,
      href: '/settings/users',
      requiresSuperAdmin: false,
      comingSoon: false,
    },
    {
      title: 'Store Settings',
      description: 'Configure store information and preferences',
      icon: Store,
      href: '/settings/stores',
      requiresSuperAdmin: false,
      comingSoon: false,
    },
    {
      title: 'Notifications',
      description: 'Configure email and system notifications',
      icon: Bell,
      href: '/settings/notifications',
      requiresSuperAdmin: false,
      comingSoon: false,
    },
    {
      title: 'Security',
      description: 'Security settings and authentication options',
      icon: Shield,
      href: '/settings/security',
      requiresSuperAdmin: false,
      comingSoon: false,
    },
    {
      title: 'Data & Backup',
      description: 'Backup and restore your data',
      icon: Database,
      href: '/settings/backup',
      requiresSuperAdmin: true,
      comingSoon: false,
    },
  ];

  const availableSections = settingsSections.filter(
    section => !section.requiresSuperAdmin || isSuperAdmin
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your application settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  {section.comingSoon && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      Coming Soon
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(section.href)}
                  disabled={section.comingSoon}
                >
                  {section.comingSoon ? 'Coming Soon' : 'Configure'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isSuperAdmin && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <p className="text-sm text-blue-800">
              Some settings are only available to super administrators. Contact your administrator if you need access.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
