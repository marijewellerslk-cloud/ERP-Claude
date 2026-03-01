# Login Simplification & Token Refresh Fix

**Date:** 2026-02-09
**Issues Fixed:**
1. Removed Store ID requirement from login (users now auto-assigned to their store)
2. Fixed "Refresh token not provided" error during authentication

---

## Changes Made

### Backend Changes

#### 1. Auth Service - Auto-detect User's Store

**File:** `apps/api/src/modules/auth/auth.service.ts`

**Changes:**
```typescript
// Made storeId optional in LoginInput interface
export interface LoginInput {
  email: string;
  password: string;
  storeId?: string; // Optional - will auto-detect from user's assigned store
}

// Updated login method to auto-detect store
async login(input: LoginInput): Promise<AuthResponse> {
  // ... existing password verification ...

  // Auto-detect store if not provided
  let storeId = input.storeId;
  if (!storeId) {
    // Get user's first assigned store
    const userRole = await db.query.userRoles.findFirst({
      where: eq(userRoles.userId, user.id),
      with: {
        store: true,
        role: true,
      },
    });

    if (!userRole) {
      throw new Error('User is not assigned to any store');
    }

    storeId = userRole.storeId;
    console.log(`[DEBUG] Auto-detected store: ${storeId} (${userRole.store.name})`);
  } else {
    // Verify user has access to the specified store (if provided)
    // ... existing verification logic ...
  }

  // Continue with token generation using detected storeId
}
```

**Why:**
- Each employee is assigned to a specific store in the `userRoles` table
- No need to manually enter Store ID during login
- System automatically determines which store the user belongs to
- If user has multiple stores, picks the first one (can be enhanced to show store selector)

#### 2. Auth Validation - Make Store ID Optional

**File:** `apps/api/src/modules/auth/auth.validation.ts`

**Changes:**
```typescript
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  storeId: z.string().uuid('Invalid store ID').optional(), // Made optional
});
```

**Why:** Login form no longer requires Store ID input

---

### Frontend Changes

#### 3. Login Form - Removed Store ID Field

**File:** `apps/web/src/app/(auth)/login/page.tsx`

**Changes:**

1. **Updated validation schema:**
```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  // storeId field removed
});
```

2. **Removed Store ID input field from UI:**
```tsx
// REMOVED:
<div className="space-y-2">
  <Label htmlFor="storeId">Store ID</Label>
  <Input id="storeId" type="text" placeholder="Store UUID" {...register('storeId')} />
  {errors.storeId && <p className="text-sm text-red-600">{errors.storeId.message}</p>}
  <p className="text-xs text-gray-500">Use the store ID provided during setup</p>
</div>
```

3. **Updated helper text:**
```tsx
<div className="mt-6 text-center">
  <p className="text-sm text-gray-600">
    Default credentials: admin@marijewellers.com / Admin@123
  </p>
  {/* Removed store ID instruction */}
</div>
```

**Why:** Simpler login experience - employees just enter email and password

#### 4. API Client - Fixed Token Refresh Logic

**File:** `apps/web/src/lib/api-client.ts`

**Changes:**
```typescript
// Response interceptor - improved token refresh handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isLoggingOut) {
        return Promise.reject(error);
      }

      // NEW: Check if we have an access token - if not, don't try to refresh
      const hasAccessToken = !!localStorage.getItem('accessToken');
      if (!hasAccessToken) {
        console.log('[API Client] No access token found, skipping refresh');
        return Promise.reject(error);
      }

      try {
        console.log('[API Client] Attempting to refresh access token...');
        // Try to refresh the token using httpOnly cookie
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/auth/refresh`,
          {},
          { withCredentials: true } // Sends httpOnly refreshToken cookie
        );

        console.log('[API Client] Token refresh successful');
        localStorage.setItem('accessToken', data.data.accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.log('[API Client] Token refresh failed, logging out...');
        // ... logout logic ...
      }
    }

    return Promise.reject(error);
  }
);
```

**Why Fixed "Refresh token not provided" Error:**

1. **Root Cause:** When user had no `accessToken` in localStorage (first visit, logged out), the API client was still trying to refresh tokens, causing unnecessary API calls to `/auth/refresh` without a refresh token cookie

2. **Solution:** Added check for `accessToken` existence before attempting refresh
   - If no access token → Skip refresh, reject immediately
   - If access token exists → Try refresh using httpOnly cookie
   - If refresh fails → Clear storage and redirect to login

3. **How Refresh Token Works:**
   - Backend sets `refreshToken` as httpOnly cookie during login (see `auth.controller.ts` line 61-66)
   - Cookie is automatically sent with requests due to `withCredentials: true`
   - Frontend never sees the refresh token (security best practice)
   - Backend reads from `req.cookies.refreshToken` (see `auth.controller.ts` line 102)

---

## Login Flow Now

### User Login Process

```
1. User opens app → Redirected to /login
2. User enters:
   - Email: admin@marijewellers.com
   - Password: Admin@123
   (NO Store ID required!)
3. Frontend sends POST /auth/login { email, password }
4. Backend:
   - Verifies credentials
   - Looks up user in userRoles table
   - Finds user's assigned store
   - Generates accessToken + refreshToken
   - Sets refreshToken as httpOnly cookie
   - Returns { accessToken, user, store }
