'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, Gift, Loader2, Award, CheckCircle, XCircle } from 'lucide-react';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  customerCode: string;
  tier: string;
  loyaltyPoints: number;
}

interface Reward {
  id: string;
  rewardName: string;
  rewardDescription: string;
  rewardType: string;
  serviceType?: string;
  discountType?: string;
  discountValue?: string;
  discountAppliesTo?: string;
  pointsCost: number;
  minimumTier: string;
  isActive: boolean;
  stockRemaining?: number;
}

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

export default function RedeemRewardPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch customer details
        const customerRes = await apiClient.get(`/customers/${customerId}`);
        if (customerRes.data.success) {
          setCustomer(customerRes.data.data);
        }

        // Fetch available rewards
        const rewardsRes = await apiClient.get(`/customers/${customerId}/available-rewards`);
        if (rewardsRes.data.success) {
          setRewards(rewardsRes.data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId]);

  const canRedeem = (reward: Reward): boolean => {
    if (!customer) return false;

    const customerTierIndex = TIER_ORDER.indexOf(customer.tier.toLowerCase());
    const rewardTierIndex = TIER_ORDER.indexOf(reward.minimumTier.toLowerCase());

    const tierEligible = customerTierIndex >= rewardTierIndex;
    const pointsEligible = customer.loyaltyPoints >= reward.pointsCost;
    const stockAvailable = reward.stockRemaining === null || (reward.stockRemaining != null && reward.stockRemaining > 0);

    return tierEligible && pointsEligible && stockAvailable && reward.isActive;
  };

  const getIneligibilityReason = (reward: Reward): string | null => {
    if (!customer) return null;

    const customerTierIndex = TIER_ORDER.indexOf(customer.tier.toLowerCase());
    const rewardTierIndex = TIER_ORDER.indexOf(reward.minimumTier.toLowerCase());

    if (customerTierIndex < rewardTierIndex) {
      return `Requires ${reward.minimumTier} tier or higher`;
    }
    if (customer.loyaltyPoints < reward.pointsCost) {
      return `Need ${reward.pointsCost - customer.loyaltyPoints} more points`;
    }
    if (reward.stockRemaining != null && reward.stockRemaining <= 0) {
      return 'Out of stock';
    }
    if (!reward.isActive) {
      return 'Reward not available';
    }
    return null;
  };

  const handleRedeem = async (rewardId: string, pointsCost: number) => {
    if (!customer) return;

    const confirmed = confirm(
      `Redeem this reward for ${pointsCost} points?\n\nYour current balance: ${customer.loyaltyPoints} points\nRemaining after redemption: ${customer.loyaltyPoints - pointsCost} points`
    );

    if (!confirmed) return;

    try {
      setRedeeming(rewardId);

      const response = await apiClient.post(`/customers/${customerId}/redeem-reward`, {
        rewardId,
      });

      if (response.data.success) {
        alert('Reward redeemed successfully!');
        // Refresh data
        window.location.reload();
      } else {
        alert('Failed to redeem reward');
      }
    } catch (error: any) {
      console.error('Failed to redeem reward:', error);
      alert(error.response?.data?.error?.message || 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Redeem Rewards</h1>
          <p className="text-gray-500">
            {customer && `${customer.firstName} ${customer.lastName} (${customer.customerCode})`}
          </p>
        </div>
      </div>

      {/* Customer Points Card */}
      {customer && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                <Award className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Available Points</p>
                <p className="text-3xl font-bold">{customer.loyaltyPoints.toLocaleString()}</p>
              </div>
            </div>
            <Badge className={TIER_COLORS[customer.tier.toLowerCase()] || 'bg-gray-100'}>
              {customer.tier.toUpperCase()} TIER
            </Badge>
          </div>
        </Card>
      )}

      {/* Rewards Catalog */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Rewards</h2>
        {rewards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((reward) => {
              const eligible = canRedeem(reward);
              const reason = getIneligibilityReason(reward);

              return (
                <Card key={reward.id} className={`p-6 ${!eligible ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{reward.rewardName}</h3>
                      <p className="text-sm text-gray-600 mt-1">{reward.rewardDescription}</p>
                    </div>
                    <Badge className="ml-2" variant="outline">
                      {reward.rewardType}
                    </Badge>
                  </div>

                  {/* Reward Details */}
                  <div className="space-y-2 mb-4">
                    {reward.serviceType && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Service:</span> {reward.serviceType}
                      </p>
                    )}
                    {reward.discountType && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Discount:</span>{' '}
                        {reward.discountType === 'percentage'
                          ? `${reward.discountValue}% off`
                          : formatCurrency(parseFloat(reward.discountValue || '0'))}
                        {reward.discountAppliesTo && ` on ${reward.discountAppliesTo}`}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Minimum Tier:</span>{' '}
                      <Badge className={TIER_COLORS[reward.minimumTier.toLowerCase()] || 'bg-gray-100'} variant="outline">
                        {reward.minimumTier.toUpperCase()}
                      </Badge>
                    </p>
                    {reward.stockRemaining !== null && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Stock:</span> {reward.stockRemaining} remaining
                      </p>
                    )}
                  </div>

                  {/* Points Cost */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{reward.pointsCost.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>

                    {eligible ? (
                      <Button
                        onClick={() => handleRedeem(reward.id, reward.pointsCost)}
                        disabled={redeeming === reward.id}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                      >
                        {redeeming === reward.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Redeeming...
                          </>
                        ) : (
                          <>
                            <Gift className="h-4 w-4 mr-2" />
                            Redeem
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-red-600 text-sm mb-1">
                          <XCircle className="h-4 w-4" />
                          <span>Not Eligible</span>
                        </div>
                        {reason && <p className="text-xs text-gray-500">{reason}</p>}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No rewards available at this time</p>
            <p className="text-sm text-gray-400">Check back later for new rewards!</p>
          </Card>
        )}
      </div>

      {/* Redemption History Link */}
      <div className="text-center pt-6">
        <Button variant="outline" onClick={() => router.push(`/customers/${customerId}?tab=loyalty`)}>
          View Redemption History
        </Button>
      </div>
    </div>
  );
}
