CREATE TABLE "custom_order_design_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_order_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"version_name" varchar(255),
	"sketch_urls" jsonb,
	"cad_model_urls" jsonb,
	"render_urls" jsonb,
	"design_notes" text,
	"changes" text,
	"estimated_cost" numeric(12, 2),
	"cost_breakdown" jsonb,
	"customer_feedback" text,
	"feedback_received_at" timestamp,
	"status" varchar(20) DEFAULT 'draft',
	"presented_at" timestamp,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_order_id" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"item_type" varchar(100),
	"quantity" integer DEFAULT 1 NOT NULL,
	"metal_type" varchar(50),
	"purity" varchar(20),
	"estimated_weight" numeric(10, 3),
	"actual_weight" numeric(10, 3),
	"stone_type" varchar(100),
	"stone_count" integer,
	"stone_total_weight" numeric(10, 3),
	"stone_quality" varchar(50),
	"stone_source" varchar(50),
	"size" varchar(50),
	"length" numeric(10, 2),
	"width" numeric(10, 2),
	"thickness" numeric(10, 2),
	"gold_cost" numeric(12, 2),
	"stone_cost" numeric(12, 2),
	"making_charges" numeric(12, 2),
	"item_total" numeric(12, 2),
	"status" varchar(30) DEFAULT 'pending',
	"completed_at" timestamp,
	"design_images" jsonb,
	"completion_photos" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_order_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_order_id" uuid NOT NULL,
	"stage_name" varchar(50) NOT NULL,
	"stage_order" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"started_at" timestamp,
	"completed_at" timestamp,
	"processed_by" uuid,
	"customer_notified" boolean DEFAULT false,
	"notification_method" varchar(30),
	"notified_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"order_type" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'consultation' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"design_title" varchar(255) NOT NULL,
	"design_description" text,
	"customer_requirements" text,
	"reference_images" jsonb,
	"metal_type" varchar(50),
	"purity" varchar(20),
	"estimated_weight" numeric(10, 3),
	"actual_weight" numeric(10, 3),
	"ring_size" varchar(20),
	"bangle_size" varchar(20),
	"chain_length" varchar(20),
	"dimensions" jsonb,
	"has_stones" boolean DEFAULT false,
	"stone_details" jsonb,
	"gold_rate_at_quote" numeric(12, 2),
	"estimated_gold_cost" numeric(12, 2),
	"estimated_stone_cost" numeric(12, 2),
	"making_charges" numeric(12, 2),
	"design_charges" numeric(12, 2),
	"wastage_percentage" numeric(5, 2),
	"wastage_amount" numeric(12, 2),
	"additional_charges" numeric(12, 2),
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"estimated_total" numeric(12, 2),
	"final_total" numeric(12, 2),
	"quoted_at" timestamp,
	"quoted_by" uuid,
	"quote_valid_until" timestamp,
	"revision_count" integer DEFAULT 0,
	"design_approved" boolean DEFAULT false,
	"approved_at" timestamp,
	"approval_method" varchar(30),
	"signed_document_url" varchar(500),
	"advance_amount" numeric(12, 2) DEFAULT '0',
	"advance_percentage" numeric(5, 2) DEFAULT '50',
	"advance_paid_at" timestamp,
	"payment_status" varchar(20) DEFAULT 'pending',
	"balance_amount" numeric(12, 2),
	"production_started_at" timestamp,
	"expected_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"craftsman" varchar(255),
	"workshop_notes" text,
	"quality_check_date" timestamp,
	"quality_check_passed" boolean,
	"quality_check_notes" text,
	"ready_for_pickup_at" timestamp,
	"delivered_at" timestamp,
	"delivery_method" varchar(30),
	"delivery_address" text,
	"design_sketch_urls" jsonb,
	"cad_model_urls" jsonb,
	"production_photos" jsonb,
	"completion_photos" jsonb,
	"packaging_photos" jsonb,
	"consulted_by" uuid NOT NULL,
	"designed_by" uuid,
	"assigned_to" uuid,
	"delivered_by" uuid,
	"is_hallmarked" boolean DEFAULT false,
	"hallmark_number" varchar(100),
	"huid_number" varchar(100),
	"warranty_months" integer DEFAULT 6,
	"warranty_expires_at" timestamp,
	"inventory_item_id" uuid,
	"invoice_id" uuid,
	"notes" text,
	"internal_notes" text,
	"cancellation_reason" text,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "custom_order_design_versions" ADD CONSTRAINT "custom_order_design_versions_custom_order_id_custom_orders_id_fk" FOREIGN KEY ("custom_order_id") REFERENCES "public"."custom_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_order_design_versions" ADD CONSTRAINT "custom_order_design_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_order_items" ADD CONSTRAINT "custom_order_items_custom_order_id_custom_orders_id_fk" FOREIGN KEY ("custom_order_id") REFERENCES "public"."custom_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_order_stages" ADD CONSTRAINT "custom_order_stages_custom_order_id_custom_orders_id_fk" FOREIGN KEY ("custom_order_id") REFERENCES "public"."custom_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_order_stages" ADD CONSTRAINT "custom_order_stages_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_quoted_by_users_id_fk" FOREIGN KEY ("quoted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_consulted_by_users_id_fk" FOREIGN KEY ("consulted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_designed_by_users_id_fk" FOREIGN KEY ("designed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_delivered_by_users_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_orders" ADD CONSTRAINT "custom_orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_order_design_versions_order_idx" ON "custom_order_design_versions" USING btree ("custom_order_id");--> statement-breakpoint
CREATE INDEX "custom_order_design_versions_version_idx" ON "custom_order_design_versions" USING btree ("version_number");--> statement-breakpoint
CREATE INDEX "custom_order_design_versions_status_idx" ON "custom_order_design_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "custom_order_items_order_idx" ON "custom_order_items" USING btree ("custom_order_id");--> statement-breakpoint
CREATE INDEX "custom_order_items_status_idx" ON "custom_order_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "custom_order_stages_order_idx" ON "custom_order_stages" USING btree ("custom_order_id");--> statement-breakpoint
CREATE INDEX "custom_order_stages_stage_idx" ON "custom_order_stages" USING btree ("stage_name");--> statement-breakpoint
CREATE INDEX "custom_order_stages_status_idx" ON "custom_order_stages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "custom_orders_store_idx" ON "custom_orders" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "custom_orders_customer_idx" ON "custom_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "custom_orders_number_idx" ON "custom_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "custom_orders_status_idx" ON "custom_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "custom_orders_type_idx" ON "custom_orders" USING btree ("order_type");--> statement-breakpoint
CREATE INDEX "custom_orders_assigned_idx" ON "custom_orders" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "custom_orders_expected_date_idx" ON "custom_orders" USING btree ("expected_completion_date");