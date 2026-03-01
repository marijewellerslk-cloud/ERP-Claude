CREATE TABLE "customer_buying_habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"preferred_metal_types" jsonb,
	"preferred_categories" jsonb,
	"purchase_occasions" jsonb,
	"average_purchase_value" numeric(12, 2),
	"min_purchase_value" numeric(12, 2),
	"max_purchase_value" numeric(12, 2),
	"budget_tier" varchar(20),
	"recency_score" integer,
	"frequency_score" integer,
	"monetary_score" integer,
	"rfm_segment" varchar(50),
	"total_purchases" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_gold_weight_purchased" numeric(10, 3) DEFAULT '0',
	"first_purchase_date" timestamp,
	"last_purchase_date" timestamp,
	"average_days_between_purchases" integer,
	"preferred_purchase_months" jsonb,
	"preferred_purchase_days" jsonb,
	"churn_risk_score" numeric(5, 2),
	"predicted_next_purchase_date" timestamp,
	"lifetime_value" numeric(12, 2),
	"predicted_lifetime_value" numeric(12, 2),
	"last_calculated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_buying_habits_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "customer_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_id" uuid NOT NULL,
	"referral_code" varchar(50),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"qualification_date" timestamp,
	"qualifying_invoice_id" uuid,
	"qualifying_amount" numeric(12, 2),
	"referrer_reward_points" integer,
	"referrer_rewarded_at" timestamp,
	"referred_reward_points" integer,
	"referred_rewarded_at" timestamp,
	"recorded_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"custom_description" text,
	"wishlist_type" varchar(20) NOT NULL,
	"metal_type" varchar(50),
	"purity_preference" varchar(50),
	"category_id" uuid,
	"min_weight" numeric(10, 3),
	"max_weight" numeric(10, 3),
	"min_budget" numeric(12, 2),
	"max_budget" numeric(12, 2),
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(20) DEFAULT 'active',
	"notes" text,
	"notify_on_match" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp,
	"fulfilled_at" timestamp,
	"fulfilled_by_invoice_id" uuid,
	"expires_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_reward_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"points_spent" integer NOT NULL,
	"redemption_code" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"used_at" timestamp,
	"used_in_invoice_id" uuid,
	"discount_applied" numeric(12, 2),
	"expires_at" timestamp NOT NULL,
	"redeemed_by" uuid NOT NULL,
	"used_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_reward_redemptions_redemption_code_unique" UNIQUE("redemption_code")
);
--> statement-breakpoint
CREATE TABLE "loyalty_rewards_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"reward_type" varchar(50) NOT NULL,
	"points_cost" integer NOT NULL,
	"discount_percentage" numeric(5, 2),
	"discount_amount" numeric(12, 2),
	"max_discount_amount" numeric(12, 2),
	"service_type" varchar(50),
	"applicable_categories" jsonb,
	"applicable_products" jsonb,
	"min_tier" varchar(20) DEFAULT 'bronze',
	"min_purchase_amount" numeric(12, 2),
	"validity_days" integer DEFAULT 90,
	"max_redemptions_per_customer" integer,
	"total_available" integer,
	"total_redeemed" integer DEFAULT 0 NOT NULL,
	"display_order" integer DEFAULT 0,
	"image_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"name" varchar(255),
	"source" varchar(50) DEFAULT 'whatsapp_enquiry',
	"campaign_id" varchar(100),
	"lead_score" integer DEFAULT 0,
	"scoring_factors" jsonb,
	"stage" varchar(30) DEFAULT 'new' NOT NULL,
	"enquiry_type" varchar(50),
	"interested_products" jsonb,
	"budget_range" varchar(50),
	"converted_to_customer_id" uuid,
	"conversion_date" timestamp,
	"conversion_value" numeric(12, 2),
	"assigned_to" uuid,
	"next_follow_up_date" timestamp,
	"last_contacted_at" timestamp,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"tags" jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid,
	"lead_id" uuid,
	"phone_number" varchar(20) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"message_type" varchar(30) NOT NULL,
	"template_name" varchar(100),
	"content" text,
	"media_url" varchar(500),
	"reference_type" varchar(50),
	"reference_id" uuid,
	"whatsapp_message_id" varchar(255),
	"status" varchar(20) DEFAULT 'pending',
	"status_updated_at" timestamp,
	"error_message" text,
	"sent_by" uuid,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "communication_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "whatsapp_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email_opt_in" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "purchase_occasion" varchar(50);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "loyalty_points_earned" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "loyalty_points_redeemed" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "redemption_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_buying_habits" ADD CONSTRAINT "customer_buying_habits_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_buying_habits" ADD CONSTRAINT "customer_buying_habits_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referrer_id_customers_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referred_id_customers_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlists" ADD CONSTRAINT "customer_wishlists_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlists" ADD CONSTRAINT "customer_wishlists_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlists" ADD CONSTRAINT "customer_wishlists_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlists" ADD CONSTRAINT "customer_wishlists_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlists" ADD CONSTRAINT "customer_wishlists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_reward_id_loyalty_rewards_catalog_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rewards_catalog" ADD CONSTRAINT "loyalty_rewards_catalog_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rewards_catalog" ADD CONSTRAINT "loyalty_rewards_catalog_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_converted_to_customer_id_customers_id_fk" FOREIGN KEY ("converted_to_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_leads" ADD CONSTRAINT "whatsapp_leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_lead_id_whatsapp_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."whatsapp_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_buying_habits_customer_idx" ON "customer_buying_habits" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_buying_habits_store_idx" ON "customer_buying_habits" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "customer_buying_habits_rfm_segment_idx" ON "customer_buying_habits" USING btree ("rfm_segment");--> statement-breakpoint