5. Frontend:
   - Saves accessToken to localStorage
   - Saves user + store to Zustand
   - Waits 150ms for persistence
   - Redirects to /dashboard
6. Dashboard:
   - useAuth hook checks _hasHydrated
   - Verifies accessToken exists
   - Renders dashboard with user info + store info
```

### Token Refresh Process

```
1. User accesses protected route
2. API request includes: Authorization: Bearer <accessToken>
3. If token expired:
   - Backend returns 401 Unauthorized
4. Frontend API client intercepts 401:
   - Checks if accessToken exists in localStorage
   - If NO → Skip refresh, let redirect happen
   - If YES → Call POST /auth/refresh
5. Refresh endpoint:
   - Reads refreshToken from httpOnly cookie
   - Verifies token is valid and not expired
   - Generates new accessToken
   - Returns { accessToken }
6. Frontend:
   - Saves new accessToken
   - Retries original request
   - Request succeeds!
```

---

## Testing Steps

### 1. Test Simple Login (No Store ID)

```bash
# 1. Clear browser storage
# Open browser console (F12):
localStorage.clear();
document.cookie.split(";").forEach(c => {
  document.cookie = c.split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
});
location.reload();

# 2. Navigate to http://localhost:3000
# 3. You should see login form with ONLY email and password fields
# 4. Enter:
#    Email: admin@marijewellers.com
#    Password: Admin@123
# 5. Click "Sign In"
# 6. Should redirect to dashboard successfully
# 7. Dashboard should show store name in header
```

### 2. Verify Token Refresh Works

```bash
# 1. After logging in, open browser DevTools
# 2. Go to Application tab → Cookies → http://localhost:3000
# 3. You should see "refreshToken" cookie with httpOnly flag
# 4. Go to Console tab
# 5. Manually expire the access token:
localStorage.setItem('accessToken', 'expired.token.here');
# 6. Navigate to any protected page (e.g., /inventory)
# 7. Watch console logs:
#    - Should see "[API Client] Attempting to refresh access token..."
#    - Should see "[API Client] Token refresh successful"
#    - Page should load normally
```

### 3. Verify Error Handling

```bash
# 1. Clear all storage while on login page:
localStorage.clear();
document.cookie.split(";").forEach(c => {
  document.cookie = c.split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
});

# 2. Try to access /dashboard directly
# 3. Should NOT see "Refresh token not provided" error
# 4. Should see "[API Client] No access token found, skipping refresh" in console
# 5. Should redirect to /login smoothly
```

---

## Database Schema Reference

### User-Store Assignment

Users are assigned to stores through the `userRoles` table:

```sql
-- userRoles table (schema.ts line ~1652)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  store_id UUID REFERENCES stores(id),  -- This links user to store
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example data:**
```
user_id                              | role_id     | store_id
-------------------------------------|-------------|-------------------------------------
abc-123-user-id                      | admin-role  | store-xyz-789
abc-123-user-id                      | manager     | store-pqr-456  (if multi-store access)
```

---

## Benefits of This Change

### For Users
✅ **Simpler login** - Just email and password
✅ **No need to remember Store ID** - System knows their store
✅ **Faster login process** - One less field to fill
✅ **Better user experience** - Clear and intuitive

### For Administrators
✅ **Easier employee onboarding** - Just give email/password
✅ **Centralized store assignment** - Managed in admin panel
✅ **Better access control** - Store access tied to user role
✅ **Audit trail** - Know which user accessed which store

### For Developers
✅ **Cleaner code** - Removed UUID input validation
✅ **Better security** - httpOnly cookies for refresh tokens
✅ **Fewer errors** - No invalid Store ID errors
✅ **Scalable** - Easy to add multi-store support later

---

## Future Enhancements

### Multi-Store User Support

If a user has access to multiple stores, you can add a store selector:

```typescript
// After login, if user has multiple stores:
const userStores = await db.query.userRoles.findMany({
  where: eq(userRoles.userId, user.id),
  with: { store: true },
});

if (userStores.length > 1) {
  // Return list of stores, let user choose
  return {
    multiStore: true,
    stores: userStores.map(ur => ur.store),
    // User selects store, then call login again with storeId
  };
}
```

### Store Switching

Add a store switcher in the header:

```typescript
// In dashboard header:
<Select onValueChange={handleStoreSwitch}>
  {userStores.map(store => (
    <SelectItem value={store.id}>{store.name}</SelectItem>
  ))}
</Select>
```

---

## Files Changed Summary

### Backend
1. ✅ `apps/api/src/modules/auth/auth.service.ts` - Auto-detect store logic
2. ✅ `apps/api/src/modules/auth/auth.validation.ts` - Made storeId optional

### Frontend
3. ✅ `apps/web/src/app/(auth)/login/page.tsx` - Removed Store ID field
4. ✅ `apps/web/src/lib/api-client.ts` - Fixed token refresh logic

---

## Server Status

🟢 **API Server:** Running at http://localhost:4000
🟢 **Web Server:** Running at http://localhost:3000

---

## Quick Start

**To test the new login:**

1. Open http://localhost:3000
2. Enter:
   - Email: `admin@marijewellers.com`
   - Password: `Admin@123`
3. Click "Sign In"
4. You're in! 🎉

**No Store ID needed!**

---

**Last Updated:** 2026-02-09
**Status:** ✅ All changes applied and tested
