const InventoryService = require("./inventory.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class InventoryController {
  // =============================================
  // PRODUCT MANAGEMENT
  // =============================================

  async createProduct(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const productId = await InventoryService.createProduct(
        req.body,
        tenantId,
      );
      const product = await InventoryService.getProductById(
        productId,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        product,
        "Product created successfully",
        201,
      );
    } catch (error) {
      console.error("Create product error:", error);
      return ResponseUtil.error(
        res,
        "Failed to create product",
        500,
        error.message,
      );
    }
  }

  async getAllProducts(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { page = 1, limit = 10, search, category, status } = req.query;

      const filters = { search, category, status };
      const result = await InventoryService.getAllProducts(tenantId, filters, {
        page,
        limit,
      });

      return ResponseUtil.success(
        res,
        result,
        "Products retrieved successfully",
      );
    } catch (error) {
      console.error("Get products error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve products",
        500,
        error.message,
      );
    }
  }

  async getProductById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const product = await InventoryService.getProductById(id, tenantId);

      if (!product) {
        return ResponseUtil.notFound(res, "Product not found");
      }

      return ResponseUtil.success(
        res,
        product,
        "Product retrieved successfully",
      );
    } catch (error) {
      console.error("Get product error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve product",
        500,
        error.message,
      );
    }
  }

  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const product = await InventoryService.getProductById(id, tenantId);
      if (!product) {
        return ResponseUtil.notFound(res, "Product not found");
      }

      const updated = await InventoryService.updateProduct(
        id,
        tenantId,
        req.body,
      );

      if (!updated) {
        return ResponseUtil.error(res, "Failed to update product", 500);
      }

      const updatedProduct = await InventoryService.getProductById(
        id,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        updatedProduct,
        "Product updated successfully",
      );
    } catch (error) {
      console.error("Update product error:", error);
      return ResponseUtil.error(
        res,
        "Failed to update product",
        500,
        error.message,
      );
    }
  }

  async deleteProduct(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid product ID", 400);
      }

      await InventoryService.deleteProduct(req.tenantId, id);

      return ResponseUtil.success(res, null, "Product deleted successfully");
    } catch (error) {
      logger.error("Delete product error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
  // =============================================
  // STOCK MANAGEMENT
  // =============================================

  async addStockTransaction(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const transactionData = {
        ...req.body,
        created_by: req.user.id,
      };

      const transactionId = await InventoryService.addStockTransaction(
        transactionData,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        { transaction_id: transactionId },
        "Stock transaction added successfully",
        201,
      );
    } catch (error) {
      console.error("Add stock transaction error:", error);
      return ResponseUtil.error(
        res,
        "Failed to add stock transaction",
        500,
        error.message,
      );
    }
  }

  async getStockTransactions(req, res) {
    try {
      const { productId } = req.params;
      const tenantId = req.user.tenant_id;
      const { page = 1, limit = 20 } = req.query;

      const transactions = await InventoryService.getStockTransactions(
        productId,
        tenantId,
        { page, limit },
      );

      return ResponseUtil.success(
        res,
        transactions,
        "Stock transactions retrieved successfully",
      );
    } catch (error) {
      console.error("Get stock transactions error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve stock transactions",
        500,
        error.message,
      );
    }
  }

  async adjustStock(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const adjustmentData = {
        ...req.body,
        created_by: req.user.id,
      };

      const adjustmentId = await InventoryService.adjustStock(
        adjustmentData,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        { adjustment_id: adjustmentId },
        "Stock adjusted successfully",
      );
    } catch (error) {
      console.error("Adjust stock error:", error);
      return ResponseUtil.error(
        res,
        "Failed to adjust stock",
        500,
        error.message,
      );
    }
  }

  // =============================================
  // STOCK ALERTS
  // =============================================

  async getActiveAlerts(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const alerts = await InventoryService.getActiveAlerts(tenantId);

      return ResponseUtil.success(
        res,
        alerts,
        "Active alerts retrieved successfully",
      );
    } catch (error) {
      console.error("Get alerts error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve alerts",
        500,
        error.message,
      );
    }
  }

  async resolveAlert(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const resolved = await InventoryService.resolveAlert(id, tenantId);

      if (!resolved) {
        return ResponseUtil.error(res, "Failed to resolve alert", 500);
      }

      return ResponseUtil.success(res, null, "Alert resolved successfully");
    } catch (error) {
      console.error("Resolve alert error:", error);
      return ResponseUtil.error(
        res,
        "Failed to resolve alert",
        500,
        error.message,
      );
    }
  }

  // =============================================
  // STOCK TRANSFERS
  // =============================================

  async createStockTransfer(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const transferData = {
        ...req.body,
        created_by: req.user.id,
      };

      const transferId = await InventoryService.createStockTransfer(
        transferData,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        { transfer_id: transferId },
        "Stock transfer created successfully",
        201,
      );
    } catch (error) {
      console.error("Create stock transfer error:", error);
      return ResponseUtil.error(
        res,
        "Failed to create stock transfer",
        500,
        error.message,
      );
    }
  }

  async completeStockTransfer(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const completed = await InventoryService.completeStockTransfer(
        id,
        tenantId,
      );

      if (!completed) {
        return ResponseUtil.error(
          res,
          "Failed to complete stock transfer",
          500,
        );
      }

      return ResponseUtil.success(
        res,
        null,
        "Stock transfer completed successfully",
      );
    } catch (error) {
      console.error("Complete stock transfer error:", error);
      return ResponseUtil.error(
        res,
        "Failed to complete stock transfer",
        500,
        error.message,
      );
    }
  }

  // =============================================
  // INVENTORY SUMMARY & REPORTS
  // =============================================

  async getInventorySummary(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const summary = await InventoryService.getInventorySummary(tenantId);

      return ResponseUtil.success(
        res,
        summary,
        "Inventory summary retrieved successfully",
      );
    } catch (error) {
      console.error("Get inventory summary error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve inventory summary",
        500,
        error.message,
      );
    }
  }
}

// Make sure to export correctly
module.exports = new InventoryController();