CREATE INDEX "customer_buying_habits_budget_tier_idx" ON "customer_buying_habits" USING btree ("budget_tier");--> statement-breakpoint
CREATE INDEX "customer_buying_habits_churn_risk_idx" ON "customer_buying_habits" USING btree ("churn_risk_score");--> statement-breakpoint
CREATE INDEX "customer_referrals_store_idx" ON "customer_referrals" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "customer_referrals_referrer_idx" ON "customer_referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "customer_referrals_referred_idx" ON "customer_referrals" USING btree ("referred_id");--> statement-breakpoint
CREATE INDEX "customer_referrals_status_idx" ON "customer_referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_referrals_code_idx" ON "customer_referrals" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "customer_wishlists_customer_idx" ON "customer_wishlists" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_wishlists_store_idx" ON "customer_wishlists" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "customer_wishlists_item_idx" ON "customer_wishlists" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "customer_wishlists_status_idx" ON "customer_wishlists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_wishlists_type_idx" ON "customer_wishlists" USING btree ("wishlist_type");--> statement-breakpoint
CREATE INDEX "customer_wishlists_metal_type_idx" ON "customer_wishlists" USING btree ("metal_type");--> statement-breakpoint
CREATE INDEX "customer_wishlists_category_idx" ON "customer_wishlists" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "loyalty_reward_redemptions_store_idx" ON "loyalty_reward_redemptions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "loyalty_reward_redemptions_customer_idx" ON "loyalty_reward_redemptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_reward_redemptions_reward_idx" ON "loyalty_reward_redemptions" USING btree ("reward_id");--> statement-breakpoint
CREATE INDEX "loyalty_reward_redemptions_status_idx" ON "loyalty_reward_redemptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loyalty_reward_redemptions_code_idx" ON "loyalty_reward_redemptions" USING btree ("redemption_code");--> statement-breakpoint
CREATE INDEX "loyalty_reward_redemptions_expires_idx" ON "loyalty_reward_redemptions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "loyalty_rewards_catalog_store_idx" ON "loyalty_rewards_catalog" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "loyalty_rewards_catalog_type_idx" ON "loyalty_rewards_catalog" USING btree ("reward_type");--> statement-breakpoint
CREATE INDEX "loyalty_rewards_catalog_tier_idx" ON "loyalty_rewards_catalog" USING btree ("min_tier");--> statement-breakpoint
CREATE INDEX "loyalty_rewards_catalog_active_idx" ON "loyalty_rewards_catalog" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "loyalty_rewards_catalog_featured_idx" ON "loyalty_rewards_catalog" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "whatsapp_leads_store_idx" ON "whatsapp_leads" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "whatsapp_leads_phone_idx" ON "whatsapp_leads" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "whatsapp_leads_stage_idx" ON "whatsapp_leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "whatsapp_leads_score_idx" ON "whatsapp_leads" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "whatsapp_leads_assigned_idx" ON "whatsapp_leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "whatsapp_leads_follow_up_idx" ON "whatsapp_leads" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "whatsapp_leads_converted_idx" ON "whatsapp_leads" USING btree ("converted_to_customer_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_store_idx" ON "whatsapp_messages" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_customer_idx" ON "whatsapp_messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_lead_idx" ON "whatsapp_messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_phone_idx" ON "whatsapp_messages" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_direction_idx" ON "whatsapp_messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_status_idx" ON "whatsapp_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_reference_idx" ON "whatsapp_messages" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_created_at_idx" ON "whatsapp_messages" USING btree ("created_at");