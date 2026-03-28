import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import {
  createProduct,
  getProductsByUserId,
  getProductById,
  updateProduct,
  deleteProduct,
  getDeadStockProducts,
  getExpiringProducts,
  recordSale,
  getSalesHistoryForProduct,
  getTotalSalesQuantity,
  createAlert,
  getAlertsByUserId,
  markAlertAsRead,
  createRecommendation,
  getRecommendationsByUserId,
  markRecommendationAsActioned,
  recordPriceChange,
  getPricingHistoryForProduct,
} from "./db";
import {
  predictDemand,
  calculateHealthScore,
  generatePricingRecommendation,
  generateBundlingRecommendation,
  generateRedistributionRecommendation,
  generateAlertMessage,
} from "./ai";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ PRODUCT MANAGEMENT ============
  products: router({
    // Create a new product
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          category: z.string().optional(),
          sku: z.string().optional(),
          description: z.string().optional(),
          currentStock: z.number().int().min(0),
          reorderPoint: z.number().int().min(0).optional(),
          basePrice: z.number().positive(),
          expiryDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await createProduct(ctx.user.id, {
          name: input.name,
          category: input.category,
          sku: input.sku,
          description: input.description,
          currentStock: input.currentStock,
          reorderPoint: input.reorderPoint,
          basePrice: input.basePrice.toString(),
          currentPrice: input.basePrice.toString(),
          expiryDate: input.expiryDate,
          daysUnsold: 0,
          lastSoldDate: new Date(),
        });
        return result;
      }),

    // Get all products for the user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getProductsByUserId(ctx.user.id);
    }),

    // Get a specific product
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getProductById(input.id, ctx.user.id);
      }),

    // Update a product
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          category: z.string().optional(),
          description: z.string().optional(),
          currentStock: z.number().int().min(0).optional(),
          reorderPoint: z.number().int().min(0).optional(),
          basePrice: z.number().positive().optional(),
          currentPrice: z.number().positive().optional(),
          expiryDate: z.date().optional(),
          daysUnsold: z.number().int().optional(),
          lastSoldDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, any> = {};
        
        if (data.name) updateData.name = data.name;
        if (data.category) updateData.category = data.category;
        if (data.description) updateData.description = data.description;
        if (data.currentStock !== undefined) updateData.currentStock = data.currentStock;
        if (data.reorderPoint !== undefined) updateData.reorderPoint = data.reorderPoint;
        if (data.basePrice) updateData.basePrice = data.basePrice.toString();
        if (data.currentPrice) updateData.currentPrice = data.currentPrice.toString();
        if (data.expiryDate) updateData.expiryDate = data.expiryDate;
        if (data.daysUnsold !== undefined) updateData.daysUnsold = data.daysUnsold;
        if (data.lastSoldDate) updateData.lastSoldDate = data.lastSoldDate;

        return await updateProduct(id, ctx.user.id, updateData);
      }),

    // Delete a product
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await deleteProduct(input.id, ctx.user.id);
      }),

    // Get dead stock products (not sold for 30+ days)
    deadStock: protectedProcedure
      .input(z.object({ minDaysUnsold: z.number().int().min(1).optional() }))
      .query(async ({ ctx, input }) => {
        return await getDeadStockProducts(ctx.user.id, input.minDaysUnsold || 30);
      }),

    // Get expiring products
    expiring: protectedProcedure
      .input(z.object({ daysThreshold: z.number().int().min(1).optional() }))
      .query(async ({ ctx, input }) => {
        return await getExpiringProducts(ctx.user.id, input.daysThreshold || 7);
      }),
  }),

  // ============ SALES TRACKING ============
  sales: router({
    // Record a sale
    record: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          quantity: z.number().int().min(1),
          salePrice: z.number().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify product belongs to user
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        // Record the sale
        await recordSale(input.productId, input.quantity, input.salePrice);

        // Update product stock and last sold date
        const newStock = Math.max(0, product.currentStock - input.quantity);
        await updateProduct(input.productId, ctx.user.id, {
          currentStock: newStock,
          lastSoldDate: new Date(),
          daysUnsold: 0,
        });

        return { success: true };
      }),

    // Get sales history for a product
    history: protectedProcedure
      .input(z.object({ productId: z.number(), days: z.number().int().min(1).optional() }))
      .query(async ({ ctx, input }) => {
        // Verify product belongs to user
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        return await getSalesHistoryForProduct(input.productId, input.days || 30);
      }),

    // Get total sales quantity for a product
    totalQuantity: protectedProcedure
      .input(z.object({ productId: z.number(), days: z.number().int().min(1).optional() }))
      .query(async ({ ctx, input }) => {
        // Verify product belongs to user
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        return await getTotalSalesQuantity(input.productId, input.days || 30);
      }),
  }),

  // ============ AI PREDICTIONS & RECOMMENDATIONS ============
  ai: router({
    // Get demand prediction for a product
    predictDemand: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ ctx, input }) => {
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        return await predictDemand(input.productId, product.daysUnsold || 0);
      }),

    // Calculate health score for a product
    healthScore: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ ctx, input }) => {
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        const avgDailySales = await getTotalSalesQuantity(input.productId, 30);
        const avgDaily = avgDailySales / 30;

        let expiryDaysRemaining: number | undefined;
        if (product.expiryDate) {
          const now = new Date();
          expiryDaysRemaining = Math.ceil(
            (product.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        return calculateHealthScore(
          product.currentStock,
          product.daysUnsold || 0,
          avgDaily,
          expiryDaysRemaining
        );
      }),

    // Get pricing recommendation
    pricingRecommendation: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ ctx, input }) => {
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        const demand = await predictDemand(input.productId, product.daysUnsold || 0);
        const avgDailySales = await getTotalSalesQuantity(input.productId, 30) / 30;

        return generatePricingRecommendation(
          parseFloat(product.basePrice),
          parseFloat(product.currentPrice),
          product.daysUnsold || 0,
          demand.demandLevel,
          product.currentStock,
          avgDailySales
        );
      }),

    // Get bundling recommendation
    bundlingRecommendation: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ ctx, input }) => {
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        return generateBundlingRecommendation(
          product.name,
          product.daysUnsold || 0,
          product.currentStock
        );
      }),

    // Get redistribution recommendation
    redistributionRecommendation: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ ctx, input }) => {
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        return generateRedistributionRecommendation(
          product.name,
          product.daysUnsold || 0,
          product.currentStock
        );
      }),

    // Generate all recommendations for a product
    allRecommendations: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ ctx, input }) => {
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        const pricing = await generatePricingRecommendation(
          parseFloat(product.basePrice),
          parseFloat(product.currentPrice),
          product.daysUnsold || 0,
          (await predictDemand(input.productId, product.daysUnsold || 0)).demandLevel,
          product.currentStock,
          (await getTotalSalesQuantity(input.productId, 30)) / 30
        );

        return {
          pricing,
          bundling: generateBundlingRecommendation(
            product.name,
            product.daysUnsold || 0,
            product.currentStock
          ),
          redistribution: generateRedistributionRecommendation(
            product.name,
            product.daysUnsold || 0,
            product.currentStock
          ),
        };
      }),
  }),

  // ============ ALERTS ============
  alerts: router({
    // Get all alerts for user
    list: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().optional() }))
      .query(async ({ ctx, input }) => {
        return await getAlertsByUserId(ctx.user.id, input.unreadOnly);
      }),

    // Mark alert as read
    markAsRead: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await markAlertAsRead(input.alertId, ctx.user.id);
      }),

    // Create alert (internal use)
    create: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          alertType: z.enum(["expiring_soon", "not_selling", "low_demand", "overstock"]),
          metadata: z.record(z.string(), z.any()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const alertMessage = generateAlertMessage(
          "Product",
          input.alertType,
          input.metadata || {}
        );

        return await createAlert(
          ctx.user.id,
          input.productId,
          input.alertType,
          alertMessage.severity,
          alertMessage.message
        );
      }),
  }),

  // ============ RECOMMENDATIONS ============
  recommendations: router({
    // Get all recommendations for user
    list: protectedProcedure
      .input(z.object({ actionedOnly: z.boolean().optional() }))
      .query(async ({ ctx, input }) => {
        return await getRecommendationsByUserId(ctx.user.id, input.actionedOnly);
      }),

    // Mark recommendation as actioned
    markAsActioned: protectedProcedure
      .input(z.object({ recommendationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await markRecommendationAsActioned(input.recommendationId, ctx.user.id);
      }),

    // Create recommendation (internal use)
    create: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          recommendationType: z.enum(["discount", "bundling", "redistribution", "clearance"]),
          suggestedAction: z.string(),
          estimatedImpact: z.string().optional(),
          discountPercentage: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createRecommendation(ctx.user.id, input.productId, {
          recommendationType: input.recommendationType as any,
          suggestedAction: input.suggestedAction,
          estimatedImpact: input.estimatedImpact,
          discountPercentage: input.discountPercentage?.toString(),
        });
      }),
  }),

  // ============ PRICING ============
  pricing: router({
    // Get pricing history for a product
    history: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ ctx, input }) => {
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        return await getPricingHistoryForProduct(input.productId);
      }),

    // Apply dynamic price adjustment
    applyDynamicPrice: protectedProcedure
      .input(z.object({ productId: z.number(), newPrice: z.number().positive() }))
      .mutation(async ({ ctx, input }) => {
        const product = await getProductById(input.productId, ctx.user.id);
        if (!product) throw new Error("Product not found");

        const oldPrice = parseFloat(product.currentPrice);

        // Record price change
        await recordPriceChange(
          input.productId,
          oldPrice,
          input.newPrice,
          "Dynamic pricing adjustment"
        );

        // Update product price
        await updateProduct(input.productId, ctx.user.id, {
          currentPrice: input.newPrice.toString(),
        });

        return { success: true, oldPrice, newPrice: input.newPrice };
      }),
  }),

  // ============ ANALYTICS ============
  analytics: router({
    // Get dashboard overview
    overview: protectedProcedure.query(async ({ ctx }) => {
      const products = await getProductsByUserId(ctx.user.id);
      
      let totalProducts = products.length;
      let totalStock = 0;
      let deadStockCount = 0;
      let warningCount = 0;
      let totalValue = 0;

      for (const product of products) {
        totalStock += product.currentStock;
        totalValue += product.currentStock * parseFloat(product.currentPrice);
        
        if ((product.daysUnsold || 0) > 30) {
          deadStockCount++;
        }
        
        if ((product.daysUnsold || 0) > 15) {
          warningCount++;
        }
      }

      return {
        totalProducts,
        totalStock,
        totalValue: Math.round(totalValue * 100) / 100,
        deadStockCount,
        warningCount,
        healthStatus: deadStockCount > totalProducts * 0.2 ? "critical" : "normal",
      };
    }),

    // Get inventory health distribution
    healthDistribution: protectedProcedure.query(async ({ ctx }) => {
      const products = await getProductsByUserId(ctx.user.id);
      
      let healthy = 0;
      let warning = 0;
      let critical = 0;

      for (const product of products) {
        const avgDailySales = await getTotalSalesQuantity(product.id, 30) / 30;
        
        let expiryDaysRemaining: number | undefined;
        if (product.expiryDate) {
          const now = new Date();
          expiryDaysRemaining = Math.ceil(
            (product.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
        }
        
        const health = calculateHealthScore(
          product.currentStock,
          product.daysUnsold || 0,
          avgDailySales,
          expiryDaysRemaining
        );

        if (health.status === "healthy") healthy++;
        else if (health.status === "warning") warning++;
        else critical++;
      }

      return { healthy, warning, critical };
    }),
  }),
});

export type AppRouter = typeof appRouter;
