import "dotenv/config";
import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running migration...");

  // Create uploaded_file table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "uploaded_file" (
      "id" SERIAL PRIMARY KEY NOT NULL,
      "customer_id" integer NOT NULL,
      "file_name" text NOT NULL,
      "r2_key" text NOT NULL,
      "file_type" text NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "result_csv_key" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
  console.log("Created uploaded_file table");

  // Add user_id column to customer_table if not exists
  try {
    await db.execute(sql`
      ALTER TABLE "customer_table" ADD COLUMN IF NOT EXISTS "user_id" text;
    `);
    console.log("Added user_id column to customer_table");
  } catch (e) {
    console.log("user_id column might already exist:", e);
  }

  // Add foreign key constraints
  try {
    await db.execute(sql`
      ALTER TABLE "uploaded_file" ADD CONSTRAINT "uploaded_file_customer_id_customer_table_id_fk" 
      FOREIGN KEY ("customer_id") REFERENCES "customer_table"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log("Added uploaded_file FK constraint");
  } catch (e) {
    console.log("FK constraint might already exist:", e);
  }

  try {
    await db.execute(sql`
      ALTER TABLE "customer_table" ADD CONSTRAINT "customer_table_user_id_user_id_fk" 
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log("Added customer_table FK constraint");
  } catch (e) {
    console.log("FK constraint might already exist:", e);
  }

  // MANUAL MIGRATION: Change customer_id to BIGINT (INT8) to support CockroachDB serials
  try {
    console.log("Altering customer_id to BIGINT...");
    // Drop FK first to allow type change? CockroachDB might allow direct alter.
    // Safest to drop FK, alter, re-add.
    await db.execute(sql`
        ALTER TABLE "uploaded_file" DROP CONSTRAINT IF EXISTS "uploaded_file_customer_id_customer_table_id_fk";
        ALTER TABLE "uploaded_file" ALTER COLUMN "customer_id" TYPE INT8;
        ALTER TABLE "customer_table" ALTER COLUMN "id" TYPE INT8; 
        ALTER TABLE "uploaded_file" ADD CONSTRAINT "uploaded_file_customer_id_customer_table_id_fk" 
        FOREIGN KEY ("customer_id") REFERENCES "customer_table"("id") ON DELETE cascade ON UPDATE no action;
    `);
    console.log("Successfully altered customer_id to BIGINT");
  } catch (e) {
    console.error(
      "Failed to alter columns to BIGINT (might already be BIGINT):",
      e,
    );
  }

  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
