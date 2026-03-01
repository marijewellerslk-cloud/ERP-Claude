CREATE TABLE "purchase_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"payment_date" timestamp NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"payment_type" varchar(50) NOT NULL,
	"transaction_reference" varchar(255),
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"supplier_code" varchar(50) NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"contact_person_name" varchar(255),
	"email" varchar(255),
	"phone" varchar(20) NOT NULL,
	"whatsapp" varchar(20),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"gst_number" varchar(15),
	"pan_number" varchar(10),
	"supplier_type" varchar(50) DEFAULT 'wholesaler',
	"specialization" jsonb,
	"bank_name" varchar(255),
	"account_number" varchar(50),
	"ifsc_code" varchar(20),
	"upi_id" varchar(100),
	"default_credit_days" integer DEFAULT 0,
	"credit_limit" numeric(12, 2) DEFAULT '0',
	"rating" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "suppliers_store_id_supplier_code_unique" UNIQUE("store_id","supplier_code")
);
--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "total_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "gold_rate_per_gram" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "total_paid" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "outstanding_balance" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "payment_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_batch_id_inventory_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."inventory_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_payments_batch_idx" ON "purchase_payments" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "purchase_payments_date_idx" ON "purchase_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "suppliers_phone_idx" ON "suppliers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "suppliers_email_idx" ON "suppliers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "suppliers_store_idx" ON "suppliers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "suppliers_type_idx" ON "suppliers" USING btree ("supplier_type");--> statement-breakpoint
CREATE INDEX "inventory_batches_payment_status_idx" ON "inventory_batches" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "inventory_batches_supplier_idx" ON "inventory_batches" USING btree ("supplier_id");--> statement-breakpoint

-- Create a "Legacy Supplier" for existing batches without supplier
-- This ensures data integrity when making supplier_id NOT NULL
DO $$
DECLARE
  store_record RECORD;
  legacy_supplier_id UUID;
BEGIN
  -- For each store that has batches without supplier_id
  FOR store_record IN
    SELECT DISTINCT store_id FROM inventory_batches WHERE supplier_id IS NULL
  LOOP
    -- Create a legacy supplier for this store
    INSERT INTO suppliers (
      store_id,
      supplier_code,
      business_name,
      phone,
      notes,
      is_active
    ) VALUES (
      store_record.store_id,
      'SUP-00000',
      'Legacy Supplier (Migration)',
      'N/A',
      'Auto-created during migration for existing batches without supplier information',
      true
    ) RETURNING id INTO legacy_supplier_id;

    -- Link all batches without supplier to this legacy supplier
    UPDATE inventory_batches
    SET supplier_id = legacy_supplier_id
    WHERE store_id = store_record.store_id
      AND supplier_id IS NULL;
  END LOOP;
END $$;
--> statement-breakpoint

-- Now that all batches have a supplier_id, add the foreign key constraint
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Make supplier_id NOT NULL (all batches now have a supplier)
ALTER TABLE "inventory_batches" ALTER COLUMN "supplier_id" SET NOT NULL;