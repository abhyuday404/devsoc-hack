"use server";

import { db } from "@/lib/db";
import { customerTable } from "@/lib/schema";
import { desc, sql } from "drizzle-orm";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?[0-9][0-9\s\-()]{7,19}$/;

type AddCustomerInput = {
  name: string;
  email: string;
  phone: string;
  status: string;
};

export async function addCustomerToCustomerTable(input: AddCustomerInput) {
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const status = input.status.trim();

  if (!name || !email || !phone || !status) {
    throw new Error("Name, email, phone, and status are required.");
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
    })
    .returning();

  return createdUser;
}

export async function viewCustomersFromCustomerTable() {
  return db.select().from(customerTable).orderBy(desc(customerTable.createdAt));
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

  return deletedCustomer;
}
