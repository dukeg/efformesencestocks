import { eq, and, desc, lt, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, products, salesHistory, alerts, recommendations, pricingHistory, type Product, type SalesHistory, type Alert, type Recommendation, type PricingHistory } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ PRODUCT QUERIES ============

export async function createProduct(userId: number, data: Omit<typeof products.$inferInsert, 'userId' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(products).values({
    ...data,
    userId,
  });
  
  return result;
}

export async function getProductsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(products).where(eq(products.userId, userId));
}

export async function getProductById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(products).where(
    and(eq(products.id, id), eq(products.userId, userId))
  );
  
  return result.length > 0 ? result[0] : null;
}

export async function updateProduct(id: number, userId: number, data: Partial<typeof products.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(products).set({
    ...data,
    updatedAt: new Date(),
  }).where(
    and(eq(products.id, id), eq(products.userId, userId))
  );
}

export async function deleteProduct(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(products).where(
    and(eq(products.id, id), eq(products.userId, userId))
  );
}

// Get products sorted by days unsold (for identifying dead stock)
export async function getDeadStockProducts(userId: number, minDaysUnsold: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(products)
    .where(
      and(
        eq(products.userId, userId),
        gte(products.daysUnsold, minDaysUnsold)
      )
    )
    .orderBy(desc(products.daysUnsold));
}

// Get products expiring soon
export async function getExpiringProducts(userId: number, daysThreshold: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysThreshold);
  
  return await db.select().from(products)
    .where(
      and(
        eq(products.userId, userId),
        lt(products.expiryDate, futureDate),
        gte(products.currentStock, 1)
      )
    )
    .orderBy(products.expiryDate);
}

// ============ SALES HISTORY QUERIES ============

export async function recordSale(productId: number, quantity: number, salePrice: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(salesHistory).values({
    productId,
    quantity,
    salePrice: salePrice.toString(),
  });
}

export async function getSalesHistoryForProduct(productId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - days);
  
  return await db.select().from(salesHistory)
    .where(
      and(
        eq(salesHistory.productId, productId),
        gte(salesHistory.saleDate, pastDate)
      )
    )
    .orderBy(desc(salesHistory.saleDate));
}

// Get total sales quantity for a product in last N days
export async function getTotalSalesQuantity(productId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return 0;
  
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - days);
  
  const result = await db.select({
    total: sql<number>`SUM(${salesHistory.quantity})`,
  }).from(salesHistory)
    .where(
      and(
        eq(salesHistory.productId, productId),
        gte(salesHistory.saleDate, pastDate)
      )
    );
  
  return result[0]?.total || 0;
}

// ============ ALERT QUERIES ============

export async function createAlert(userId: number, productId: number, alertType: string, severity: string, message: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(alerts).values({
    userId,
    productId,
    alertType: alertType as any,
    severity: severity as any,
    message,
  });
}

export async function getAlertsByUserId(userId: number, unreadOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(alerts).where(eq(alerts.userId, userId));
  
  if (unreadOnly) {
    query = db.select().from(alerts).where(
      and(eq(alerts.userId, userId), eq(alerts.isRead, false))
    );
  }
  
  return await query.orderBy(desc(alerts.createdAt));
}

export async function markAlertAsRead(alertId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(alerts).set({
    isRead: true,
  }).where(
    and(eq(alerts.id, alertId), eq(alerts.userId, userId))
  );
}

// ============ RECOMMENDATION QUERIES ============

export async function createRecommendation(userId: number, productId: number, data: Omit<typeof recommendations.$inferInsert, 'userId' | 'productId' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(recommendations).values({
    ...data,
    userId,
    productId,
  });
}

export async function getRecommendationsByUserId(userId: number, actionedOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(recommendations).where(eq(recommendations.userId, userId));
  
  if (actionedOnly) {
    query = db.select().from(recommendations).where(
      and(eq(recommendations.userId, userId), eq(recommendations.isActioned, true))
    );
  }
  
  return await query.orderBy(desc(recommendations.createdAt));
}

export async function markRecommendationAsActioned(recommendationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(recommendations).set({
    isActioned: true,
    actionedAt: new Date(),
  }).where(
    and(eq(recommendations.id, recommendationId), eq(recommendations.userId, userId))
  );
}

// ============ PRICING HISTORY QUERIES ============

export async function recordPriceChange(productId: number, oldPrice: number, newPrice: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(pricingHistory).values({
    productId,
    oldPrice: oldPrice.toString(),
    newPrice: newPrice.toString(),
    reason,
  });
}

export async function getPricingHistoryForProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(pricingHistory)
    .where(eq(pricingHistory.productId, productId))
    .orderBy(desc(pricingHistory.createdAt));
}
