CREATE TABLE "market_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"world_gold_price_usd" numeric(12, 2),
	"sea_street_price_lkr" numeric(12, 2),
	"lkr_usdt_rate" numeric(12, 4),
	"world_gold_price_lkr_gram" numeric(12, 2),
	"spread_percentage" numeric(8, 4),
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "market_data_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "market_data" ADD CONSTRAINT "market_data_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_data_date_idx" ON "market_data" USING btree ("date");