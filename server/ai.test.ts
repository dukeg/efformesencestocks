import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  predictDemand,
  calculateHealthScore,
  generatePricingRecommendation,
  generateBundlingRecommendation,
  generateRedistributionRecommendation,
  generateAlertMessage,
} from "./ai";
import * as db from "./db";

// Mock the database functions
vi.mock("./db", () => ({
  getTotalSalesQuantity: vi.fn(),
  getSalesHistoryForProduct: vi.fn(),
}));

describe("AI Prediction Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("predictDemand", () => {
    it("should predict high demand when sales are strong", async () => {
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(1500); // 50/day
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(1800); // 30/day for 60 days

      const result = await predictDemand(1, 5);

      expect(result.demandLevel).toBe("high");
      expect(result.predictedSalesNext30Days).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.trend).toBe("increasing");
    });

    it("should predict low demand when sales are weak", async () => {
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(50); // 1.67/day
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(100); // 1.67/day for 60 days

      const result = await predictDemand(1, 45);

      expect(result.demandLevel).toBe("medium");
      expect(result.trend).toBe("stable");
    });

    it("should detect stable demand when sales are consistent", async () => {
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(300); // 10/day
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(300); // 5/day for 60 days

      const result = await predictDemand(1, 10);

      expect(result.demandLevel).toBe("high");
      expect(result.trend).toBe("increasing");
    });

    it("should have higher confidence with more sales history", async () => {
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(500);
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(500);

      const result = await predictDemand(1, 0);

      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe("calculateHealthScore", () => {
    it("should give healthy score for recently sold products", () => {
      const health = calculateHealthScore(50, 5, 2, 30);

      expect(health.score).toBeGreaterThan(70);
      expect(health.status).toBe("healthy");
      expect(health.riskFactors.length).toBe(0);
    });

    it("should flag dead stock (90+ days unsold)", () => {
      const health = calculateHealthScore(100, 95, 0.5, 30);

      expect(health.score).toBeLessThan(70);
      expect(health.status).toBe("warning");
      expect(health.riskFactors).toContain("Dead stock - not sold in 90+ days");
    });

    it("should flag slow-moving inventory (30-60 days)", () => {
      const health = calculateHealthScore(80, 45, 1, 30);

      expect(health.riskFactors).toContain("Slow-moving - not sold in 30+ days");
    });

    it("should flag excessive inventory", () => {
      const health = calculateHealthScore(500, 10, 1, 30);

      expect(health.riskFactors).toContain("Excessive inventory - 6+ months of stock");
    });

    it("should flag expiring products", () => {
      const health = calculateHealthScore(50, 5, 2, 3);

      expect(health.riskFactors).toContain("Expiring within 7 days");
      expect(health.score).toBeLessThan(85);
    });

    it("should flag expired products as critical", () => {
      const health = calculateHealthScore(50, 5, 2, -1);

      expect(health.score).toBeLessThanOrEqual(50);
      expect(health.riskFactors).toContain("Product expired");
    });

    it("should score 0 minimum", () => {
      const health = calculateHealthScore(1000, 100, 0, -5);

      expect(health.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("generatePricingRecommendation", () => {
    it("should recommend heavy discount for dead stock", () => {
      const rec = generatePricingRecommendation(100, 100, 95, "low", 50, 0.5);

      expect(rec.discountPercentage).toBe(40);
      expect(rec.suggestedPrice).toBe(60);
      expect(rec.reason.toLowerCase()).toContain("dead stock");
    });

    it("should recommend strong discount for slow-moving items", () => {
      const rec = generatePricingRecommendation(100, 100, 65, "low", 50, 1);

      expect(rec.discountPercentage).toBe(30);
      expect(rec.suggestedPrice).toBe(70);
    });

    it("should recommend moderate discount for items unsold 30+ days", () => {
      const rec = generatePricingRecommendation(100, 100, 35, "medium", 30, 2);

      expect(rec.discountPercentage).toBe(20);
      expect(rec.suggestedPrice).toBe(80);
    });

    it("should recommend price increase for high demand items", () => {
      const rec = generatePricingRecommendation(100, 100, 5, "high", 10, 5);

      expect(rec.discountPercentage).toBe(-10);
      expect(rec.suggestedPrice).toBe(110);
    });

    it("should provide reasonable estimated impact", () => {
      const rec = generatePricingRecommendation(100, 100, 95, "low", 50, 0.5);

      expect(rec.estimatedImpact).toContain("move");
      expect(rec.estimatedImpact).toContain("%");
    });
  });

  describe("generateBundlingRecommendation", () => {
    it("should recommend bundling for slow-moving items", () => {
      const rec = generateBundlingRecommendation("Widget", 65, 50);

      expect(rec).not.toBeNull();
      expect(rec?.suggestion).toContain("bundling");
      expect(rec?.bundleStrategy).toContain("discount");
    });

    it("should not recommend bundling for recently sold items", () => {
      const rec = generateBundlingRecommendation("Widget", 15, 50);

      expect(rec).toBeNull();
    });

    it("should not recommend bundling for low stock", () => {
      const rec = generateBundlingRecommendation("Widget", 65, 5);

      expect(rec).toBeNull();
    });

    it("should suggest higher discount for very old stock", () => {
      const rec = generateBundlingRecommendation("Widget", 75, 50);

      expect(rec?.bundleStrategy).toContain("15-20%");
    });
  });

  describe("generateRedistributionRecommendation", () => {
    it("should recommend redistribution for old, high-stock items", () => {
      const rec = generateRedistributionRecommendation("Widget", 65, 100);

      expect(rec).not.toBeNull();
      expect(rec?.suggestion.toLowerCase()).toContain("redistribute");
    });

    it("should not recommend redistribution for recent sales", () => {
      const rec = generateRedistributionRecommendation("Widget", 30, 100);

      expect(rec).toBeNull();
    });

    it("should not recommend redistribution for low stock", () => {
      const rec = generateRedistributionRecommendation("Widget", 65, 10);

      expect(rec).toBeNull();
    });

    it("should suggest transferring 30-50% of stock", () => {
      const rec = generateRedistributionRecommendation("Widget", 65, 100);

      expect(rec?.action).toContain("30-50%");
    });
  });

  describe("generateAlertMessage", () => {
    it("should generate critical alert for expired products", () => {
      const alert = generateAlertMessage("Widget", "expiring_soon", { daysToExpiry: -1 });

      expect(alert.severity).toBe("critical");
      expect(alert.message).toContain("EXPIRED");
    });

    it("should generate critical alert for products expiring in <3 days", () => {
      const alert = generateAlertMessage("Widget", "expiring_soon", { daysToExpiry: 2 });

      expect(alert.severity).toBe("critical");
      expect(alert.message).toContain("expires");
    });

    it("should generate high alert for products expiring in 3-7 days", () => {
      const alert = generateAlertMessage("Widget", "expiring_soon", { daysToExpiry: 5 });

      expect(alert.severity).toBe("high");
    });

    it("should generate critical alert for dead stock (90+ days)", () => {
      const alert = generateAlertMessage("Widget", "not_selling", { daysUnsold: 100 });

      expect(alert.severity).toBe("critical");
      expect(alert.message).toContain("dead stock");
    });

    it("should generate high alert for slow-moving stock (60-90 days)", () => {
      const alert = generateAlertMessage("Widget", "not_selling", { daysUnsold: 75 });

      expect(alert.severity).toBe("high");
    });

    it("should generate medium alert for low demand", () => {
      const alert = generateAlertMessage("Widget", "low_demand", {});

      expect(alert.severity).toBe("medium");
      expect(alert.message).toContain("low predicted demand");
    });

    it("should generate low alert for overstock", () => {
      const alert = generateAlertMessage("Widget", "overstock", { daysOfStock: 120 });

      expect(alert.severity).toBe("low");
    });

    it("should include product name in all alerts", () => {
      const types: Array<"expiring_soon" | "not_selling" | "low_demand" | "overstock"> = [
        "expiring_soon",
        "not_selling",
        "low_demand",
        "overstock",
      ];

      types.forEach((type) => {
        const alert = generateAlertMessage("TestProduct", type, {});
        expect(alert.message).toContain("TestProduct");
      });
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete inventory analysis workflow", async () => {
      // Setup mock data for a slow-moving product
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(50); // 1.67/day last 30 days
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(100); // 1.67/day last 60 days

      const demand = await predictDemand(1, 45);
      const health = calculateHealthScore(100, 45, 1.67, 15);
      const pricing = generatePricingRecommendation(100, 100, 45, demand.demandLevel, 100, 1.67);

      expect(demand.demandLevel).toBe("medium");
      expect(health.riskFactors.length).toBeGreaterThan(0);
      expect(pricing.discountPercentage).toBeGreaterThan(0);
    });

    it("should identify products needing immediate action", async () => {
      // Setup mock for critical product
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(0);
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValueOnce(0);

      const demand = await predictDemand(1, 100);
      const health = calculateHealthScore(200, 100, 0, 2);
      const alert = generateAlertMessage("CriticalProduct", "not_selling", { daysUnsold: 100 });

      expect(demand.demandLevel).toBe("low");
      expect(health.status).toBe("critical");
      expect(alert.severity).toBe("critical");
    });
  });
});
