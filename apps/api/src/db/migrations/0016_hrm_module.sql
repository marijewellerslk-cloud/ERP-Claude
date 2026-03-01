-- HRM Module Migration
-- Adds employees, attendance, leave management, and payroll tables

-- Employees table
CREATE TABLE IF NOT EXISTS "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"store_id" uuid NOT NULL,
	"employee_code" varchar(20) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"date_of_birth" timestamp,
	"date_of_joining" timestamp NOT NULL,
	"department" varchar(50) NOT NULL,
	"position" varchar(100) NOT NULL,
	"employment_type" varchar(20) DEFAULT 'full_time' NOT NULL,
	"salary" numeric(12, 2) NOT NULL,
	"bank_account_number" varchar(50),
	"bank_name" varchar(100),
	"ifsc_code" varchar(15),
	"emergency_contact_name" varchar(255),
	"emergency_contact_phone" varchar(20),
	"address" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"termination_date" timestamp,
	"termination_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Attendance table
CREATE TABLE IF NOT EXISTS "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"check_in" timestamp,
	"check_out" timestamp,
	"work_hours" numeric(4, 2),
	"overtime_hours" numeric(4, 2) DEFAULT '0',
	"status" varchar(20) DEFAULT 'present' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Leave Types table
CREATE TABLE IF NOT EXISTS "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"days_allowed" integer NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"carry_forward" boolean DEFAULT false NOT NULL,
	"max_carry_forward" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Leave Requests table
CREATE TABLE IF NOT EXISTS "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_days" numeric(4, 1) NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Leave Balances table
CREATE TABLE IF NOT EXISTS "leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"allocated" numeric(4, 1) NOT NULL,
	"used" numeric(4, 1) DEFAULT '0' NOT NULL,
	"carried_forward" numeric(4, 1) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Payroll table
CREATE TABLE IF NOT EXISTS "payroll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"base_salary" numeric(12, 2) NOT NULL,
	"working_days" integer NOT NULL,
	"days_worked" integer NOT NULL,
	"overtime_hours" numeric(5, 2) DEFAULT '0',
	"overtime_amount" numeric(10, 2) DEFAULT '0',
	"bonus" numeric(10, 2) DEFAULT '0',
	"allowances" numeric(10, 2) DEFAULT '0',
	"deductions" numeric(10, 2) DEFAULT '0',
	"deduction_notes" text,
	"advance_deduction" numeric(10, 2) DEFAULT '0',
	"net_salary" numeric(12, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"paid_by" uuid,
	"payment_method" varchar(50),
	"payment_reference" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Salary Advances table
CREATE TABLE IF NOT EXISTS "salary_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"request_date" timestamp NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"rejection_reason" text,
	"deduct_from_payroll_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "employees" ADD CONSTRAINT "employees_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "payroll" ADD CONSTRAINT "payroll_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_deduct_from_payroll_id_payroll_id_fk" FOREIGN KEY ("deduct_from_payroll_id") REFERENCES "payroll"("id") ON DELETE no action ON UPDATE no action;

-- Add unique constraints
ALTER TABLE "employees" ADD CONSTRAINT "employees_store_id_employee_code_unique" UNIQUE("store_id","employee_code");
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_date_unique" UNIQUE("employee_id","date");
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_store_id_name_unique" UNIQUE("store_id","name");
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_leave_type_id_year_unique" UNIQUE("employee_id","leave_type_id","year");
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_employee_id_month_year_unique" UNIQUE("employee_id","month","year");

-- Add indexes
CREATE INDEX IF NOT EXISTS "employees_user_idx" ON "employees" ("user_id");
CREATE INDEX IF NOT EXISTS "employees_store_idx" ON "employees" ("store_id");
CREATE INDEX IF NOT EXISTS "employees_department_idx" ON "employees" ("department");
CREATE INDEX IF NOT EXISTS "employees_status_idx" ON "employees" ("status");

CREATE INDEX IF NOT EXISTS "attendance_store_idx" ON "attendance" ("store_id");
CREATE INDEX IF NOT EXISTS "attendance_date_idx" ON "attendance" ("date");
CREATE INDEX IF NOT EXISTS "attendance_status_idx" ON "attendance" ("status");

CREATE INDEX IF NOT EXISTS "leave_types_store_idx" ON "leave_types" ("store_id");

CREATE INDEX IF NOT EXISTS "leave_requests_employee_idx" ON "leave_requests" ("employee_id");
CREATE INDEX IF NOT EXISTS "leave_requests_store_idx" ON "leave_requests" ("store_id");
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests" ("status");
CREATE INDEX IF NOT EXISTS "leave_requests_date_idx" ON "leave_requests" ("start_date", "end_date");

CREATE INDEX IF NOT EXISTS "leave_balances_employee_idx" ON "leave_balances" ("employee_id");
CREATE INDEX IF NOT EXISTS "leave_balances_year_idx" ON "leave_balances" ("year");

CREATE INDEX IF NOT EXISTS "payroll_store_idx" ON "payroll" ("store_id");
CREATE INDEX IF NOT EXISTS "payroll_month_year_idx" ON "payroll" ("month", "year");
CREATE INDEX IF NOT EXISTS "payroll_status_idx" ON "payroll" ("status");

CREATE INDEX IF NOT EXISTS "salary_advances_employee_idx" ON "salary_advances" ("employee_id");
CREATE INDEX IF NOT EXISTS "salary_advances_store_idx" ON "salary_advances" ("store_id");
CREATE INDEX IF NOT EXISTS "salary_advances_status_idx" ON "salary_advances" ("status");
