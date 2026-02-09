import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  bigserial,
  bigint,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const customerTable = pgTable("customer_table", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const uploadedFileTable = pgTable("uploaded_file", {
  id: serial("id").primaryKey(),
  customerId: bigint("customer_id", { mode: "bigint" })
    .notNull()
    .references(() => customerTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  r2Key: text("r2_key").notNull(),
  fileType: text("file_type").notNull(), // 'csv' | 'pdf'
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  resultCsvKey: text("result_csv_key"), // For PDFs: key of generated CSV
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
