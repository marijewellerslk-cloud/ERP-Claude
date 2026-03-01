# Label Printing Module - Stuck Issue Fix

**Date:** 2026-01-08
**Status:** ✅ FIXED

## Problem

When completing a batch entry, the system redirects to the label printing page but gets stuck showing "Loading..." indefinitely.

## Root Cause

The label printing page fetches two pieces of data:
1. Batch data from `/inventory/batches/:id`
2. Default label template from `/labels/default`

If either request fails (especially due to 401 Unauthorized), the error was set but **not displayed**. The page checked for `!batch || !template` first, showing "Loading..." instead of the error message.

## Solution Applied

**File:** `apps/web/src/app/(dashboard)/inventory/batches/[batchId]/labels/page.tsx`

**Change:** Check for errors BEFORE checking loading state

```typescript
// Check error first
if (error) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800 font-semibold mb-2">Error Loading Labels</p>
          <p className="text-red-600 text-sm">{error}</p>
          <Button onClick={() => router.push('/inventory/batches')} ...>
            Back to Batches
          </Button>
        </div>
      </div>
    </div>
  );
}

// Then check loading
if (!batch || !template) {
  return <div>Loading...</div>;
}
```

## Result

✅ Users now see a proper error message with a "Back to Batches" button
✅ No more infinite loading
✅ Clear indication of what went wrong

## How to Test

1. Complete a batch in the system
2. System redirects to label printing page
3. **If successful:** Labels display with Print button
4. **If error:** Red error box with "Back to Batches" button

## Authentication Note

The label printing page requires authentication. Make sure you're logged in:
- Email: `admin@marijewellers.com`
- Password: `Admin@123`
- Store ID: `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`

The browser should have `accessToken` in localStorage.
