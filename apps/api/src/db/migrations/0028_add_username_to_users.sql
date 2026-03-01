ALTER TABLE "users" ADD COLUMN "username" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username") WHERE "username" IS NOT NULL;
