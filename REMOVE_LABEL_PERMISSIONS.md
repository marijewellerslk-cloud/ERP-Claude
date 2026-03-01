# Label Designer - Permission Removal

**Date:** January 6, 2026
**Change:** Removed all permission checks from Label Designer API
**Reason:** Allow any authenticated user to manage label templates

---

## Changes Made

### 1. Routes File - Removed Permission Middleware

**File:** `/apps/api/src/modules/labels/labels.routes.ts`

**Before:**
```typescript
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = { INVENTORY: 'inventory' } as const;
const ACTIONS = { CREATE: 'create', READ: 'read', UPDATE: 'update', DELETE: 'delete' } as const;

router.get('/', requirePermission(RESOURCES.INVENTORY, ACTIONS.READ), ...);
router.post('/', requirePermission(RESOURCES.INVENTORY, ACTIONS.CREATE), ...);
router.put('/:templateId', requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE), ...);
router.delete('/:templateId', requirePermission(RESOURCES.INVENTORY, ACTIONS.DELETE), ...);
```

**After:**
```typescript
// No permission middleware - only authentication required
router.get('/', (req, res) => labelsController.listTemplates(req, res));
router.post('/', (req, res) => labelsController.createTemplate(req, res));
router.put('/:templateId', (req, res) => labelsController.updateTemplate(req, res));
router.delete('/:templateId', (req, res) => labelsController.deleteTemplate(req, res));
```

### 2. Controller - Removed Super Admin Checks

**File:** `/apps/api/src/modules/labels/labels.controller.ts`

**Removed from 4 methods:**

1. **createTemplate** (Line 23-32) - Removed:
```typescript
// Check if user has super admin permissions (wildcard permission)
if (!req.user.permissions.includes('*:*')) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Only super admins can create label templates',
    },
  });
}
```

2. **updateTemplate** (Line 176-185) - Removed:
```typescript
if (!req.user.permissions.includes('*:*')) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Only super admins can update label templates',
    },
  });
}
```

3. **deleteTemplate** (Line 223-232) - Removed:
```typescript
if (!req.user.permissions.includes('*:*')) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Only super admins can delete label templates',
    },
  });
}
```

4. **setDefaultTemplate** (Line 254-263) - Removed:
```typescript
if (!req.user.permissions.includes('*:*')) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Only super admins can set default label template',
    },
  });
}
```

5. **duplicateTemplate** (Line 290-299) - Removed:
```typescript
if (!req.user.permissions.includes('*:*')) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Only super admins can duplicate label templates',
    },
  });
}
```

---

## Current Access Control

### Authentication Required
All routes still require authentication via the auth middleware. Users must:
- ✅ Be logged in
- ✅ Have valid JWT token
- ✅ Token must not be expired

### Authorization Removed
- ❌ No permission checks (`inventory:read`, `inventory:create`, etc.)
- ❌ No super admin checks (`*:*` permission)
- ❌ No role-based restrictions

### What This Means

**Any authenticated user can now:**
- ✅ View all label templates
- ✅ Create new label templates
- ✅ Edit existing label templates
- ✅ Delete label templates
- ✅ Set default template
- ✅ Duplicate templates

---

## API Endpoints - Updated Access

### GET /api/v1/labels
**Access:** Any authenticated user
**Returns:** List of all templates for the user's store

### GET /api/v1/labels/default
**Access:** Any authenticated user
**Returns:** Default template for the user's store

### GET /api/v1/labels/:templateId
**Access:** Any authenticated user
**Returns:** Specific template details

### POST /api/v1/labels
**Access:** Any authenticated user
**Action:** Create new template
**Before:** Required `inventory:create` + super admin
**After:** Any authenticated user

### PUT /api/v1/labels/:templateId
**Access:** Any authenticated user
**Action:** Update existing template
**Before:** Required `inventory:update` + super admin
**After:** Any authenticated user

### DELETE /api/v1/labels/:templateId
**Access:** Any authenticated user
**Action:** Delete template
**Before:** Required `inventory:delete` + super admin
**After:** Any authenticated user

### POST /api/v1/labels/:templateId/set-default
**Access:** Any authenticated user
**Action:** Set template as default
**Before:** Required `inventory:update` + super admin
**After:** Any authenticated user

### POST /api/v1/labels/:templateId/duplicate
**Access:** Any authenticated user
**Action:** Duplicate template
**Before:** Required `inventory:create` + super admin
**After:** Any authenticated user

---

## Store Isolation

Templates are still isolated by store:
- Users can only see templates for their own store
- Users cannot access templates from other stores
- Store ID is taken from authenticated user's JWT token
- Service layer enforces store-based filtering

