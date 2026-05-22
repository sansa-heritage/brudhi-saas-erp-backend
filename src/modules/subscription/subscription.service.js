const DatabaseManager = require("../../services/database-manager.service"); // Fixed path

class SubscriptionService {
  // Generate subscription number
  static async generateSubscriptionNo(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        "SELECT COUNT(*) as count FROM subscriptions WHERE YEAR(created_at) = YEAR(CURDATE())",
      );
      const count = result[0].count + 1;
      const year = new Date().getFullYear();
      return `SUB${year}${String(count).padStart(6, "0")}`;
    } finally {
      await db.end();
    }
  }

  // Generate payment number
  static async generatePaymentNo(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        "SELECT COUNT(*) as count FROM subscription_payments WHERE YEAR(created_at) = YEAR(CURDATE())",
      );
      const count = result[0].count + 1;
      const year = new Date().getFullYear();
      return `PAY${year}${String(count).padStart(6, "0")}`;
    } finally {
      await db.end();
    }
  }

  // Create new subscription
  static async createSubscription(subscriptionData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const subscriptionNo = await this.generateSubscriptionNo(tenantId);

      const startDate = new Date(subscriptionData.start_date);
      let endDate = new Date(startDate);

      switch (subscriptionData.billing_cycle) {
        case "monthly":
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case "quarterly":
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case "half_yearly":
          endDate.setMonth(endDate.getMonth() + 6);
          break;
        case "yearly":
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
        default:
          endDate.setMonth(endDate.getMonth() + 1);
      }

      const [result] = await db.query(
        `INSERT INTO subscriptions (
                subscription_no, tenant_id, plan_id, plan_name, plan_type,
                start_date, end_date, billing_cycle, amount,
                discount_amount, total_amount, payment_status,
                payment_method, transaction_id, status, auto_renew, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subscriptionNo,
          tenantId,
          subscriptionData.plan_id || 1, // Add plan_id
          subscriptionData.plan_name,
          subscriptionData.plan_type || "monthly",
          subscriptionData.start_date,
          endDate,
          subscriptionData.billing_cycle || "monthly",
          subscriptionData.amount,
          subscriptionData.discount_amount || 0,
          subscriptionData.total_amount,
          subscriptionData.payment_status || "pending",
          subscriptionData.payment_method || null,
          subscriptionData.transaction_id || null,
          "active",
          subscriptionData.auto_renew !== false,
          subscriptionData.created_by,
        ],
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }

  // Record payment
  static async recordPayment(subscriptionId, paymentData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const paymentNo = await this.generatePaymentNo(tenantId);

      const [result] = await db.query(
        `INSERT INTO subscription_payments (
                    subscription_id, payment_no, amount, payment_date,
                    payment_method, transaction_id, status, remarks, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subscriptionId,
          paymentNo,
          paymentData.amount,
          new Date(),
          paymentData.payment_method,
          paymentData.transaction_id,
          "success",
          paymentData.remarks || null,
          paymentData.created_by,
        ],
      );

      // Update subscription payment status
      await db.query(
        `UPDATE subscriptions SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
        [subscriptionId],
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }

  // Add history
  static async addHistory(
    subscriptionId,
    action,
    oldValue,
    newValue,
    remarks,
    changedBy,
    tenantId,
  ) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      await db.query(
        `INSERT INTO subscription_history (
                    subscription_id, action, old_value, new_value, remarks, changed_by
                ) VALUES (?, ?, ?, ?, ?, ?)`,
        [subscriptionId, action, oldValue, newValue, remarks, changedBy],
      );
    } finally {
      await db.end();
    }
  }

  // Get subscription by ID
  static async getSubscriptionById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [subscriptions] = await db.query(
        `SELECT s.*, 
                        u.name as created_by_name,
                        c.name as cancelled_by_name
                FROM subscriptions s
                LEFT JOIN users u ON s.created_by = u.id
                LEFT JOIN users c ON s.cancelled_by = c.id
                WHERE s.id = ?`,
        [id],
      );

      if (subscriptions.length === 0) return null;

      const [payments] = await db.query(
        `SELECT * FROM subscription_payments WHERE subscription_id = ? ORDER BY created_at DESC`,
        [id],
      );

      return {
        ...subscriptions[0],
        payments: payments,
      };
    } finally {
      await db.end();
    }
  }

  // Get all subscriptions
  static async getAllSubscriptions(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
                SELECT s.*, u.name as created_by_name
                FROM subscriptions s
                LEFT JOIN users u ON s.created_by = u.id
                WHERE 1=1
            `;
      const params = [];

      if (filters.status) {
        query += " AND s.status = ?";
        params.push(filters.status);
      }

      if (filters.plan_type) {
        query += " AND s.plan_type = ?";
        params.push(filters.plan_type);
      }

      query += " ORDER BY s.created_at ASC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;

      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM subscriptions",
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

  // Get tenant subscription
  static async getTenantSubscription(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [subscriptions] = await db.query(
        `SELECT s.*, 
                        DATEDIFF(s.end_date, CURDATE()) as days_remaining
                FROM subscriptions s
                WHERE s.tenant_id = ? AND s.status = 'active'
                ORDER BY s.created_at DESC
                LIMIT 1`,
        [tenantId],
      );
      return subscriptions[0] || null;
    } finally {
      await db.end();
    }
  }

  // Renew subscription
  static async renewSubscription(id, tenantId, renewData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Get current subscription
      const [current] = await db.query(
        "SELECT * FROM subscriptions WHERE id = ?",
        [id],
      );

      if (!current[0]) {
        throw new Error("Subscription not found");
      }

      // Calculate new end date
      let newEndDate = new Date(current[0].end_date);
      switch (current[0].billing_cycle) {
        case "monthly":
          newEndDate.setMonth(newEndDate.getMonth() + 1);
          break;
        case "quarterly":
          newEndDate.setMonth(newEndDate.getMonth() + 3);
          break;
        case "half_yearly":
          newEndDate.setMonth(newEndDate.getMonth() + 6);
          break;
        case "yearly":
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
          break;
        default:
          newEndDate.setMonth(newEndDate.getMonth() + 1);
      }

      // Update subscription
      await db.query(
        `UPDATE subscriptions SET 
                end_date = ?, renewed_at = NOW(), updated_at = NOW()
            WHERE id = ?`,
        [newEndDate, id],
      );

      // Create renewal remarks
      const renewalRemarks =
        renewData.remarks ||
        `Subscription renewed. New expiry: ${newEndDate.toISOString().split("T")[0]}`;

      // Add to history
      await this.addHistory(
        id,
        "RENEW",
        current[0].end_date,
        newEndDate,
        renewalRemarks,
        renewData.renewed_by,
        tenantId,
      );

      // Record payment if provided
      if (renewData.payment_method && renewData.transaction_id) {
        await this.recordPayment(
          id,
          {
            amount: renewData.amount || current[0].total_amount,
            payment_method: renewData.payment_method,
            transaction_id: renewData.transaction_id,
            receipt_url: renewData.receipt_url || null,
            remarks:
              renewData.payment_remarks || `Payment for subscription renewal`,
            created_by: renewData.renewed_by,
          },
          tenantId,
        );
      }

      return true;
    } finally {
      await db.end();
    }
  }

  // Cancel subscription
  static async cancelSubscription(id, tenantId, cancelData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [current] = await db.query(
        "SELECT status FROM subscriptions WHERE id = ?",
        [id],
      );

      if (!current[0]) {
        throw new Error("Subscription not found");
      }

      if (current[0].status === "cancelled") {
        throw new Error("Subscription is already cancelled");
      }

      await db.query(
        `UPDATE subscriptions SET 
                    status = 'cancelled', 
                    cancelled_at = NOW(), 
                    cancelled_by = ?,
                    cancellation_reason = ?,
                    auto_renew = FALSE,
                    updated_at = NOW()
                WHERE id = ?`,
        [cancelData.cancelled_by, cancelData.reason, id],
      );

      await this.addHistory(
        id,
        "CANCEL",
        current[0].status,
        "cancelled",
        cancelData.reason,
        cancelData.cancelled_by,
        tenantId,
      );

      return true;
    } finally {
      await db.end();
    }
  }

  // Get subscription statistics
  static async getSubscriptionStats(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [stats] = await db.query(`
                SELECT 
                    COUNT(*) as total_subscriptions,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                    SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
                    SUM(CASE WHEN end_date < CURDATE() AND status = 'active' THEN 1 ELSE 0 END) as expired_soon,
                    SUM(total_amount) as total_revenue
                FROM subscriptions
            `);
      return stats[0];
    } finally {
      await db.end();
    }
  }

  // Check and update expired subscriptions
  static async updateExpiredSubscriptions(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        `UPDATE subscriptions 
                 SET status = 'expired', updated_at = NOW()
                 WHERE end_date < CURDATE() AND status = 'active'`,
      );
      return result.affectedRows;
    } finally {
      await db.end();
    }
  }
}

module.exports = SubscriptionService;
