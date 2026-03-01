ALTER TABLE "inventory_items" ADD COLUMN "cost_rate_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "calculated_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "cost_calculation_method" varchar(50);