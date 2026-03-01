CREATE TABLE "label_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"page_size" varchar(50) DEFAULT 'A4',
	"page_width" integer,
	"page_height" integer,
	"page_orientation" varchar(20) DEFAULT 'portrait',
	"label_width" integer NOT NULL,
	"label_height" integer NOT NULL,
	"labels_per_row" integer DEFAULT 2 NOT NULL,
	"labels_per_column" integer DEFAULT 4 NOT NULL,
	"margin_top" integer DEFAULT 10 NOT NULL,
	"margin_bottom" integer DEFAULT 10 NOT NULL,
	"margin_left" integer DEFAULT 10 NOT NULL,
	"margin_right" integer DEFAULT 10 NOT NULL,
	"horizontal_spacing" integer DEFAULT 5 NOT NULL,
	"vertical_spacing" integer DEFAULT 5 NOT NULL,
	"fields" jsonb NOT NULL,
	"company_name" varchar(255) DEFAULT 'MARI Jewellers',
	"show_company_header" boolean DEFAULT true NOT NULL,
	"header_font_size" integer DEFAULT 16,
	"show_border" boolean DEFAULT true NOT NULL,
	"border_width" integer DEFAULT 2,
	"border_color" varchar(7) DEFAULT '#000000',
	"border_radius" integer DEFAULT 4,
	"background_color" varchar(7) DEFAULT '#FFFFFF',
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "label_templates_store_idx" ON "label_templates" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "label_templates_default_idx" ON "label_templates" USING btree ("is_default","store_id");--> statement-breakpoint
CREATE INDEX "label_templates_active_idx" ON "label_templates" USING btree ("is_active");