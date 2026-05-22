const db = require('../../config/db');
const logger = require('../../config/logger');
const DatabaseManager = require('../../services/database-manager.service');
const moment = require('moment');

class SuperadminService {
  async createTenant(tenantData) {
    // First, create the database
    let dbConfig;
    try {
      dbConfig = await DatabaseManager.createTenantDatabase(
        tenantData.name,
        {
          adminName: tenantData.adminName,
          adminEmail: tenantData.adminEmail,
          adminPassword: tenantData.adminPassword,
          adminMobile: tenantData.adminMobile
        }
      );
    } catch (error) {
      logger.error('Failed to create tenant database:', error);
      throw new Error(`Failed to create database: ${error.message}`);
    }

    // Now create the tenant record with the actual database details
    return await db.transaction(async (connection) => {
      // Check if email exists
      const existing = await connection.execute(
        'SELECT id FROM tenants WHERE email = ?',
        [tenantData.email]
      );

      if (existing[0].length > 0) {
        // Clean up the database we just created
        await DatabaseManager.deleteTenantDatabaseByCredentials(dbConfig.databaseName, dbConfig.username);
        throw new Error('Email already registered');
      }

      // Check if subdomain exists
      if (tenantData.subdomain) {
        const existingSubdomain = await connection.execute(
          'SELECT id FROM tenants WHERE subdomain = ?',
          [tenantData.subdomain]
        );

        if (existingSubdomain[0].length > 0) {
          await DatabaseManager.deleteTenantDatabaseByCredentials(dbConfig.databaseName, dbConfig.username);
          throw new Error('Subdomain already taken');
        }
      }

      // Set trial end date
      const trialDays = tenantData.trialDays || 14;
      const trialEndsAt = moment().add(trialDays, 'days').format('YYYY-MM-DD');

      // Insert tenant with the actual database details
      const [result] = await connection.execute(
        `INSERT INTO tenants (
          name, subdomain, email, phone, database_name, database_host, database_port,
          database_user, database_password, status, subscription_status, trial_ends_at, 
          config, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'trial', ?, ?, ?)`,
        [
          tenantData.name,
          tenantData.subdomain || null,
          tenantData.email,
          tenantData.phone,
          dbConfig.databaseName,
          dbConfig.host,
          dbConfig.port,
          dbConfig.username,
          dbConfig.password,
          trialEndsAt,
          JSON.stringify(tenantData.config || {}),
          tenantData.createdBy || null
        ]
      );

      const tenantId = result.insertId;

      // Assign subscription plan
      const planId = tenantData.subscriptionPlanId || 1;
      const [plan] = await connection.execute(
        'SELECT price FROM plans WHERE id = ?',
        [planId]
      );

      const startDate = moment().format('YYYY-MM-DD');
      const endDate = moment().add(30, 'days').format('YYYY-MM-DD');

      await connection.execute(
        `INSERT INTO tenant_subscriptions (
          tenant_id, plan_id, start_date, end_date, amount, status
        ) VALUES (?, ?, ?, ?, ?, 'active')`,
        [tenantId, planId, startDate, endDate, plan[0]?.price || 0]
      );

      // Log activity
      await connection.execute(
        `INSERT INTO main_activity_logs (superadmin_id, tenant_id, action, ip_address) 
         VALUES (?, ?, 'Tenant created with separate database', ?)`,
        [tenantData.createdBy || null, tenantId, tenantData.ipAddress || null]
      );

      return {
        tenantId,
        tenant: {
          id: tenantId,
          name: tenantData.name,
          subdomain: tenantData.subdomain,
          email: tenantData.email
        },
        database: dbConfig,
        admin: {
          name: tenantData.adminName,
          email: tenantData.adminEmail
        }
      };
    });
  }

