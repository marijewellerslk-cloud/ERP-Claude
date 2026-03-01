/**
 * Seed default loyalty rewards catalog
 * Run with: npx tsx src/scripts/seed-loyalty-rewards.ts
 */

import { db } from '../config/database.js';
import { loyaltyRewardsCatalog, stores, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

interface RewardData {
  name: string;
  description?: string;
  rewardType: string;
  serviceType?: string;
  discountPercentage?: string;
  discountAmount?: string;
  pointsCost: number;
  minTier: string;
  totalAvailable?: number;
}

const DEFAULT_REWARDS: RewardData[] = [
  // Service rewards
  {
    name: 'Free Cleaning Service',
    description: 'Complimentary jewelry cleaning and polishing service',
    rewardType: 'free_service',
    serviceType: 'cleaning',
    pointsCost: 100,
    minTier: 'bronze',
  },
  {
    name: 'Free Rhodium Plating',
    description: 'Rhodium plating for white gold or silver jewelry',
    rewardType: 'free_service',
    serviceType: 'repolishing',
    pointsCost: 300,
    minTier: 'silver',
  },
  {
    name: 'Free Resizing',
    description: 'Ring resizing up to 2 sizes up or down',
    rewardType: 'free_service',
    serviceType: 'resizing',
    pointsCost: 250,
    minTier: 'bronze',
  },
  {
    name: 'Free Engraving',
    description: 'Personalized engraving on any jewelry piece',
    rewardType: 'free_service',
    serviceType: 'engraving',
    pointsCost: 200,
    minTier: 'bronze',
  },
  {
    name: 'Priority Repair Service',
    description: 'Jump the queue with priority repair service (24-48 hours)',
    rewardType: 'free_service',
    serviceType: 'repair',
    pointsCost: 150,
    minTier: 'silver',
  },

  // Discount rewards - percentage
  {
    name: '5% Off Making Charges',
    description: '5% discount on making charges for your next purchase',
    rewardType: 'discount_percentage',
    discountPercentage: '5',
    pointsCost: 200,
    minTier: 'bronze',
  },
  {
    name: '10% Off Making Charges',
    description: '10% discount on making charges for your next purchase',
    rewardType: 'discount_percentage',
    discountPercentage: '10',
    pointsCost: 400,
    minTier: 'silver',
  },
  {
    name: '15% Off Wastage Charges',
    description: '15% discount on wastage charges',
    rewardType: 'discount_percentage',
    discountPercentage: '15',
    pointsCost: 350,
    minTier: 'gold',
  },

  // Discount rewards - fixed
  {
    name: '₹500 Off Purchase',
    description: '₹500 discount on any purchase above ₹10,000',
    rewardType: 'discount_fixed',
    discountAmount: '500',
    pointsCost: 250,
    minTier: 'bronze',
  },
  {
    name: '₹1000 Off Purchase',
    description: '₹1000 discount on any purchase above ₹25,000',
    rewardType: 'discount_fixed',
    discountAmount: '1000',
    pointsCost: 450,
    minTier: 'silver',
  },
  {
    name: '₹2500 Off Purchase',
    description: '₹2500 discount on any purchase above ₹50,000',
    rewardType: 'discount_fixed',
    discountAmount: '2500',
    pointsCost: 1000,
    minTier: 'gold',
  },

  // Product rewards (premium)
  {
    name: 'Complimentary Gift Box',
    description: 'Premium jewelry gift box with velvet lining',
    rewardType: 'free_product',
    pointsCost: 50,
    minTier: 'bronze',
  },
  {
    name: 'Silver Charm',
    description: 'Sterling silver charm of your choice',
    rewardType: 'free_product',
    pointsCost: 500,
    minTier: 'silver',
  },
  {
    name: 'Gold-Plated Pendant',
    description: 'Elegant gold-plated pendant',
    rewardType: 'free_product',
    pointsCost: 1500,
    minTier: 'gold',
  },
  {
    name: '1 Gram Gold Coin',
    description: '1 gram 24K gold coin with certificate',
    rewardType: 'free_product',
    pointsCost: 3000,
    minTier: 'platinum',
    totalAvailable: 10,
  },
];

async function seedLoyaltyRewards() {
  console.log('Starting loyalty rewards seeding...\n');

  try {
    // Get all active stores
    const activeStores = await db.query.stores.findMany({
      where: eq(stores.isActive, true),
    });

    if (activeStores.length === 0) {
      console.log('No active stores found. Please create a store first.');
      process.exit(1);
    }

    // Get first admin user for createdBy
    const adminUser = await db.query.users.findFirst({
      where: eq(users.role, 'admin'),
    });

    if (!adminUser) {
      console.log('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`Found ${activeStores.length} active store(s)\n`);

    for (const store of activeStores) {
      console.log(`Seeding rewards for store: ${store.name} (${store.id})`);

      // Check if rewards already exist for this store
      const existingRewards = await db.query.loyaltyRewardsCatalog.findMany({
        where: eq(loyaltyRewardsCatalog.storeId, store.id),
      });

      if (existingRewards.length > 0) {
        console.log(`  - Store already has ${existingRewards.length} rewards, skipping...`);
        continue;
      }

      // Insert rewards for this store
      for (const reward of DEFAULT_REWARDS) {
        await db.insert(loyaltyRewardsCatalog).values({
          storeId: store.id,
          name: reward.name,
          description: reward.description,
          rewardType: reward.rewardType,
          serviceType: reward.serviceType,
          discountPercentage: reward.discountPercentage,
          discountAmount: reward.discountAmount,
          pointsCost: reward.pointsCost,
          minTier: reward.minTier,
          totalAvailable: reward.totalAvailable,
          createdBy: adminUser.id,
          isActive: true,
        });
      }

      console.log(`  - Created ${DEFAULT_REWARDS.length} rewards`);
    }

    console.log('\nLoyalty rewards seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding loyalty rewards:', error);
    process.exit(1);
  }

  process.exit(0);
}

seedLoyaltyRewards();
