import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Products table - core inventory items
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  sku: varchar("sku", { length: 100 }).unique(),
  description: text("description"),
  currentStock: int("currentStock").notNull().default(0),
  reorderPoint: int("reorderPoint").default(10),
  basePrice: decimal("basePrice", { precision: 10, scale: 2 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }).notNull(),
  expiryDate: timestamp("expiryDate"),
  lastSoldDate: timestamp("lastSoldDate"),
  daysUnsold: int("daysUnsold").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Sales history - for demand prediction
export const salesHistory = mysqlTable("salesHistory", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(),
  salePrice: decimal("salePrice", { precision: 10, scale: 2 }).notNull(),
  saleDate: timestamp("saleDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SalesHistory = typeof salesHistory.$inferSelect;
export type InsertSalesHistory = typeof salesHistory.$inferInsert;

// Alerts table - for high-risk products
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  userId: int("userId").notNull(),
  alertType: mysqlEnum("alertType", ["expiring_soon", "not_selling", "low_demand", "overstock"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

// Recommendations table - AI-generated suggestions
export const recommendations = mysqlTable("recommendations", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  userId: int("userId").notNull(),
  recommendationType: mysqlEnum("recommendationType", ["discount", "bundling", "redistribution", "clearance"]).notNull(),
  suggestedAction: text("suggestedAction").notNull(),
  estimatedImpact: varchar("estimatedImpact", { length: 100 }),
  discountPercentage: decimal("discountPercentage", { precision: 5, scale: 2 }),
  bundleProductIds: json("bundleProductIds"),
  isActioned: boolean("isActioned").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  actionedAt: timestamp("actionedAt"),
});

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = typeof recommendations.$inferInsert;

// Pricing history - for tracking price changes
export const pricingHistory = mysqlTable("pricingHistory", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  oldPrice: decimal("oldPrice", { precision: 10, scale: 2 }).notNull(),
  newPrice: decimal("newPrice", { precision: 10, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PricingHistory = typeof pricingHistory.$inferSelect;
export type InsertPricingHistory = typeof pricingHistory.$inferInsert;
