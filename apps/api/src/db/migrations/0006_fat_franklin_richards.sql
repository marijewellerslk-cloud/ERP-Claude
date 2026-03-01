CREATE TABLE "activity_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_date" timestamp NOT NULL,
	"category" varchar(50) NOT NULL,
	"activity_type" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"quantity_change" integer,
	"amount_change" numeric(12, 2),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"summary_date" timestamp NOT NULL,
	"total_sales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_invoices" integer DEFAULT 0 NOT NULL,
	"total_customers" integer DEFAULT 0 NOT NULL,
	"average_invoice_value" numeric(12, 2) DEFAULT '0',
	"items_added" integer DEFAULT 0 NOT NULL,
	"items_sold" integer DEFAULT 0 NOT NULL,
	"batches_created" integer DEFAULT 0 NOT NULL,
	"batches_completed" integer DEFAULT 0 NOT NULL,
	"total_gross_weight_added" numeric(12, 3) DEFAULT '0',
	"total_gross_weight_sold" numeric(12, 3) DEFAULT '0',
	"total_payments_received" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_payments_made" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_receivables" numeric(12, 2) DEFAULT '0',
	"outstanding_payables" numeric(12, 2) DEFAULT '0',
	"total_activities" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"top_selling_categories" jsonb,
	"top_customers" jsonb,
	"inventory_changes" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_summaries_store_id_summary_date_unique" UNIQUE("store_id","summary_date")
);
--> statement-breakpoint
CREATE TABLE "email_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"recipients" jsonb NOT NULL,
	"template_data" jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"error_message" text,
	"scheduled_for" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_summaries" ADD CONSTRAINT "activity_summaries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_summaries" ADD CONSTRAINT "activity_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_summaries_store_idx" ON "activity_summaries" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "activity_summaries_user_idx" ON "activity_summaries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_summaries_date_idx" ON "activity_summaries" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "activity_summaries_category_idx" ON "activity_summaries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "activity_summaries_type_idx" ON "activity_summaries" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "daily_summaries_store_idx" ON "daily_summaries" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "daily_summaries_generated_at_idx" ON "daily_summaries" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "email_notifications_store_idx" ON "email_notifications" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "email_notifications_status_idx" ON "email_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_notifications_scheduled_idx" ON "email_notifications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "email_notifications_type_idx" ON "email_notifications" USING btree ("notification_type");