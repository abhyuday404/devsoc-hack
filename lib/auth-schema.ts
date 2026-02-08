import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";


export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),

  name: text("name"),
  image: text("image"),

  // your custom fields
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});


export const accounts = pgTable(
  "account",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),

    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    expiresAt: timestamp("expires_at", { mode: "date" }),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    providerIdx: index("account_provider_idx").on(
      table.provider,
      table.providerAccountId,
    ),
  }),
);


export const sessions = pgTable("session", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  sessionToken: text("session_token").notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const verificationTokens = pgTable("verification_token", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});
