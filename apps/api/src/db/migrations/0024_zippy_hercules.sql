-- Add inventory manipulation permission to user_roles
-- This allows fine-grained control over who can create/update/delete inventory

-- Add column to user_roles table
ALTER TABLE "user_roles"
ADD COLUMN IF NOT EXISTS "can_manipulate_inventory" BOOLEAN DEFAULT FALSE;

-- Set default TRUE for Super Admin and Owner roles
UPDATE "user_roles" ur
SET "can_manipulate_inventory" = TRUE
FROM "roles" r
WHERE ur.role_id = r.id
AND r.name IN ('super_admin', 'owner');

-- Add index for faster permission checks
CREATE INDEX IF NOT EXISTS "idx_user_roles_inventory_permission"
ON "user_roles"("user_id", "store_id", "can_manipulate_inventory");

-- Comments
COMMENT ON COLUMN "user_roles"."can_manipulate_inventory" IS 'Whether user can create, update, or delete inventory in this store. Super Admin and Owner always have this. Store Managers need explicit grant.';

-- Create permission requests table for Store Managers to request manipulation access
CREATE TABLE IF NOT EXISTS "inventory_permission_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requester_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "store_id" UUID NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "requested_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "reviewed_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" TIMESTAMP,
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_inventory_permission_requests_requester"
ON "inventory_permission_requests"("requester_id");

CREATE INDEX IF NOT EXISTS "idx_inventory_permission_requests_status"
ON "inventory_permission_requests"("status");

CREATE INDEX IF NOT EXISTS "idx_inventory_permission_requests_store"
ON "inventory_permission_requests"("store_id");

-- Comments
COMMENT ON TABLE "inventory_permission_requests" IS 'Requests from Store Managers to get inventory manipulation permission';
COMMENT ON COLUMN "inventory_permission_requests"."requester_id" IS 'Store Manager requesting permission';
COMMENT ON COLUMN "inventory_permission_requests"."store_id" IS 'Store they want to manipulate inventory in';
COMMENT ON COLUMN "inventory_permission_requests"."reason" IS 'Business justification for needing permission';
COMMENT ON COLUMN "inventory_permission_requests"."reviewed_by" IS 'Owner/Super Admin who approved/rejected';

-- From original zippy_hercules migration
ALTER TABLE "inventory_items" ADD COLUMN "country_of_origin" varchar(100);