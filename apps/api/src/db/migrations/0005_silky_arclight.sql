ALTER TABLE "inventory_categories" ADD COLUMN "requires_length" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD COLUMN "requires_width" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD COLUMN "requires_height" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD COLUMN "requires_internal_size" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD COLUMN "requires_ring_size" boolean DEFAULT false;