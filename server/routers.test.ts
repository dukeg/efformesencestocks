import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Mock database functions
vi.mock("./db");

function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };
}

describe("Product Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("products.list", () => {
    it("should return list of products", async () => {
      const mockProducts = [
        {
          id: 1,
          userId: 1,
          name: "Widget",
          category: "Electronics",
          sku: "SKU-001",
          description: "A useful widget",
          currentStock: 50,
          reorderPoint: 10,
          basePrice: "99.99",
          currentPrice: "99.99",
          daysUnsold: 5,
          expiryDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getProductsByUserId).mockResolvedValueOnce(mockProducts);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.list();

      expect(result).toEqual(mockProducts);
      expect(db.getProductsByUserId).toHaveBeenCalledWith(1);
    });
  });

  describe("products.create", () => {
    it("should create a new product", async () => {
      const newProduct = {
        id: 2,
        userId: 1,
        name: "Gadget",
        category: "Electronics",
        sku: "SKU-002",
        description: "A cool gadget",
        currentStock: 100,
        reorderPoint: 20,
        basePrice: "149.99",
        currentPrice: "149.99",
        daysUnsold: 0,
        expiryDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.createProduct).mockResolvedValueOnce(newProduct);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.create({
        name: "Gadget",
        category: "Electronics",
        sku: "SKU-002",
        description: "A cool gadget",
        currentStock: 100,
        reorderPoint: 20,
        basePrice: 149.99,
      });

      expect(result).toEqual(newProduct);
      expect(db.createProduct).toHaveBeenCalled();
    });
  });
});

describe("Sales Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sales.record", () => {
    it("should record a sale successfully", async () => {
      const mockProduct = {
        id: 1,
        userId: 1,
        name: "Widget",
        category: "Electronics",
        sku: "SKU-001",
        description: "A widget",
        currentStock: 50,
        reorderPoint: 10,
        basePrice: "99.99",
        currentPrice: "99.99",
        daysUnsold: 5,
        expiryDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getProductById).mockResolvedValueOnce(mockProduct);
      vi.mocked(db.recordSale).mockResolvedValueOnce(undefined);
      vi.mocked(db.updateProduct).mockResolvedValueOnce(undefined);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.sales.record({
        productId: 1,
        quantity: 5,
        salePrice: 99.99,
      });

      expect(result).toEqual({ success: true });
      expect(db.recordSale).toHaveBeenCalled();
      expect(db.updateProduct).toHaveBeenCalled();
    });
  });
});

describe("Analytics Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analytics.overview", () => {
    it("should return overview statistics", async () => {
      const mockProducts = [
        {
          id: 1,
          userId: 1,
          name: "Product 1",
          category: "Cat1",
          sku: "SKU-001",
          description: "Desc",
          currentStock: 50,
          reorderPoint: 10,
          basePrice: "100",
          currentPrice: "100",
          daysUnsold: 5,
          expiryDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getProductsByUserId).mockResolvedValueOnce(mockProducts);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.analytics.overview();

      expect(result).toHaveProperty("totalProducts");
      expect(result).toHaveProperty("totalStock");
      expect(result).toHaveProperty("totalValue");
      expect(result).toHaveProperty("deadStockCount");
    });
  });

  describe("analytics.healthDistribution", () => {
    it("should return health distribution counts", async () => {
      const mockProducts = [
        {
          id: 1,
          userId: 1,
          name: "Healthy Product",
          category: "Cat1",
          sku: "SKU-001",
          description: "Desc",
          currentStock: 50,
          reorderPoint: 10,
          basePrice: "100",
          currentPrice: "100",
          daysUnsold: 5,
          expiryDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getProductsByUserId).mockResolvedValueOnce(mockProducts);
      vi.mocked(db.getTotalSalesQuantity).mockResolvedValue(100);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.analytics.healthDistribution();

      expect(result).toHaveProperty("healthy");
      expect(result).toHaveProperty("warning");
      expect(result).toHaveProperty("critical");
      expect(typeof result.healthy).toBe("number");
      expect(typeof result.warning).toBe("number");
      expect(typeof result.critical).toBe("number");
    });
  });
});

describe("Alerts Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("alerts.list", () => {
    it("should return list of alerts", async () => {
      const mockAlerts = [
        {
          id: 1,
          userId: 1,
          productId: 1,
          alertType: "not_selling" as const,
          severity: "high" as const,
          message: "Product not selling",
          isRead: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.getAlertsByUserId).mockResolvedValueOnce(mockAlerts);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.alerts.list({ unreadOnly: false });

      expect(result).toEqual(mockAlerts);
    });
  });
});

describe("Recommendations Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recommendations.list", () => {
    it("should return list of recommendations", async () => {
      const mockRecs = [
        {
          id: 1,
          userId: 1,
          productId: 1,
          recommendationType: "discount" as const,
          suggestedAction: "Apply 20% discount",
          discountPercentage: 20,
          estimatedImpact: "Expected to move 30% more units",
          isActioned: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.getRecommendationsByUserId).mockResolvedValueOnce(mockRecs);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.recommendations.list({ actionedOnly: false });

      expect(result).toEqual(mockRecs);
    });
  });
});
