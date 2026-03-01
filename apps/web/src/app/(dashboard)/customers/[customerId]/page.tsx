'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Award,
  Gift,
  Heart,
  MessageSquare,
  History,
  TrendingUp,
  Users,
  Calendar,
  ShoppingBag,
  AlertTriangle,
  Star,
  Crown,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  state?: string;
  tier: string;
  loyaltyPoints: number;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  dateOfBirth?: string;
  anniversary?: string;
  notes?: string;
  createdAt: string;
}

interface LoyaltyInfo {
  tier: string;
  currentPoints: number;
  lifetimePoints: number;
  totalSpent: string;
  purchaseCount: number;
  tierProgress: {
    currentTier: string;
    nextTier: string | null;
    pointsToNext: number;
    progress: number;
  };
  recentTransactions: {
    id: string;
    points: number;
    type: string;
    description: string;
    createdAt: string;
  }[];
}

interface BuyingHabits {
  preferredMetalTypes?: Record<string, number>;
  preferredCategories?: { categoryId: string; name: string; percentage: number }[];
  purchaseOccasions?: Record<string, number>;
  budgetTier?: string;
  averagePurchaseValue?: string;
  totalPurchases?: number;
  totalSpent?: string;
  rfmSegment?: string;
  churnRiskScore?: string;
  lastPurchaseDate?: string;
  predictedNextPurchaseDate?: string;
}

interface Referral {
  id: string;
  referredId: string;
  referredName: string;
  status: string;
  createdAt: string;
  referrerRewardPoints?: number;
}

interface WishlistItem {
  id: string;
  wishlistType: string;
  customDescription?: string;
  metalType?: string;
  inventoryItem?: { name: string; sku: string };
  priority: string;
  status: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  finalAmount: string;
  paymentStatus: string;
  items?: {
    itemName: string;
    quantity: number;
    rate: string;
    totalAmount: string;
  }[];
}

const TIER_COLORS = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

const TIER_ICONS = {
  bronze: Award,
  silver: Award,
  gold: Star,
  platinum: Crown,
};

