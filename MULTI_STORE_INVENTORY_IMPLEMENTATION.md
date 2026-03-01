# Multi-Store Inventory System Implementation

**Date:** 2026-02-09
**Feature:** Role-based multi-store inventory access with permission requests

---

## Overview

This document outlines the implementation of a multi-store inventory system with role-based access control:

### Access Levels

1. **Super Admin & Owner (Level 6+)**
   - ✅ View ALL stores' inventory
   - ✅ Switch between stores using dropdown selector
   - ✅ See inventory separated by store
   - ✅ Approve/reject access requests from store managers
   - ✅ Full CRUD operations on any store

2. **Store Manager (Level 5)**
   - ✅ View only their assigned store's inventory
   - ✅ Full CRUD operations on their store
   - ✅ Request temporary access to other stores
   - ❌ Cannot directly access other stores without approval

3. **Lower Roles (Level 1-4)**
   - ✅ View only their assigned store's inventory
   - ✅ Limited operations based on role permissions
   - ❌ Cannot request access to other stores

---

## Architecture

### Database Changes

#### New Table: `store_access_requests`

```sql
CREATE TABLE store_access_requests (
  id UUID PRIMARY KEY,
  requester_id UUID REFERENCES users(id),
  requester_store_id UUID REFERENCES stores(id),
  requested_store_id UUID REFERENCES stores(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, expired
  requested_at TIMESTAMP DEFAULT NOW(),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Tracks store managers' requests to access other stores temporarily

---

## Backend Implementation

### 1. API Endpoints

#### Inventory Endpoints (Updated)

```
GET /api/v1/inventory/items?storeId={optional}
  - Super Admin/Owner: Can specify any storeId or omit for all stores
  - Store Manager: Returns their assigned store only
  - Query params: storeId, page, limit, search, category

GET /api/v1/inventory/batches?storeId={optional}
  - Same access control as items
  - Returns batches filtered by store

GET /api/v1/inventory/stores
  - Super Admin/Owner: Returns all active stores
  - Store Manager: Returns only assigned store + approved access stores
  - Used for populating store selector dropdown
```

#### New Access Request Endpoints

```
POST /api/v1/stores/access-requests
  - Body: { requestedStoreId, reason, requestedDuration }
  - Creates new access request
  - Only for Store Managers

GET /api/v1/stores/access-requests
  - Returns user's access requests (as requester)
  - Status: pending, approved, rejected, expired

GET /api/v1/stores/access-requests/pending
  - Returns pending requests for Owner/Super Admin to review
  - Shows requests from all stores

PUT /api/v1/stores/access-requests/:id/approve
  - Body: { validFrom, validUntil }
  - Approves request with time limits
  - Only Owner/Super Admin

PUT /api/v1/stores/access-requests/:id/reject
  - Body: { rejectionReason }
  - Rejects access request
  - Only Owner/Super Admin

GET /api/v1/stores/access-requests/active
  - Returns user's currently active/approved access to other stores
  - Used to determine which stores they can access
```

### 2. Access Control Logic

#### Helper Function: `getUserAccessibleStores(userId, userRole, userStoreId)`

```typescript
async function getUserAccessibleStores(
  userId: string,
  userRole: string,
  userStoreId: string
): Promise<string[]> {
  // Super Admin and Owner get all stores
  if (['super_admin', 'owner'].includes(userRole)) {
    const allStores = await db.select({ id: stores.id })
      .from(stores)
      .where(eq(stores.isActive, true));
    return allStores.map(s => s.id);
  }

  // Store Manager: own store + approved access
  if (userRole === 'store_manager') {
    const activeAccess = await db
      .select({ storeId: storeAccessRequests.requestedStoreId })
      .from(storeAccessRequests)
      .where(
        and(
          eq(storeAccessRequests.requesterId, userId),
          eq(storeAccessRequests.status, 'approved'),
          sql`${storeAccessRequests.validFrom} <= NOW()`,
          sql`${storeAccessRequests.validUntil} >= NOW()`
        )
      );

    return [userStoreId, ...activeAccess.map(a => a.storeId)];
  }

  // Other roles: only their assigned store
  return [userStoreId];
}
```

### 3. Middleware Updates

#### Store Access Middleware

```typescript
export async function validateStoreAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const requestedStoreId = req.query.storeId as string || req.body.storeId;

  if (!requestedStoreId) {
    return next(); // No specific store requested
  }

  const accessibleStores = await getUserAccessibleStores(
    req.user.userId,
    req.user.role,
    req.user.storeId
  );

  if (!accessibleStores.includes(requestedStoreId)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'STORE_ACCESS_DENIED',
        message: 'You do not have access to this store',
      },
    });
  }

  next();
}
```

---

## Frontend Implementation

### 1. Components

#### Store Selector Component

```tsx
// apps/web/src/components/inventory/StoreSelector.tsx
'use client';

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/store/auth-store';
import apiClient from '@/lib/api-client';

