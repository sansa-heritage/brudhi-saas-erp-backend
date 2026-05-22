const DatabaseManager = require("../../services/database-manager.service");
const HashUtil = require("../../utils/hash");

class UserService {
  async getAllUsers(tenantId, filters = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      let query =
        "SELECT id, name, email, role, mobile, status, last_login, created_at FROM users WHERE 1=1";
      const params = [];

      if (filters.role) {
        query += " AND role = ?";
        params.push(filters.role);
      }

      if (filters.status) {
        query += " AND status = ?";
        params.push(filters.status);
      }

      if (filters.search) {
        query += " AND (name LIKE ? OR email LIKE ?)";
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }

      query += " ORDER BY created_at DESC";

      const page = parseInt(filters.page) || 1;
      const limit = Math.min(100, parseInt(filters.limit) || 10);
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const users = await db.query(query, params);

      const countResult = await db.query(
        "SELECT COUNT(*) as total FROM users",
        [],
      );
      const total = countResult[0]?.total || 0;

      return {
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } finally {
      await db.end();
    }
  }

  async getUserById(tenantId, id) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const users = await db.query(
        "SELECT id, name, email, role, mobile, status, last_login, created_at FROM users WHERE id = ?",
        [parseInt(id)],
      );
      return users[0] || null;
    } finally {
      await db.end();
    }
  }

  async createUser(tenantId, userData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const existing = await db.query("SELECT id FROM users WHERE email = ?", [
        userData.email,
      ]);

      if (existing.length > 0) {
        throw new Error("Email already exists");
      }

      const hashedPassword = await HashUtil.hashPassword(userData.password);

      const result = await db.query(
        `INSERT INTO users (name, email, password, role, mobile, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userData.name,
          userData.email,
          hashedPassword,
          userData.role,
          userData.mobile,
          userData.status || "active",
          userData.createdBy,
        ],
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }

  async updateUser(tenantId, id, userData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const updates = [];
      const params = [];

      if (userData.name !== undefined) {
        updates.push("name = ?");
        params.push(userData.name);
      }
      if (userData.email !== undefined) {
        updates.push("email = ?");
        params.push(userData.email);
      }
      if (userData.role !== undefined) {
        updates.push("role = ?");
        params.push(userData.role);
      }
      if (userData.mobile !== undefined) {
        updates.push("mobile = ?");
        params.push(userData.mobile);
      }
      if (userData.status !== undefined) {
        updates.push("status = ?");
        params.push(userData.status);
      }

      if (updates.length === 0) return true;

      params.push(parseInt(id));
      await db.query(
        `UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
        params,
      );

      return true;
    } finally {
      await db.end();
    }
  }

  async deleteUser(tenantId, id) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Check if user has created records
      const invoices = await db.query(
        "SELECT id FROM invoices WHERE created_by = ? LIMIT 1",
        [parseInt(id)],
      );

      if (invoices.length > 0) {
        throw new Error("Cannot delete user who has created invoices");
      }

      await db.query("DELETE FROM users WHERE id = ?", [parseInt(id)]);
      return true;
    } finally {
      await db.end();
    }
  }

  async resetPassword(tenantId, id, newPassword) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const hashedPassword = await HashUtil.hashPassword(newPassword);
      await db.query("UPDATE users SET password = ? WHERE id = ?", [
        hashedPassword,
        parseInt(id),
      ]);
      return true;
    } finally {
      await db.end();
    }
  }
}

module.exports = new UserService();
