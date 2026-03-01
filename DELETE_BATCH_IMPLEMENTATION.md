# Delete Batch Feature Implementation

## Overview
Implemented the ability to delete incomplete batches that were entered by mistake. This feature includes proper validation, audit logging, and a user-friendly interface with confirmation dialogs.

## Implementation Date
2026-01-14

---

## Backend Implementation

### 1. Database Service (`apps/api/src/modules/inventory/inventory.service.ts`)

**New Method: `deleteBatch()`** (Lines 623-707)

**Features:**
- **Validation:** Only allows deletion of batches with `in_progress` status
- **Transaction Safety:** Uses database transactions to ensure atomicity
- **Cascade Deletion:** Properly deletes all inventory items and junction table records
- **Audit Trail:** Logs deletion with reason and full batch details
- **Store Isolation:** Ensures batch belongs to the requesting store

**Key Implementation Details:**
```typescript
async deleteBatch(batchId: string, userId: string, storeId: string, reason: string) {
  // Verify batch exists and belongs to store
  const batch = await db.query.inventoryBatches.findFirst({
    where: and(
      eq(inventoryBatches.id, batchId),
      eq(inventoryBatches.storeId, storeId)
    ),
    with: {
      batchItems: {
        with: {
          inventoryItem: true,
        },
      },
    },
  });

  // Only allow deletion of in_progress batches
  if (batch.status !== 'in_progress') {
    throw new Error('Only incomplete batches can be deleted. Completed batches cannot be removed.');
  }

  // Use transaction for atomicity
  await db.transaction(async (tx) => {
    // Delete all items in the batch
    if (batch.batchItems && batch.batchItems.length > 0) {
      const itemIds = batch.batchItems.map(bi => bi.inventoryItem.id);
      await tx.delete(inventoryItems).where(
        and(
          inArray(inventoryItems.id, itemIds),
          eq(inventoryItems.storeId, storeId)
        )
      );
    }

    // Delete the batch
    await tx.delete(inventoryBatches).where(
      and(
        eq(inventoryBatches.id, batchId),
        eq(inventoryBatches.storeId, storeId)
      )
    );

    // Log to audit trail
    await activityLogger.logAudit({
      action: 'delete',
      entityType: 'batch',
      entityId: batchId,
      userId,
      storeId,
      oldValues: {
        batchNumber: batch.batchNumber,
        status: batch.status,
        expectedItems: batch.expectedTotalItems,
        actualItems: batch.actualTotalItems,
        expectedWeight: batch.expectedTotalWeight,
        actualWeight: batch.actualTotalWeight,
        itemCount: batch.batchItems?.length || 0,
      },
      newValues: {
        reason,
        deletedAt: new Date().toISOString(),
      },
    });
  });

  return { success: true, message: 'Batch deleted successfully' };
}
```

**Import Addition:**
- Added `inArray` to Drizzle ORM imports (Line 1)

---

### 2. API Controller (`apps/api/src/modules/inventory/inventory.controller.ts`)

**New Method: `deleteBatch()`** (Lines 199-244)

**Features:**
- Validates user authentication
- Requires deletion reason (not optional)
- Calls service layer with proper error handling
- Returns appropriate HTTP status codes

**Key Implementation:**
```typescript
async deleteBatch(req: AuthRequest, res: Response) {
  const { batchId } = req.params;
  const { reason } = req.body;

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Deletion reason is required',
      },
    });
  }

  const result = await inventoryService.deleteBatch(
    batchId,
    req.user.userId,
    req.user.storeId,
    reason
  );

  res.json({ success: true, data: result });
}
```

---

### 3. API Routes (`apps/api/src/modules/inventory/inventory.routes.ts`)

**New Route:** (Lines 72-76)
```typescript
router.delete(
  '/batches/:batchId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.DELETE),
  (req, res) => inventoryController.deleteBatch(req, res)
);
```

