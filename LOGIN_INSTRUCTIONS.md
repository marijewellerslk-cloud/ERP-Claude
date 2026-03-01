# Login Instructions - MARI Jewellers ERP

**Issue:** Label Designer doesn't work after login
**Cause:** Login requires three fields, including Store ID

---

## Login Credentials

To access the application, you need **THREE pieces of information**:

### 1. Email
```
admin@marijewellers.com
```

### 2. Password
```
Admin@123
```

### 3. Store ID (UUID)
```
189ba8d0-7c36-497c-9c1c-8fe73b7b28f7
```

---

## How to Login

1. **Navigate to:** http://localhost:3000/login

2. **Fill in the form:**
   - **Email:** `admin@marijewellers.com`
   - **Password:** `Admin@123`
   - **Store ID:** `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`

3. **Click "Sign In"**

4. **You should be redirected to:** `/dashboard`

---

## After Successful Login

Once logged in with the correct Store ID, you should be able to access:

- ✅ Dashboard
- ✅ Inventory and all inventory features
- ✅ Settings (http://localhost:3000/settings)
- ✅ Label Designer (http://localhost:3000/settings/label-designer)

---

## Why Store ID is Required

The system is multi-tenant, meaning it supports multiple stores. Each user must specify which store they're logging into. The Store ID ensures:

- Users can only access data for their assigned store
- Templates and inventory are store-specific
- Permissions are enforced per-store

---

## Troubleshooting

### Issue: "The label designer doesn't work"

**Possible Cause:** You didn't provide the Store ID during login

**Solution:**
1. Logout (if logged in)
2. Go to http://localhost:3000/login
3. Fill in ALL THREE fields including Store ID
4. Login again

### Issue: Still redirecting to login

**Possible Cause:** Refresh token cookie not being set

**Check:**
1. Open Browser DevTools (F12)
2. Go to Application tab → Cookies
3. Check for `refreshToken` cookie for `localhost:4000`

**If cookie is missing:**
- The backend might not be setting it due to CORS
- Try logging in again with the Store ID

### Issue: "Invalid store ID" error

**Check:** Make sure you're using the exact Store ID:
```
189ba8d0-7c36-497c-9c1c-8fe73b7b28f7
```

**No spaces, no quotes, just the UUID exactly as shown above.**

---

## Technical Details

### Authentication Flow:

1. User submits email, password, and storeId
2. Backend validates credentials
3. Backend generates accessToken and refreshToken
4. Backend sets `refreshToken` as httpOnly cookie
5. Frontend stores `accessToken` in localStorage
6. Frontend stores user data in Zustand store
7. All subsequent API calls include:
   - Authorization header with accessToken
   - refreshToken cookie (automatic)

### Middleware Protection:

The middleware (`apps/web/src/middleware.ts`) checks for the `refreshToken` cookie. If it's not present, you'll be redirected to login.

### Super Admin Permissions:

The super admin account has the permission `*:*` which grants access to all features including:
- Label Designer
- User Management (when implemented)
- Security Settings (when implemented)
- Data & Backup (when implemented)

---

## Quick Login Test

Run this command to verify the Store ID is correct:

```bash
cd /Users/marijewellers/ERP-Cluade/apps/api
npm run script:get-store-id
```

This should output:
```
📦 Store Information:
   ID: 189ba8d0-7c36-497c-9c1c-8fe73b7b28f7
   Name: MARI Jewellers - Main Store
   Code: MAIN-001
```

---

## API Test

You can also test the login API directly:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@marijewellers.com",
    "password": "Admin@123",
    "storeId": "189ba8d0-7c36-497c-9c1c-8fe73b7b28f7"
  }' \
  -c cookies.txt \
  -v
```

Successful response should include:
- `accessToken` in the JSON response
- `Set-Cookie: refreshToken` in the response headers

---

## Summary

**To access the Label Designer:**

1. ✅ Make sure services are running (Docker, API, Web)
2. ✅ Navigate to http://localhost:3000/login
3. ✅ Enter email: `admin@marijewellers.com`
4. ✅ Enter password: `Admin@123`
5. ✅ **Enter store ID: `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`** ← CRITICAL STEP
6. ✅ Click "Sign In"
7. ✅ Navigate to Settings → Label Designer

**The Store ID is the key missing piece!**

---

**Created:** January 6, 2026
**Store ID:** 189ba8d0-7c36-497c-9c1c-8fe73b7b28f7
