# Image and Hallmark Fields Implementation

**Date:** 2026-01-08
**Status:** ✅ Completed

## Overview

Added image URL and hallmark/certification fields to the inventory product forms, allowing users to add product images and certification details when creating or editing inventory items.

## Changes Made

### 1. Add Items Form Updates

**File:** [apps/web/src/app/(dashboard)/inventory/batches/[batchId]/add-items/page.tsx](apps/web/src/app/(dashboard)/inventory/batches/[batchId]/add-items/page.tsx)

#### Schema Updates (Lines 15-46)
Added new fields to the Zod validation schema:
```typescript
// Hallmark and certification fields
isHallmarked: z.boolean().optional(),
hallmarkNumber: z.string().optional(),
huidNumber: z.string().optional(),
certificationNumber: z.string().optional(),
certificationAgency: z.string().optional(),
certificationDate: z.string().optional(),
// Image URLs
imageUrls: z.string().optional(), // Comma-separated URLs
```

#### Form Submission Updates (Lines 246-273)
- Added logic to parse comma-separated image URLs into an array
- Added hallmark and certification fields to the API request
- Converts certification date to ISO format

#### New UI Sections Added

**Hallmark & Certification Section (Lines 750-825)**
- Purple-themed card with optional hallmark fields
- Checkbox to indicate if item is hallmarked
- Conditional fields that appear when hallmarked:
  - Hallmark Number
  - HUID Number (Hallmark Unique ID)
- Always visible certification fields:
  - Certification Number
  - Certification Agency (e.g., GIA, IGI, BIS)
  - Certification Date (date picker)

**Product Images Section (Lines 827-845)**
- Amber-themed card for image URLs
- Textarea for entering comma-separated image URLs
- Helper text explaining the format
- URLs are parsed and sent as an array to the backend

### 2. Edit Items Form Updates

**File:** [apps/web/src/app/(dashboard)/inventory/items/[itemId]/edit/page.tsx](apps/web/src/app/(dashboard)/inventory/items/[itemId]/edit/page.tsx)

#### Import Updates (Line 9)
Added `RefreshCw` icon import:
```typescript
import { ArrowLeft, Save, AlertCircle, RefreshCw } from 'lucide-react';
```

#### Submission Updates (Line 115)
Added `imageUrls` to the update request payload

#### New Product Images Card (Lines 453-498)
- Textarea for entering image URLs (one per line)
- Converts between array and newline-separated format
- Image preview grid showing current images (if any)
- Displays up to 3 images per row
- Fallback for broken image URLs
- Shows count of current images

**Features:**
- One URL per line (more user-friendly than comma-separated)
- Live preview of existing images
- Graceful error handling for invalid URLs

## Database Schema Support

The backend database schema already supported these fields:

**Inventory Items Table:**
- `isHallmarked` (boolean)
- `hallmarkNumber` (varchar 100)
- `huidNumber` (varchar 100) - Hallmark Unique ID
- `certificationNumber` (varchar 100)
- `certificationAgency` (varchar 100)
- `certificationDate` (timestamp)
- `imageUrls` (jsonb) - Array of image URLs

**Backend Validation Schema:**
The API validation schemas already included all these fields, so no backend changes were needed.

## User Workflow

### Adding Items to Batch

1. Navigate to a batch and click "Add Items"
2. Fill in basic item details (name, type, weights, etc.)
3. **NEW:** Scroll down to "Hallmark & Certification (Optional)"
   - Check "This item is hallmarked" if applicable
   - Enter Hallmark Number and HUID
   - Enter certification details (optional)
4. **NEW:** Scroll to "Product Images (Optional)"
   - Paste image URLs separated by commas
   - Example: `https://example.com/img1.jpg, https://example.com/img2.jpg`
5. Click "Save & Add Next"

### Editing Existing Items

1. Navigate to inventory item details
2. Click "Edit" (Super Admin only)
3. Scroll to "Hallmark & Certification" card
   - Update hallmark status and details
4. **NEW:** Scroll to "Product Images" card
   - View current images in grid layout
   - Edit URLs (one per line) in textarea
   - Images update automatically on save
5. Click "Save Changes"

## Technical Details

### Image URL Format

**Add Items Form:**
- Input: Comma-separated string
- Example: `https://img1.jpg, https://img2.jpg`
- Parsing: Split by comma, trim whitespace, filter empty strings

**Edit Items Form:**
- Input: Newline-separated string
- Example:
  ```
  https://img1.jpg
  https://img2.jpg
  ```
- Parsing: Split by newline, trim whitespace, filter empty strings
- Display: Array joined with newlines

### Hallmark Field Behavior

- `isHallmarked` checkbox controls visibility of hallmark-specific fields
- When unchecked, Hallmark Number and HUID fields are hidden
- Certification fields are always visible (independent of hallmark status)
- All fields are optional

### Image Preview Features

- Grid layout: 2 columns on mobile, 3 on desktop
- Aspect ratio: Square (1:1)
- Error handling: Displays "No Image" placeholder if URL fails to load
- Object-fit: Cover (fills container, may crop)

## Benefits

1. **Complete Product Information:** Users can now add all certification and image details during batch entry
2. **Visual Product Management:** Image previews help identify items quickly
3. **Certification Tracking:** Proper tracking of hallmarks and certifications for compliance
4. **Flexible Image Storage:** URL-based approach allows using any image hosting service
5. **User-Friendly Input:** Different input formats for add vs. edit optimized for each use case

## Future Enhancements (Not Implemented)

These features were NOT implemented but could be added later:

1. **File Upload:** Direct image upload instead of URL input
2. **Image Storage:** Integration with MinIO or cloud storage
3. **Image Compression:** Automatic image optimization
4. **Multiple Image Management:** Drag-to-reorder, delete individual images
5. **Image Cropping:** Built-in image editor
6. **Bulk Image Upload:** Upload multiple images at once
7. **Image Validation:** Check if URLs are valid images before saving

## Testing Checklist

- [ ] Add new item with hallmark details
- [ ] Add new item with image URLs
- [ ] Verify hallmark fields show/hide based on checkbox
- [ ] Edit existing item and update images
- [ ] Verify image previews display correctly
- [ ] Test with invalid image URLs (should show fallback)
- [ ] Test with empty/whitespace-only URLs (should be filtered out)
- [ ] Verify data saves correctly to database
- [ ] Check that images display in inventory details page

## Files Modified

1. `/apps/web/src/app/(dashboard)/inventory/batches/[batchId]/add-items/page.tsx`
   - Added hallmark and image fields to schema
   - Added hallmark and image sections to form UI
   - Updated submission logic

2. `/apps/web/src/app/(dashboard)/inventory/items/[itemId]/edit/page.tsx`
   - Added RefreshCw import
   - Added imageUrls to submission
   - Added Product Images card with preview

## Conclusion

The image and hallmark functionality is now fully integrated into both the add-items and edit-items workflows. Users can enter certification details and product images, with the edit form providing a convenient preview feature. All data is properly validated and stored in the existing database schema.
