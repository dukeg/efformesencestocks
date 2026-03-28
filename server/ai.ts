import { getTotalSalesQuantity, getSalesHistoryForProduct } from "./db";

/**
 * AI Prediction Engine for SmartStock
 * Provides demand forecasting, health scoring, and recommendation logic
 */

export interface DemandPrediction {
  demandLevel: "high" | "medium" | "low";
  predictedSalesNext30Days: number;
  confidence: number;
  trend: "increasing" | "stable" | "decreasing";
}

export interface InventoryHealthScore {
  score: number; // 0-100
  status: "healthy" | "warning" | "critical";
  riskFactors: string[];
}

export interface PricingRecommendation {
  currentPrice: number;
  suggestedPrice: number;
  discountPercentage: number;
  reason: string;
  estimatedImpact: string;
}

/**
 * Predict demand for a product based on sales history
 * Uses simple time-series analysis and trend detection
 */
export async function predictDemand(productId: number, daysUnsold: number): Promise<DemandPrediction> {
  // Get sales data from last 30 days
  const salesLast30 = await getTotalSalesQuantity(productId, 30);
  
  // Get sales data from last 60 days for trend analysis
  const salesLast60 = await getTotalSalesQuantity(productId, 60);
  
  // Calculate average daily sales
  const avgDailyLast30 = salesLast30 / 30;
  const avgDailyLast60 = salesLast60 / 60;
  
  // Determine trend
  let trend: "increasing" | "stable" | "decreasing" = "stable";
  if (avgDailyLast30 > avgDailyLast60 * 1.2) {
    trend = "increasing";
  } else if (avgDailyLast30 < avgDailyLast60 * 0.8) {
    trend = "decreasing";
  }
  
  // Predict demand for next 30 days
  let predictedSalesNext30Days = Math.round(avgDailyLast30 * 30);
  
  // Adjust prediction based on trend
  if (trend === "increasing") {
    predictedSalesNext30Days = Math.round(predictedSalesNext30Days * 1.15);
  } else if (trend === "decreasing") {
    predictedSalesNext30Days = Math.round(predictedSalesNext30Days * 0.85);
  }
  
  // Determine demand level
  let demandLevel: "high" | "medium" | "low" = "medium";
  if (predictedSalesNext30Days > 50) {
    demandLevel = "high";
  } else if (predictedSalesNext30Days < 10) {
    demandLevel = "low";
  }
  
  // Calculate confidence (higher with more sales history)
  const confidence = Math.min(0.95, Math.max(0.3, (salesLast30 + 1) / 100));
  
  return {
    demandLevel,
    predictedSalesNext30Days,
    confidence,
    trend,
  };
}

/**
 * Calculate inventory health score for a product
 * Considers stock levels, sales velocity, and age
 */
export function calculateHealthScore(
  currentStock: number,
  daysUnsold: number,
  avgDailySales: number,
  expiryDaysRemaining?: number
): InventoryHealthScore {
  let score = 100;
  const riskFactors: string[] = [];
  
  // Factor 1: Days unsold (dead stock indicator)
  if (daysUnsold > 90) {
    score -= 40;
    riskFactors.push("Dead stock - not sold in 90+ days");
  } else if (daysUnsold > 60) {
    score -= 25;
    riskFactors.push("Slow-moving - not sold in 60+ days");
  } else if (daysUnsold > 30) {
    score -= 15;
    riskFactors.push("Slow-moving - not sold in 30+ days");
  }
  
  // Factor 2: Stock turnover ratio
  if (avgDailySales > 0) {
    const daysOfStock = currentStock / avgDailySales;
    if (daysOfStock > 180) {
      score -= 20;
      riskFactors.push("Excessive inventory - 6+ months of stock");
    } else if (daysOfStock > 90) {
      score -= 10;
      riskFactors.push("High inventory - 3+ months of stock");
    }
  } else if (currentStock > 100) {
    score -= 15;
    riskFactors.push("High stock with no recent sales");
  }
  
  // Factor 3: Expiry date approaching
  if (expiryDaysRemaining !== undefined) {
    if (expiryDaysRemaining < 0) {
      score -= 50;
      riskFactors.push("Product expired");
    } else if (expiryDaysRemaining < 7) {
      score -= 30;
      riskFactors.push("Expiring within 7 days");
    } else if (expiryDaysRemaining < 30) {
      score -= 15;
      riskFactors.push("Expiring within 30 days");
    }
  }
  
  // Determine status
  let status: "healthy" | "warning" | "critical" = "healthy";
  if (score < 40) {
    status = "critical";
  } else if (score < 70) {
    status = "warning";
  }
  
  return {
    score: Math.max(0, score),
    status,
    riskFactors,
  };
}

/**
 * Generate dynamic pricing recommendation
 * Based on inventory age, demand, and storage duration
 */
