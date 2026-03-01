"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Coins,
  Calculator,
  Truck,
  FileText,
  Settings,
  LogOut,
  User,
  PackageOpen,
  FolderTree,
  Sparkles,
  Wrench,
  BarChart3,
  UserPlus,
  Gift,
  Award,
  Users2,
  Clock,
  Calendar,
  Wallet,
  Building2,
  Hammer,
  Factory,
  Scale,
  Flame,
  LineChart,
  Eye,
  EyeOff,
  BookOpen,
  Bot,
} from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: {
    email: string
    role?: string
  }
}

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  comingSoon?: boolean
  roles?: string[]
  children?: {
    title: string
    href: string
    roles?: string[]
  }[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Sales & POS",
        href: "/sales",
        icon: ShoppingCart,
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
      },
      {
        title: "Inventory",
        href: "/inventory",
        icon: Package,
        children: [
          {
            title: "View Inventory",
            href: "/inventory",
          },
          {
            title: "Batches",
            href: "/inventory/batches",
          },
          {
            title: "Categories",
            href: "/inventory/categories",
          },
          {
            title: "Stock Transfers",
            href: "/inventory/transfers",
            roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'stock_controller'],
          },
          {
            title: "Global Search",
            href: "/inventory/global-search",
            roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'stock_controller'],
      },
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
        children: [
          {
            title: "All Customers",
            href: "/customers",
          },
          {
            title: "Loyalty Rewards",
            href: "/loyalty/rewards",
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
      },
      {
        title: "Leads",
        href: "/leads",
        icon: UserPlus,
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
      },
      {
        title: "Custom Orders",
        href: "/custom-orders",
        icon: Sparkles,
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'sales_agent'],
      },
      {
        title: "Repairs",
        href: "/repairs",
        icon: Wrench,
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
      },
      {
        title: "Gold Pawning",
        href: "/loans",
        icon: Coins,
        children: [
          {
            title: "Dashboard",
            href: "/loans",
          },
          {
            title: "New Loan",
            href: "/loans/new",
          },
          {
            title: "KYC Verification",
            href: "/loans/kyc",
          },
          {
            title: "Margin Calls",
            href: "/loans/margin-calls",
          },
          {
            title: "Auctions",
            href: "/loans/auctions",
          },
          {
            title: "Interest Rates",
            href: "/loans/interest-rates",
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
      },
    ]
  },
  {
    label: "Management",
    items: [
      {
        title: "HRM",
        href: "/hrm",
        icon: Users2,
        children: [
          {
            title: "Overview",
            href: "/hrm",
          },
          {
            title: "Employees",
            href: "/hrm/employees",
          },
          {
            title: "Attendance",
            href: "/hrm/attendance",
          },
          {
            title: "Leave Management",
            href: "/hrm/leave",
          },
          {
            title: "Payroll",
            href: "/hrm/payroll",
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager'],
      },
      {
        title: "Karigars",
        href: "/karigars",
        icon: Hammer,
        children: [
          {
            title: "All Karigars",
            href: "/karigars",
          },
          {
            title: "Job Cards",
            href: "/job-cards",
          },
          {
            title: "Scrap Inventory",
            href: "/karigars/scrap",
          },
          {
            title: "Melting Records",
            href: "/karigars/melting",
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'stock_controller'],
      },
      {
        title: "Suppliers",
        href: "/suppliers",
        icon: Truck,
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'stock_controller'],
      },
      {
        title: "Command Center",
        href: "/command-center",
        icon: Building2,
        children: [
          {
            title: "Overview",
            href: "/command-center",
          },
          {
            title: "Financial Dashboard",
            href: "/command-center/financials",
          },
          {
            title: "Gold Loans",
            href: "/command-center/loans",
          },
          {
            title: "Orders & Repairs",
            href: "/command-center/orders",
          },
          {
            title: "Customers",
            href: "/command-center/customers",
          },
          {
            title: "Activity Feed",
            href: "/command-center/activity",
          },
          {
            title: "Smart Insights",
            href: "/command-center/smart-insights",
          },
          {
            title: "Fraud & Risk",
            href: "/command-center/fraud-risk",
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager'],
      },
    ]
  },
  {
    label: "Finance & Reports",
    items: [
      {
        title: "Accounting",
        href: "/accounting",
        icon: Calculator,
        children: [
          {
            title: "Overview",
            href: "/accounting",
          },
          {
            title: "Chart of Accounts",
            href: "/accounting/chart-of-accounts",
          },
          {
            title: "Journal Entries",
            href: "/accounting/journal-entries",
          },
          {
            title: "Expenses",
            href: "/accounting/expenses",
          },
          {
            title: "Reports",
            href: "/accounting/reports",
          },
          {
            title: "General Ledger",
            href: "/accounting/ledger",
          },
          {
            title: "Public Ledger",
            href: "/accounting/public-ledger",
          },
          {
            title: "Private Ledger",
            href: "/accounting/private-ledger",
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner', 'accountant'],
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        children: [
          {
            title: "Overview",
            href: "/reports",
          },
          {
            title: "Margin Analysis",
            href: "/reports/margin-analysis",
          },
          {
            title: "Stock Aging",
            href: "/reports/stock-aging",
          },
          {
            title: "Salesperson",
            href: "/reports/salesperson",
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'store_manager', 'accountant'],
      },
      {
        title: "Metal Position",
        href: "/metal-position",
        icon: Scale,
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'stock_controller'],
      },
      {
        title: "Market Analysis",
        href: "/market-analysis",
        icon: LineChart,
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager'],
      },
      {
        title: "Gold Ledger",
        href: "/gold-ledger",
        icon: Coins,
        roles: ['superadmin', 'super_admin', 'owner', 'general_manager', 'accountant'],
      },
      {
        title: "AI Reports",
        href: "/ai-reports",
        icon: Bot,
        roles: ['superadmin', 'super_admin', 'owner'],
      },
    ]
  },
  {
    label: "System",
    items: [
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        children: [
          {
            title: "Stores",
            href: "/settings/stores",
          },
          {
            title: "Label Designer",
            href: "/settings/label-designer",
          },
        ],
        roles: ['superadmin', 'super_admin', 'owner'],
      },
    ]
  }
]

export function Sidebar({ open, onOpenChange, user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        router.push('/login')
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0">
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="text-left">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-yellow-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">MJ</span>
                </div>
                <span className="font-bold text-lg">MARI Jewellers</span>
              </div>
            </SheetTitle>
          </SheetHeader>

          <Separator />

          {/* User Info */}
          {user && (
            <>
              <div className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-yellow-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.email}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {user.role ? user.role.replace('_', ' ') : 'User'}
                    </p>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="space-y-6 px-3">
              {navGroups.map((group, groupIndex) => {
                // Filter items by role
                const filteredItems = group.items.filter(item => {
                  if (item.roles && user?.role && !item.roles.includes(user.role)) {
                    return false
                  }
                  return true
                })

                if (filteredItems.length === 0) return null

                return (
                  <div key={group.label} className="space-y-1">
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {group.label}
                    </h3>

                    {filteredItems.map((item) => (
                      <div key={item.href}>
                        <button
                          onClick={() => {
                            if (!item.comingSoon) {
                              router.push(item.href)
                              onOpenChange(false)
                            }
                          }}
                          disabled={item.comingSoon}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                            isActive(item.href) && !item.comingSoon
                              ? "bg-yellow-50 text-yellow-900"
                              : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                            item.comingSoon && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 text-left">{item.title}</span>
                          {item.comingSoon && (
                            <Badge variant="secondary" className="text-xs">
                              Soon
                            </Badge>
                          )}
                        </button>

                        {/* Sub-navigation */}
                        {item.children && !item.comingSoon && isActive(item.href) && (
                          <div className="ml-8 mt-1 space-y-1 relative border-l-2 border-gray-100 pl-2">
                            {item.children.map((child) => {
                              if (child.roles && user?.role && !child.roles.includes(user.role)) {
                                return null
                              }
                              return (
                                <button
                                  key={child.href}
                                  onClick={() => {
                                    router.push(child.href)
                                    onOpenChange(false)
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
                                    pathname === child.href
                                      ? "text-yellow-900 font-medium bg-yellow-50/50"
                                      : "text-gray-500 hover:text-gray-900"
                                  )}
                                >
                                  {child.title}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </nav>

          <Separator />

          {/* Logout Button */}
          <div className="p-4">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full justify-start gap-3"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
