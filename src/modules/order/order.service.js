const DatabaseManager = require("../../services/database-manager.service");
const { v4: uuidv4 } = require("uuid");

class OrderService {
  // Generate order number
  static async generateOrderNo(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()",
      );
      const count = result[0].count + 1;
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `ORD${year}${month}${day}${String(count).padStart(4, "0")}`;
    } finally {
      await db.end();
    }
  }

  // Create new order
  static async createOrder(orderData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      console.log(
        "Creating order with data:",
        JSON.stringify(orderData, null, 2),
      );

      await db.query("START TRANSACTION");

      const orderNo = await this.generateOrderNo(tenantId);
      console.log("Generated order number:", orderNo);

      const [orderResult] = await db.query(
        `INSERT INTO orders (
          order_no, order_date, customer_id, customer_type, order_type,
          status, payment_status, payment_method, subtotal, discount_type,
          discount_value, discount_amount, tax_amount, shipping_charge,
          total_amount, notes, delivery_address, delivery_date, assigned_to,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          orderNo,
          orderData.order_date,
          orderData.customer_id,
          orderData.customer_type || "customer",
          orderData.order_type || "sales",
          orderData.status || "pending",
          orderData.payment_status || "pending",
          orderData.payment_method || null,
          orderData.subtotal || 0,
          orderData.discount_type || "percentage",
          orderData.discount_value || 0,
          orderData.discount_amount || 0,
          orderData.tax_amount || 0,
          orderData.shipping_charge || 0,
          orderData.total_amount || 0,
          orderData.notes || null,
          orderData.delivery_address || null,
          orderData.delivery_date || null,
          orderData.assigned_to || null,
          orderData.created_by || 1,
        ],
      );

      const orderId = orderResult.insertId;
      console.log("Order created with ID:", orderId);

      // Insert order items
      if (orderData.items && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          console.log("Processing item:", item);

          const [product] = await db.query(
            "SELECT product_name, selling_price, gst_rate, current_stock FROM products WHERE id = ?",
            [item.product_id],
          );

          if (!product[0]) {
            throw new Error(`Product with ID ${item.product_id} not found`);
          }

          const productName = product[0].product_name;
          const unitPrice = item.unit_price || product[0].selling_price;
          const gstRate = item.gst_rate || product[0].gst_rate;
          const quantity = parseInt(item.quantity) || 0;
          const discountPercent = parseFloat(item.discount_percent) || 0;

          const taxableValue = unitPrice * quantity;
          const discountAmount = (taxableValue * discountPercent) / 100;
          const afterDiscount = taxableValue - discountAmount;
          const cgstAmount = (afterDiscount * gstRate) / 200;
          const sgstAmount = (afterDiscount * gstRate) / 200;
          const totalAmount = afterDiscount + cgstAmount + sgstAmount;

          await db.query(
            `INSERT INTO order_items (
              order_id, product_id, product_name, quantity, unit_price,
              discount_percent, discount_amount, taxable_value, gst_rate,
              cgst_amount, sgst_amount, igst_amount, cess_amount, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              item.product_id,
              productName,
              quantity,
              unitPrice,
              discountPercent,
              discountAmount,
              taxableValue,
              gstRate,
              cgstAmount,
              sgstAmount,
              0,
              0,
              totalAmount,
            ],
          );

          if (orderData.order_type === "sales") {
            const newStock = product[0].current_stock - quantity;
            if (newStock < 0) {
              throw new Error(`Insufficient stock for product: ${productName}`);
            }
            await db.query(
              "UPDATE products SET current_stock = current_stock - ? WHERE id = ?",
              [quantity, item.product_id],
            );
          }
        }
      }

      if (orderData.status) {
        const changedBy = orderData.created_by || 1;
        await db.query(
          `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, remarks, changed_at)
           VALUES (?, NULL, ?, ?, ?, NOW())`,
          [
            orderId,
            orderData.status,
            changedBy,
            orderData.status_remarks || null,
          ],
        );
      }

      await db.query("COMMIT");
      console.log(`Order ${orderId} created successfully`);

      return await this.getOrderById(orderId, tenantId);
    } catch (error) {
      console.error("Create order error:", error);
      await db.query("ROLLBACK");
      throw error;
    } finally {
      await db.end();
    }
  }

  // Get order by ID - FIXED: removed deleted_at
  static async getOrderById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [orders] = await db.query(
        `SELECT o.*, 
                c.name as customer_name,
                c.email as customer_email,
                c.mobile as customer_mobile,
                CONCAT(s.first_name, ' ', s.last_name) as assigned_to_name
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id AND o.customer_type = 'customer'
         LEFT JOIN staff s ON o.assigned_to = s.id
         WHERE o.id = ?`,
        [id],
      );

      if (orders.length === 0) return null;

      const [items] = await db.query(
        `SELECT oi.*, p.product_code
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [id],
      );

      return {
        ...orders[0],
        items: items,
      };
    } finally {
      await db.end();
    }
  }

  // Update order - FIXED: removed deleted_at
  // static async updateOrder(id, orderData, tenantId) {
  //   const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
  //   try {
  //     console.log(`Updating order ${id}:`, JSON.stringify(orderData, null, 2));

  //     await db.query("START TRANSACTION");

  //     const [existingOrder] = await db.query(
  //       "SELECT id, order_type, status FROM orders WHERE id = ?",
  //       [id],
  //     );

  //     if (existingOrder.length === 0) {
  //       console.log(`Order with ID ${id} not found`);
  //       await db.query("ROLLBACK");
  //       return false;
  //     }

  //     await db.query(
  //       `UPDATE orders SET
  //         order_date = ?,
  //         customer_id = ?,
  //         customer_type = ?,
  //         order_type = ?,
  //         status = ?,
  //         payment_status = ?,
  //         payment_method = ?,
  //         subtotal = ?,
  //         discount_type = ?,
  //         discount_value = ?,
  //         discount_amount = ?,
  //         tax_amount = ?,
  //         shipping_charge = ?,
  //         total_amount = ?,
  //         notes = ?,
  //         delivery_address = ?,
  //         delivery_date = ?,
  //         assigned_to = ?,
  //         created_by = ?,
  //         updated_at = NOW()
  //       WHERE id = ?`,
  //       [
  //         orderData.order_date,
  //         orderData.customer_id,
  //         orderData.customer_type || "customer",
  //         orderData.order_type || "sales",
  //         orderData.status || "pending",
  //         orderData.payment_status || "pending",
  //         orderData.payment_method || null,
  //         orderData.subtotal || 0,
  //         orderData.discount_type || "percentage",
  //         orderData.discount_value || 0,
  //         orderData.discount_amount || 0,
  //         orderData.tax_amount || 0,
  //         orderData.shipping_charge || 0,
  //         orderData.total_amount || 0,
  //         orderData.notes || null,
  //         orderData.delivery_address || null,
  //         orderData.delivery_date || null,
  //         orderData.assigned_to || null,
  //         orderData.created_by || null,
  //         id,
  //       ],
  //     );

  //     // Handle items update
  //     if (orderData.items && Array.isArray(orderData.items)) {
  //       if (orderData.removed_items && orderData.removed_items.length > 0) {
  //         for (const productId of orderData.removed_items) {
  //           const [itemToRemove] = await db.query(
  //             "SELECT quantity FROM order_items WHERE order_id = ? AND product_id = ?",
  //             [id, productId],
  //           );

  //           if (itemToRemove.length > 0) {
  //             if (existingOrder[0].order_type === "sales") {
  //               await db.query(
  //                 "UPDATE products SET current_stock = current_stock + ? WHERE id = ?",
  //                 [itemToRemove[0].quantity, productId],
  //               );
  //             }
  //             await db.query(
  //               "DELETE FROM order_items WHERE order_id = ? AND product_id = ?",
  //               [id, productId],
  //             );
  //           }
  //         }
  //       }

  //       for (const item of orderData.items) {
  //         const [existingItem] = await db.query(
  //           "SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ?",
  //           [id, item.product_id],
  //         );

  //         const quantity = parseInt(item.quantity) || 0;
  //         const unitPrice = parseFloat(item.unit_price) || 0;
  //         const discountPercent = parseFloat(item.discount_percent) || 0;
  //         const gstRate = parseFloat(item.gst_rate) || 18;
  //         const taxableValue = quantity * unitPrice;
  //         const discountAmount = (taxableValue * discountPercent) / 100;
  //         const afterDiscount = taxableValue - discountAmount;
  //         const cgstAmount = (afterDiscount * gstRate) / 200;
  //         const sgstAmount = (afterDiscount * gstRate) / 200;
  //         const totalAmount = afterDiscount + cgstAmount + sgstAmount;

  //         if (existingItem.length > 0) {
  //           const oldQuantity = existingItem[0].quantity;
  //           const quantityDiff = quantity - oldQuantity;

  //           await db.query(
  //             `UPDATE order_items SET
  //               quantity = ?, unit_price = ?, discount_percent = ?, discount_amount = ?,
  //               taxable_value = ?, gst_rate = ?, cgst_amount = ?, sgst_amount = ?,
  //               total_amount = ?
  //             WHERE order_id = ? AND product_id = ?`,
  //             [quantity, unitPrice, discountPercent, discountAmount, taxableValue, gstRate, cgstAmount, sgstAmount, totalAmount, id, item.product_id]
  //           );

  //           if (existingOrder[0].order_type === "sales" && quantityDiff !== 0) {
  //             await db.query(
  //               "UPDATE products SET current_stock = current_stock - ? WHERE id = ?",
  //               [quantityDiff, item.product_id],
  //             );
  //           }
  //         } else {
  //           const [product] = await db.query(
  //             "SELECT product_name FROM products WHERE id = ?",
  //             [item.product_id],
  //           );
  //           const productName = product[0]?.product_name || item.product_name || "Unknown Product";

  //           await db.query(
  //             `INSERT INTO order_items (
  //               order_id, product_id, product_name, quantity, unit_price,
  //               discount_percent, discount_amount, taxable_value, gst_rate,
  //               cgst_amount, sgst_amount, total_amount
  //             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  //             [id, item.product_id, productName, quantity, unitPrice, discountPercent, discountAmount, taxableValue, gstRate, cgstAmount, sgstAmount, totalAmount]
  //           );

  //           if (existingOrder[0].order_type === "sales") {
  //             await db.query(
  //               "UPDATE products SET current_stock = current_stock - ? WHERE id = ?",
  //               [quantity, item.product_id],
  //             );
  //           }
  //         }
  //       }
  //     }

  //     if (orderData.status && existingOrder[0].status !== orderData.status) {
  //       const changedBy = orderData.changed_by || orderData.updated_by || 1;
  //       await db.query(
  //         `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, remarks, changed_at)
  //          VALUES (?, ?, ?, ?, ?, NOW())`,
  //         [id, existingOrder[0].status, orderData.status, changedBy, orderData.status_remarks || null],
  //       );
  //     }

  //     await db.query("COMMIT");
  //     console.log(`Order ${id} updated successfully`);
  //     return true;
  //   } catch (error) {
  //     console.error("Update order error:", error);
  //     await db.query("ROLLBACK");
  //     throw error;
  //   } finally {
  //     await db.end();
  //   }
  // }

  static async updateOrder(id, orderData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      console.log(`Updating order ${id}:`, JSON.stringify(orderData, null, 2));

      await db.query("START TRANSACTION");

      const [existingOrder] = await db.query(
        "SELECT id, order_type, status FROM orders WHERE id = ?",
        [id],
      );

      if (existingOrder.length === 0) {
        console.log(`Order with ID ${id} not found`);
        await db.query("ROLLBACK");
        return false;
      }

      // FIX: Remove created_by from UPDATE query (it should never be updated)
      await db.query(
        `UPDATE orders SET
        order_date = ?,
        customer_id = ?,
        customer_type = ?,
        order_type = ?,
        status = ?,
        payment_status = ?,
        payment_method = ?,
        subtotal = ?,
        discount_type = ?,
        discount_value = ?,
        discount_amount = ?,
        tax_amount = ?,
        shipping_charge = ?,
        total_amount = ?,
        notes = ?,
        delivery_address = ?,
        delivery_date = ?,
        assigned_to = ?,
        updated_at = NOW()
      WHERE id = ?`,
        [
          orderData.order_date,
          orderData.customer_id,
          orderData.customer_type || "customer",
          orderData.order_type || "sales",
          orderData.status || "pending",
          orderData.payment_status || "pending",
          orderData.payment_method || null,
          orderData.subtotal || 0,
          orderData.discount_type || "percentage",
          orderData.discount_value || 0,
          orderData.discount_amount || 0,
          orderData.tax_amount || 0,
          orderData.shipping_charge || 0,
          orderData.total_amount || 0,
          orderData.notes || null,
          orderData.delivery_address || null,
          orderData.delivery_date || null,
          orderData.assigned_to || null,
          id,
        ],
      );

      // Rest of your code remains the same...
      // Handle items update
      if (orderData.items && Array.isArray(orderData.items)) {
        // ... your existing items update code ...
      }

      if (orderData.status && existingOrder[0].status !== orderData.status) {
        const changedBy = orderData.changed_by || orderData.updated_by || 1;
        await db.query(
          `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, remarks, changed_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            id,
            existingOrder[0].status,
            orderData.status,
            changedBy,
            orderData.status_remarks || null,
          ],
        );
      }

      await db.query("COMMIT");
      console.log(`Order ${id} updated successfully`);
      return true;
    } catch (error) {
      console.error("Update order error:", error);
      await db.query("ROLLBACK");
      throw error;
    } finally {
      await db.end();
    }
  }

  // Get all orders - FIXED: removed deleted_at
  static async getAllOrders(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
        SELECT o.*, c.name as customer_name, c.email as customer_email
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id AND o.customer_type = 'customer'
        WHERE 1=1
      `;
      const params = [];

      if (filters.customer_id) {
        query += " AND o.customer_id = ?";
        params.push(filters.customer_id);
      }
      if (filters.customer_type) {
        query += " AND o.customer_type = ?";
        params.push(filters.customer_type);
      }
      if (filters.order_type) {
        query += " AND o.order_type = ?";
        params.push(filters.order_type);
      }
      if (filters.status) {
        query += " AND o.status = ?";
        params.push(filters.status);
      }
      if (filters.payment_status) {
        query += " AND o.payment_status = ?";
        params.push(filters.payment_status);
      }
      if (filters.search) {
        query += ` AND (o.order_no LIKE ? OR c.name LIKE ?)`;
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      if (filters.from_date) {
        query += " AND DATE(o.order_date) >= ?";
        params.push(filters.from_date);
      }
      if (filters.to_date) {
        query += " AND DATE(o.order_date) <= ?";
        params.push(filters.to_date);
      }

      query += " ORDER BY o.created_at DESC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;

      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      const ordersWithItems = [];
      for (const order of rows) {
        const [items] = await db.query(
          `SELECT oi.*, p.product_code
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`,
          [order.id],
        );
        ordersWithItems.push({ ...order, items });
      }

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM orders",
      );

      return {
        data: ordersWithItems,
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

  // Update order status
  static async updateOrderStatus(id, tenantId, statusData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [oldStatus] = await db.query(
        "SELECT status FROM orders WHERE id = ?",
        [id],
      );

      await db.query(
        `UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?`,
        [statusData.status, id],
      );

      const changedBy = statusData.changed_by || statusData.user_id || 1;

      await db.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, remarks, changed_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          oldStatus[0]?.status,
          statusData.status,
          statusData.remarks || null,
          changedBy,
        ],
      );

      return true;
    } finally {
      await db.end();
    }
  }

  // Update payment status
  static async updatePaymentStatus(id, tenantId, paymentData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      await db.query(
        `UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?`,
        [paymentData.payment_status, id],
      );
      return true;
    } finally {
      await db.end();
    }
  }

  // Cancel order
  static async cancelOrder(id, tenantId, cancelData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [order] = await db.query(
        "SELECT order_type, status FROM orders WHERE id = ?",
        [id],
      );

      if (!order[0]) {
        throw new Error("Order not found");
      }

      if (order[0].status === "cancelled") {
        throw new Error("Order is already cancelled");
      }

      const cancellableStatuses = ["pending", "confirmed", "processing"];

      if (!cancellableStatuses.includes(order[0].status)) {
        throw new Error(
          `Order cannot be cancelled because current status is '${order[0].status}'. Only orders with status: ${cancellableStatuses.join(", ")} can be cancelled.`,
        );
      }

      const cancelledBy = cancelData.cancelled_by || 1;

      if (!cancelData.reason) {
        throw new Error("Cancellation reason is required");
      }

      await db.query(
        `UPDATE orders SET status = 'cancelled', cancelled_by = ?, cancelled_at = NOW(),
         cancellation_reason = ?, updated_at = NOW() WHERE id = ?`,
        [cancelledBy, cancelData.reason, id],
      );

      await db.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, remarks, changed_by)
         VALUES (?, ?, 'cancelled', ?, ?)`,
        [id, order[0].status, cancelData.reason, cancelledBy],
      );

      if (order[0].order_type === "sales") {
        const [items] = await db.query(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
          [id],
        );

        for (const item of items) {
          await db.query(
            "UPDATE products SET current_stock = current_stock + ? WHERE id = ?",
            [item.quantity, item.product_id],
          );
        }
      }

      return true;
    } finally {
      await db.end();
    }
  }

  // Delete order - HARD DELETE
  static async deleteOrder(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid order ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      await db.query("START TRANSACTION");

      const [order] = await db.query("SELECT id FROM orders WHERE id = ?", [
        Number(id),
      ]);

      if (order.length === 0) {
        throw new Error("Order not found");
      }

      await db.query("DELETE FROM order_items WHERE order_id = ?", [
        Number(id),
      ]);
      await db.query("DELETE FROM order_status_history WHERE order_id = ?", [
        Number(id),
      ]);
      const [orderDeleted] = await db.query("DELETE FROM orders WHERE id = ?", [
        Number(id),
      ]);

      if (orderDeleted.affectedRows === 0) {
        throw new Error("Order not found");
      }

      await db.query("COMMIT");
      console.log(`Order ${id} deleted permanently`);

      return true;
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Delete order error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Get order statistics - FIXED: removed deleted_at
  static async getOrderStats(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [stats] = await db.query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN DATE(order_date) = CURDATE() THEN 1 ELSE 0 END) as today_orders
        FROM orders
      `);
      return stats[0];
    } finally {
      await db.end();
    }
  }
}

module.exports = OrderService;
