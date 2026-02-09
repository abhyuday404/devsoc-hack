"use server";

import { db } from "@/lib/db";
import { customerTable } from "@/lib/schema";
import { desc } from "drizzle-orm";

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
