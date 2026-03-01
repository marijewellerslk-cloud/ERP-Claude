CREATE TABLE "exchange_valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"valuation_number" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"item_description" text NOT NULL,
	"item_type" varchar(100),
	"metal_type" varchar(50) NOT NULL,
	"claimed_purity" varchar(20),
	"tested_purity" varchar(20),
	"gross_weight" numeric(10, 3) NOT NULL,
	"stone_weight" numeric(10, 3) DEFAULT '0',
	"net_weight" numeric(10, 3),
	"testing_method" varchar(50),
	"testing_notes" text,
	"tested_by" uuid,
	"tested_at" timestamp,
	"market_rate" numeric(12, 2),
	"exchange_rate" numeric(12, 2),
	"deduction_percentage" numeric(5, 2),
	"stone_value" numeric(12, 2) DEFAULT '0',
	"gross_value" numeric(12, 2),
	"deductions" numeric(12, 2) DEFAULT '0',
	"final_value" numeric(12, 2),
	"offer_valid_until" timestamp,
	"customer_decision" varchar(20),
	"decision_at" timestamp,
	"rejection_reason" text,
	"linked_invoice_id" uuid,
	"applied_to_invoice" boolean DEFAULT false,
	"payment_method" varchar(30),
	"payment_reference" varchar(100),
	"paid_at" timestamp,
	"item_photos" jsonb,
	"testing_photos" jsonb,
	"received_by" uuid NOT NULL,
	"valued_by" uuid,
	"approved_by" uuid,
	"notes" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_valuations_valuation_number_unique" UNIQUE("valuation_number")
);
--> statement-breakpoint
CREATE TABLE "repair_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_id" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"item_type" varchar(100),
	"metal_type" varchar(50),
	"purity" varchar(20),
	"weight" numeric(10, 3),
	"issue_description" text,
	"repair_action" text,
	"inventory_item_id" uuid,
	"before_photos" jsonb,
	"after_photos" jsonb,
	"labor_cost" numeric(12, 2),
	"material_cost" numeric(12, 2),
	"status" varchar(30) DEFAULT 'pending',
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_id" uuid NOT NULL,
	"stage_name" varchar(50) NOT NULL,
	"stage_order" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"started_at" timestamp,
	"completed_at" timestamp,
	"processed_by" uuid,
	"notes" text,
	"customer_notified" boolean DEFAULT false,
	"notified_at" timestamp,
	"notification_method" varchar(30),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"repair_number" varchar(50) NOT NULL,
	"repair_type" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'received' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"item_description" text NOT NULL,
	"metal_type" varchar(50),
	"purity" varchar(20),
	"estimated_weight" numeric(10, 3),
	"problem_description" text NOT NULL,
	"customer_instructions" text,
	"assessment_notes" text,
	"assessment_date" timestamp,
	"assessed_by" uuid,
	"estimated_cost" numeric(12, 2),
	"labor_charges" numeric(12, 2),
	"material_cost" numeric(12, 2),
	"additional_charges" numeric(12, 2),
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"final_cost" numeric(12, 2),
	"quotation_approved" boolean DEFAULT false,
	"approved_at" timestamp,
	"approval_method" varchar(30),
	"advance_amount" numeric(12, 2) DEFAULT '0',
	"advance_paid_at" timestamp,
	"payment_status" varchar(20) DEFAULT 'pending',
	"balance_amount" numeric(12, 2),
	"expected_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"delivered_at" timestamp,
	"intake_photos" jsonb,
	"completion_photos" jsonb,
	"received_by" uuid NOT NULL,
	"assigned_to" uuid,
	"delivered_by" uuid,
	"warranty_days" integer DEFAULT 30,
	"warranty_expires_at" timestamp,
	"notes" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repairs_repair_number_unique" UNIQUE("repair_number")
);
--> statement-breakpoint
ALTER TABLE "exchange_valuations" ADD CONSTRAINT "exchange_valuations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_valuations" ADD CONSTRAINT "exchange_valuations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_valuations" ADD CONSTRAINT "exchange_valuations_tested_by_users_id_fk" FOREIGN KEY ("tested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_valuations" ADD CONSTRAINT "exchange_valuations_linked_invoice_id_invoices_id_fk" FOREIGN KEY ("linked_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_valuations" ADD CONSTRAINT "exchange_valuations_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_valuations" ADD CONSTRAINT "exchange_valuations_valued_by_users_id_fk" FOREIGN KEY ("valued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_valuations" ADD CONSTRAINT "exchange_valuations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_items" ADD CONSTRAINT "repair_items_repair_id_repairs_id_fk" FOREIGN KEY ("repair_id") REFERENCES "public"."repairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_items" ADD CONSTRAINT "repair_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_stages" ADD CONSTRAINT "repair_stages_repair_id_repairs_id_fk" FOREIGN KEY ("repair_id") REFERENCES "public"."repairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_stages" ADD CONSTRAINT "repair_stages_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_delivered_by_users_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchange_valuations_store_idx" ON "exchange_valuations" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "exchange_valuations_customer_idx" ON "exchange_valuations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "exchange_valuations_number_idx" ON "exchange_valuations" USING btree ("valuation_number");--> statement-breakpoint
CREATE INDEX "exchange_valuations_status_idx" ON "exchange_valuations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exchange_valuations_metal_idx" ON "exchange_valuations" USING btree ("metal_type");--> statement-breakpoint
CREATE INDEX "repair_items_repair_idx" ON "repair_items" USING btree ("repair_id");--> statement-breakpoint
CREATE INDEX "repair_items_status_idx" ON "repair_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "repair_stages_repair_idx" ON "repair_stages" USING btree ("repair_id");--> statement-breakpoint
CREATE INDEX "repair_stages_stage_idx" ON "repair_stages" USING btree ("stage_name");--> statement-breakpoint
CREATE INDEX "repair_stages_status_idx" ON "repair_stages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "repairs_store_idx" ON "repairs" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "repairs_customer_idx" ON "repairs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "repairs_number_idx" ON "repairs" USING btree ("repair_number");--> statement-breakpoint
CREATE INDEX "repairs_status_idx" ON "repairs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "repairs_type_idx" ON "repairs" USING btree ("repair_type");--> statement-breakpoint
CREATE INDEX "repairs_assigned_idx" ON "repairs" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "repairs_expected_date_idx" ON "repairs" USING btree ("expected_completion_date");