export function generatePricingRecommendation(
  basePrice: number,
  currentPrice: number,
  daysUnsold: number,
  demandLevel: "high" | "medium" | "low",
  currentStock: number,
  avgDailySales: number
): PricingRecommendation {
  let discountPercentage = 0;
  let reason = "";
  let estimatedImpact = "";
  
  // Pricing strategy based on days unsold
  if (daysUnsold > 90) {
    discountPercentage = 40; // Heavy clearance discount
    reason = "Dead stock - aggressive clearance needed";
    estimatedImpact = "Expected to move 70-80% of inventory";
  } else if (daysUnsold > 60) {
    discountPercentage = 30; // Strong discount
    reason = "Slow-moving inventory - significant discount recommended";
    estimatedImpact = "Expected to move 50-60% of inventory";
  } else if (daysUnsold > 30) {
    discountPercentage = 20; // Moderate discount
    reason = "Slow-moving product - moderate discount recommended";
    estimatedImpact = "Expected to move 30-40% of inventory";
  } else if (demandLevel === "low" && currentStock > 50) {
    discountPercentage = 15; // Light discount for low demand
    reason = "Low predicted demand - light discount to stimulate sales";
    estimatedImpact = "Expected to move 20-30% of inventory";
  } else if (demandLevel === "high" && daysUnsold < 7) {
    discountPercentage = -10; // Price increase for high demand
    reason = "High demand detected - price increase opportunity";
    estimatedImpact = "Expected to increase revenue by 10-15%";
  }
  
  const suggestedPrice = basePrice * (1 - discountPercentage / 100);
  
  return {
    currentPrice,
    suggestedPrice: Math.round(suggestedPrice * 100) / 100,
    discountPercentage,
    reason,
    estimatedImpact,
  };
}

/**
 * Generate bundling recommendations
 * Suggests complementary products to bundle with slow-moving items
 */
export function generateBundlingRecommendation(
  productName: string,
  daysUnsold: number,
  currentStock: number
): { suggestion: string; bundleStrategy: string } | null {
  if (daysUnsold < 30 || currentStock < 10) {
    return null;
  }
  
  let bundleStrategy = "";
  
  if (daysUnsold > 60) {
    bundleStrategy = "Bundle with fast-moving complementary products at 15-20% discount";
  } else {
    bundleStrategy = "Bundle with related products at 10-15% discount";
  }
  
  return {
    suggestion: `Consider bundling "${productName}" with complementary products to increase sales velocity`,
    bundleStrategy,
  };
}

/**
 * Generate redistribution recommendations
 * For multi-location inventory (future enhancement)
 */
export function generateRedistributionRecommendation(
  productName: string,
  daysUnsold: number,
  currentStock: number
): { suggestion: string; action: string } | null {
  if (daysUnsold < 45 || currentStock < 20) {
    return null;
  }
  
  return {
    suggestion: `Redistribute excess "${productName}" stock to high-demand locations`,
    action: "Transfer 30-50% of current stock to secondary locations or channels",
  };
}

/**
 * Generate alert messages based on product status
 */
export function generateAlertMessage(
  productName: string,
  alertType: "expiring_soon" | "not_selling" | "low_demand" | "overstock",
  metadata: Record<string, any>
): { message: string; severity: "low" | "medium" | "high" | "critical" } {
  let message = "";
  let severity: "low" | "medium" | "high" | "critical" = "medium";
  
  switch (alertType) {
    case "expiring_soon":
      const daysToExpiry = metadata.daysToExpiry || 0;
      if (daysToExpiry < 0) {
        message = `⚠️ "${productName}" has EXPIRED. Immediate action required.`;
        severity = "critical";
      } else if (daysToExpiry < 3) {
        message = `🔴 "${productName}" expires in ${daysToExpiry} days. Urgent clearance needed.`;
        severity = "critical";
      } else if (daysToExpiry < 7) {
        message = `🟠 "${productName}" expires in ${daysToExpiry} days. Consider discounting.`;
        severity = "high";
      } else {
        message = `🟡 "${productName}" expires in ${daysToExpiry} days. Plan clearance strategy.`;
        severity = "medium";
      }
      break;
      
    case "not_selling":
      const daysUnsold = metadata.daysUnsold || 0;
      if (daysUnsold > 90) {
        message = `🔴 "${productName}" has not sold for ${daysUnsold} days (dead stock). Aggressive action needed.`;
        severity = "critical";
      } else if (daysUnsold > 60) {
        message = `🟠 "${productName}" has not sold for ${daysUnsold} days. Strong discount recommended.`;
        severity = "high";
      } else {
        message = `🟡 "${productName}" has not sold for ${daysUnsold} days. Monitor closely.`;
        severity = "medium";
      }
      break;
      
    case "low_demand":
      message = `📊 "${productName}" shows low predicted demand. Consider promotional activities.`;
      severity = "medium";
      break;
      
    case "overstock":
      const stockDays = metadata.daysOfStock || 0;
      message = `📦 "${productName}" has ${stockDays} days of inventory. High stock levels detected.`;
      severity = "low";
      break;
  }
  
  return { message, severity };
}
