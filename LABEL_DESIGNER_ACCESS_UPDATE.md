# Label Designer Access Update

**Date:** January 6, 2026
**Change:** Removed super admin requirement from Label Designer module

---

## Changes Made

### 1. Label Designer List Page
**File:** `/apps/web/src/app/(dashboard)/settings/label-designer/page.tsx`

**Before:**
```typescript
const isSuperAdmin = user?.permissions?.includes('*:*');

useEffect(() => {
  if (!isSuperAdmin) {
    router.push('/settings');
    return;
  }
  fetchTemplates();
}, [isSuperAdmin]);

if (!isSuperAdmin) {
  return null;
}
```

**After:**
```typescript
useEffect(() => {
  // Allow any authenticated user to access label designer
  if (!user) {
    router.push('/login');
    return;
  }
  fetchTemplates();
}, [user]);

// Removed the isSuperAdmin check
```

### 2. Label Template Editor Page
**File:** `/apps/web/src/app/(dashboard)/settings/label-designer/[templateId]/page.tsx`

**Before:**
```typescript
const isSuperAdmin = user?.permissions?.includes('*:*');

useEffect(() => {
  if (!isSuperAdmin) {
    router.push('/inventory');
    return;
  }
  fetchTemplate();
}, [templateId, isSuperAdmin]);

if (!isSuperAdmin) {
  return null;
}
```

**After:**
```typescript
useEffect(() => {
  // Allow any authenticated user to access template editor
  if (!user) {
    router.push('/login');
    return;
  }
  fetchTemplate();
}, [templateId, user]);

// Removed the isSuperAdmin check
```

### 3. Settings Page
**File:** `/apps/web/src/app/(dashboard)/settings/page.tsx`

**Before:**
```typescript
{
  title: 'Label Designer',
  description: 'Design and manage custom label templates for inventory',
  icon: Palette,
  href: '/settings/label-designer',
  requiresSuperAdmin: true,
},
```

**After:**
```typescript
{
  title: 'Label Designer',
  description: 'Design and manage custom label templates for inventory',
  icon: Palette,
  href: '/settings/label-designer',
  requiresSuperAdmin: false, // Allow all users
},
```

---

## What This Means

### ✅ **Any authenticated user can now:**
1. Access the Label Designer from Settings menu
2. View all label templates
3. Create new label templates
4. Edit existing label templates
5. Delete label templates
6. Set default templates
7. Duplicate templates

### ⚠️ **Backend Permission Check**

**Note:** The backend API still has permission checks. If you want to completely remove permission requirements, you'll also need to update the backend routes.

**Backend file to check:** `/apps/api/src/modules/labels/labels.routes.ts`

Current backend permissions:
- CREATE templates: Requires `inventory:create` permission
- READ templates: Requires `inventory:read` permission
- UPDATE templates: Requires `inventory:update` permission
- DELETE templates: Requires `inventory:delete` permission

---

## Testing

### To test the changes:

1. **Login as regular user** (not super admin):
   - Email: Any valid user email
   - Password: User's password
   - Store ID: `189ba8d0-7c36-497c-9c1c-8fe73b7b28f7`

2. **Navigate to Settings:**
   - Go to http://localhost:3000/settings
   - Label Designer should be visible (not hidden)

3. **Access Label Designer:**
   - Click on "Label Designer" card
   - Should load templates page without redirect

4. **Test functionality:**
   - Create new template (if has inventory:create permission)
   - Edit template (if has inventory:update permission)
   - Delete template (if has inventory:delete permission)

---

## Rollback Instructions

If you need to restore super admin requirement:

### In `label-designer/page.tsx`:
```typescript
const isSuperAdmin = user?.permissions?.includes('*:*');

useEffect(() => {
  if (!isSuperAdmin) {
    router.push('/settings');
    return;
  }
  fetchTemplates();
}, [isSuperAdmin]);

if (!isSuperAdmin) {
  return null;
}
```

### In `label-designer/[templateId]/page.tsx`:
```typescript
const isSuperAdmin = user?.permissions?.includes('*:*');

useEffect(() => {
  if (!isSuperAdmin) {
    router.push('/settings');
    return;
  }
  fetchTemplate();
}, [templateId, isSuperAdmin]);

if (!isSuperAdmin) {
  return null;
}
```

### In `settings/page.tsx`:
```typescript
{
  title: 'Label Designer',
  description: 'Design and manage custom label templates for inventory',
  icon: Palette,
  href: '/settings/label-designer',
  requiresSuperAdmin: true,
},
```

---

## Impact Analysis

### ✅ Positive Impact:
- More users can manage label templates
- Easier access for admin users
- No need for super admin permissions for common tasks

### ⚠️ Potential Concerns:
- Any logged-in user can now modify templates
- If you have multiple users, they can all edit templates
- Consider adding role-based checks if you need granular control

### 💡 Recommendation:
If you need role-based access control, consider:
1. Creating a "Label Manager" role
2. Checking for specific permissions like `labels:manage`
3. Implementing user-level or role-level access

---

## Next Steps

### Option 1: Keep it open (current state)
- Any authenticated user can access Label Designer
- Simple and straightforward

### Option 2: Add role-based check
Replace the user check with a role check:
```typescript
const canManageLabels = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

useEffect(() => {
  if (!canManageLabels) {
    router.push('/settings');
    return;
  }
  fetchTemplates();
}, [canManageLabels]);
```

### Option 3: Add permission-based check
Use specific permission for labels:
```typescript
const canManageLabels = user?.permissions?.some(p =>
  p === '*:*' || p === 'inventory:*' || p === 'labels:manage'
);

useEffect(() => {
  if (!canManageLabels) {
    router.push('/settings');
    return;
  }
  fetchTemplates();
}, [canManageLabels]);
```

---

## Summary

✅ **Changes completed:**
- Removed super admin requirement from Label Designer
- Any authenticated user can now access and manage label templates
- Settings page now shows Label Designer to all users

✅ **Files modified:**
1. `apps/web/src/app/(dashboard)/settings/label-designer/page.tsx`
2. `apps/web/src/app/(dashboard)/settings/label-designer/[templateId]/page.tsx`
3. `apps/web/src/app/(dashboard)/settings/page.tsx`

✅ **Status:** Ready to test

---

**Created:** January 6, 2026
**Updated:** January 6, 2026
