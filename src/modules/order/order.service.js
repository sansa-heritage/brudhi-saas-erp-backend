const DatabaseManager = require("../../services/database-manager.service"); // Fixed path
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

  // // Create new order
  // // Create new order
  // // Update order - Updated to match createOrder structure
  // static async updateOrder(id, orderData, tenantId) {
  //   const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
  //   try {
  //     console.log(
  //       `Updating order ${id} with data:`,
  //       JSON.stringify(orderData, null, 2),
  //     );

  //     // Check if order exists
  //     const [existingOrder] = await db.query(
  //       "SELECT id, order_type, status FROM orders WHERE id = ? AND deleted_at IS NULL",
  //       [id],
  //     );

  //     if (existingOrder.length === 0) {
  //       console.log(`Order with ID ${id} not found`);
  //       return false;
  //     }

  //     // Update order basic info
  //     const [updateResult] = await db.query(
  //       `UPDATE orders SET
  //       order_date = ?,
  //       customer_id = ?,
  //       customer_type = ?,
  //       order_type = ?,
  //       status = ?,
  //       payment_status = ?,
  //       payment_method = ?,
  //       subtotal = ?,
  //       discount_type = ?,
  //       discount_value = ?,
  //       discount_amount = ?,
  //       tax_amount = ?,
  //       shipping_charge = ?,
  //       total_amount = ?,
  //       notes = ?,
  //       delivery_address = ?,
  //       delivery_date = ?,
  //       assigned_to = ?,
  //       updated_at = NOW()
  //     WHERE id = ? AND deleted_at IS NULL`,
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
  //         id,
  //       ],
  //     );

  //     console.log("Order updated, affected rows:", updateResult.affectedRows);

  //     // Handle items update
  //     if (orderData.items && Array.isArray(orderData.items)) {
  //       // Delete existing items that are not in the new list or all if removed_items provided
  //       if (orderData.removed_items && orderData.removed_items.length > 0) {
  //         // Delete only removed items
  //         for (const itemId of orderData.removed_items) {
  //           await db.query(
  //             "DELETE FROM order_items WHERE order_id = ? AND product_id = ?",
  //             [id, itemId],
  //           );
  //           console.log(`Deleted item with product_id: ${itemId}`);
  //         }
  //       } else {
  //         // Delete all existing items and reinsert (simpler approach)
  //         await db.query("DELETE FROM order_items WHERE order_id = ?", [id]);
  //         console.log(`Deleted all existing items for order ${id}`);
  //       }

  //       // Insert or update items
  //       if (orderData.items.length > 0) {
  //         for (const item of orderData.items) {
  //           console.log("Processing item:", item);

  //           // Get product details (similar to createOrder)
  //           const [product] = await db.query(
  //             "SELECT product_name, selling_price, gst_rate FROM products WHERE id = ?",
  //             [item.product_id],
  //           );
  //           console.log("Product found:", product[0]);

  //           const productName =
  //             product[0]?.product_name ||
  //             item.product_name ||
  //             "Unknown Product";
  //           const unitPrice = item.unit_price || product[0]?.selling_price || 0;
  //           const gstRate = item.gst_rate || product[0]?.gst_rate || 18;

  //           const quantity = parseInt(item.quantity) || 0;
  //           const taxableValue = unitPrice * quantity;
  //           const discountPercent = parseFloat(item.discount_percent) || 0;
  //           const discountAmount = (taxableValue * discountPercent) / 100;
  //           const afterDiscount = taxableValue - discountAmount;
  //           const cgstAmount = (afterDiscount * gstRate) / 200;
  //           const sgstAmount = (afterDiscount * gstRate) / 200;
  //           const totalAmount = afterDiscount + cgstAmount + sgstAmount;

  //           console.log("Item calculations:", {
  //             taxableValue,
  //             discountAmount,
  //             cgstAmount,
  //             sgstAmount,
  //             totalAmount,
  //           });

  //           // Check if item already exists
  //           const [existingItem] = await db.query(
  //             "SELECT id FROM order_items WHERE order_id = ? AND product_id = ?",
  //             [id, item.product_id],
  //           );

  //           if (existingItem.length > 0 && !orderData.removed_items) {
  //             // Update existing item
  //             await db.query(
  //               `UPDATE order_items SET
  //               quantity = ?,
  //               unit_price = ?,
  //               discount_percent = ?,
  //               discount_amount = ?,
  //               taxable_value = ?,
  //               gst_rate = ?,
  //               cgst_amount = ?,
  //               sgst_amount = ?,
  //               total_amount = ?
  //             WHERE order_id = ? AND product_id = ?`,
  //               [
  //                 quantity,
  //                 unitPrice,
  //                 discountPercent,
  //                 discountAmount,
  //                 taxableValue,
  //                 gstRate,
  //                 cgstAmount,
  //                 sgstAmount,
  //                 totalAmount,
  //                 id,
  //                 item.product_id,
  //               ],
  //             );
  //             console.log("Order item updated for product:", item.product_id);
  //           } else {
  //             // Insert new item
  //             const [itemResult] = await db.query(
  //               `INSERT INTO order_items (
  //               order_id, product_id, product_name, quantity, unit_price,
  //               discount_percent, discount_amount, taxable_value, gst_rate,
  //               cgst_amount, sgst_amount, igst_amount, cess_amount, total_amount
  //             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  //               [
  //                 id,
  //                 item.product_id,
  //                 productName,
  //                 quantity,
  //                 unitPrice,
  //                 discountPercent,
  //                 discountAmount,
  //                 taxableValue,
  //                 gstRate,
  //                 cgstAmount,
  //                 sgstAmount,
  //                 0,
  //                 0,
  //                 totalAmount,
  //               ],
  //             );
  //             console.log("Order item inserted, ID:", itemResult.insertId);
  //           }

  //           // Update stock if order type is sales (and status changed to confirmed/processing)
  //           if (
  //             orderData.order_type === "sales" &&
  //             orderData.status !== "cancelled"
  //           ) {
  //             // Get current stock
  //             const [stockProduct] = await db.query(
  //               "SELECT current_stock FROM products WHERE id = ?",
  //               [item.product_id],
  //             );

  //             // Calculate stock difference if updating existing order
  //             if (
  //               existingOrder[0].status === "pending" &&
  //               orderData.status !== "pending"
  //             ) {
  //               await db.query(
  //                 "UPDATE products SET current_stock = current_stock - ? WHERE id = ?",
  //                 [quantity, item.product_id],
  //               );
  //               console.log("Stock updated for product:", item.product_id);
  //             }
  //           }
  //         }
  //       }
  //     }

  //     // ✅ FIXED: Add status history if status changed (like createOrder)
  //     if (orderData.status && existingOrder[0].status !== orderData.status) {
  //       const changedBy = orderData.changed_by || orderData.updated_by || 1;
  //       await db.query(
  //         `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, remarks)
  //        VALUES (?, ?, ?, ?, ?)`,
  //         [
  //           id,
  //           existingOrder[0].status,
  //           orderData.status,
  //           changedBy,
  //           orderData.status_remarks || null,
  //         ],
  //       );
  //       console.log("Status history added with changed_by:", changedBy);
  //     }

  //     return true;
  //   } catch (error) {
  //     console.error("Update order error:", error);
  //     throw error;
  //   } finally {
  //     await db.end();
  //   }
  // }

  // Create new order
 // Create new order