interface Store {
  id: string;
  name: string;
  code: string;
}

export function StoreSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (storeId: string) => void;
}) {
  const { user } = useAuthStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccessibleStores();
  }, []);

  async function fetchAccessibleStores() {
    try {
      const response = await apiClient.get('/inventory/stores');
      setStores(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    } finally {
      setLoading(false);
    }
  }

  // Only show for Super Admin and Owner
  if (!['super_admin', 'owner'].includes(user?.role || '')) {
    return null;
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[250px]">
        <SelectValue placeholder="Select Store" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Stores</SelectItem>
        {stores.map(store => (
          <SelectItem key={store.id} value={store.id}>
            {store.name} ({store.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

#### Access Request Dialog

```tsx
// apps/web/src/components/inventory/RequestAccessDialog.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import apiClient from '@/lib/api-client';

export function RequestAccessDialog({
  open,
  onClose,
  stores
}: {
  open: boolean;
  onClose: () => void;
  stores: Store[];
}) {
  const [selectedStore, setSelectedStore] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('24'); // hours
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await apiClient.post('/stores/access-requests', {
        requestedStoreId: selectedStore,
        reason,
        requestedDuration: parseInt(duration),
      });

      alert('Access request submitted successfully!');
      onClose();
    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Store Access</DialogTitle>
        </DialogHeader>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <Label>Store</Label>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              {/* Store options */}
            </Select>
          </div>

          <div>
            <Label>Duration (hours)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectItem value="2">2 hours</SelectItem>
              <SelectItem value="8">8 hours (1 day)</SelectItem>
              <SelectItem value="24">24 hours</SelectItem>
              <SelectItem value="72">72 hours (3 days)</SelectItem>
            </Select>
          </div>

          <div>
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you need access to this store..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedStore || !reason || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 2. Updated Inventory Page

```tsx
// apps/web/src/app/(dashboard)/inventory/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { StoreSelector } from '@/components/inventory/StoreSelector';
import { RequestAccessDialog } from '@/components/inventory/RequestAccessDialog';
import { useAuthStore } from '@/store/auth-store';
import apiClient from '@/lib/api-client';

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [selectedStore, setSelectedStore] = useState(user?.store?.id || 'all');
  const [items, setItems] = useState([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  const isHighLevel = ['super_admin', 'owner'].includes(user?.role || '');
  const isStoreManager = user?.role === 'store_manager';

  useEffect(() => {
    fetchInventory();
  }, [selectedStore]);

  async function fetchInventory() {
    try {
      const params = selectedStore === 'all' ? {} : { storeId: selectedStore };
      const response = await apiClient.get('/inventory/items', { params });
      setItems(response.data.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Inventory</h1>

        <div className="flex gap-4">
          {/* Store selector for high-level roles */}
          {isHighLevel && (
            <StoreSelector value={selectedStore} onChange={setSelectedStore} />
          )}

          {/* Request access button for store managers */}
          {isStoreManager && (
            <Button onClick={() => setShowRequestDialog(true)}>
              Request Store Access
            </Button>
          )}
        </div>
      </div>

      {/* Inventory table/grid */}
      {selectedStore === 'all' ? (
        // Group by store
        <MultiStoreInventoryView items={items} />
      ) : (
        // Single store view
        <SingleStoreInventoryView items={items} />
      )}

      {/* Access request dialog */}
      {isStoreManager && (
        <RequestAccessDialog
          open={showRequestDialog}
          onClose={() => setShowRequestDialog(false)}
        />
      )}
    </div>
  );
}
```

---

## User Flows

### Flow 1: Super Admin Views All Stores

```
1. Super Admin logs in
2. Navigates to Inventory page
3. Sees dropdown: "All Stores" (default)
4. Inventory displays grouped by store:
   ┌─────────────────────────────┐
   │ Main Store (MAIN-001)       │
   │ - Ring 24K Gold (100g)      │
   │ - Necklace 22K (50g)        │
   │                             │
   │ Branch Store (BR-002)       │
   │ - Earrings 18K (25g)        │
   │ - Bracelet 22K (75g)        │
   └─────────────────────────────┘
5. Can select specific store from dropdown
6. Inventory filters to that store only
```

### Flow 2: Store Manager Requests Access

```
1. Store Manager logs in
2. Navigates to Inventory page
3. Sees only their assigned store (Main Store)
4. Clicks "Request Store Access" button
5. Dialog opens:
   - Select store: [Branch Store ▼]
   - Duration: [24 hours ▼]
   - Reason: [Need to check stock for customer order...]
6. Submits request
7. Notification sent to Owner/General Manager
8. Request appears in "Pending Requests" list
```

### Flow 3: Owner Approves Access

```
1. Owner receives notification
2. Navigates to Settings > Access Requests
3. Sees pending request:
   ┌─────────────────────────────────────┐
   │ John Doe (Store Manager)            │
   │ Main Store → Branch Store           │
   │ Reason: Need to check stock...      │
   │ Duration: 24 hours                  │
   │ [Approve] [Reject]                  │
   └─────────────────────────────────────┘
4. Clicks [Approve]
5. Sets validity period (Start: Now, End: +24hrs)
6. Store Manager now has temporary access
```

### Flow 4: Store Manager Uses Temporary Access

```
1. Store Manager's request approved
2. Navigates to Inventory
3. Now sees store selector dropdown (temporarily)
4. Can switch between:
   - Main Store (assigned)
   - Branch Store (temporary access)
5. After 24 hours, access expires
6. Dropdown disappears, back to assigned store only
```

---

## Security Considerations

### 1. Authorization Checks

```typescript
// Every inventory operation must verify:
1. User is authenticated
2. User has permission for the operation (RBAC)
3. User has access to the requested store
4. For temporary access: check not expired
```

### 2. Audit Logging

```typescript
// Log all store access events:
- Access request created
- Access approved/rejected
- Temporary access used
- Access expired
- Cross-store operations performed
```

### 3. Rate Limiting

```typescript
// Prevent abuse:
- Max 3 pending requests per user
- Max 5 requests per user per day
- Auto-expire unused approved access
```

---

## Database Indexes

```sql
-- Performance optimization
CREATE INDEX idx_store_access_active ON store_access_requests(
  requester_id, status, valid_from, valid_until
) WHERE status = 'approved';

CREATE INDEX idx_inventory_items_store ON inventory_items(store_id, status);
CREATE INDEX idx_inventory_batches_store ON inventory_batches(store_id, status);
```

---

## Testing Checklist

### Backend Tests

- [ ] Super admin can query any store
- [ ] Owner can query any store
- [ ] Store manager can only query assigned store
- [ ] Store manager cannot query unapproved store
- [ ] Approved access allows temporary query
- [ ] Expired access is rejected
- [ ] Access request creation works
- [ ] Access approval works
- [ ] Access rejection works
- [ ] Concurrent access requests handled

### Frontend Tests

- [ ] Store selector appears for super admin/owner
- [ ] Store selector hidden for store managers
- [ ] Request access button appears for store managers
- [ ] Request dialog submits correctly
- [ ] Inventory filters by selected store
- [ ] All stores view groups correctly
- [ ] Temporary access shows in dropdown
- [ ] Access expiry removes from dropdown

---

## Next Steps

To complete this implementation:

1. **Run migration**: `npm run db:migrate`
2. **Implement backend services**: Store access service, updated inventory controller
3. **Create API routes**: Access request endpoints
4. **Build frontend components**: StoreSelector, RequestAccessDialog
5. **Update inventory pages**: Add multi-store support
6. **Test thoroughly**: All user roles and access scenarios
7. **Deploy**: Staging → Production

---

## Estimated Implementation Time

- **Backend (API + Database)**: 4-6 hours
- **Frontend (UI Components)**: 3-4 hours
- **Testing & Refinement**: 2-3 hours
- **Total**: ~10-13 hours

---

**Status**: ✅ Migration created, schema updated
**Next**: Implement backend services and API endpoints

**Last Updated:** 2026-02-09