**Example:**
```typescript
// In controller
const template = await labelsService.createTemplate(
  validatedData,
  req.user.storeId,  // ← Store from authenticated user
  req.user.userId
);

// In service
async listTemplates(storeId: string) {
  return await db
    .select()
    .from(labelTemplates)
    .where(eq(labelTemplates.storeId, storeId)); // ← Filtered by store
}
```

---

## Security Considerations

### What's Still Protected
1. ✅ **Authentication:** Must be logged in with valid token
2. ✅ **Store Isolation:** Can only manage own store's templates
3. ✅ **Data Validation:** Zod schemas validate all inputs
4. ✅ **SQL Injection:** Drizzle ORM prevents SQL injection
5. ✅ **XSS:** Input sanitization in validation

### What's No Longer Protected
1. ❌ **Role-based Access:** Any user can perform any action
2. ❌ **Permission Checks:** No inventory permission requirements
3. ❌ **Admin-only Actions:** No super admin restrictions

### Risks and Mitigations

**Risk:** Users can delete important templates
**Mitigation:**
- Frontend shows confirmation dialogs
- Consider adding soft delete
- Keep audit logs of who deleted what

**Risk:** Users can modify templates others created
**Mitigation:**
- All changes are tracked (`createdBy`, `updatedAt`, `updatedBy`)
- Store isolation prevents cross-store modifications
- Consider adding template ownership checks

**Risk:** Users might create too many templates
**Mitigation:**
- Consider adding rate limiting
- Monitor template count per store
- Add pagination to template list

---

## Frontend Changes (Already Done)

Frontend already allows any authenticated user:
1. ✅ Access Label Designer page
2. ✅ Create new templates
3. ✅ Edit templates
4. ✅ Delete templates

Backend now matches frontend permissions.

---

## Testing

### Test 1: Login and Create Template

```bash
# 1. Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@marijewellers.com",
    "password": "Admin@123",
    "storeId": "189ba8d0-7c36-497c-9c1c-8fe73b7b28f7"
  }' \
  -c cookies.txt

# Extract token from response and save as TOKEN

# 2. Create Template (should work now)
curl -X POST http://localhost:4000/api/v1/labels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Template",
    "pageSize": "A4",
    "labelWidth": 50,
    "labelHeight": 30,
    ...
  }'
```

**Expected:** 201 Created (not 403 Forbidden)

### Test 2: Update Template

```bash
curl -X PUT http://localhost:4000/api/v1/labels/{templateId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Updated Name", ...}'
```

**Expected:** 200 OK (not 403 Forbidden)

### Test 3: Delete Template

```bash
curl -X DELETE http://localhost:4000/api/v1/labels/{templateId} \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** 200 OK (not 403 Forbidden)

---

## Rollback Instructions

If you need to restore permission checks:

### 1. Restore Routes File

```typescript
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = { INVENTORY: 'inventory' } as const;
const ACTIONS = { CREATE: 'create', READ: 'read', UPDATE: 'update', DELETE: 'delete' } as const;

router.post('/', requirePermission(RESOURCES.INVENTORY, ACTIONS.CREATE), (req, res) => ...);
```

### 2. Restore Controller Checks

Add back to each method:
```typescript
if (!req.user.permissions.includes('*:*')) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Only super admins can [action] label templates',
    },
  });
}
```

---

## Future Improvements

### Option 1: Template Ownership

```typescript
// Only allow editing own templates
if (template.createdBy !== req.user.userId && !req.user.permissions.includes('*:*')) {
  return res.status(403).json({ error: 'Can only edit your own templates' });
}
```

### Option 2: Role-Based Permissions

```typescript
// Check for specific permission
const canManageLabels = req.user.permissions.some(p =>
  p === '*:*' || p === 'labels:manage' || p === 'inventory:*'
);

if (!canManageLabels) {
  return res.status(403).json({ error: 'No permission to manage labels' });
}
```

### Option 3: Template Locking

```typescript
interface LabelTemplate {
  // ...
  isLocked: boolean;
  lockedBy?: string;
}

// Prevent editing locked templates
if (template.isLocked && template.lockedBy !== req.user.userId) {
  return res.status(403).json({ error: 'Template is locked' });
}
```

---

## Summary

✅ **Removed:** All permission checks from Label Designer API
✅ **Kept:** Authentication requirement and store isolation
✅ **Result:** Any authenticated user can now manage label templates
✅ **Security:** Store-level isolation still enforced

**Files Modified:**
1. `/apps/api/src/modules/labels/labels.routes.ts` - Removed permission middleware
2. `/apps/api/src/modules/labels/labels.controller.ts` - Removed super admin checks

**Impact:**
- Users no longer get 403 Forbidden errors
- Template creation/editing now works for all users
- Store data remains isolated

---

**Created:** January 6, 2026
**Status:** ✅ Complete - Permissions Removed
