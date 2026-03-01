# Label Designer Troubleshooting Guide

**Issue:** Label Designer doesn't load after login
**Last Updated:** January 6, 2026

---

## Quick Checklist

Before troubleshooting, verify:

- [ ] Frontend running on port 3000
- [ ] Backend API running on port 4000
- [ ] Docker services (PostgreSQL, Redis, MinIO) running
- [ ] You logged in with **all three fields** (email, password, **and Store ID**)

---

## Problem: Page Redirects or Shows Blank

The Label Designer page has a super admin check that redirects non-super-admins. If your user data isn't loading correctly, you'll be redirected away.

### Step 1: Verify Login with Store ID

You **MUST** log in with all three fields:

1. **Email:** `admin@marijewellers.com`
2. **Password:** `Admin@123`
3. **Store ID:** `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`

**If you logged in without the Store ID, logout and login again with all three fields.**

### Step 2: Check Browser Console

1. Open the browser (http://localhost:3000)
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Try to navigate to Label Designer
5. Look for errors

**Common Errors:**

- **"Failed to fetch templates"** - API connection issue
- **401 Unauthorized** - Authentication token invalid
- **Redirecting to /settings** - User permissions check failed

### Step 3: Check User Data in Browser

In the browser console (F12 → Console tab), type:

```javascript
JSON.parse(localStorage.getItem('auth-storage'))
```

**Expected Output:**
```json
{
  "state": {
    "user": {
      "id": "...",
      "email": "admin@marijewellers.com",
      "fullName": "Admin User",
      "phone": null,
      "permissions": ["*:*"]  ← THIS IS CRITICAL
    },
    "store": {
      "id": "189ba8d0-7c36-497c-9c1c-8fe73b7b28f7",
      "name": "MARI Jewellers - Main Store",
      "code": "MAIN-001"
    },
    "isAuthenticated": true
  },
  "version": 0
}
```

**If `permissions` array is missing or empty:**
- This is the problem!
- Logout and login again with the Store ID

**If the entire object is `null`:**
- You're not logged in
- Go to http://localhost:3000/login and login

### Step 4: Check Access Token

In the browser console:

```javascript
localStorage.getItem('accessToken')
```

**Should return:** A long JWT string like `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**If null or undefined:**
- Not logged in properly
- Logout and login again

### Step 5: Check Refresh Token Cookie

1. In DevTools, go to **Application** tab
2. Expand **Cookies** in left sidebar
3. Click on `http://localhost:4000`
4. Look for `refreshToken` cookie

**Should see:**
- Name: `refreshToken`
- Value: Long string
- Domain: `localhost`
- Path: `/`
- HttpOnly: ✓

**If cookie is missing:**
- Backend didn't set it (CORS issue or login failed)
- Check backend console for errors

### Step 6: Test API Authentication

In terminal, test if your token works:

```bash
# Get your token from browser console first
TOKEN="<paste-your-access-token-here>"

# Test authentication
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/v1/labels

# Should return list of templates, not 401 error
```

**If you get 401 Unauthorized:**
- Token is invalid or expired
- Logout and login again

---

## Problem: "Failed to fetch templates"

This means the page loaded but the API call failed.

### Possible Causes:

1. **API not running**
   ```bash
   curl http://localhost:4000/api/v1/health
   ```
   Should return: `{"success":true,"message":"API is healthy"}`

2. **Authentication failed**
   - Check access token (see Step 4 above)
   - Check browser Network tab for 401 errors

3. **CORS issues**
   - Check browser console for CORS errors
   - Backend should allow requests from localhost:3000

4. **Templates don't exist**
   - Run the create default template script:
   ```bash
   cd /Users/marijewellers/ERP-Cluade/apps/api
   npm run script:create-default-label
   ```

---

## Problem: Infinite Redirect Loop

If the page keeps redirecting between `/settings/label-designer` and `/settings`:

### Cause:
The page checks for super admin permissions. If the check fails, it redirects to `/settings`.

### Solution:

1. **Clear browser storage:**
   - Open DevTools (F12)
   - Application tab → Storage → Clear site data
   - Close all browser tabs for localhost:3000

2. **Logout properly:**
   - Click logout button in sidebar
   - Or visit: http://localhost:3000/login

3. **Login again with ALL THREE FIELDS**
   - Email: `admin@marijewellers.com`
   - Password: `Admin@123`
   - **Store ID: `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`** ← DON'T SKIP THIS

4. **After login, check permissions again:**
   ```javascript
   JSON.parse(localStorage.getItem('auth-storage')).state.user.permissions
   ```
   Should return: `["*:*"]`

---

## Problem: Page Shows but Empty/Blank

If the page loads but shows no templates:

### Check 1: Templates exist in database

```bash
cd /Users/marijewellers/ERP-Cluade/apps/api
npm run script:create-default-label
```

Expected output: "Template created successfully" or "Template already exists"

### Check 2: API returns templates

```bash
# Test without auth (should fail with 401)
curl http://localhost:4000/api/v1/labels

# Test with auth (get token from browser console first)
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:4000/api/v1/labels
```

Should return:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Default Jewelry Label",
      ...
    }
  ]
}
```

### Check 3: Browser Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. Refresh the Label Designer page
4. Look for a request to `/labels` or `/api/v1/labels`
5. Click on it to see:
   - Status code (should be 200)
   - Response data

**If Status is 401:**
- Authentication failed
- Check access token

**If Status is 404:**
- API route not found
- Check backend is running

**If Status is 500:**
- Server error
- Check backend console for error messages

---

## Complete Reset Procedure

If nothing else works, do a complete reset:

### 1. Logout and Clear Browser Data

```javascript
// In browser console
localStorage.clear()
sessionStorage.clear()
```

Then close ALL browser tabs for localhost:3000

### 2. Restart Services

```bash
# Stop frontend (Ctrl+C if running in terminal)
# Or kill the process:
lsof -ti:3000 | xargs kill -9

