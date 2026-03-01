# CSS Troubleshooting Guide

## ✅ Steps Taken

1. **Cleaned Next.js build cache** - Removed `.next` folder
2. **Killed processes on port 3000** - Ensured clean start
3. **Restarted dev server** - Server running at http://localhost:3000
4. **Verified dependencies** - All Tailwind CSS packages installed correctly

---

## 🔍 What to Check

### 1. **Open the Application in Browser**
Visit: **http://localhost:3000**

### 2. **Check Browser Console (F12)**
Look for:
- ❌ Any CSS-related errors
- ❌ Failed network requests for stylesheets
- ❌ Tailwind CSS warnings

### 3. **Verify CSS is Loading**

**Expected behavior:**
- Login page should have a gradient background (`bg-gradient-to-br from-gray-50 to-gray-100`)
- Form should have white background with shadow (`bg-white rounded-lg shadow-xl`)
- Buttons should have styling and hover effects
- Input fields should have borders and focus rings

**If CSS is missing:**
- Background will be white (no gradient)
- No shadows, borders, or rounded corners
- Text will be unstyled (default browser font)
- No spacing between elements

---

## 🐛 Common CSS Issues & Solutions

### Issue 1: "Styles Not Applying"

**Symptoms:**
- Elements have no styling
- Everything looks like plain HTML

**Solution:**
```bash
# In terminal:
cd apps/web
rm -rf .next
npm run dev
```

Then hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

---

### Issue 2: "Flash of Unstyled Content (FOUC)"

**Symptoms:**
- Page loads without styles for a brief moment
- Then styles appear

**Solution:**
This is normal for client-side rendering. The styles load after JavaScript runs.

---

### Issue 3: "Some Components Missing Styles"

**Symptoms:**
- Most of the page looks good
- But specific components (buttons, inputs) look broken

**Solution:**
Check if shadcn/ui components are imported correctly:

```bash
# Verify component files exist:
ls apps/web/src/components/ui/
```

Should see:
- `button.tsx`
- `input.tsx`
- `label.tsx`
- `card.tsx`
- `badge.tsx`
- etc.

---

### Issue 4: "Dark Mode Styles Showing Instead"

**Symptoms:**
- Page has dark background
- Light text on dark background

**Solution:**
Remove dark mode class from HTML:
1. Open browser DevTools (F12)
2. Select `<html>` element
3. Remove `class="dark"` if present

---

## 🧪 Quick CSS Test

Open browser console (F12) and run:

```javascript
// Check if Tailwind classes are applied
const loginDiv = document.querySelector('.bg-gradient-to-br');
console.log('Gradient background found:', !!loginDiv);

// Check computed styles
const styles = window.getComputedStyle(document.body);
console.log('Background color:', styles.backgroundColor);
console.log('Font family:', styles.fontFamily);
```

**Expected output:**
```
Gradient background found: true
Background color: rgb(249, 250, 251) or similar
Font family: Inter, ... (not Times New Roman)
```

---

## 📋 Verification Checklist

After restarting the server, verify these work:

- [ ] Login page loads at http://localhost:3000
- [ ] Login page has gradient background
- [ ] Form has white background with shadow
- [ ] Inputs have borders and focus rings
- [ ] "Sign In" button has blue background
- [ ] Button changes on hover
- [ ] No console errors in browser DevTools
- [ ] Font is Inter (not default serif font)

---

## 🔧 If Issues Persist

### Option 1: Full Clean Restart

```bash
# Stop all processes
lsof -ti:3000 | xargs kill -9

# Clean everything
cd apps/web
rm -rf .next
rm -rf node_modules/.cache

# Restart
npm run dev
```

### Option 2: Reinstall Dependencies

```bash
cd apps/web
rm -rf node_modules
npm install
npm run dev
```

### Option 3: Check Browser Cache

1. Open DevTools (F12)
2. Go to Network tab
3. Check "Disable cache" option
4. Refresh page (F5)

---

## 📸 What Good CSS Looks Like

**Login Page:**
- Centered white card on gray gradient background
- Blue "MARI Jewellers" title
- Three input fields with gray borders
- Blue "Sign In" button
- Small gray footer text

**Dashboard (after login):**
- White header with company name
- Light gray background
- Blue store badge
- Cards with shadows
- Sidebar menu (when hamburger clicked)

---

## 🆘 Still Having Issues?

**Share this information:**

1. **Browser console errors** (F12 → Console tab)
2. **Network tab** (F12 → Network tab → filter by CSS)
3. **Screenshot** of what you see vs. what you expect
4. **Browser version** (Chrome/Firefox/Safari/Edge)

**Check these files:**
```bash
# Verify these files exist and have content:
cat apps/web/src/app/globals.css | head -5
cat apps/web/tailwind.config.js | head -10
cat apps/web/postcss.config.js
```

All should have content (not empty files).

---

**Last Updated:** 2026-02-09
**Server Status:** ✓ Running at http://localhost:3000