static async createOrder(orderData, tenantId) {
  const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
  try {
    console.log("Creating order with data:", JSON.stringify(orderData, null, 2));

    // Start transaction
    await db.query("START TRANSACTION");

    // Generate order number
    const orderNo = await this.generateOrderNo(tenantId);
    console.log("Generated order number:", orderNo);

    // Insert order
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
      ]
    );

    const orderId = orderResult.insertId;
    console.log("Order created with ID:", orderId);

    // Insert order items
    if (orderData.items && Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        console.log("Processing item:", item);

        // Get product details
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

        // Calculate amounts
        const taxableValue = unitPrice * quantity;
        const discountAmount = (taxableValue * discountPercent) / 100;
        const afterDiscount = taxableValue - discountAmount;
        const cgstAmount = (afterDiscount * gstRate) / 200;
        const sgstAmount = (afterDiscount * gstRate) / 200;
        const totalAmount = afterDiscount + cgstAmount + sgstAmount;

        console.log("Item calculations:", {
          taxableValue,
          discountAmount,
          cgstAmount,
          sgstAmount,
          totalAmount,
        });

        // Insert order item
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

        // Update stock if sales order
        if (orderData.order_type === "sales") {
          const newStock = product[0].current_stock - quantity;
          if (newStock < 0) {
            throw new Error(`Insufficient stock for product: ${productName}`);
          }
          await db.query(
            "UPDATE products SET current_stock = current_stock - ? WHERE id = ?",
            [quantity, item.product_id],
          );
          console.log(`Stock updated for product: ${item.product_id}, new stock: ${newStock}`);
        }
      }
    }

    // Add status history - using created_by as the person who created/initiated the status
    if (orderData.status) {
      const changedBy = orderData.created_by || 1; // Renamed for clarity
      await db.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, remarks, changed_at)
         VALUES (?, NULL, ?, ?, ?, NOW())`,
        [orderId, orderData.status, changedBy, orderData.status_remarks || null],
      );
      console.log("Status history added with changed_by:", changedBy);
    }

    // Commit transaction
    await db.query("COMMIT");
    console.log(`Order ${orderId} created successfully`);

    // Return created order
    return await this.getOrderById(orderId, tenantId);
  } catch (error) {
    console.error("Create order error:", error);
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}

  // Get order by ID
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
            WHERE o.id = ? AND o.deleted_at IS NULL`,
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

  // ============ ADD THIS UPDATE ORDER METHOD ============
  // Update order
  static async updateOrder(id, orderData, tenantId) {
  const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
  try {
    console.log(
      `Updating order ${id} with data:`,
      JSON.stringify(orderData, null, 2),
    );

    // Start transaction
    await db.query("START TRANSACTION");

    // Check if order exists
    const [existingOrder] = await db.query(
      "SELECT id, order_type, status FROM orders WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    if (existingOrder.length === 0) {
      console.log(`Order with ID ${id} not found`);
      await db.query("ROLLBACK");
      return false;
    }

    // Update order basic info - NO changed_by in orders table
    const [updateResult] = await db.query(
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
        created_by = ?,
        updated_at = NOW()
      WHERE id = ? AND deleted_at IS NULL`,
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
        orderData.created_by || null,
        id,
      ],
    );

    console.log("Order updated, affected rows:", updateResult.affectedRows);

    // Handle items update
    if (orderData.items && Array.isArray(orderData.items)) {
      // Handle removed items first
      if (orderData.removed_items && orderData.removed_items.length > 0) {
        for (const productId of orderData.removed_items) {
          const [itemToRemove] = await db.query(
            "SELECT quantity FROM order_items WHERE order_id = ? AND product_id = ?",
            [id, productId],
          );

          if (itemToRemove.length > 0) {
            if (existingOrder[0].order_type === "sales") {
              await db.query(
                "UPDATE products SET current_stock = current_stock + ? WHERE id = ?",
                [itemToRemove[0].quantity, productId],
              );
              console.log(`Restored stock for removed product: ${productId}`);
            }

            await db.query(
              "DELETE FROM order_items WHERE order_id = ? AND product_id = ?",
              [id, productId],
            );
            console.log(`Removed item with product_id: ${productId}`);
          }
        }
      }

      // Insert or update items
      for (const item of orderData.items) {
        console.log("Processing item:", item);

        const [existingItem] = await db.query(
          "SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ?",
          [id, item.product_id],
        );

        const quantity = parseInt(item.quantity) || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const discountPercent = parseFloat(item.discount_percent) || 0;
        const gstRate = parseFloat(item.gst_rate) || 18;
        const taxableValue = quantity * unitPrice;
        const discountAmount = (taxableValue * discountPercent) / 100;
        const afterDiscount = taxableValue - discountAmount;
        const cgstAmount = (afterDiscount * gstRate) / 200;
        const sgstAmount = (afterDiscount * gstRate) / 200;
        const totalAmount = afterDiscount + cgstAmount + sgstAmount;

        if (existingItem.length > 0) {
          const oldQuantity = existingItem[0].quantity;
          const quantityDiff = quantity - oldQuantity;

          await db.query(
            `UPDATE order_items SET
              quantity = ?, unit_price = ?, discount_percent = ?, discount_amount = ?,
              taxable_value = ?, gst_rate = ?, cgst_amount = ?, sgst_amount = ?,
              total_amount = ?
            WHERE order_id = ? AND product_id = ?`,
            [quantity, unitPrice, discountPercent, discountAmount, taxableValue, gstRate, cgstAmount, sgstAmount, totalAmount, id, item.product_id]
          );

          if (existingOrder[0].order_type === "sales" && quantityDiff !== 0) {
            await db.query(
              "UPDATE products SET current_stock = current_stock - ? WHERE id = ?",
              [quantityDiff, item.product_id],
            );
          }
        } else {
          await db.query(
            `INSERT INTO order_items (
              order_id, product_id, product_name, quantity, unit_price,
              discount_percent, discount_amount, taxable_value, gst_rate,
              cgst_amount, sgst_amount, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, item.product_id, item.product_name, quantity, unitPrice, discountPercent, discountAmount, taxableValue, gstRate, cgstAmount, sgstAmount, totalAmount]
          );

          if (existingOrder[0].order_type === "sales") {
            await db.query(
              "UPDATE products SET current_stock = current_stock - ? WHERE id = ?",
              [quantity, item.product_id],
            );
          }
        }
      }
    }

    // Add status history if status changed - THIS is where changed_by belongs
    if (orderData.status && existingOrder[0].status !== orderData.status) {
      const changedBy = orderData.changed_by || orderData.updated_by || 1;
      await db.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, remarks, changed_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, existingOrder[0].status, orderData.status, changedBy, orderData.status_remarks || null],
      );
      console.log(`Status history added: ${existingOrder[0].status} -> ${orderData.status} by ${changedBy}`);
    }

    // Commit transaction
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
}  // ============ END OF UPDATE ORDER METHOD ============

  // Get all orders with filters
  // Get all orders with filters
  static async getAllOrders(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
          SELECT o.*, 
                 c.name as customer_name,
                 c.email as customer_email
          FROM orders o
          LEFT JOIN customers c ON o.customer_id = c.id AND o.customer_type = 'customer'
          WHERE o.deleted_at IS NULL
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

      query += " ORDER BY o.created_at DESC"; // Changed to DESC for newest first

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;

      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      // ✅ FIX: Get items for each order
      const ordersWithItems = [];
      for (const order of rows) {
        const [items] = await db.query(
          `SELECT oi.*, p.product_code
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
          [order.id],
        );
        ordersWithItems.push({
          ...order,
          items: items,
        });
      }

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM orders WHERE deleted_at IS NULL",
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
      // Get old status
      const [oldStatus] = await db.query(
        "SELECT status FROM orders WHERE id = ?",
        [id],
      );

      // Update order status
      await db.query(
        `UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?`,
        [statusData.status, id],
      );

      // Get changed_by from request or use a default
      const changedBy = statusData.changed_by || statusData.user_id || 1;

      // Add to status history
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
      // Get order details
      const [order] = await db.query(
        "SELECT order_type, status FROM orders WHERE id = ?",
        [id],
      );

      if (!order[0]) {
        throw new Error("Order not found");
      }

      // Check if order is already cancelled
      if (order[0].status === "cancelled") {
        throw new Error("Order is already cancelled");
      }

      // Define which statuses can be cancelled
      const cancellableStatuses = ["pending", "confirmed", "processing"];

      if (!cancellableStatuses.includes(order[0].status)) {
        throw new Error(
          `Order cannot be cancelled because current status is '${order[0].status}'. Only orders with status: ${cancellableStatuses.join(", ")} can be cancelled.`,
        );
      }

      // Get cancelled_by from request
      const cancelledBy = cancelData.cancelled_by || 1;

      if (!cancelData.reason) {
        throw new Error("Cancellation reason is required");
      }

      // Update order status
      await db.query(
        `UPDATE orders SET status = 'cancelled', cancelled_by = ?, cancelled_at = NOW(),
             cancellation_reason = ?, updated_at = NOW() WHERE id = ?`,
        [cancelledBy, cancelData.reason, id],
      );

      // Add to status history
      await db.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, remarks, changed_by)
             VALUES (?, ?, 'cancelled', ?, ?)`,
        [id, order[0].status, cancelData.reason, cancelledBy],
      );

      // Restore stock if it was a sales order
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

  // Delete order (soft delete)
  // Delete order - Modified to cascade delete related records
  static async deleteOrder(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid order ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Start transaction to ensure all related records are deleted
      await db.query("START TRANSACTION");

      // First, delete order items
      const [itemsDeleted] = await db.query(
        "DELETE FROM order_items WHERE order_id = ?",
        [Number(id)],
      );
      console.log(`Deleted ${itemsDeleted.affectedRows} order items`);

      // Second, delete order status history
      const [historyDeleted] = await db.query(
        "DELETE FROM order_status_history WHERE order_id = ?",
        [Number(id)],
      );
      console.log(
        `Deleted ${historyDeleted.affectedRows} status history records`,
      );

      // Finally, delete the order
      const [orderDeleted] = await db.query("DELETE FROM orders WHERE id = ?", [
        Number(id),
      ]);

      if (orderDeleted.affectedRows === 0) {
        throw new Error("Order not found");
      }

      // Commit transaction
      await db.query("COMMIT");
      console.log(`Order ${id} and all related records deleted successfully`);

      return true;
    } catch (error) {
      // Rollback transaction on error
      await db.query("ROLLBACK");
      console.error("Delete order error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
  // Get order statistics
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
                WHERE deleted_at IS NULL
            `);
      return stats[0];
    } finally {
      await db.end();
    }
  }
}

module.exports = OrderService;
