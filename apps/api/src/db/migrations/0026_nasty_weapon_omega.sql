ALTER TABLE "employees" ADD COLUMN "payroll_frequency" varchar(20) DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "nic_number" varchar(20);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "nic_photo_url" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_contact_name_2" varchar(255);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_contact_phone_2" varchar(20);--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "cycle" varchar(20) DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "bonus_type" varchar(50) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "festive_bonus_month" integer;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "epf_employee" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "epf_employer" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "etf_employer" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "apit" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
CREATE INDEX "employees_nic_idx" ON "employees" USING btree ("nic_number");