**Endpoint Details:**
- **URL:** `DELETE /api/v1/inventory/batches/:batchId`
- **Authentication:** Required
- **Permission:** `inventory:delete`
- **Request Body:** `{ reason: string }`
- **Response:** `{ success: boolean, data: { success: boolean, message: string } }`

---

## Frontend Implementation

### 1. Batch Detail Page (`apps/web/src/app/(dashboard)/inventory/batches/[batchId]/page.tsx`)

**New Import:** (Line 7)
```typescript
import { ArrowLeft, Package, Plus, Printer, DollarSign, Trash2 } from 'lucide-react';
```

**New Method: `handleDeleteBatch()`** (Lines 106-154)

**Features:**
- Status validation (only in_progress batches)
- Two-step confirmation process:
  1. Prompt for deletion reason
  2. Confirm deletion with summary
- Shows batch details before deletion
- Redirects to batches list on success
- Proper error handling with user feedback

**UI Flow:**
1. User clicks "Delete Batch" button
2. System checks if batch status is `in_progress`
3. Prompt asks for deletion reason with batch summary
4. Confirmation dialog shows:
   - Batch number
   - Number of items to be deleted
   - Warning that action cannot be undone
   - The reason entered
5. On confirmation, API call is made
6. Success: Alert + redirect to batches list
7. Error: Alert with error message

**Delete Button:** (Lines 207-214)
```typescript
<Button
  variant="outline"
  onClick={handleDeleteBatch}
  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
>
  <Trash2 className="h-4 w-4 mr-2" />
  Delete Batch
</Button>
```

**Button Visibility:**
- Only shown when batch status is `in_progress`
- Positioned next to "Add Items" button
- Styled in red to indicate destructive action

---

## Security Features

### 1. **Multi-level Validation**
- Frontend: Status check before showing delete button
- Frontend: Status check in delete handler
- Backend: Status check in service layer
- Backend: Store ownership verification

### 2. **Required Deletion Reason**
- Cannot be empty or whitespace-only
- Logged in audit trail for accountability
- Displayed in confirmation dialog

### 3. **Permission-based Access Control**
- Requires `inventory:delete` permission
- Enforced by RBAC middleware
- Authentication required

### 4. **Audit Trail**
- Full batch details logged before deletion
- Deletion reason captured
- User ID and timestamp recorded
- Cannot be bypassed

### 5. **Transaction Safety**
- All deletions wrapped in database transaction
- Either all succeed or all fail (no partial deletions)
- Maintains data integrity

---

## User Experience Features

### 1. **Clear Visual Indicators**
- Delete button styled in red
- Only visible for incomplete batches
- Trash icon for clarity

### 2. **Confirmation Process**
- Step 1: Reason prompt with batch details
- Step 2: Final confirmation with warning
- Shows exactly what will be deleted
- Emphasizes irreversibility

### 3. **Informative Messages**
- Batch number, items count, weight shown
- Clear error messages
- Success confirmation
- Auto-redirect after deletion

### 4. **Error Prevention**
- Cannot delete completed batches
- Reason is mandatory
- Double confirmation required

---

## API Endpoint Documentation

### Delete Batch

**Endpoint:** `DELETE /api/v1/inventory/batches/:batchId`

**Authentication:** Required (Bearer token)

**Permission:** `inventory:delete`

**Request:**
```json
{
  "reason": "Entered by mistake - duplicate of batch #123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Batch deleted successfully"
  }
}
```

**Error Responses:**