  async getAllTenants(filters = {}) {
    let query = `
      SELECT t.*, 
             ts.status as subscription_status,
             ts.end_date as subscription_end_date,
             p.name as plan_name,
             p.price as plan_price
      FROM tenants t
      LEFT JOIN (
        SELECT tenant_id, status, end_date, plan_id 
        FROM tenant_subscriptions 
        WHERE status = 'active'
        ORDER BY created_at DESC
      ) ts ON t.id = ts.tenant_id
      LEFT JOIN plans p ON ts.plan_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (t.name LIKE ? OR t.email LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY t.created_at DESC';

    const page = parseInt(filters.page) || 1;
    const limit = Math.min(100, parseInt(filters.limit) || 10);
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const tenants = await db.query(query, params);

    const countResult = await db.query('SELECT COUNT(*) as total FROM tenants');
    const total = countResult[0]?.total || 0;

    return {
      data: tenants,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getTenantById(id) {
    const tenants = await db.query(
      `SELECT t.*, 
              ts.status as subscription_status,
              ts.start_date, ts.end_date,
              p.name as plan_name
       FROM tenants t
       LEFT JOIN (
         SELECT tenant_id, status, start_date, end_date, plan_id
         FROM tenant_subscriptions
         WHERE status = 'active'
         ORDER BY created_at DESC
         LIMIT 1
       ) ts ON t.id = ts.tenant_id
       LEFT JOIN plans p ON ts.plan_id = p.id
       WHERE t.id = ?`,
      [id]
    );

    if (tenants.length === 0) return null;

    return tenants[0];
  }

  async updateTenant(id, tenantData) {
    const updates = [];
    const params = [];

    const allowedFields = ['name', 'email', 'phone', 'status', 'subscription_status'];

    for (const field of allowedFields) {
      if (tenantData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(tenantData[field]);
      }
    }

    if (updates.length === 0) return true;

    params.push(parseInt(id));
    await db.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return true;
  }

  async deleteTenant(id) {
    return await db.transaction(async (connection) => {
      const [tenant] = await connection.execute(
        'SELECT id, name, database_name FROM tenants WHERE id = ?',
        [id]
      );

      if (tenant[0].length === 0) {
        throw new Error('Tenant not found');
      }

      // Delete tenant database
      try {
        await DatabaseManager.deleteTenantDatabase(id);
      } catch (err) {
        logger.warn('Failed to delete tenant database:', err.message);
      }

      // Soft delete tenant record
      await connection.execute(
        'UPDATE tenants SET status = "suspended" WHERE id = ?',
        [id]
      );

      await connection.execute(
        `INSERT INTO main_activity_logs (superadmin_id, tenant_id, action) 
         VALUES (?, ?, 'Tenant deleted')`,
        [null, id]
      );

      return true;
    });
  }

  async updateTenant(id, tenantData) {
    const updates = [];
    const params = [];

    const allowedFields = ['name', 'email', 'phone', 'status', 'subscription_status'];

    for (const field of allowedFields) {
      if (tenantData[field] !== undefined && tenantData[field] !== null) {
        updates.push(`${field} = ?`);
        params.push(tenantData[field]);
      }
    }

    if (updates.length === 0) {
      return true;
    }

    params.push(parseInt(id));
    await db.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return true;
  }

  async updateTenantStatus(id, status) {
    await db.query(
      'UPDATE tenants SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    // If blocking tenant, also block all users
    if (status === 'blocked') {
      // This would need to be done in the tenant's database
      // For now, just log it
      logger.info(`Tenant ${id} status changed to blocked`);
    }

    return true;
  }

  async updateTenantSubscription(tenantId, planId, duration = 30) {
    return await db.transaction(async (connection) => {
      // Deactivate current subscription
      await connection.execute(
        `UPDATE tenant_subscriptions 
                 SET status = 'expired', updated_at = NOW()
                 WHERE tenant_id = ? AND status = 'active'`,
        [tenantId]
      );

      // Get plan details
      const [plan] = await connection.execute(
        'SELECT price FROM plans WHERE id = ?',
        [planId]
      );

      // Create new subscription
      const startDate = moment().format('YYYY-MM-DD');
      const endDate = moment().add(duration, 'days').format('YYYY-MM-DD');

      const [result] = await connection.execute(
        `INSERT INTO tenant_subscriptions (
                    tenant_id, plan_id, start_date, end_date, amount, status
                ) VALUES (?, ?, ?, ?, ?, 'active')`,
        [tenantId, planId, startDate, endDate, plan[0]?.price || 0]
      );

      // Update tenant subscription status
      await connection.execute(
        `UPDATE tenants SET subscription_status = 'active', updated_at = NOW()
                 WHERE id = ?`,
        [tenantId]
      );

      return result.insertId;
    });
  }

  // Get tenant subscription details
  async getTenantSubscription(tenantId) {
    // Get current subscription from main database
    const currentSubscription = await db.query(
      `SELECT ts.*, p.name as plan_name, p.price, p.max_users, p.max_invoices, 
              p.max_customers, p.max_dealers, p.features
       FROM tenant_subscriptions ts
       LEFT JOIN plans p ON ts.plan_id = p.id
       WHERE ts.tenant_id = ? AND ts.status = 'active'
       ORDER BY ts.created_at DESC
       LIMIT 1`,
      [tenantId]
    );

    // Get tenant details
    const tenant = await db.query(
      'SELECT id, name, subdomain, email, subscription_status FROM tenants WHERE id = ?',
      [tenantId]
    );

    // Get usage stats from tenant database
    let usageStats = {
      total_users: 0,
      total_customers: 0,
      total_dealers: 0,
      total_invoices: 0
    };

    try {
      const tenantDb = await DatabaseManager.getTenantDatabaseConnection(tenantId);
      try {
        const [users] = await tenantDb.query('SELECT COUNT(*) as count FROM users');
        const [customers] = await tenantDb.query('SELECT COUNT(*) as count FROM customers');
        const [dealers] = await tenantDb.query('SELECT COUNT(*) as count FROM dealers');
        const [invoices] = await tenantDb.query('SELECT COUNT(*) as count FROM invoices');

        usageStats = {
          total_users: users[0]?.count || 0,
          total_customers: customers[0]?.count || 0,
          total_dealers: dealers[0]?.count || 0,
          total_invoices: invoices[0]?.count || 0
        };
      } finally {
        await tenantDb.end();
      }
    } catch (error) {
      logger.warn('Could not fetch tenant usage stats:', error.message);
    }

    // Calculate days remaining
    let daysRemaining = 0;
    if (currentSubscription[0]?.end_date) {
      daysRemaining = moment(currentSubscription[0].end_date).diff(moment(), 'days');
    }

    return {
      tenant: tenant[0],
      current_subscription: currentSubscription[0] ? {
        ...currentSubscription[0],
        days_remaining: daysRemaining,
        features: currentSubscription[0].features ? JSON.parse(currentSubscription[0].features) : {}
      } : null,
      usage_stats: usageStats,
      usage_percentage: currentSubscription[0] ? {
        users: (usageStats.total_users / (currentSubscription[0].max_users || 1)) * 100,
        customers: (usageStats.total_customers / (currentSubscription[0].max_customers || 1)) * 100,
        dealers: (usageStats.total_dealers / (currentSubscription[0].max_dealers || 1)) * 100,
        invoices: (usageStats.total_invoices / (currentSubscription[0].max_invoices || 1)) * 100
      } : null
    };
  }

  // Assign plan to tenant
  async assignPlanToTenant(tenantId, planId, duration = 30, startDate = null) {
    return await db.transaction(async (connection) => {
      // Check if tenant exists
      const [tenant] = await connection.execute(
        'SELECT id, name FROM tenants WHERE id = ?',
        [tenantId]
      );

      if (tenant[0].length === 0) {
        throw new Error('Tenant not found');
      }

      // Check if plan exists and is active
      const [plan] = await connection.execute(
        'SELECT * FROM plans WHERE id = ? AND is_active = 1',
        [planId]
      );

      if (plan[0].length === 0) {
        throw new Error('Plan not found or inactive');
      }

      // Deactivate current subscription
      await connection.execute(
        `UPDATE tenant_subscriptions 
         SET status = 'expired', updated_at = NOW()
         WHERE tenant_id = ? AND status = 'active'`,
        [tenantId]
      );

      // Create new subscription
      const start = startDate ? moment(startDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
      const endDate = moment(start).add(duration, 'days').format('YYYY-MM-DD');

      const [result] = await connection.execute(
        `INSERT INTO tenant_subscriptions (
          tenant_id, plan_id, start_date, end_date, amount, status
        ) VALUES (?, ?, ?, ?, ?, 'active')`,
        [tenantId, planId, start, endDate, plan[0].price]
      );

      // Update tenant subscription status
      await connection.execute(
        `UPDATE tenants SET subscription_status = 'active' WHERE id = ?`,
        [tenantId]
      );

      // Log activity
      await connection.execute(
        `INSERT INTO main_activity_logs (superadmin_id, tenant_id, action, details) 
         VALUES (?, ?, 'Plan assigned', ?)`,
        [null, tenantId, JSON.stringify({
          plan_name: plan[0].name,
          plan_price: plan[0].price,
          duration: duration,
          start_date: start,
          end_date: endDate
        })]
      );

      return {
        subscription_id: result.insertId,
        tenant_id: tenantId,
        plan_id: planId,
        plan_name: plan[0].name,
        plan_price: plan[0].price,
        start_date: start,
        end_date: endDate,
        duration_days: duration,
        amount: plan[0].price,
        status: 'active'
      };
    });
  }

  // Get tenant subscription history
  async getTenantSubscriptionHistory(tenantId) {
    const subscriptions = await db.query(
      `SELECT ts.*, p.name as plan_name, p.price
       FROM tenant_subscriptions ts
       LEFT JOIN plans p ON ts.plan_id = p.id
       WHERE ts.tenant_id = ?
       ORDER BY ts.created_at DESC`,
      [tenantId]
    );

    return subscriptions;
  }

  // Cancel tenant subscription
  async cancelTenantSubscription(tenantId, reason = null, cancelImmediately = false) {
    return await db.transaction(async (connection) => {
      // Get current subscription
      const [current] = await connection.execute(
        `SELECT * FROM tenant_subscriptions 
         WHERE tenant_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId]
      );

      if (current[0].length === 0) {
        throw new Error('No active subscription found');
      }

      if (cancelImmediately) {
        // Cancel immediately
        await connection.execute(
          `UPDATE tenant_subscriptions 
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = ?`,
          [current[0].id]
        );

        await connection.execute(
          `UPDATE tenants SET subscription_status = 'cancelled' WHERE id = ?`,
          [tenantId]
        );

        return {
          subscription_id: current[0].id,
          status: 'cancelled',
          cancelled_at: moment().format('YYYY-MM-DD'),
          message: 'Subscription cancelled immediately'
        };
      } else {
        // Set to expire at end date
        await connection.execute(
          `UPDATE tenant_subscriptions 
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = ?`,
          [current[0].id]
        );

        return {
          subscription_id: current[0].id,
          status: 'cancelled',
          end_date: current[0].end_date,
          message: `Subscription will remain active until ${moment(current[0].end_date).format('YYYY-MM-DD')}`
        };
      }
    });
  }

  async getAllSubscriptions(filters = {}) {
    let query = `
    SELECT 
      ts.id,
      ts.tenant_id,
      t.name as tenant_name,
      t.subdomain,
      t.email as tenant_email,
      ts.plan_id,
      p.name as plan_name,
      p.price as plan_price,
      ts.start_date,
      ts.end_date,
      ts.amount,
      ts.status,
      ts.created_at,
      DATEDIFF(ts.end_date, CURDATE()) as days_remaining
    FROM tenant_subscriptions ts
    LEFT JOIN tenants t ON ts.tenant_id = t.id
    LEFT JOIN plans p ON ts.plan_id = p.id
    WHERE 1=1
  `;

    const params = [];

    if (filters.status) {
      query += ' AND ts.status = ?';
      params.push(filters.status);
    }

    if (filters.planId) {
      query += ' AND ts.plan_id = ?';
      params.push(filters.planId);
    }

    if (filters.tenantId) {
      query += ' AND ts.tenant_id = ?';
      params.push(filters.tenantId);
    }

    if (filters.fromDate) {
      query += ' AND ts.created_at >= ?';
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      query += ' AND ts.created_at <= ?';
      params.push(filters.toDate);
    }

    query += ' ORDER BY ts.created_at DESC';

    const page = parseInt(filters.page) || 1;
    const limit = Math.min(100, parseInt(filters.limit) || 10);
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const subscriptions = await db.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM tenant_subscriptions ts WHERE 1=1';
    const countParams = [];

    if (filters.status) {
      countQuery += ' AND ts.status = ?';
      countParams.push(filters.status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return {
      data: subscriptions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  // Get subscription statistics
  async getSubscriptionStats() {
    const stats = await db.query(`
    SELECT 
      COUNT(*) as total_subscriptions,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_subscriptions,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_subscriptions,
      SUM(CASE WHEN DATEDIFF(end_date, CURDATE()) <= 7 AND status = 'active' THEN 1 ELSE 0 END) as expiring_soon,
      SUM(amount) as total_revenue,
      AVG(amount) as average_revenue,
      SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as monthly_recurring_revenue
    FROM tenant_subscriptions
  `);

    // Get revenue by plan
    const revenueByPlan = await db.query(`
    SELECT 
      p.name as plan_name,
      COUNT(ts.id) as subscriber_count,
      SUM(ts.amount) as total_revenue
    FROM tenant_subscriptions ts
    LEFT JOIN plans p ON ts.plan_id = p.id
    WHERE ts.status = 'active'
    GROUP BY p.id
    ORDER BY total_revenue DESC
  `);

    // Get monthly revenue trend
    const monthlyTrend = await db.query(`
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m') as month,
      COUNT(*) as subscriptions_count,
      SUM(amount) as revenue
    FROM tenant_subscriptions
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY month ASC
  `);

    return {
      ...stats[0],
      revenue_by_plan: revenueByPlan,
      monthly_trend: monthlyTrend
    };
  }

  // Get subscriptions by plan
  async getSubscriptionsByPlan(planId) {
    const subscriptions = await db.query(`
    SELECT 
      ts.*,
      t.name as tenant_name,
      t.subdomain,
      t.email as tenant_email,
      DATEDIFF(ts.end_date, CURDATE()) as days_remaining
    FROM tenant_subscriptions ts
    LEFT JOIN tenants t ON ts.tenant_id = t.id
    WHERE ts.plan_id = ? AND ts.status = 'active'
    ORDER BY ts.end_date ASC
  `, [planId]);

    return subscriptions;
  }

  // Get expiring subscriptions
  async getExpiringSubscriptions(days = 7) {
    const subscriptions = await db.query(`
    SELECT 
      ts.*,
      t.name as tenant_name,
      t.subdomain,
      t.email as tenant_email,
      p.name as plan_name,
      DATEDIFF(ts.end_date, CURDATE()) as days_remaining
    FROM tenant_subscriptions ts
    LEFT JOIN tenants t ON ts.tenant_id = t.id
    LEFT JOIN plans p ON ts.plan_id = p.id
    WHERE ts.status = 'active' 
      AND DATEDIFF(ts.end_date, CURDATE()) <= ?
      AND DATEDIFF(ts.end_date, CURDATE()) > 0
    ORDER BY ts.end_date ASC
  `, [days]);

    return subscriptions;
  }

  // Get expired subscriptions
  async getExpiredSubscriptions() {
    const subscriptions = await db.query(`
    SELECT 
      ts.*,
      t.name as tenant_name,
      t.subdomain,
      t.email as tenant_email,
      p.name as plan_name,
      DATEDIFF(CURDATE(), ts.end_date) as days_expired
    FROM tenant_subscriptions ts
    LEFT JOIN tenants t ON ts.tenant_id = t.id
    LEFT JOIN plans p ON ts.plan_id = p.id
    WHERE ts.status = 'expired' OR (ts.status = 'active' AND ts.end_date < CURDATE())
    ORDER BY ts.end_date DESC
  `);

    return subscriptions;
  }

  // Bulk assign plan to multiple tenants
  async bulkAssignPlan(tenantIds, planId, duration = 30, startDate = null) {
    const results = [];
    const errors = [];

    for (const tenantId of tenantIds) {
      try {
        const result = await this.assignPlanToTenant(tenantId, planId, duration, startDate);
        results.push(result);
      } catch (error) {
        errors.push({ tenantId, error: error.message });
      }
    }

    return {
      success_count: results.length,
      failed_count: errors.length,
      results: results,
      errors: errors
    };
  }
}

module.exports = new SuperadminService();