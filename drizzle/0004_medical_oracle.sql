CREATE TABLE "uploaded_file" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" bigint NOT NULL,
	"file_name" text NOT NULL,
	"r2_key" text NOT NULL,
	"file_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_csv_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_table" ALTER COLUMN "id" SET DATA TYPE bigserial;--> statement-breakpoint
ALTER TABLE "customer_table" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "uploaded_file" ADD CONSTRAINT "uploaded_file_customer_id_customer_table_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_table" ADD CONSTRAINT "customer_table_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;