**401 Unauthorized:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**400 Bad Request (No reason):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deletion reason is required"
  }
}
```

**400 Bad Request (Completed batch):**
```json
{
  "success": false,
  "error": {
    "code": "DELETE_BATCH_FAILED",
    "message": "Only incomplete batches can be deleted. Completed batches cannot be removed."
  }
}
```

**400 Bad Request (Not found):**
```json
{
  "success": false,
  "error": {
    "code": "DELETE_BATCH_FAILED",
    "message": "Batch not found"
  }
}
```

---

## Testing Guide

### Manual Testing Steps

1. **Test Normal Deletion:**
   - Create a new batch
   - Add some items to it (status: in_progress)
   - Navigate to batch detail page
   - Click "Delete Batch" button
   - Enter a reason when prompted
   - Confirm deletion
   - Verify redirect to batches list
   - Verify batch no longer appears in list

2. **Test Completed Batch Protection:**
   - Create and complete a batch
   - Navigate to batch detail page
   - Verify "Delete Batch" button is NOT visible
   - Attempt direct API call (should fail)

3. **Test Reason Validation:**
   - Create an incomplete batch
   - Click "Delete Batch"
   - Cancel the reason prompt or enter empty string
   - Verify deletion is cancelled
   - Verify appropriate message shown

4. **Test Confirmation Cancellation:**
   - Create an incomplete batch
   - Click "Delete Batch"
   - Enter a reason
   - Click "Cancel" on confirmation dialog
   - Verify batch is NOT deleted

5. **Test Audit Trail:**
   - Delete a batch with reason "Test deletion"
   - Check audit logs in database
   - Verify entry contains:
     - Action: 'delete'
     - Entity type: 'batch'
     - Batch details (number, items, weights)
     - Deletion reason
     - User ID
     - Timestamp

6. **Test Permission Control:**
   - Login as user without `inventory:delete` permission
   - Navigate to batch detail page
   - Verify delete button behavior based on permissions

---

## Database Impact

### Tables Affected

1. **inventory_batches**
   - Batch record is deleted

2. **inventory_batch_items**
   - All junction records deleted (cascade)

3. **inventory_items**
   - All items in the batch deleted

4. **audit_logs**
   - New entry created with deletion details

### Cascade Behavior

The deletion follows this order:
1. Inventory items deleted explicitly in transaction
2. Batch-item junction records deleted automatically (FK cascade)
3. Batch record deleted
4. Audit log entry created

This ensures referential integrity is maintained.

---

## Files Modified

### Backend Files
1. `/apps/api/src/modules/inventory/inventory.service.ts`
   - Added `inArray` import
   - Added `deleteBatch()` method

2. `/apps/api/src/modules/inventory/inventory.controller.ts`
   - Added `deleteBatch()` controller method

3. `/apps/api/src/modules/inventory/inventory.routes.ts`
   - Added DELETE route for batches

### Frontend Files
1. `/apps/web/src/app/(dashboard)/inventory/batches/[batchId]/page.tsx`
   - Added `Trash2` icon import
   - Added `handleDeleteBatch()` method
   - Added delete button to UI
   - Conditional rendering based on batch status

---

## Future Enhancements (Optional)

1. **Soft Delete:**
   - Add `deleted_at` column to batches
   - Implement soft delete instead of hard delete
   - Allow batch restoration within X days

2. **Batch Archive:**
   - Archive deleted batches to separate table
   - Keep historical data for reporting
   - Automatic cleanup after retention period

3. **Better UI Dialog:**
   - Replace browser `prompt()` and `confirm()` with custom modal
   - Add text area for detailed reason
   - Show batch items list in confirmation dialog
   - Better styling and UX

4. **Bulk Delete:**
   - Allow selection of multiple incomplete batches
   - Delete multiple batches at once
   - Single reason for all selected batches

5. **Admin Override:**
   - Allow admins to delete completed batches
   - Require additional confirmation
   - Stricter audit logging

---

## Summary

The delete batch feature has been successfully implemented with:
- ✅ Secure backend API with validation
- ✅ Transaction-safe database operations
- ✅ Comprehensive audit logging
- ✅ User-friendly frontend interface
- ✅ Multi-step confirmation process
- ✅ Permission-based access control
- ✅ Protection against accidental deletion
- ✅ Clear error messages and feedback

The feature is production-ready and follows best practices for destructive operations.
