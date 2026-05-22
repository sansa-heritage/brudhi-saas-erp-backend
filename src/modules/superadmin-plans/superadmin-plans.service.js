const db = require("../../config/db");
const logger = require("../../config/logger");

class SuperadminPlansService {
  async getAllPlans(filters = {}) {
    let query = "SELECT * FROM plans WHERE 1=1";
    const params = [];

    if (filters.is_active !== undefined) {
      query += " AND is_active = ?";
      params.push(filters.is_active === "true" ? 1 : 0);
    }

    if (filters.search) {
      query += " AND (name LIKE ? OR description LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += " ORDER BY price ASC";

    const plans = await db.query(query, params);

    return plans; // Return only data array
  }

  async getPlanById(id) {
    const plans = await db.query("SELECT * FROM plans WHERE id = ?", [
      parseInt(id),
    ]);
    return plans[0] || null;
  }

  async createPlan(planData) {
    // Check if plan name already exists
    const existing = await db.query("SELECT id FROM plans WHERE name = ?", [
      planData.name,
    ]);

    if (existing.length > 0) {
      throw new Error("Plan name already exists");
    }

    const result = await db.query(
      `INSERT INTO plans (
        name, description, price, annual_price, max_users, max_invoices, 
        max_stock_items, max_customers, max_dealers, max_storage_mb, 
        features, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planData.name,
        planData.description || null,
        planData.price,
        planData.annualPrice || null,
        planData.max_users || 5,
        planData.max_invoices || 100,
        planData.max_stock_items || 500,
        planData.max_customers || 500,
        planData.max_dealers || 100,
        planData.max_storage_mb || 100,
        JSON.stringify(planData.features || {}),
        planData.is_active !== undefined ? planData.is_active : 1,
      ],
    );

    return result.insertId;
  }

  async updatePlan(id, planData) {
    const updates = [];
    const params = [];

    const allowedFields = [
      "name",
      "description",
      "price",
      "annual_price",
      "max_users",
      "max_invoices",
      "max_stock_items",
      "max_customers",
      "max_dealers",
      "max_storage_mb",
      "features",
      "is_active",
    ];

    for (const field of allowedFields) {
      if (planData[field] !== undefined) {
        if (field === "features") {
          updates.push(`${field} = ?`);
          params.push(JSON.stringify(planData[field]));
        } else {
          updates.push(`${field} = ?`);
          params.push(planData[field]);
        }
      }
    }

    if (updates.length === 0) return true;

    params.push(parseInt(id));
    await db.query(
      `UPDATE plans SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params,
    );

    return true;
  }

  async togglePlanStatus(id, isActive) {
    await db.query(
      "UPDATE plans SET is_active = ?, updated_at = NOW() WHERE id = ?",
      [isActive ? 1 : 0, parseInt(id)],
    );
    return true;
  }

  async deletePlan(id) {
    // Check if plan is being used by any tenant
    const used = await db.query(
      "SELECT id FROM tenant_subscriptions WHERE plan_id = ? LIMIT 1",
      [parseInt(id)],
    );

    if (used.length > 0) {
      throw new Error("Cannot delete plan that is being used by tenants");
    }

    await db.query("DELETE FROM plans WHERE id = ?", [parseInt(id)]);
    return true;
  }
}

module.exports = new SuperadminPlansService();
