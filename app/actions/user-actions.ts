"use server";

import { db } from "@/lib/db";
import { customerTable, uploadedFileTable } from "@/lib/schema";
import { desc, sql, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTableSchemas, sanitizeTableName } from "@/lib/csv-db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?[0-9][0-9\s\-()]{7,19}$/;

type AddCustomerInput = {
  name: string;
  email: string;
  phone: string;
  status: string;
  userId: string;
};

export async function addCustomerToCustomerTable(input: AddCustomerInput) {
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const status = input.status.trim();
  const userId = input.userId.trim();

  if (!name || !email || !phone || !status || !userId) {
    throw new Error("Name, email, phone, status, and userId are required.");
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new Error("Invalid email format.");
  }
  if (!PHONE_REGEX.test(phone)) {
    throw new Error("Invalid phone number format.");
  }

  const [createdUser] = await db
    .insert(customerTable)
    .values({
      name,
      email,
      phone,
      status,
      userId,
    })
    .returning();

  return {
    ...createdUser,
    id: createdUser.id.toString(),
  };
}

export async function viewCustomersFromCustomerTable() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.user.id;

  if (!userId) {
    return [];
  }

  const customers = await db
    .select()
    .from(customerTable)
    .where(eq(customerTable.userId, userId))
    .orderBy(desc(customerTable.createdAt));

  return customers.map((c) => ({
    ...c,
    id: c.id.toString(),
  }));
}

export async function deleteCustomerFromCustomerTable(
  customerId: number | string,
) {
  const normalizedCustomerId = String(customerId).trim();
  if (!normalizedCustomerId) {
    throw new Error("Invalid customer id.");
  }

  const [deletedCustomer] = await db
    .delete(customerTable)
    .where(sql`${customerTable.id}::text = ${normalizedCustomerId}`)
    .returning();

  if (!deletedCustomer) {
    throw new Error("Customer not found.");
  }

  return {
    ...deletedCustomer,
    id: deletedCustomer.id.toString(),
  };
}

export async function getUploadedFilesForCustomer(customerId: number | string) {
  const files = await db
    .select()
    .from(uploadedFileTable)
    .where(eq(uploadedFileTable.customerId, BigInt(customerId)))
    .orderBy(desc(uploadedFileTable.createdAt));

  return files.map((f) => ({
    ...f,
    customerId: f.customerId.toString(),
  }));
}

export async function getAvailableTables(customerId: number | string) {
  const files = await getUploadedFilesForCustomer(customerId);
  const schemas = getTableSchemas();
  const tables = [];
  const processedTableNames = new Set<string>();

  for (const file of files) {
    const tableName = sanitizeTableName(file.fileName);
    if (processedTableNames.has(tableName)) {
      continue;
    }

    const schema = schemas.get(tableName);
    if (schema) {
      processedTableNames.add(tableName);
      tables.push({
        fileName: file.fileName,
        tableName: tableName,
        columns: schema.columns,
        rowCount: schema.rowCount,
      });
    }
  }
  return tables;
}
