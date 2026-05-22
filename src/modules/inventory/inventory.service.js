const DatabaseManager = require("../../services/database-manager.service"); // Fixed path

class InventoryService {
  // =============================================
  // PRODUCT MANAGEMENT
  // =============================================
  static async generateProductCode(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Get all existing product codes in one query
      const [existingCodes] = await db.query(
        "SELECT product_code FROM products WHERE tenant_id = ?",
        [tenantId],
      );

      const existingSet = new Set(existingCodes.map((c) => c.product_code));

      let counter = existingCodes.length + 1;
      let productCode = `PROD${String(counter).padStart(6, "0")}`;

      // Keep incrementing until unique
      while (existingSet.has(productCode)) {
        counter++;
        productCode = `PROD${String(counter).padStart(6, "0")}`;
      }

      return productCode;
    } finally {
      await db.end();
    }
  }

  static async createProduct(productData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const productCode = await this.generateProductCode(tenantId);

      const [result] = await db.query(
        `INSERT INTO products (
                product_code, product_name, category, hsn_code, unit,
                unit_price, purchase_price, selling_price, gst_rate,
                min_stock_level, max_stock_level, reorder_level,
                opening_stock, current_stock, location, brand_id,
                tenant_id, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          productCode,
          productData.product_name,
          productData.category || null,
          productData.hsn_code || null,
          productData.unit || "NOS",
          productData.unit_price || 0,
          productData.purchase_price || 0,
          productData.selling_price || 0,
          productData.gst_rate || 18,
          productData.min_stock_level || 0,
          productData.max_stock_level || 0,
          productData.reorder_level || 0,
          productData.opening_stock || 0,
          productData.opening_stock || 0,
          productData.location || null,
          productData.brand_id || null,
          tenantId, // Add tenant_id here
          productData.created_by || null,
        ],
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }
  static async getProductById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT p.*
                FROM products p
                WHERE p.id = ? AND p.tenant_id = ? AND p.deleted_at IS NULL`,
        [id, tenantId],
      );
      return rows[0];
    } finally {
      await db.end();
    }
  }

  static async getAllProducts(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
                SELECT p.*,
                       CASE 
                           WHEN p.current_stock <= p.min_stock_level THEN 'LOW_STOCK'
                           WHEN p.current_stock <= p.reorder_level THEN 'REORDER'
                           ELSE 'OK'
                       END as stock_status
                FROM products p
                WHERE p.deleted_at IS NULL AND p.tenant_id = ?
            `;
      const params = [tenantId];

      if (filters.search) {
        query += ` AND (p.product_name LIKE ? OR p.product_code LIKE ?)`;
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      if (filters.category) {
        query += ` AND p.category = ?`;
        params.push(filters.category);
      }

      if (filters.status === "low_stock") {
        query += ` AND p.current_stock <= p.min_stock_level`;
      }

      if (filters.status === "reorder") {
        query += ` AND p.current_stock <= p.reorder_level AND p.current_stock > p.min_stock_level`;
      }

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;

      query += ` ORDER BY p.created_at ASC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      let countQuery = `SELECT COUNT(*) as total FROM products WHERE deleted_at IS NULL AND tenant_id = ?`;
      const countParams = [tenantId];

      if (filters.search) {
        countQuery += ` AND (product_name LIKE ? OR product_code LIKE ?)`;
        countParams.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      if (filters.category) {
        countQuery += ` AND category = ?`;
        countParams.push(filters.category);
      }

      const [countResult] = await db.query(countQuery, countParams);

      return {
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit),
        },
      };
    } finally {
      await db.end();
    }
  }
  static async updateProduct(id, tenantId, updateData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const fields = [];
      const values = [];

      // Define allowed fields for update (matching createProduct structure)
      const allowedFields = [
        "product_name",
        "category",
        "hsn_code",
        "unit",
        "unit_price",
        "purchase_price",
        "selling_price",
        "gst_rate",
        "min_stock_level",
        "max_stock_level",
        "reorder_level",
        "opening_stock",
        "current_stock",
        "location",
        "brand_id",
        "updated_by",
      ];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      }

      // If opening_stock is updated, also update current_stock to match
      if (updateData.opening_stock !== undefined && updateData.opening_stock !== null) {
        // Remove current_stock from fields if already added to avoid duplicate
        const currentStockIndex = fields.findIndex(f => f.startsWith('current_stock = ?'));
        if (currentStockIndex !== -1) {
          fields.splice(currentStockIndex, 1);
          values.splice(currentStockIndex, 1);
        }
        fields.push(`current_stock = ?`);
        values.push(updateData.opening_stock);
      }

      if (fields.length === 0) return false;

      // Add updated_at timestamp
      fields.push("updated_at = NOW()");
      values.push(id);

      const query = `UPDATE products SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL AND tenant_id = ?`;
      values.push(tenantId);
      
      const [result] = await db.query(query, values);
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    } finally {
      await db.end();
    }
}

  static async deleteProduct(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid product ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Check if product has any stock transactions
      const [transactions] = await db.query(
        `SELECT id FROM stock_transactions
             WHERE product_id = ? LIMIT 1`,
        [Number(id)],
      );

      if (transactions.length > 0) {
        throw new Error(
          "Cannot delete product with existing stock transactions",
        );
      }

      // Hard delete - permanently remove from database
      await db.query("DELETE FROM products WHERE id = ?", [Number(id)]);

      return true;
    } finally {
      await db.end();
    }
  }
  // =============================================
  // STOCK MANAGEMENT
  // =============================================

  static async addStockTransaction(transactionData, tenantId) {
    console.log("=== ADD STOCK TRANSACTION ===");
    console.log("Product ID:", transactionData.product_id);
    console.log("Transaction Type:", transactionData.transaction_type);
    console.log("Quantity:", transactionData.quantity);
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // First, get current product stock
      const [product] = await db.query(
        "SELECT current_stock FROM products WHERE id = ?",
        [transactionData.product_id],
      );

      const currentStock = product[0]?.current_stock || 0;
      let newStock = currentStock;

      // Calculate new stock based on transaction type
      if (transactionData.transaction_type === "SALE") {
        newStock = currentStock - transactionData.quantity;
      } else if (transactionData.transaction_type === "PURCHASE") {
        newStock = currentStock + transactionData.quantity;
      }

      // Update product stock
      await db.query("UPDATE products SET current_stock = ? WHERE id = ?", [
        newStock,
        transactionData.product_id,
      ]);

      // Insert transaction record
      const [result] = await db.query(
        `INSERT INTO stock_transactions (
                product_id, transaction_type, quantity, previous_stock, new_stock,
                reference_type, reference_id, remarks, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          transactionData.product_id,
          transactionData.transaction_type,
          transactionData.quantity,
          currentStock,
          newStock,
          transactionData.reference_type || null,
          transactionData.reference_id || null,
          transactionData.remarks || null,
          transactionData.created_by,
        ],
      );

      // ***** IMPORTANT: Call checkAndCreateAlert to create alerts *****
      await this.checkAndCreateAlert(
        transactionData.product_id,
        newStock,
        tenantId,
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }

  static async adjustStock(adjustmentData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Get current stock
      const [product] = await db.query(
        "SELECT current_stock FROM products WHERE id = ?",
        [adjustmentData.product_id],
      );

      const currentStock = product[0]?.current_stock || 0;
      let newStock = currentStock;

      if (adjustmentData.adjustment_type === "INCREASE") {
        newStock = currentStock + adjustmentData.quantity;
      } else {
        newStock = currentStock - adjustmentData.quantity;
      }

      // Update product stock
      await db.query("UPDATE products SET current_stock = ? WHERE id = ?", [
        newStock,
        adjustmentData.product_id,
      ]);

      // Insert adjustment record
      const [result] = await db.query(
        `INSERT INTO stock_adjustments (
                adjustment_no, product_id, adjustment_type, quantity,
                reason, previous_stock, new_stock, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          `ADJ_${Date.now()}`,
          adjustmentData.product_id,
          adjustmentData.adjustment_type,
          adjustmentData.quantity,
          adjustmentData.reason,
          currentStock,
          newStock,
          adjustmentData.created_by,
        ],
      );

      // ***** IMPORTANT: Call checkAndCreateAlert to create alerts *****
      await this.checkAndCreateAlert(
        adjustmentData.product_id,
        newStock,
        tenantId,
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }
  static async getStockTransactions(productId, tenantId, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const page = pagination.page || 1;
      const limit = pagination.limit || 20;
      const offset = (page - 1) * limit;

      const [rows] = await db.query(
        `SELECT st.*, p.product_name
                FROM stock_transactions st
                JOIN products p ON st.product_id = p.id
                WHERE st.product_id = ?
                ORDER BY st.created_at DESC
                LIMIT ? OFFSET ?`,
        [productId, parseInt(limit), parseInt(offset)],
      );

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM stock_transactions WHERE product_id = ?",
        [productId],
      );

      return {
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit),
        },
      };
    } finally {
      await db.end();
    }
  }

  // =============================================
  // STOCK ALERTS
  // =============================================

  static async checkAndCreateAlert(productId, currentStock, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Get product details
      const [product] = await db.query(
        "SELECT min_stock_level, reorder_level, product_name FROM products WHERE id = ?",
        [productId],
      );

      if (!product[0]) return;

      const minStockLevel = product[0].min_stock_level || 0;
      const reorderLevel = product[0].reorder_level || 0;
      const productName = product[0].product_name;

      // Check for LOW STOCK alert
      if (currentStock <= minStockLevel && minStockLevel > 0) {
        // Check if alert already exists - CHANGE is_active to status
        const [existing] = await db.query(
          "SELECT id FROM stock_alerts WHERE product_id = ? AND alert_type = 'LOW_STOCK' AND status = 'ACTIVE'",
          [productId],
        );

        if (existing.length === 0) {
          await db.query(
            `INSERT INTO stock_alerts (product_id, alert_type, threshold_value, current_value, status, created_at)
                     VALUES (?, 'LOW_STOCK', ?, ?, 'ACTIVE', NOW())`,
            [productId, minStockLevel, currentStock],
          );
          console.log(`Low stock alert created for ${productName}`);
        } else {
          // Update existing alert
          await db.query(
            `UPDATE stock_alerts SET current_value = ?, updated_at = NOW() 
                     WHERE product_id = ? AND alert_type = 'LOW_STOCK' AND status = 'ACTIVE'`,
            [currentStock, productId],
          );
        }
      }

      // Check for REORDER alert
      if (
        currentStock <= reorderLevel &&
        currentStock > minStockLevel &&
        reorderLevel > 0
      ) {
        // Check if alert already exists - CHANGE is_active to status
        const [existing] = await db.query(
          "SELECT id FROM stock_alerts WHERE product_id = ? AND alert_type = 'REORDER' AND status = 'ACTIVE'",
          [productId],
        );

        if (existing.length === 0) {
          await db.query(
            `INSERT INTO stock_alerts (product_id, alert_type, threshold_value, current_value, status, created_at)
                     VALUES (?, 'REORDER', ?, ?, 'ACTIVE', NOW())`,
            [productId, reorderLevel, currentStock],
          );
          console.log(`Reorder alert created for ${productName}`);
        } else {
          // Update existing alert
          await db.query(
            `UPDATE stock_alerts SET current_value = ?, updated_at = NOW() 
                     WHERE product_id = ? AND alert_type = 'REORDER' AND status = 'ACTIVE'`,
            [currentStock, productId],
          );
        }
      }

      // Auto-resolve alerts if stock is restored - CHANGE is_active to status
      if (currentStock > reorderLevel && reorderLevel > 0) {
        await db.query(
          `UPDATE stock_alerts SET status = 'RESOLVED', resolved_at = NOW()
                 WHERE product_id = ? AND alert_type = 'REORDER' AND status = 'ACTIVE'`,
          [productId],
        );
      }

      if (currentStock > minStockLevel && minStockLevel > 0) {
        await db.query(
          `UPDATE stock_alerts SET status = 'RESOLVED', resolved_at = NOW()
                 WHERE product_id = ? AND alert_type = 'LOW_STOCK' AND status = 'ACTIVE'`,
          [productId],
        );
      }
    } catch (error) {
      console.error("Error checking alerts:", error);
    } finally {
      await db.end();
    }
  }

  static async getActiveAlerts(tenantId) {
    console.log("getActiveAlerts called for tenant:", tenantId);
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT * FROM stock_alerts WHERE status = 'ACTIVE' ORDER BY created_at DESC`,
      );
      console.log("Alerts found:", rows);
      return rows || [];
    } finally {
      await db.end();
    }
  }

  static async resolveAlert(alertId, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        "UPDATE stock_alerts SET status = 'RESOLVED', resolved_at = NOW() WHERE id = ?",
        [alertId],
      );
      return result.affectedRows > 0;
    } finally {
      await db.end();
    }
  }

  // =============================================
  // STOCK TRANSFERS
  // =============================================

  static async createStockTransfer(transferData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        `INSERT INTO stock_transfers (
                    transfer_no, from_location, to_location, product_id,
                    quantity, transfer_date, vehicle_no, transporter_name,
                    delivery_person, notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `TRF_${Date.now()}`,
          transferData.from_location,
          transferData.to_location,
          transferData.product_id,
          transferData.quantity,
          transferData.transfer_date,
          transferData.vehicle_no || null,
          transferData.transporter_name || null,
          transferData.delivery_person || null,
          transferData.notes || null,
          transferData.created_by,
        ],
      );
      return result.insertId;
    } finally {
      await db.end();
    }
  }

  static async completeStockTransfer(transferId, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        "UPDATE stock_transfers SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?",
        [transferId],
      );
      return result.affectedRows > 0;
    } finally {
      await db.end();
    }
  }

  // =============================================
  // INVENTORY SUMMARY & REPORTS
  // =============================================

  static async getInventorySummary(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [summary] = await db.query(`
                SELECT 
                    COUNT(*) as total_products,
                    SUM(current_stock) as total_quantity,
                    SUM(current_stock * unit_price) as total_value,
                    SUM(CASE WHEN current_stock <= min_stock_level THEN 1 ELSE 0 END) as low_stock_count,
                    SUM(CASE WHEN current_stock <= reorder_level AND current_stock > min_stock_level THEN 1 ELSE 0 END) as reorder_count
                FROM products
                WHERE deleted_at IS NULL
            `);

      const [categoryWise] = await db.query(`
                SELECT 
                    category,
                    COUNT(*) as product_count,
                    SUM(current_stock) as total_quantity,
                    SUM(current_stock * unit_price) as total_value
                FROM products
                WHERE deleted_at IS NULL AND category IS NOT NULL
                GROUP BY category
            `);

      return {
        summary: summary[0],
        category_wise: categoryWise,
      };
    } finally {
      await db.end();
    }
  }
}

module.exports = InventoryService;
