import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@/lib/auth-schema";
import * as appSchema from "@/lib/schema";

// Use DATABASE_URL from env
const connectionString = process.env.DATABASE_URL!;

// Create postgres client
const client = postgres(connectionString, {
  ssl: "require", // IMPORTANT for CockroachDB & prod
  max: 10,
});

// Export Drizzle DB instance
export const db = drizzle(client, {
  schema: {
    ...authSchema,
    ...appSchema,
  },
  logger: process.env.NODE_ENV === "development",
});
