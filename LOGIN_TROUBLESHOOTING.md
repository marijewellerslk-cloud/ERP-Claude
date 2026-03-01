# Login Troubleshooting Guide

**Issue:** Getting "Invalid credentials" error when trying to log in

---

## ✅ Verified Working

I've tested the login API directly and it works perfectly:

```bash
# This command works successfully:
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@marijewellers.com","password":"Admin@123"}'

# Result: ✅ Login successful with access token
```

The backend, database, and credentials are all correct.

---

## 🔍 Troubleshooting Steps

### Step 1: Clear Browser Cache

**This is the most common cause!**

1. Open your browser
2. Press `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows) to hard refresh
3. Or manually clear cache:
   - Press `F12` to open DevTools
   - Go to **Application** tab
   - Click **Clear storage** on the left
   - Click **Clear site data** button
   - Close DevTools and refresh the page

### Step 2: Verify You're Entering Correct Credentials

**Email:** (copy and paste this exactly)
```
admin@marijewellers.com
```

**Password:** (copy and paste this exactly - note the capital A and @ symbol)
```
Admin@123
```

⚠️ **Common mistakes:**
- Using lowercase `admin@123` instead of `Admin@123` (capital A is required!)
- Missing the `@` symbol
- Extra spaces before or after email/password
- Wrong email domain (should be `marijewellers.com` not `mari.com`)

### Step 3: Check Browser Console for Errors

1. Open the login page: http://localhost:3000/login
2. Press `F12` to open Developer Tools
3. Click on the **Console** tab
4. Click on the **Network** tab
5. Try to log in
6. Look for:
   - Any red error messages in Console
   - A POST request to `/auth/login` in Network tab
   - Click on the `/auth/login` request and check:
     - **Status:** Should be 200 or 201 for success
     - **Response:** Check what error message it returns

### Step 4: Test with Copy-Paste

To eliminate typos:

1. Open http://localhost:3000/login
2. **Copy this email exactly:** `admin@marijewellers.com`
3. Paste into Email field
4. **Copy this password exactly:** `Admin@123`
5. Paste into Password field
6. Click Sign In

### Step 5: Check Network Request

If still failing, check what the browser is sending:

1. Open DevTools (F12)
2. Go to **Network** tab
3. Try to log in
4. Click on the `/auth/login` request
5. Go to **Payload** or **Request** tab
6. Verify it shows:
   ```json
   {
     "email": "admin@marijewellers.com",
     "password": "Admin@123"
   }
   ```
7. Go to **Response** tab
8. Check what error message it returns

---

## 🧪 Alternative: Test Login via Browser Console

You can test the login directly from the browser console:

1. Open http://localhost:3000
2. Press `F12` to open DevTools
3. Go to **Console** tab
4. Paste this code and press Enter:

```javascript
fetch('http://localhost:4000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'admin@marijewellers.com',
    password: 'Admin@123'
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Login Result:', data);
  if (data.success) {
    console.log('✅✅✅ LOGIN WORKS! The issue is in the form.');
    console.log('Store:', data.data.store.name);
  } else {
    console.log('❌ Login failed:', data.error);
  }
})
.catch(err => console.error('❌ Network error:', err));
```

If this works (shows "LOGIN WORKS!"), then the issue is with the login form, not the API.

---

## 🆘 Still Not Working?

### Check if Servers are Running

```bash
# Check API server (should show process ID):
lsof -ti:4000

# Check Web server (should show process ID):
lsof -ti:3000
```

Both should return a number. If not, restart them:

```bash
# Restart servers:
cd /Users/marijewellers/ERP-Cluade
npm run dev
```

### Verify Database Has User

Run this command to verify the user exists:

```bash
cd /Users/marijewellers/ERP-Cluade/apps/api
npx tsx -e "
import { db, connection } from './src/config/database.js';
import { users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const user = await db.query.users.findFirst({
  where: eq(users.email, 'admin@marijewellers.com')
});

console.log(user ? '✅ User exists' : '❌ User not found');
await connection.end();
"
```

---

## 📝 What to Check in Browser DevTools

When you try to log in, you should see:

### Console Tab:
```
[AuthStore] Rehydration complete
[API Client] No access token found, skipping refresh
```

### Network Tab:
```
POST /api/v1/auth/login
Status: 200 OK
Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": { ... },
    "store": { "name": "MARI Jewellers - Main Store" }
  }
}
```

If you see **Status: 401** with "Invalid credentials", then:
- Double-check you're typing the password correctly
- Make sure it's `Admin@123` with capital A
- Make sure there are no extra spaces

---

## ✅ Correct Credentials Summary

**Email:** `admin@marijewellers.com`
**Password:** `Admin@123`
(Capital A, contains @, followed by 123)

**Store:** Automatically detected (MARI Jewellers - Main Store)

---

## 🔧 Quick Fix: Re-seed Database

If all else fails, you can re-seed the database:

```bash
# Stop API server
lsof -ti:4000 | xargs kill -9

# Delete and recreate database
cd /Users/marijewellers/ERP-Cluade/apps/api
npm run db:migrate

# Run seed script
npm run db:seed

# Restart API
cd /Users/marijewellers/ERP-Cluade
npm run dev
```

This will create a fresh admin user with the correct password.

---

**Last Updated:** 2026-02-09
