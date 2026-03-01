'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
  Plus,
  Gift,
  Award,
  Percent,
  Wrench,
  Package,
  Star,
  Crown,
  Edit,
  Trash2,
  Loader2,
  Search,
} from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  description?: string;
  rewardType: 'service' | 'discount' | 'product';
  serviceType?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: string;
  discountAppliesTo?: string;
  pointsCost: number;
  isActive: boolean;
  minimumTier: string;
  stockLimit?: number;
  stockRemaining?: number;
  validFrom?: string;
  validUntil?: string;
  redemptionCount?: number;
}

interface RewardStats {
  totalRewards: number;
  activeRewards: number;
  totalRedemptions: number;
  mostPopular?: string;
}

const TIER_ICONS = {
  bronze: Award,
  silver: Award,
  gold: Star,
  platinum: Crown,
};

const TIER_COLORS = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

const TYPE_ICONS = {
  service: Wrench,
  discount: Percent,
  product: Package,
};

export default function LoyaltyRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [stats, setStats] = useState<RewardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch rewards catalog
        const rewardsRes = await apiClient.get('/customers/loyalty/rewards', {
          params: {
            type: typeFilter !== 'all' ? typeFilter : undefined,
            tier: tierFilter !== 'all' ? tierFilter : undefined,
            includeInactive: showInactive,
          },
        });
        if (rewardsRes.data.success) {
          let filteredRewards = rewardsRes.data.data || [];
          if (searchQuery) {
            filteredRewards = filteredRewards.filter((r: Reward) =>
              r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
          }
          setRewards(filteredRewards);
        }

        // Fetch stats
        const statsRes = await apiClient.get('/customers/loyalty/rewards/stats');
        if (statsRes.data.success) {
          setStats(statsRes.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch rewards:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [typeFilter, tierFilter, showInactive, searchQuery]);

  const getTypeIcon = (type: string) => {
    const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS] || Gift;
    return Icon;
  };

  const getTierIcon = (tier: string) => {
    const Icon = TIER_ICONS[tier as keyof typeof TIER_ICONS] || Award;
    return Icon;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Loyalty Rewards Catalog</h1>
          <p className="text-gray-500 mt-1">Manage rewards that customers can redeem with points</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Reward
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Rewards</p>
                <p className="text-2xl font-bold">{stats.totalRewards}</p>
              </div>
              <Gift className="h-8 w-8 text-blue-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Rewards</p>
                <p className="text-2xl font-bold">{stats.activeRewards}</p>
              </div>
              <Award className="h-8 w-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Redemptions</p>
                <p className="text-2xl font-bold">{stats.totalRedemptions}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Most Popular</p>
                <p className="text-lg font-bold truncate">{stats.mostPopular || 'N/A'}</p>
              </div>
              <Crown className="h-8 w-8 text-purple-600" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search rewards..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="service">Services</SelectItem>
            <SelectItem value="discount">Discounts</SelectItem>
            <SelectItem value="product">Products</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="bronze">Bronze+</SelectItem>
            <SelectItem value="silver">Silver+</SelectItem>
            <SelectItem value="gold">Gold+</SelectItem>
            <SelectItem value="platinum">Platinum</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showInactive ? 'default' : 'outline'}
          onClick={() => setShowInactive(!showInactive)}
        >
          {showInactive ? 'Hide Inactive' : 'Show Inactive'}
        </Button>
      </div>

      {/* Rewards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : rewards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((reward) => {
            const TypeIcon = getTypeIcon(reward.rewardType);
            const TierIcon = getTierIcon(reward.minimumTier);
            return (
              <Card
                key={reward.id}
                className={`p-6 ${!reward.isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TypeIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-1">{reward.name}</h3>
                {reward.description && (
                  <p className="text-sm text-gray-500 mb-4">{reward.description}</p>
                )}

                {/* Reward details */}
                <div className="space-y-2 mb-4">
                  {reward.rewardType === 'discount' && reward.discountValue && (
                    <p className="text-sm">
                      {reward.discountType === 'percentage'
                        ? `${reward.discountValue}% off`
                        : formatCurrency(parseFloat(reward.discountValue)) + ' off'}
                      {reward.discountAppliesTo && (
                        <span className="text-gray-500"> on {reward.discountAppliesTo}</span>
                      )}
                    </p>
                  )}
                  {reward.rewardType === 'service' && reward.serviceType && (
                    <p className="text-sm capitalize">
                      Free {reward.serviceType.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className={TIER_COLORS[reward.minimumTier as keyof typeof TIER_COLORS]}>
                    <TierIcon className="h-3 w-3 mr-1" />
                    {reward.minimumTier}+
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {reward.rewardType}
                  </Badge>
                  {!reward.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>

                {/* Stock info */}
                {reward.stockLimit && (
                  <p className="text-xs text-gray-500 mb-2">
                    {reward.stockRemaining || 0} / {reward.stockLimit} remaining
                  </p>
                )}

                {/* Points cost */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm text-gray-500">Points Required</span>
                  <span className="text-xl font-bold text-blue-600">
                    {reward.pointsCost.toLocaleString()}
                  </span>
                </div>

                {/* Redemption count */}
                {reward.redemptionCount !== undefined && reward.redemptionCount > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Redeemed {reward.redemptionCount} times
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Gift className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No rewards found</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first loyalty reward to get started
          </p>
          <Button className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add Reward
          </Button>
        </Card>
      )}
    </div>
  );
}