# Stop backend (Ctrl+C if running in terminal)
# Or kill the process:
lsof -ti:4000 | xargs kill -9

# Restart Docker services
cd /Users/marijewellers/ERP-Cluade
docker-compose restart

# Wait 5 seconds
sleep 5

# Start backend
cd apps/api
npm run dev

# In another terminal, start frontend
cd apps/web
npm run dev
```

### 3. Fresh Login

1. Wait for both services to be ready
2. Go to http://localhost:3000/login
3. Fill in ALL THREE fields:
   - Email: `admin@marijewellers.com`
   - Password: `Admin@123`
   - Store ID: `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`
4. Click "Sign In"
5. Should redirect to `/dashboard`

### 4. Verify Permissions

In browser console:
```javascript
const auth = JSON.parse(localStorage.getItem('auth-storage'))
console.log('User:', auth.state.user.email)
console.log('Permissions:', auth.state.user.permissions)
console.log('Is Super Admin:', auth.state.user.permissions.includes('*:*'))
```

Should output:
```
User: admin@marijewellers.com
Permissions: ["*:*"]
Is Super Admin: true
```

### 5. Try Label Designer

Navigate to: http://localhost:3000/settings/label-designer

Should see list of templates.

---

## Still Not Working?

### Collect Debug Information:

Run these commands and share the output:

```bash
# 1. Check services running
echo "=== SERVICES ==="
lsof -ti:3000 && echo "✓ Frontend running on 3000" || echo "✗ Frontend NOT running"
lsof -ti:4000 && echo "✓ Backend running on 4000" || echo "✗ Backend NOT running"
docker ps | grep -E "(postgres|redis|minio)" && echo "✓ Docker services running" || echo "✗ Docker services NOT running"

# 2. Check frontend logs
echo "=== FRONTEND LOGS ==="
# (Copy last 20 lines from frontend terminal)

# 3. Check backend logs
echo "=== BACKEND LOGS ==="
# (Copy last 20 lines from backend terminal)

# 4. Test API directly
echo "=== API TEST ==="
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@marijewellers.com",
    "password": "Admin@123",
    "storeId": "189ba8d0-7c36-497c-9c1c-8fe73b7b28f7"
  }'
```

**In Browser Console:**

```javascript
// Get auth state
const auth = JSON.parse(localStorage.getItem('auth-storage'))
console.log('Auth State:', JSON.stringify(auth, null, 2))

// Get token
console.log('Access Token:', localStorage.getItem('accessToken') ? 'EXISTS' : 'MISSING')

// Check cookies
console.log('Cookies:', document.cookie)
```

---

## Common Mistakes

1. **❌ Logging in without Store ID**
   - The form has THREE fields, not two
   - Store ID is required

2. **❌ Wrong Store ID**
   - Must be exactly: `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`
   - No spaces, no quotes

3. **❌ Not waiting for services to start**
   - Backend takes ~5 seconds to start
   - Frontend takes ~10 seconds to start
   - Docker takes ~15 seconds to be ready

4. **❌ Using old cached auth data**
   - Clear browser storage after making changes
   - Use incognito/private browsing to test fresh

5. **❌ Backend and frontend on different networks**
   - Both must be on `localhost`
   - Check `NEXT_PUBLIC_API_URL` in `.env.local`

---

## Summary: Most Common Fix

**90% of "Label Designer doesn't load" issues are solved by:**

1. ✅ Logout completely
2. ✅ Clear browser cache/storage
3. ✅ Login with **ALL THREE FIELDS** (don't forget Store ID!)
4. ✅ Verify permissions in browser console
5. ✅ Navigate to Label Designer

**Store ID:** `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`

---

**Created:** January 6, 2026
**File:** `/LABEL_DESIGNER_TROUBLESHOOTING.md`
