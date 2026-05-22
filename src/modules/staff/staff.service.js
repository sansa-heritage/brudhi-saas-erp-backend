const DatabaseManager = require("../../services/database-manager.service");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

class StaffService {
  // Generate staff code
  // static async generateStaffCode(tenantId) {
  //   const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
  //   try {
  //     const [result] = await db.query(
  //       "SELECT COUNT(*) as count FROM staff WHERE tenant_id = ? AND deleted_at IS NULL",
  //       [tenantId],
  //     );
  //     const count = result[0].count + 1;
  //     return `STAFF${String(count).padStart(4, "0")}`;
  //   } finally {
  //     await db.end();
  //   }
  // }
  // Fix the generateStaffCode function
  static async generateStaffCode(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Start transaction to prevent race conditions
      await db.query("START TRANSACTION");

      // Get the highest staff_code number
      const [result] = await db.query(
        `SELECT staff_code 
       FROM staff 
       WHERE tenant_id = ? 
       AND staff_code REGEXP '^STAFF[0-9]+$'
       ORDER BY LENGTH(staff_code) DESC, staff_code DESC 
       LIMIT 1`,
        [tenantId],
      );

      let nextNum = 1;
      if (result.length > 0 && result[0].staff_code) {
        const match = result[0].staff_code.match(/STAFF(\d+)/);
        if (match && match[1]) {
          nextNum = parseInt(match[1]) + 1;
        }
      }

      await db.query("COMMIT");
      return `STAFF${String(nextNum).padStart(4, "0")}`;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      await db.end();
    }
  }

  // Save profile image
  static async saveProfileImage(file, tenantId) {
    if (!file) return null;

    const uploadDir = path.join(__dirname, "../../../uploads/staff");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `staff_${tenantId}_${timestamp}${ext}`;
    const newPath = path.join(uploadDir, filename);

    fs.renameSync(file.path, newPath);

    return `/uploads/staff/${filename}`;
  }

  // Create new staff member
  static async create(staffData, profileImageFile = null) {
    // Validate required fields
    if (!staffData.password) {
      throw new Error("Password is required");
    }
    if (!staffData.first_name) {
      throw new Error("First name is required");
    }
    if (!staffData.last_name) {
      throw new Error("Last name is required");
    }
    if (!staffData.email) {
      throw new Error("Email is required");
    }
    if (!staffData.role_id) {
      throw new Error("Role ID is required");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(
      staffData.tenant_id,
    );
    try {
      const hashedPassword = await bcrypt.hash(String(staffData.password), 10);
      const staffCode = await this.generateStaffCode(staffData.tenant_id);

      let profileImagePath = null;
      if (profileImageFile) {
        profileImagePath = await this.saveProfileImage(
          profileImageFile,
          staffData.tenant_id,
        );
      }

      const [result] = await db.query(
        `INSERT INTO staff (
                    staff_code, first_name, last_name, email, phone, 
                    password_hash, role_id, tenant_id, department, 
                    designation, joining_date, address,
                    city, state, country, zip_code, profile_image,
                    created_by, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          staffCode,
          staffData.first_name,
          staffData.last_name,
          staffData.email,
          staffData.phone || null,
          hashedPassword,
          staffData.role_id,
          staffData.tenant_id,
          staffData.department || null,
          staffData.designation || null,
          staffData.joining_date || null,
          staffData.address || null,
          staffData.city || null,
          staffData.state || null,
          staffData.country || null,
          staffData.zip_code || null,
          profileImagePath,
          staffData.created_by,
          staffData.status || "active",
        ],
      );
      return result.insertId;
    } finally {
      await db.end();
    }
  }

  // Get staff by ID
  static async findById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT s.*, r.name as role_name
                FROM staff s
                LEFT JOIN roles r ON s.role_id = r.id
                WHERE s.id = ? AND s.tenant_id = ? AND s.deleted_at IS NULL`,
        [id, tenantId],
      );

      if (rows[0]) {
        delete rows[0].password_hash;
      }
      return rows[0];
    } finally {
      await db.end();
    }
  }

  // Get staff by email
  static async findByEmail(email, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT s.*, r.name as role_name
                FROM staff s
                LEFT JOIN roles r ON s.role_id = r.id
                WHERE s.email = ? AND s.tenant_id = ? AND s.deleted_at IS NULL AND s.status = 'active'`,
        [email, tenantId],
      );
      return rows[0];
    } finally {
      await db.end();
    }
  }

  // Get all staff members with filters
  static async findAll(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
                SELECT s.id, s.staff_code, s.first_name, s.last_name, s.email, 
                       s.phone, s.role_id, s.department, s.designation, 
                       s.joining_date, s.status, s.last_login,
                       s.created_at, s.updated_at,
                       r.name as role_name
                FROM staff s
                LEFT JOIN roles r ON s.role_id = r.id
                WHERE s.tenant_id = ? AND s.deleted_at IS NULL
            `;
      const params = [tenantId];

      if (filters.role_id) {
        query += " AND s.role_id = ?";
        params.push(filters.role_id);
      }

      if (filters.status) {
        query += " AND s.status = ?";
        params.push(filters.status);
      }

      if (filters.department) {
        query += " AND s.department = ?";
        params.push(filters.department);
      }

      if (filters.search) {
        query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? 
                              OR s.staff_code LIKE ?)`;
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      query += " ORDER BY s.created_at DESC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;

      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `
                SELECT COUNT(*) as total 
                FROM staff 
                WHERE tenant_id = ? AND deleted_at IS NULL
            `;
      const countParams = [tenantId];

      if (filters.role_id) {
        countQuery += " AND role_id = ?";
        countParams.push(filters.role_id);
      }

      if (filters.status) {
        countQuery += " AND status = ?";
        countParams.push(filters.status);
      }

      if (filters.search) {
        countQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? 
                                  OR staff_code LIKE ?)`;
        const searchTerm = `%${filters.search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
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

  // Update staff member
  // Update staff member
  // Update staff member
  static async update(id, tenantId, updateData) {
    console.log("=== STAFF SERVICE UPDATE ===");
    console.log("ID:", id);
    console.log("Tenant ID:", tenantId);
    console.log("Update Data:", JSON.stringify(updateData, null, 2));

    if (!id || !tenantId) {
      console.log("Missing id or tenantId");
      throw new Error("ID and Tenant ID are required");
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      console.log("No update data provided");
      throw new Error("No update data provided");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const fields = [];
      const values = [];

      const allowedFields = [
        "first_name",
        "last_name",
        "phone",
        "role_id",
        "department",
        "designation",
        "status",
        "address",
        "city",
        "state",
        "country",
        "zip_code",
        "profile_image",
      ];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined && updateData[field] !== "") {
          fields.push(`${field} = ?`);
          values.push(updateData[field]);
          console.log(`Adding field: ${field} = ${updateData[field]}`);
        }
      }

      if (updateData.email && updateData.email !== "") {
        fields.push("email = ?");
        values.push(updateData.email);
        console.log(`Adding field: email = ${updateData.email}`);
      }

      if (updateData.password && updateData.password !== "") {
        const hashedPassword = await bcrypt.hash(
          String(updateData.password),
          10,
        );
        fields.push("password_hash = ?");
        values.push(hashedPassword);
        console.log("Adding field: password_hash (hashed)");
      }

      if (fields.length === 0) {
        console.log("No fields to update after filtering");
        return false;
      }

      fields.push("updated_at = NOW()");
      values.push(id, tenantId);

      const query = `UPDATE staff SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`;
      console.log("Update Query:", query);
      console.log("Values:", values);

      const [result] = await db.query(query, values);
      console.log("Query Result:", result);
      console.log("Affected rows:", result.affectedRows);

      return result.affectedRows > 0;
    } catch (error) {
      console.error("Database update error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Soft delete staff member (just mark as deleted, not remove from database)
  static async deleteStaff(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid staff ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Hard delete - permanently remove from database
      await db.query("DELETE FROM staff WHERE id = ?", [Number(id)]);

      return true;
    } finally {
      await db.end();
    }
  }
  // Reset password
  static async resetPassword(id, tenantId, newPassword) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const hashedPassword = await bcrypt.hash(String(newPassword), 10);
      const [result] = await db.query(
        "UPDATE staff SET password_hash = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?",
        [hashedPassword, id, tenantId],
      );
      return result.affectedRows > 0;
    } finally {
      await db.end();
    }
  }

  // Check if email exists
  static async emailExists(email, tenantId, excludeId = null) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query =
        "SELECT id FROM staff WHERE email = ? AND tenant_id = ? AND deleted_at IS NULL";
      const params = [email, tenantId];

      if (excludeId) {
        query += " AND id != ?";
        params.push(excludeId);
      }

      const [rows] = await db.query(query, params);
      return rows.length > 0;
    } finally {
      await db.end();
    }
  }

  // Get staff statistics
  static async getStats(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
                    SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
                    COUNT(DISTINCT department) as total_departments
                FROM staff
                WHERE tenant_id = ? AND deleted_at IS NULL`,
        [tenantId],
      );
      return rows[0];
    } finally {
      await db.end();
    }
  }

  // Get staff by role
  static async getByRole(tenantId, roleId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT id, staff_code, first_name, last_name, email, phone, status
                FROM staff
                WHERE tenant_id = ? AND role_id = ? AND status = 'active' AND deleted_at IS NULL
                ORDER BY first_name, last_name`,
        [tenantId, roleId],
      );
      return rows;
    } finally {
      await db.end();
    }
  }

  // Get staff by department
  static async getByDepartment(tenantId, department) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT id, staff_code, first_name, last_name, email, phone, designation
                FROM staff
                WHERE tenant_id = ? AND department = ? AND status = 'active' AND deleted_at IS NULL
                ORDER BY first_name`,
        [tenantId, department],
      );
      return rows;
    } finally {
      await db.end();
    }
  }

  // Get all departments
  static async getDepartments(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT department 
                FROM staff 
                WHERE tenant_id = ? AND department IS NOT NULL AND deleted_at IS NULL
                ORDER BY department`,
        [tenantId],
      );
      return rows.map((r) => r.department);
    } finally {
      await db.end();
    }
  }

  // Get staff activity log
  static async getActivityLog(staffId, tenantId, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const page = pagination.page || 1;
      const limit = pagination.limit || 20;
      const offset = (page - 1) * limit;

      const [rows] = await db.query(
        `SELECT id, action, entity_type, entity_id, old_values, new_values, 
                       ip_address, user_agent, created_at
                FROM staff_activity_log
                WHERE staff_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?`,
        [staffId, parseInt(limit), parseInt(offset)],
      );

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM staff_activity_log WHERE staff_id = ?",
        [staffId],
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

  // Log activity
  // Log activity - FIXED
  static async logActivity(logData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(
      logData.tenant_id || 1,
    );
    try {
      // Make sure staff_id is not null
      const staffId = logData.staff_id || logData.user_id || null;

      if (!staffId) {
        console.log("Warning: staff_id is null, skipping activity log");
        return;
      }

      await db.query(
        `INSERT INTO staff_activity_log (
                staff_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          staffId,
          logData.action,
          logData.entity_type,
          logData.entity_id || null,
          logData.old_values || null,
          logData.new_values || null,
          logData.ip_address || null,
          logData.user_agent || null,
        ],
      );
    } catch (error) {
      console.error("Error logging activity:", error.message);
      // Don't throw error to prevent breaking the main operation
    } finally {
      await db.end();
    }
  }
}

module.exports = StaffService;