const SEGMENT_COLORS: Record<string, string> = {
  champions: 'bg-green-100 text-green-800',
  loyal: 'bg-blue-100 text-blue-800',
  potential: 'bg-cyan-100 text-cyan-800',
  new: 'bg-teal-100 text-teal-800',
  promising: 'bg-indigo-100 text-indigo-800',
  need_attention: 'bg-yellow-100 text-yellow-800',
  about_to_sleep: 'bg-orange-100 text-orange-800',
  at_risk: 'bg-red-100 text-red-800',
  cant_lose: 'bg-pink-100 text-pink-800',
  hibernating: 'bg-gray-100 text-gray-800',
  lost: 'bg-slate-100 text-slate-800',
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loyaltyInfo, setLoyaltyInfo] = useState<LoyaltyInfo | null>(null);
  const [buyingHabits, setBuyingHabits] = useState<BuyingHabits | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'loyalty' | 'history' | 'habits' | 'wishlist' | 'referrals' | 'messages'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch customer details
        const customerRes = await apiClient.get(`/customers/${customerId}`);
        if (customerRes.data.success) {
          setCustomer(customerRes.data.data);
        }

        // Fetch loyalty info
        const loyaltyRes = await apiClient.get(`/customers/${customerId}/loyalty/info`);
        if (loyaltyRes.data.success) {
          setLoyaltyInfo(loyaltyRes.data.data);
        }

        // Fetch buying habits
        const habitsRes = await apiClient.get(`/customers/${customerId}/buying-habits`);
        if (habitsRes.data.success) {
          setBuyingHabits(habitsRes.data.data);
        }

        // Fetch referrals
        const referralsRes = await apiClient.get(`/customers/${customerId}/referrals`);
        if (referralsRes.data.success) {
          setReferrals(referralsRes.data.data || []);
        }

        // Fetch wishlist
        const wishlistRes = await apiClient.get(`/customers/${customerId}/wishlist`);
        if (wishlistRes.data.success) {
          setWishlist(wishlistRes.data.data || []);
        }

        // Fetch purchase history
        const historyRes = await apiClient.get(`/customers/${customerId}/purchase-history`);
        if (historyRes.data.success) {
          setPurchaseHistory(historyRes.data.data.invoices || []);
        }
      } catch (error) {
        console.error('Failed to fetch customer data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      fetchData();
    }
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Customer not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const TierIcon = TIER_ICONS[customer.tier as keyof typeof TIER_ICONS] || Award;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {customer.firstName} {customer.lastName}
            </h1>
            <Badge className={TIER_COLORS[customer.tier as keyof typeof TIER_COLORS] || 'bg-gray-100'}>
              <TierIcon className="h-3 w-3 mr-1" />
              {customer.tier.charAt(0).toUpperCase() + customer.tier.slice(1)}
            </Badge>
          </div>
          <p className="text-gray-500">{customer.customerCode}</p>
        </div>
        <Link href={`/customers/${customerId}/edit`}>
          <Button variant="outline">Edit Customer</Button>
        </Link>
      </div>

      {/* Contact Info Card */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Phone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium">{customer.phone}</p>
            </div>
          </div>
          {customer.email && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{customer.email}</p>
              </div>
            </div>
          )}
          {customer.whatsapp && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">WhatsApp</p>
                <p className="font-medium">{customer.whatsapp}</p>
                {customer.whatsappOptIn && (
                  <Badge variant="outline" className="text-xs mt-1">Opted In</Badge>
                )}
              </div>
            </div>
          )}
          {customer.city && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{customer.city}{customer.state ? `, ${customer.state}` : ''}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {['overview', 'loyalty', 'history', 'habits', 'wishlist', 'referrals', 'messages'].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className="capitalize whitespace-nowrap"
          >
            {tab === 'habits' ? 'Buying Habits' : tab === 'history' ? 'Purchase History' : tab}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Loyalty Summary */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-yellow-600" />
              <h3 className="font-semibold">Loyalty Points</h3>
            </div>
            <p className="text-3xl font-bold">{customer.loyaltyPoints.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Current Balance</p>
            {loyaltyInfo?.tierProgress && loyaltyInfo.tierProgress.nextTier && (
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span>{loyaltyInfo.tierProgress.currentTier}</span>
                  <span>{loyaltyInfo.tierProgress.nextTier}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{ width: `${loyaltyInfo.tierProgress.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {loyaltyInfo.tierProgress.pointsToNext} points to {loyaltyInfo.tierProgress.nextTier}
                </p>
              </div>
            )}
          </Card>

          {/* Purchase Summary */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Purchase History</h3>
            </div>
            <p className="text-3xl font-bold">{buyingHabits?.totalPurchases || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Total Purchases</p>
            {buyingHabits?.totalSpent && (
              <p className="text-lg font-medium mt-4">
                {formatCurrency(parseFloat(buyingHabits.totalSpent))}
                <span className="text-sm text-gray-500 font-normal ml-1">Lifetime Value</span>
              </p>
            )}
          </Card>

          {/* Engagement */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold">Engagement</h3>
            </div>
            {buyingHabits?.rfmSegment && (
              <div className="mb-3">
                <Badge className={SEGMENT_COLORS[buyingHabits.rfmSegment] || 'bg-gray-100'}>
                  {buyingHabits.rfmSegment.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              </div>
            )}
            {buyingHabits?.churnRiskScore && parseFloat(buyingHabits.churnRiskScore) > 50 && (
              <div className="flex items-center gap-2 text-orange-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>High churn risk ({Math.round(parseFloat(buyingHabits.churnRiskScore))}%)</span>
              </div>
            )}
            {buyingHabits?.lastPurchaseDate && (
              <p className="text-sm text-gray-500 mt-3">
                Last purchase: {new Date(buyingHabits.lastPurchaseDate).toLocaleDateString()}
              </p>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'loyalty' && loyaltyInfo && (
        <div className="space-y-6">
          {/* Loyalty Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-sm text-gray-500">Current Points</p>
              <p className="text-2xl font-bold">{loyaltyInfo.currentPoints.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-500">Lifetime Points</p>
              <p className="text-2xl font-bold">{loyaltyInfo.lifetimePoints.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-500">Total Spent</p>
              <p className="text-2xl font-bold">{formatCurrency(parseFloat(loyaltyInfo.totalSpent))}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-500">Total Purchases</p>
              <p className="text-2xl font-bold">{loyaltyInfo.purchaseCount}</p>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Recent Point Transactions</h3>
            {loyaltyInfo.recentTransactions?.length > 0 ? (
              <div className="space-y-3">
                {loyaltyInfo.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-sm text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge className={tx.points >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {tx.points >= 0 ? '+' : ''}{tx.points} pts
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No transactions yet</p>
            )}
          </Card>

          {/* Redeem Reward Button */}
          <div className="flex justify-center">
            <Link href={`/customers/${customerId}/redeem`}>
              <Button>
                <Gift className="h-4 w-4 mr-2" />
                Redeem Reward
              </Button>
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Purchase Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-sm text-gray-500">Total Purchases</p>
              <p className="text-2xl font-bold">{buyingHabits?.totalPurchases || 0}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-500">Lifetime Value</p>
              <p className="text-2xl font-bold">
                {buyingHabits?.totalSpent ? formatCurrency(parseFloat(buyingHabits.totalSpent)) : 'Rs 0'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-500">Average Purchase</p>
              <p className="text-2xl font-bold">
                {buyingHabits?.averagePurchaseValue ? formatCurrency(parseFloat(buyingHabits.averagePurchaseValue)) : 'Rs 0'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-500">Last Purchase</p>
              <p className="text-lg font-bold">
                {buyingHabits?.lastPurchaseDate
                  ? new Date(buyingHabits.lastPurchaseDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'N/A'}
              </p>
            </Card>
          </div>

          {/* Invoice List */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History className="h-5 w-5" />
              Purchase History
            </h3>
            {purchaseHistory.length > 0 ? (
              <div className="space-y-3">
                {purchaseHistory.map((invoice) => (
                  <div key={invoice.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-lg">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{formatCurrency(parseFloat(invoice.finalAmount))}</p>
                        <Badge className={
                          invoice.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : invoice.paymentStatus === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }>
                          {invoice.paymentStatus}
                        </Badge>
                      </div>
                    </div>

                    {invoice.items && invoice.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium text-gray-700 mb-2">Items:</p>
                        <div className="space-y-1">
                          {invoice.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {item.itemName} × {item.quantity}
                              </span>
                              <span className="font-medium">{formatCurrency(parseFloat(item.totalAmount))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Link href={`/sales/${invoice.id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No purchase history yet</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'habits' && buyingHabits && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Metal Type Preferences */}
          {buyingHabits.preferredMetalTypes && Object.keys(buyingHabits.preferredMetalTypes).length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Metal Preferences</h3>
              <div className="space-y-3">
                {Object.entries(buyingHabits.preferredMetalTypes).map(([metal, percentage]) => (
                  <div key={metal}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{metal}</span>
                      <span>{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${metal === 'gold' ? 'bg-yellow-500' : 'bg-gray-500'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Category Preferences */}
          {buyingHabits.preferredCategories && buyingHabits.preferredCategories.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Category Preferences</h3>
              <div className="space-y-3">
                {buyingHabits.preferredCategories.map((cat) => (
                  <div key={cat.categoryId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{cat.name}</span>
                      <span>{cat.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Purchase Occasions */}
          {buyingHabits.purchaseOccasions && Object.keys(buyingHabits.purchaseOccasions).length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Purchase Occasions</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(buyingHabits.purchaseOccasions).map(([occasion, percentage]) => (
                  <Badge key={occasion} variant="outline" className="capitalize">
                    {occasion.replace(/_/g, ' ')} ({percentage}%)
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Budget & Frequency */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Spending Patterns</h3>
            <div className="grid grid-cols-2 gap-4">
              {buyingHabits.budgetTier && (
                <div>
                  <p className="text-sm text-gray-500">Budget Tier</p>
                  <Badge className="mt-1 capitalize">{buyingHabits.budgetTier.replace(/_/g, ' ')}</Badge>
                </div>
              )}
              {buyingHabits.averagePurchaseValue && (
                <div>
                  <p className="text-sm text-gray-500">Avg. Purchase</p>
                  <p className="font-medium">{formatCurrency(parseFloat(buyingHabits.averagePurchaseValue))}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'wishlist' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Wishlist Items</h3>
            <Link href={`/customers/${customerId}/wishlist/add`}>
              <Button size="sm">
                <Heart className="h-4 w-4 mr-2" />
                Add to Wishlist
              </Button>
            </Link>
          </div>
          {wishlist.length > 0 ? (
            <div className="space-y-3">
              {wishlist.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {item.wishlistType === 'specific_item' && item.inventoryItem ? (
                        <p className="font-medium">{item.inventoryItem.name}</p>
                      ) : (
                        <p className="font-medium">{item.customDescription || `${item.metalType} item`}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Added {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{item.priority}</Badge>
                      <Badge className={item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Heart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No wishlist items yet</p>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Referrals Made</h3>
            <Link href={`/customers/${customerId}/referrals/add`}>
              <Button size="sm">
                <Users className="h-4 w-4 mr-2" />
                Record Referral
              </Button>
            </Link>
          </div>
          {referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.map((ref) => (
                <Card key={ref.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Referred: {ref.referredName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={
                        ref.status === 'rewarded' ? 'bg-green-100 text-green-800' :
                        ref.status === 'qualified' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100'
                      }>
                        {ref.status}
                      </Badge>
                      {ref.referrerRewardPoints && (
                        <Badge variant="outline">+{ref.referrerRewardPoints} pts</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No referrals yet</p>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">WhatsApp Messages</h3>
            <Button size="sm" disabled={!customer.whatsappOptIn}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </div>
          <Card className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {customer.whatsappOptIn
                ? 'No messages yet'
                : 'Customer has not opted in for WhatsApp messages'}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
