const DatabaseManager = require("../../services/database-manager.service");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

class StaffService {
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
    if (!staffData.tenant_id) {
      throw new Error("Tenant ID is required");
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
        created_by, status, pan_number, aadhaar_number,
        bank_name, account_number, ifsc_code, uan_number,
        esic_number, resignation_date, salary_type,
        base_salary, overtime_rate, target_amount, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
          staffData.created_by || null,
          staffData.status || "active",
          staffData.pan_number,
          staffData.aadhaar_number,
          staffData.bank_name,
          staffData.account_number,
          staffData.ifsc_code,
          staffData.uan_number,
          staffData.esic_number,
          staffData.resignation_date || null,
          staffData.salary_type,
          staffData.base_salary,
          staffData.overtime_rate,
          staffData.target_amount,
        ],
      );
      return result.insertId;
    } finally {
      await db.end();
    }
  }

  // ✅ FIXED: Get staff by ID - NO deleted_at
  static async findById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT s.*, r.name as role_name
        FROM staff s
        LEFT JOIN roles r ON s.role_id = r.id
        WHERE s.id = ? AND s.tenant_id = ?`,
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

  // ✅ FIXED: Get all staff - NO deleted_at
  static async findAll(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
      SELECT s.*, r.name as role_name
      FROM staff s
      LEFT JOIN roles r ON s.role_id = r.id
      WHERE s.tenant_id = ?
    `;
      const params = [tenantId];

      // REMOVE: AND s.deleted_at IS NULL

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
        query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR s.staff_code LIKE ?)`;
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
      let countQuery = `SELECT COUNT(*) as total FROM staff WHERE tenant_id = ?`;
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
        countQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR staff_code LIKE ?)`;
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

  static async update(id, staffData, profileImageFile = null, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let profileImagePath = null;
      if (profileImageFile) {
        profileImagePath = await this.saveProfileImage(
          profileImageFile,
          tenantId,
        );
      }

      // Build update query dynamically based on provided fields
      const updateFields = [];
      const values = [];

      // Basic Information
      if (
        staffData.first_name !== undefined &&
        staffData.first_name !== null &&
        staffData.first_name !== ""
      ) {
        updateFields.push("first_name = ?");
        values.push(staffData.first_name);
      }

      if (
        staffData.last_name !== undefined &&
        staffData.last_name !== null &&
        staffData.last_name !== ""
      ) {
        updateFields.push("last_name = ?");
        values.push(staffData.last_name);
      }

      if (
        staffData.email !== undefined &&
        staffData.email !== null &&
        staffData.email !== ""
      ) {
        updateFields.push("email = ?");
        values.push(staffData.email);
      }

      if (staffData.phone !== undefined && staffData.phone !== null) {
        updateFields.push("phone = ?");
        values.push(staffData.phone || null);
      }

      if (
        staffData.role_id !== undefined &&
        staffData.role_id !== null &&
        staffData.role_id !== ""
      ) {
        updateFields.push("role_id = ?");
        values.push(parseInt(staffData.role_id));
      }

      if (staffData.department !== undefined && staffData.department !== null) {
        updateFields.push("department = ?");
        values.push(staffData.department || null);
      }

      if (
        staffData.designation !== undefined &&
        staffData.designation !== null
      ) {
        updateFields.push("designation = ?");
        values.push(staffData.designation || null);
      }

      if (
        staffData.joining_date !== undefined &&
        staffData.joining_date !== null &&
        staffData.joining_date !== ""
      ) {
        updateFields.push("joining_date = ?");
        values.push(staffData.joining_date);
      }

      // Address Information
      if (staffData.address !== undefined && staffData.address !== null) {
        updateFields.push("address = ?");
        values.push(staffData.address || null);
      }

      if (staffData.city !== undefined && staffData.city !== null) {
        updateFields.push("city = ?");
        values.push(staffData.city || null);
      }

      if (staffData.state !== undefined && staffData.state !== null) {
        updateFields.push("state = ?");
        values.push(staffData.state || null);
      }

      if (staffData.country !== undefined && staffData.country !== null) {
        updateFields.push("country = ?");
        values.push(staffData.country || null);
      }

      if (staffData.zip_code !== undefined && staffData.zip_code !== null) {
        updateFields.push("zip_code = ?");
        values.push(staffData.zip_code || null);
      }

      // Employment Status
      if (
        staffData.status !== undefined &&
        staffData.status !== null &&
        staffData.status !== ""
      ) {
        updateFields.push("status = ?");
        values.push(staffData.status);
      }

      // Document Information
      if (staffData.pan_number !== undefined && staffData.pan_number !== null) {
        updateFields.push("pan_number = ?");
        values.push(staffData.pan_number || null);
      }

      if (
        staffData.aadhaar_number !== undefined &&
        staffData.aadhaar_number !== null
      ) {
        updateFields.push("aadhaar_number = ?");
        values.push(staffData.aadhaar_number || null);
      }

      // Banking Information
      if (staffData.bank_name !== undefined && staffData.bank_name !== null) {
        updateFields.push("bank_name = ?");
        values.push(staffData.bank_name || null);
      }

      if (
        staffData.account_number !== undefined &&
        staffData.account_number !== null
      ) {
        updateFields.push("account_number = ?");
        values.push(staffData.account_number || null);
      }

      if (staffData.ifsc_code !== undefined && staffData.ifsc_code !== null) {
        updateFields.push("ifsc_code = ?");
        values.push(staffData.ifsc_code || null);
      }

      // Social Security Information
      if (staffData.uan_number !== undefined && staffData.uan_number !== null) {
        updateFields.push("uan_number = ?");
        values.push(staffData.uan_number || null);
      }

      if (
        staffData.esic_number !== undefined &&
        staffData.esic_number !== null
      ) {
        updateFields.push("esic_number = ?");
        values.push(staffData.esic_number || null);
      }

      // Salary Information
      if (
        staffData.salary_type !== undefined &&
        staffData.salary_type !== null &&
        staffData.salary_type !== ""
      ) {
        updateFields.push("salary_type = ?");
        values.push(staffData.salary_type);
      }

      if (
        staffData.base_salary !== undefined &&
        staffData.base_salary !== null &&
        staffData.base_salary !== ""
      ) {
        updateFields.push("base_salary = ?");
        values.push(parseFloat(staffData.base_salary));
      }

      if (
        staffData.overtime_rate !== undefined &&
        staffData.overtime_rate !== null &&
        staffData.overtime_rate !== ""
      ) {
        updateFields.push("overtime_rate = ?");
        values.push(parseFloat(staffData.overtime_rate));
      }

      if (
        staffData.target_amount !== undefined &&
        staffData.target_amount !== null &&
        staffData.target_amount !== ""
      ) {
        updateFields.push("target_amount = ?");
        values.push(parseFloat(staffData.target_amount));
      }

      // Resignation Date
      if (
        staffData.resignation_date !== undefined &&
        staffData.resignation_date !== null &&
        staffData.resignation_date !== ""
      ) {
        updateFields.push("resignation_date = ?");
        values.push(staffData.resignation_date);
      }

      // Profile Image
      if (profileImagePath) {
        updateFields.push("profile_image = ?");
        values.push(profileImagePath);
      }

      // Always update the timestamp
      updateFields.push("updated_at = NOW()");

      // Check if there's anything to update
      if (updateFields.length === 1) {
        console.log("No fields to update");
        return false;
      }

      // Add WHERE clause parameters
      values.push(parseInt(id));
      values.push(tenantId);

      const query = `UPDATE staff SET ${updateFields.join(", ")} WHERE id = ? AND tenant_id = ?`;

      console.log("Update Query:", query);
      console.log("Values:", values);

      const [result] = await db.query(query, values);
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error in update method:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Soft delete staff member (just mark as deleted, not remove from database)
  // Hard delete method (permanent)
  static async hardDeleteStaff(tenantId, id) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
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

  static async emailExists(tenantId, email, excludeId = null) {
    if (!email) return false;

    const numericTenantId = parseInt(tenantId);
    if (isNaN(numericTenantId)) {
      throw new Error("Invalid tenant ID format");
    }

    try {
      const db =
        await DatabaseManager.getTenantDatabaseConnection(numericTenantId);
      try {
        let query = "SELECT id FROM staff WHERE email = ? AND tenant_id = ?";
        const params = [email.toLowerCase(), numericTenantId];

        if (excludeId) {
          query += " AND id != ?";
          params.push(parseInt(excludeId));
        }

        const [rows] = await db.query(query, params);
        return rows.length > 0;
      } finally {
        await db.end();
      }
    } catch (error) {
      console.error("Error checking email existence:", error.message);
      throw error;
    }
  }

  // ✅ FIXED: Get staff statistics - NO deleted_at
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
      WHERE tenant_id = ?`,
        [tenantId],
      );
      return rows[0];
    } finally {
      await db.end();
    }
  }

  // ✅ FIXED: Get staff by department - NO deleted_at
  static async getByDepartment(tenantId, department) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT id, staff_code, first_name, last_name, email, phone, designation
      FROM staff
      WHERE tenant_id = ? AND department = ? AND status = 'active'`,
        [tenantId, department],
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

  // ✅ FIXED: Get all departments - NO deleted_at
  static async getDepartments(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT department 
      FROM staff 
      WHERE tenant_id = ? AND department IS NOT NULL AND department != ''`,
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

  // ============ SALARY STRUCTURE METHODS ============

  static async createSalaryStructure(data, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        `INSERT INTO salary_structure (
          staff_id, effective_from, basic_salary, house_rent_allowance,
          travel_allowance, medical_allowance, special_allowance,
          other_allowances, pf_percent, esic_percent, professional_tax, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.staff_id,
          data.effective_from,
          data.basic_salary,
          data.house_rent_allowance || 0,
          data.travel_allowance || 0,
          data.medical_allowance || 0,
          data.special_allowance || 0,
          data.other_allowances || 0,
          data.pf_percent || 12,
          data.esic_percent || 0.75,
          data.professional_tax || 200,
          data.created_by,
        ],
      );
      return result.insertId;
    } finally {
      await db.end();
    }
  }

  static async getSalaryStructure(staffId, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT ss.*, 
              CONCAT(s.first_name, ' ', s.last_name) as staff_name,
              s.staff_code,
              s.first_name,
              s.last_name
       FROM salary_structure ss
       JOIN staff s ON ss.staff_id = s.id
       WHERE ss.staff_id = ? AND ss.effective_from <= CURDATE()
       ORDER BY ss.effective_from DESC LIMIT 1`,
        [staffId],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error in getSalaryStructure:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  static async getAllSalaryStructures(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
      SELECT ss.*, 
             CONCAT(s.first_name, ' ', s.last_name) as staff_name,
             s.staff_code,
             s.first_name,
             s.last_name
      FROM salary_structure ss
      JOIN staff s ON ss.staff_id = s.id
      WHERE 1=1
    `;
      const params = [];

      if (filters.staff_id) {
        query += " AND ss.staff_id = ?";
        params.push(filters.staff_id);
      }

      query += " ORDER BY ss.created_at DESC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM salary_structure ss WHERE 1=1`;
      const countParams = [];

      if (filters.staff_id) {
        countQuery += " AND ss.staff_id = ?";
        countParams.push(filters.staff_id);
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
    } catch (error) {
      console.error("Error in getAllSalaryStructures:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // ============ PAYROLL METHODS ============

  static async generatePayroll(staffId, month, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      await db.query("START TRANSACTION");

      // Get staff details
      const [staff] = await db.query(
        `SELECT id, first_name, last_name, staff_code, base_salary, overtime_rate, target_amount
       FROM staff 
       WHERE id = ? AND tenant_id = ?`,
        [staffId, tenantId],
      );

      if (!staff[0]) throw new Error("Staff not found");

      const baseSalary = parseFloat(staff[0].base_salary) || 0;
      const allowances = 0;
      const overtimeAmount = 0;
      const bonusAmount = 0;
      const incentiveAmount = 0;

      const totalEarnings =
        baseSalary +
        allowances +
        overtimeAmount +
        bonusAmount +
        incentiveAmount;

      const pfDeduction = totalEarnings * 0.12;
      const esicDeduction = totalEarnings * 0.0075;
      const professionalTax = 200;
      const totalDeductions = pfDeduction + esicDeduction + professionalTax;
      const netSalary = totalEarnings - totalDeductions;

      // Check if payroll already exists - ADDED tenant_id condition
      const [existing] = await db.query(
        "SELECT id FROM payroll WHERE staff_id = ? AND DATE_FORMAT(payroll_month, '%Y-%m') = ? AND tenant_id = ?",
        [staffId, month, tenantId],
      );

      let payrollId;

      if (existing.length > 0) {
        // Update existing payroll - ADDED tenant_id in WHERE clause
        await db.query(
          `UPDATE payroll SET
          base_salary = ?, 
          allowances = ?, 
          overtime_amount = ?,
          bonus_amount = ?, 
          incentive_amount = ?, 
          total_earnings = ?,
          pf_deduction = ?, 
          esic_deduction = ?, 
          professional_tax = ?,
          total_deductions = ?, 
          net_salary = ?, 
          updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
          [
            baseSalary,
            allowances,
            overtimeAmount,
            bonusAmount,
            incentiveAmount,
            totalEarnings,
            pfDeduction,
            esicDeduction,
            professionalTax,
            totalDeductions,
            netSalary,
            existing[0].id,
            tenantId,
          ],
        );
        payrollId = existing[0].id;
      } else {
        // Insert new payroll record - ADDED tenant_id
        const [result] = await db.query(
          `INSERT INTO payroll (
          staff_id, payroll_month, base_salary, allowances, 
          overtime_amount, bonus_amount, incentive_amount, total_earnings, 
          pf_deduction, esic_deduction, professional_tax, total_deductions, net_salary,
          tenant_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            staffId,
            `${month}-01`,
            baseSalary,
            allowances,
            overtimeAmount,
            bonusAmount,
            incentiveAmount,
            totalEarnings,
            pfDeduction,
            esicDeduction,
            professionalTax,
            totalDeductions,
            netSalary,
            tenantId,
          ],
        );
        payrollId = result.insertId;
      }

      await db.query("COMMIT");

      // Get the created payroll - ADDED tenant_id condition
      const [payroll] = await db.query(
        `SELECT p.*, s.first_name, s.last_name, s.staff_code
       FROM payroll p
       JOIN staff s ON p.staff_id = s.id
       WHERE p.id = ? AND p.tenant_id = ?`,
        [payrollId, tenantId],
      );

      return payroll[0];
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Generate payroll error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
  static async getPayrollById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [payroll] = await db.query(
        `SELECT p.*, 
              CONCAT(s.first_name, ' ', s.last_name) as staff_name,
              s.staff_code,
              s.first_name,
              s.last_name,
              s.email
       FROM payroll p
       JOIN staff s ON p.staff_id = s.id
       WHERE p.id = ? AND p.tenant_id = ?`,
        [id, tenantId],
      );
      return payroll[0] || null;
    } catch (error) {
      console.error("Error in getPayrollById:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  static async getAllPayrolls(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
      SELECT p.*, 
             CONCAT(s.first_name, ' ', s.last_name) as staff_name,
             s.staff_code,
             s.first_name,
             s.last_name
      FROM payroll p
      JOIN staff s ON p.staff_id = s.id
      WHERE p.tenant_id = ?
    `;
      const params = [tenantId];

      if (filters.staff_id) {
        query += " AND p.staff_id = ?";
        params.push(filters.staff_id);
      }

      if (filters.month) {
        query += " AND DATE_FORMAT(p.payroll_month, '%Y-%m') = ?";
        params.push(filters.month);
      }

      if (filters.status) {
        query += " AND p.payment_status = ?";
        params.push(filters.status);
      }

      query += " ORDER BY p.payroll_month DESC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM payroll p WHERE p.tenant_id = ?`;
      const countParams = [tenantId];

      if (filters.staff_id) {
        countQuery += " AND p.staff_id = ?";
        countParams.push(filters.staff_id);
      }

      if (filters.month) {
        countQuery += " AND DATE_FORMAT(p.payroll_month, '%Y-%m') = ?";
        countParams.push(filters.month);
      }

      if (filters.status) {
        countQuery += " AND p.payment_status = ?";
        countParams.push(filters.status);
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
    } catch (error) {
      console.error("Error in getAllPayrolls:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  static async processPayrollPayment(id, paymentData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      await db.query(
        `UPDATE payroll SET
          payment_status = ?,
          payment_date = ?,
          payment_mode = ?,
          transaction_id = ?,
          remarks = ?
         WHERE id = ?`,
        [
          paymentData.status,
          paymentData.payment_date,
          paymentData.payment_mode,
          paymentData.transaction_id,
          paymentData.remarks,
          id,
        ],
      );
      return true;
    } finally {
      await db.end();
    }
  }

  // ============ PAYSLIP METHODS ============

  static async getPayslipData(payrollId, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const [payslip] = await db.query(
        `SELECT 
        p.*,
        s.first_name,
        s.last_name,
        s.email,
        s.phone,
        s.staff_code,
        s.department,
        s.designation,
        s.joining_date,
        s.pan_number,
        s.aadhaar_number,
        s.bank_name,
        s.account_number,
        s.ifsc_code,
        s.uan_number,
        s.esic_number,
        s.address,
        s.city,
        s.state,
        s.zip_code,
        r.name as role_name
      FROM payroll p
      JOIN staff s ON p.staff_id = s.id
      LEFT JOIN roles r ON s.role_id = r.id
      WHERE p.id = ? AND p.tenant_id = ?`,
        [payrollId, tenantId],
      );

      if (!payslip[0]) {
        throw new Error("Payslip not found");
      }

      const result = payslip[0];

      // Add company information (customize these values)
      result.tenant_name = "Puja Gas Service";
      result.tenant_address = "123 Gas Road, Mumbai, Maharashtra - 400001";
      result.tenant_email = "info@pujagas.com";
      result.tenant_phone = "+91 22 1234 5678";

      return result;
    } catch (error) {
      console.error("Error in getPayslipData:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
  static async generateExcelPayslip(payrollId, tenantId) {
    const data = await this.getPayslipData(payrollId, tenantId);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Payslip");

    // Style configurations
    const titleStyle = {
      font: { size: 16, bold: true, color: { argb: "FFFFFFFF" } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF667eea" },
      },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    const headerStyle = {
      font: { bold: true, size: 11 },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F4FF" },
      },
      alignment: { horizontal: "left" },
    };

    const labelStyle = {
      font: { bold: true, size: 10 },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8F9FA" },
      },
    };

    const valueStyle = {
      font: { size: 10 },
      alignment: { horizontal: "left" },
    };

    const amountStyle = {
      font: { bold: true, size: 11 },
      alignment: { horizontal: "right" },
      numFmt: "#,##0.00",
    };

    // Set column widths
    worksheet.columns = [
      { width: 20 },
      { width: 30 },
      { width: 20 },
      { width: 20 },
    ];

    // Title
    worksheet.mergeCells("A1:D1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "SALARY PAYSLIP";
    titleCell.style = titleStyle;
    worksheet.getRow(1).height = 30;

    // Company Info
    worksheet.mergeCells("A2:D2");
    worksheet.getCell("A2").value = data.tenant_name || "Company Name";
    worksheet.getCell("A2").style = {
      font: { bold: true, size: 12 },
      alignment: { horizontal: "center" },
    };

    worksheet.mergeCells("A3:D3");
    worksheet.getCell("A3").value = data.tenant_address || "";
    worksheet.getCell("A3").style = {
      font: { size: 9 },
      alignment: { horizontal: "center" },
    };

    // Payroll Month
    worksheet.mergeCells("A4:D4");
    const month = new Date(data.payroll_month).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
    });
    worksheet.getCell("A4").value = `Payroll Month: ${month}`;
    worksheet.getCell("A4").style = {
      font: { bold: true, size: 11 },
      alignment: { horizontal: "center" },
    };

    // Employee Details Section
    worksheet.getRow(6).height = 20;
    worksheet.mergeCells("A6:D6");
    worksheet.getCell("A6").value = "EMPLOYEE DETAILS";
    worksheet.getCell("A6").style = headerStyle;

    const employeeDetails = [
      ["Employee Code", data.staff_code, "Department", data.department],
      [
        "Employee Name",
        `${data.first_name} ${data.last_name}`,
        "Designation",
        data.designation,
      ],
      [
        "Role",
        data.role_name,
        "Joining Date",
        data.joining_date
          ? new Date(data.joining_date).toLocaleDateString("en-IN")
          : "N/A",
      ],
      [
        "PAN Number",
        data.pan_number || "N/A",
        "Aadhaar Number",
        data.aadhaar_number || "N/A",
      ],
      ["Email", data.email, "Phone", data.phone],
      [
        "Address",
        `${data.address || ""}, ${data.city || ""}, ${data.state || ""} ${data.zip_code || ""}`,
        "",
        "",
      ],
    ];

    let rowNum = 7;
    employeeDetails.forEach((detail) => {
      worksheet.getCell(`A${rowNum}`).value = detail[0];
      worksheet.getCell(`A${rowNum}`).style = labelStyle;
      worksheet.getCell(`B${rowNum}`).value = detail[1];
      worksheet.getCell(`B${rowNum}`).style = valueStyle;
      worksheet.getCell(`C${rowNum}`).value = detail[2];
      worksheet.getCell(`C${rowNum}`).style = labelStyle;
      worksheet.getCell(`D${rowNum}`).value = detail[3];
      worksheet.getCell(`D${rowNum}`).style = valueStyle;
      rowNum++;
    });

    rowNum++;

    // Earnings Section
    worksheet.mergeCells(`A${rowNum}:D${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = "EARNINGS";
    worksheet.getCell(`A${rowNum}`).style = headerStyle;
    rowNum++;

    const earnings = [
      ["Basic Salary", data.base_salary || 0],
      ["Allowances", data.allowances || 0],
      ["Overtime Amount", data.overtime_amount || 0],
      ["Bonus Amount", data.bonus_amount || 0],
      ["Incentive Amount", data.incentive_amount || 0],
      ["Total Earnings", data.total_earnings || 0],
    ];

    earnings.forEach((earning) => {
      worksheet.getCell(`A${rowNum}`).value = earning[0];
      worksheet.getCell(`A${rowNum}`).style = labelStyle;
      worksheet.getCell(`B${rowNum}`).value = earning[1];
      worksheet.getCell(`B${rowNum}`).style = amountStyle;
      rowNum++;
    });

    rowNum++;

    // Deductions Section
    worksheet.mergeCells(`A${rowNum}:D${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = "DEDUCTIONS";
    worksheet.getCell(`A${rowNum}`).style = headerStyle;
    rowNum++;

    const deductions = [
      ["PF Deduction (12%)", data.pf_deduction || 0],
      ["ESIC Deduction (0.75%)", data.esic_deduction || 0],
      ["Professional Tax", data.professional_tax || 0],
      ["Total Deductions", data.total_deductions || 0],
    ];

    deductions.forEach((deduction) => {
      worksheet.getCell(`A${rowNum}`).value = deduction[0];
      worksheet.getCell(`A${rowNum}`).style = labelStyle;
      worksheet.getCell(`B${rowNum}`).value = deduction[1];
      worksheet.getCell(`B${rowNum}`).style = amountStyle;
      rowNum++;
    });

    rowNum++;

    // Net Salary
    worksheet.mergeCells(`A${rowNum}:B${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = "NET SALARY";
    worksheet.getCell(`A${rowNum}`).style = {
      font: { bold: true, size: 14 },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF667eea" },
      },
      alignment: { horizontal: "center" },
    };
    worksheet.mergeCells(`C${rowNum}:D${rowNum}`);
    worksheet.getCell(`C${rowNum}`).value = data.net_salary || 0;
    worksheet.getCell(`C${rowNum}`).style = {
      font: { bold: true, size: 14, color: { argb: "FF667eea" } },
      alignment: { horizontal: "right" },
      numFmt: "#,##0.00",
    };
    worksheet.getRow(rowNum).height = 25;

    rowNum += 2;

    // Payment Details
    worksheet.mergeCells(`A${rowNum}:D${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = "PAYMENT DETAILS";
    worksheet.getCell(`A${rowNum}`).style = headerStyle;
    rowNum++;

    const paymentStatus = data.payment_status
      ? data.payment_status.toUpperCase()
      : "PENDING";
    const paymentDetails = [
      ["Payment Status", paymentStatus],
      [
        "Payment Date",
        data.payment_date
          ? new Date(data.payment_date).toLocaleDateString("en-IN")
          : "Not Paid",
      ],
      ["Payment Mode", data.payment_mode || "N/A"],
      ["Transaction ID", data.transaction_id || "N/A"],
    ];

    paymentDetails.forEach((detail) => {
      worksheet.getCell(`A${rowNum}`).value = detail[0];
      worksheet.getCell(`A${rowNum}`).style = labelStyle;
      worksheet.getCell(`B${rowNum}`).value = detail[1];
      worksheet.getCell(`B${rowNum}`).style = valueStyle;
      rowNum++;
    });

    rowNum += 2;

    // Bank Details
    worksheet.mergeCells(`A${rowNum}:D${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = "BANK DETAILS";
    worksheet.getCell(`A${rowNum}`).style = headerStyle;
    rowNum++;

    const bankDetails = [
      ["Bank Name", data.bank_name || "N/A"],
      ["Account Number", data.account_number || "N/A"],
      ["IFSC Code", data.ifsc_code || "N/A"],
      ["UAN Number", data.uan_number || "N/A"],
      ["ESIC Number", data.esic_number || "N/A"],
    ];

    bankDetails.forEach((detail) => {
      worksheet.getCell(`A${rowNum}`).value = detail[0];
      worksheet.getCell(`A${rowNum}`).style = labelStyle;
      worksheet.getCell(`B${rowNum}`).value = detail[1];
      worksheet.getCell(`B${rowNum}`).style = valueStyle;
      rowNum++;
    });

    // Footer
    rowNum += 2;
    worksheet.mergeCells(`A${rowNum}:D${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value =
      "This is a computer-generated document. No signature required.";
    worksheet.getCell(`A${rowNum}`).style = {
      font: { size: 9, italic: true },
      alignment: { horizontal: "center" },
    };

    return workbook;
  }
  static async generatePDFPayslip(payrollId, tenantId) {
    const data = await this.getPayslipData(payrollId, tenantId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Colors
      const primaryColor = "#1e3a6f";
      const textColor = "#333333";
      const lightGray = "#f8f9fa";
      const borderColor = "#e2e8f0";
      const successColor = "#10b981";
      const warningColor = "#f59e0b";
      const dangerColor = "#ef4444";

      // Header Section
      doc.rect(50, 45, 515, 90).fill(primaryColor);
      doc.fillColor("white");
      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .text("SALARY PAYSLIP", 50, 65, { align: "center" });
      doc.fontSize(14).text(data.tenant_name || "Gas Agency ERP", 50, 95, {
        align: "center",
      });
      doc
        .fontSize(10)
        .text(data.tenant_address || "Corporate Office", 50, 115, {
          align: "center",
        });

      // Payroll Month
      const month = new Date(data.payroll_month).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
      });
      doc.fillColor(textColor);
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(`Payroll Month: ${month}`, 50, 155, { align: "center" });

      let yPosition = 195;

      // Employee Details Section
      doc.fillColor(primaryColor);
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .text("EMPLOYEE DETAILS", 50, yPosition);
      yPosition += 20;

      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(50, yPosition)
        .lineTo(565, yPosition)
        .stroke();
      yPosition += 12;

      doc.fillColor(textColor);
      doc.font("Helvetica").fontSize(10);

      // Employee details in two columns
      const employeeDetails = [
        { label: "Employee Code:", value: data.staff_code || "N/A", col: 1 },
        {
          label: "Employee Name:",
          value: `${data.first_name} ${data.last_name}`.trim(),
          col: 2,
        },
        { label: "Department:", value: data.department || "N/A", col: 1 },
        { label: "Designation:", value: data.designation || "N/A", col: 2 },
        { label: "Role:", value: data.role_name || "N/A", col: 1 },
        {
          label: "Joining Date:",
          value: data.joining_date
            ? new Date(data.joining_date).toLocaleDateString("en-IN")
            : "N/A",
          col: 2,
        },
        { label: "PAN Number:", value: data.pan_number || "N/A", col: 1 },
        {
          label: "Aadhaar Number:",
          value: data.aadhaar_number || "N/A",
          col: 2,
        },
        { label: "Email:", value: data.email || "N/A", col: 1 },
        { label: "Phone:", value: data.phone || "N/A", col: 2 },
      ];

      let col1Y = yPosition;
      let col2Y = yPosition;

      employeeDetails.forEach((detail) => {
        if (detail.col === 1) {
          doc.text(detail.label, 50, col1Y);
          doc.text(detail.value, 150, col1Y);
          col1Y += 20;
        } else {
          doc.text(detail.label, 300, col2Y);
          doc.text(detail.value, 400, col2Y);
          col2Y += 20;
        }
      });

      yPosition = Math.max(col1Y, col2Y);
      yPosition += 10;

      // Earnings Section
      doc.fillColor(primaryColor);
      doc.font("Helvetica-Bold").fontSize(14).text("EARNINGS", 50, yPosition);
      yPosition += 20;

      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(50, yPosition)
        .lineTo(565, yPosition)
        .stroke();
      yPosition += 12;

      doc.fillColor(textColor);
      doc.font("Helvetica");

      const earnings = [
        { label: "Basic Salary", value: data.base_salary || 0 },
        { label: "Allowances", value: data.allowances || 0 },
        { label: "Overtime Amount", value: data.overtime_amount || 0 },
        { label: "Bonus Amount", value: data.bonus_amount || 0 },
        { label: "Incentive Amount", value: data.incentive_amount || 0 },
      ];

      earnings.forEach((earning) => {
        doc.text(earning.label, 50, yPosition);
        doc.text(
          `₹ ${Number(earning.value).toLocaleString("en-IN")}`,
          500,
          yPosition,
          { align: "right" },
        );
        yPosition += 20;
      });

      doc.font("Helvetica-Bold");
      doc.text("Total Earnings", 50, yPosition);
      doc.text(
        `₹ ${Number(data.total_earnings || 0).toLocaleString("en-IN")}`,
        500,
        yPosition,
        { align: "right" },
      );
      yPosition += 30;

      // Deductions Section
      doc.fillColor(primaryColor);
      doc.font("Helvetica-Bold").fontSize(14).text("DEDUCTIONS", 50, yPosition);
      yPosition += 20;

      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(50, yPosition)
        .lineTo(565, yPosition)
        .stroke();
      yPosition += 12;

      doc.fillColor(textColor);
      doc.font("Helvetica");

      const deductions = [
        { label: "PF Deduction (12%)", value: data.pf_deduction || 0 },
        { label: "ESIC Deduction (0.75%)", value: data.esic_deduction || 0 },
        { label: "Professional Tax", value: data.professional_tax || 0 },
      ];

      deductions.forEach((deduction) => {
        doc.text(deduction.label, 50, yPosition);
        doc.text(
          `₹ ${Number(deduction.value).toLocaleString("en-IN")}`,
          500,
          yPosition,
          { align: "right" },
        );
        yPosition += 20;
      });

      doc.font("Helvetica-Bold");
      doc.text("Total Deductions", 50, yPosition);
      doc.text(
        `₹ ${Number(data.total_deductions || 0).toLocaleString("en-IN")}`,
        500,
        yPosition,
        { align: "right" },
      );
      yPosition += 35;

      // Net Salary Box
      const boxY = yPosition;
      doc.rect(50, boxY, 515, 55).fill(primaryColor);
      doc.fillColor("white");
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .text("NET SALARY", 50, boxY + 18);
      doc
        .fontSize(20)
        .text(
          `₹ ${Number(data.net_salary || 0).toLocaleString("en-IN")}`,
          500,
          boxY + 15,
          { align: "right" },
        );
      doc
        .fontSize(9)
        .text("(After all deductions and allowances)", 50, boxY + 40);
      yPosition += 75;

      // Payment Details Section
      doc.fillColor(primaryColor);
      doc.fontSize(14).text("PAYMENT DETAILS", 50, yPosition);
      yPosition += 20;

      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(50, yPosition)
        .lineTo(565, yPosition)
        .stroke();
      yPosition += 12;

      doc.fillColor(textColor);
      doc.fontSize(10);

      const paymentStatus = data.payment_status
        ? data.payment_status.toUpperCase()
        : "PENDING";
      let statusColor;
      if (paymentStatus === "PAID") statusColor = successColor;
      else if (paymentStatus === "PENDING") statusColor = warningColor;
      else statusColor = dangerColor;

      const paymentDetails = [
        { label: "Payment Status:", value: paymentStatus, color: statusColor },
        {
          label: "Payment Date:",
          value: data.payment_date
            ? new Date(data.payment_date).toLocaleDateString("en-IN")
            : "Not Paid",
          color: textColor,
        },
        {
          label: "Payment Mode:",
          value: data.payment_mode || "N/A",
          color: textColor,
        },
        {
          label: "Transaction ID:",
          value: data.transaction_id || "N/A",
          color: textColor,
        },
      ];

      paymentDetails.forEach((detail) => {
        doc.text(detail.label, 50, yPosition);
        if (detail.color !== textColor) {
          doc.fillColor(detail.color);
        }
        doc.text(detail.value, 170, yPosition);
        if (detail.color !== textColor) {
          doc.fillColor(textColor);
        }
        yPosition += 20;
      });

      yPosition += 10;

      // Bank Details Section
      doc.fillColor(primaryColor);
      doc.fontSize(14).text("BANK DETAILS", 50, yPosition);
      yPosition += 20;

      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(50, yPosition)
        .lineTo(565, yPosition)
        .stroke();
      yPosition += 12;

      doc.fillColor(textColor);
      doc.fontSize(10);

      // Check if any bank details exist
      const hasBankDetails =
        (data.bank_name && data.bank_name !== "N/A") ||
        (data.account_number && data.account_number !== "N/A") ||
        (data.ifsc_code && data.ifsc_code !== "N/A");

      if (hasBankDetails) {
        // Bank details in two columns
        const leftBankDetails = [
          { label: "Bank Name:", value: data.bank_name || "N/A" },
          { label: "Account Number:", value: data.account_number || "N/A" },
          { label: "IFSC Code:", value: data.ifsc_code || "N/A" },
        ];

        const rightBankDetails = [];
        if (data.branch_name)
          rightBankDetails.push({ label: "Branch:", value: data.branch_name });
        if (data.uan_number)
          rightBankDetails.push({
            label: "UAN Number:",
            value: data.uan_number,
          });
        if (data.esic_number)
          rightBankDetails.push({
            label: "ESIC Number:",
            value: data.esic_number,
          });

        let leftY = yPosition;
        let rightY = yPosition;

        leftBankDetails.forEach((detail) => {
          doc.text(detail.label, 50, leftY);
          doc.text(detail.value, 150, leftY);
          leftY += 20;
        });

        rightBankDetails.forEach((detail) => {
          doc.text(detail.label, 300, rightY);
          doc.text(detail.value, 400, rightY);
          rightY += 20;
        });

        yPosition = Math.max(leftY, rightY);
      } else {
        doc.fillColor("#999999");
        doc.text("No bank details available for this employee", 50, yPosition);
        doc.fillColor(textColor);
        yPosition += 20;
      }

      yPosition += 20;

      // Signature Section
      const pageHeight = doc.page.height;

      // Company Signature
      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(50, pageHeight - 100)
        .lineTo(250, pageHeight - 100)
        .stroke();
      doc.fillColor(textColor);
      doc.fontSize(9).text("Authorized Signatory", 50, pageHeight - 95);
      doc
        .fontSize(8)
        .fillColor("#666666")
        .text("(Company Seal)", 50, pageHeight - 85);

      // Employee Signature
      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(350, pageHeight - 100)
        .lineTo(565, pageHeight - 100)
        .stroke();
      doc.fillColor(textColor);
      doc.fontSize(9).text("Employee Signature", 350, pageHeight - 95);
      doc
        .fontSize(8)
        .fillColor("#666666")
        .text("(Acknowledgment of receipt)", 350, pageHeight - 85);

      // Footer
      doc.fillColor("#999999");
      doc
        .fontSize(8)
        .text(
          "This is a computer-generated document. No signature required for validation.",
          50,
          pageHeight - 50,
          { align: "center" },
        );

      // Page Number
      doc
        .fontSize(8)
        .text("Page 1 of 1", 500, pageHeight - 50, { align: "right" });

      doc.end();
    });
  }

  // ============ LEAVE METHODS ============

  // Mark leave as taken (when leave date has passed)
  // ============ LEAVE MANAGEMENT METHODS ============

  static async markLeaveDirectly(tenantId, staffId, leaveData, adminId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Check if staff exists
      const [staff] = await db.query(
        `SELECT id, first_name, last_name, staff_code FROM staff WHERE id = ? AND tenant_id = ?`,
        [staffId, tenantId],
      );

      if (!staff[0]) {
        throw new Error("Staff member not found");
      }

      // Check if leave already marked for this date
      const [existing] = await db.query(
        `SELECT id FROM staff_leaves WHERE staff_id = ? AND leave_date = ?`,
        [staffId, leaveData.leave_date],
      );

      if (existing.length > 0) {
        throw new Error(`Leave already marked for ${leaveData.leave_date}`);
      }

      // Insert leave record
      const [result] = await db.query(
        `INSERT INTO staff_leaves (
        staff_id, leave_date, leave_type, reason, marked_by
      ) VALUES (?, ?, ?, ?, ?)`,
        [
          staffId,
          leaveData.leave_date,
          leaveData.leave_type || "casual",
          leaveData.reason || null,
          adminId,
        ],
      );

      // Log activity
      await this.logActivity({
        staff_id: adminId,
        action: "LEAVE_MARKED",
        entity_type: "staff",
        entity_id: staffId,
        new_values: JSON.stringify({
          staff_name: `${staff[0].first_name} ${staff[0].last_name}`,
          leave_date: leaveData.leave_date,
          leave_type: leaveData.leave_type,
          reason: leaveData.reason,
        }),
        ip_address: null,
        tenant_id: tenantId,
      });

      return {
        id: result.insertId,
        staff_id: staffId,
        staff_name: `${staff[0].first_name} ${staff[0].last_name}`,
        staff_code: staff[0].staff_code,
        leave_date: leaveData.leave_date,
        leave_type: leaveData.leave_type,
        reason: leaveData.reason,
        marked_by: adminId,
      };
    } catch (error) {
      console.error("Error marking leave:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Get leave history for a staff member
  static async getStaffLeaveHistory(
    tenantId,
    staffId,
    filters = {},
    pagination = {},
  ) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
      SELECT 
        sl.*,
        CONCAT(s.first_name, ' ', s.last_name) as staff_name,
        s.staff_code,
        CONCAT(a.first_name, ' ', a.last_name) as marked_by_name
      FROM staff_leaves sl
      JOIN staff s ON sl.staff_id = s.id
      LEFT JOIN staff a ON sl.marked_by = a.id
      WHERE s.tenant_id = ?
    `;
      const params = [tenantId];

      if (staffId) {
        query += " AND sl.staff_id = ?";
        params.push(staffId);
      }

      if (filters.leave_type) {
        query += " AND sl.leave_type = ?";
        params.push(filters.leave_type);
      }

      if (filters.from_date) {
        query += " AND sl.leave_date >= ?";
        params.push(filters.from_date);
      }

      if (filters.to_date) {
        query += " AND sl.leave_date <= ?";
        params.push(filters.to_date);
      }

      query += " ORDER BY sl.leave_date DESC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM staff_leaves sl WHERE sl.staff_id IN (SELECT id FROM staff WHERE tenant_id = ?)`;
      const countParams = [tenantId];

      if (staffId) {
        countQuery = `SELECT COUNT(*) as total FROM staff_leaves WHERE staff_id = ?`;
        countParams.push(staffId);
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

  // Get leave summary for a staff member or all staff
  static async getLeaveSummary(tenantId, staffId = null, year = null) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const targetYear = year || new Date().getFullYear();

      let query = `
      SELECT 
        staff_id,
        CONCAT(s.first_name, ' ', s.last_name) as staff_name,
        s.staff_code,
        COUNT(*) as total_leaves,
        SUM(CASE WHEN leave_type = 'sick' THEN 1 ELSE 0 END) as sick_leaves,
        SUM(CASE WHEN leave_type = 'casual' THEN 1 ELSE 0 END) as casual_leaves,
        SUM(CASE WHEN leave_type = 'annual' THEN 1 ELSE 0 END) as annual_leaves,
        SUM(CASE WHEN leave_type = 'unpaid' THEN 1 ELSE 0 END) as unpaid_leaves,
        SUM(CASE WHEN leave_type = 'emergency' THEN 1 ELSE 0 END) as emergency_leaves
      FROM staff_leaves sl
      JOIN staff s ON sl.staff_id = s.id
      WHERE s.tenant_id = ? AND YEAR(sl.leave_date) = ?
    `;
      const params = [tenantId, targetYear];

      if (staffId) {
        query += " AND sl.staff_id = ?";
        params.push(staffId);
      }

      query += " GROUP BY sl.staff_id ORDER BY total_leaves DESC";

      const [rows] = await db.query(query, params);

      if (staffId && rows.length === 0) {
        return {
          staff_id: staffId,
          total_leaves: 0,
          sick_leaves: 0,
          casual_leaves: 0,
          annual_leaves: 0,
          unpaid_leaves: 0,
          emergency_leaves: 0,
        };
      }

      return staffId ? rows[0] : rows;
    } finally {
      await db.end();
    }
  }
  // ============ OVERTIME METHODS ============

  static async createOvertimeRequest(overtimeData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [staff] = await db.query(
        "SELECT overtime_rate, base_salary FROM staff WHERE id = ?",
        [overtimeData.staff_id],
      );

      const ratePerHour =
        overtimeData.rate_per_hour ||
        staff[0]?.overtime_rate ||
        staff[0]?.base_salary / (30 * 8);
      const amount = overtimeData.hours * ratePerHour;

      const [result] = await db.query(
        `INSERT INTO overtime_requests (
          staff_id, date, hours, rate_per_hour, amount, reason
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          overtimeData.staff_id,
          overtimeData.date,
          overtimeData.hours,
          ratePerHour,
          amount,
          overtimeData.reason,
        ],
      );
      return result.insertId;
    } finally {
      await db.end();
    }
  }

  static async updateOvertimeStatus(id, statusData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      await db.query(
        `UPDATE overtime_requests SET
          status = ?, approved_by = ?, approved_at = NOW(), remarks = ?
         WHERE id = ?`,
        [statusData.status, statusData.approved_by, statusData.remarks, id],
      );
      return true;
    } finally {
      await db.end();
    }
  }

  static async getOvertimeRequests(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
      SELECT o.*, 
             CONCAT(s.first_name, ' ', s.last_name) as staff_name,
             s.staff_code,
             CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
      FROM overtime_requests o
      JOIN staff s ON o.staff_id = s.id
      LEFT JOIN staff a ON o.approved_by = a.id
      WHERE 1=1
    `;
      const params = [];

      if (filters.staff_id) {
        query += " AND o.staff_id = ?";
        params.push(filters.staff_id);
      }
      if (filters.status) {
        query += " AND o.status = ?";
        params.push(filters.status);
      }
      if (filters.from_date) {
        query += " AND o.date >= ?";
        params.push(filters.from_date);
      }
      if (filters.to_date) {
        query += " AND o.date <= ?";
        params.push(filters.to_date);
      }

      query += " ORDER BY o.date DESC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM overtime_requests o WHERE 1=1`;
      const countParams = [];

      if (filters.staff_id) {
        countQuery += " AND o.staff_id = ?";
        countParams.push(filters.staff_id);
      }
      if (filters.status) {
        countQuery += " AND o.status = ?";
        countParams.push(filters.status);
      }
      if (filters.from_date) {
        countQuery += " AND o.date >= ?";
        countParams.push(filters.from_date);
      }
      if (filters.to_date) {
        countQuery += " AND o.date <= ?";
        countParams.push(filters.to_date);
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
    } catch (error) {
      console.error("Error in getOvertimeRequests:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // ============ DELETE OVERTIME REQUEST ============
  static async deleteOvertimeRequest(id, tenantId, userId = null) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Get overtime request details first
      const [overtime] = await db.query(
        `SELECT o.*, s.first_name, s.last_name, s.staff_code 
       FROM overtime_requests o
       JOIN staff s ON o.staff_id = s.id
       WHERE o.id = ?`,
        [id],
      );

      if (!overtime || overtime.length === 0) {
        throw new Error("Overtime request not found");
      }

      const request = overtime[0];

      // Prevent deletion of approved or paid requests
      if (request.status === "approved") {
        throw new Error("Cannot delete an approved overtime request");
      }
      if (request.status === "paid") {
        throw new Error("Cannot delete a paid overtime request");
      }

      // Log activity
      if (userId) {
        await this.logActivity({
          staff_id: userId,
          action: "OVERTIME_DELETE",
          entity_type: "overtime_request",
          entity_id: id,
          old_values: JSON.stringify({
            staff_id: request.staff_id,
            staff_name: `${request.first_name} ${request.last_name}`,
            date: request.date,
            hours: request.hours,
            amount: request.amount,
          }),
          tenant_id: tenantId,
        });
      }

      // Delete the overtime request
      await db.query("DELETE FROM overtime_requests WHERE id = ?", [id]);

      return true;
    } catch (error) {
      console.error("Error deleting overtime request:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  static async getOvertimeRequestById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT o.*, 
              CONCAT(s.first_name, ' ', s.last_name) as staff_name,
              s.staff_code,
              CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
       FROM overtime_requests o
       JOIN staff s ON o.staff_id = s.id
       LEFT JOIN staff a ON o.approved_by = a.id
       WHERE o.id = ?`,
        [id],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error getting overtime request by ID:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // ============ BONUS/INCENTIVE METHODS ============

  static async createBonus(bonusData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Format month to YYYY-MM-DD for DATE column, or keep as YYYY-MM for VARCHAR
      let formattedMonth = bonusData.month;

      // If your column is DATE type, add -01
      // If VARCHAR, keep as is
      if (bonusData.month && !bonusData.month.includes("-")) {
        formattedMonth = `${bonusData.month}-01`;
      }

      const [result] = await db.query(
        `INSERT INTO bonuses (
        staff_id, bonus_type, amount, month, reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          bonusData.staff_id,
          bonusData.bonus_type,
          bonusData.amount,
          formattedMonth,
          bonusData.reason,
          bonusData.created_by,
        ],
      );
      return result.insertId;
    } catch (error) {
      console.error("Error creating bonus:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
  static async updateBonusStatus(id, statusData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      await db.query(
        `UPDATE bonuses SET
          status = ?, approved_by = ?, approved_at = NOW(),
          paid_date = ?, remarks = ?
         WHERE id = ?`,
        [
          statusData.status,
          statusData.approved_by,
          statusData.paid_date,
          statusData.remarks,
          id,
        ],
      );
      return true;
    } finally {
      await db.end();
    }
  }

  static async getBonuses(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
      SELECT b.*, 
             CONCAT(s.first_name, ' ', s.last_name) as staff_name,
             s.staff_code,
             CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
      FROM bonuses b
      JOIN staff s ON b.staff_id = s.id
      LEFT JOIN staff a ON b.approved_by = a.id
      WHERE 1=1
    `;
      const params = [];

      if (filters.staff_id) {
        query += " AND b.staff_id = ?";
        params.push(filters.staff_id);
      }
      if (filters.bonus_type) {
        query += " AND b.bonus_type = ?";
        params.push(filters.bonus_type);
      }
      if (filters.status) {
        query += " AND b.status = ?";
        params.push(filters.status);
      }
      if (filters.month) {
        query += " AND DATE_FORMAT(b.month, '%Y-%m') = ?";
        params.push(filters.month);
      }

      query += " ORDER BY b.created_at DESC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM bonuses b WHERE 1=1`;
      const countParams = [];

      if (filters.staff_id) {
        countQuery += " AND b.staff_id = ?";
        countParams.push(filters.staff_id);
      }
      if (filters.bonus_type) {
        countQuery += " AND b.bonus_type = ?";
        countParams.push(filters.bonus_type);
      }
      if (filters.status) {
        countQuery += " AND b.status = ?";
        countParams.push(filters.status);
      }
      if (filters.month) {
        countQuery += " AND DATE_FORMAT(b.month, '%Y-%m') = ?";
        countParams.push(filters.month);
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
    } catch (error) {
      console.error("Error in getBonuses:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // services/staff.service.js

  // ✅ ADD THIS - Get bonus by ID
  static async getBonusById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT b.*, 
              CONCAT(s.first_name, ' ', s.last_name) as staff_name,
              s.staff_code,
              CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
       FROM bonuses b
       JOIN staff s ON b.staff_id = s.id
       LEFT JOIN staff a ON b.approved_by = a.id
       WHERE b.id = ?`,
        [id],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error getting bonus by ID:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // ✅ ADD THIS - Update bonus
  // services/staff.service.js - updateBonus method

  static async updateBonus(id, bonusData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Check if bonus exists
      const [existing] = await db.query("SELECT * FROM bonuses WHERE id = ?", [
        id,
      ]);

      if (!existing || existing.length === 0) {
        throw new Error("Bonus not found");
      }

      // Format month if provided
      let formattedMonth = bonusData.month;
      if (bonusData.month && !bonusData.month.includes("-")) {
        formattedMonth = `${bonusData.month}-01`;
      }

      const updates = [];
      const params = [];

      // ✅ Validate bonus_type length
      if (bonusData.bonus_type !== undefined) {
        // Trim and limit length if needed
        let bonusType = bonusData.bonus_type;
        if (bonusType && bonusType.length > 20) {
          bonusType = bonusType.substring(0, 20);
        }
        updates.push("bonus_type = ?");
        params.push(bonusType);
      }

      if (bonusData.amount !== undefined) {
        updates.push("amount = ?");
        params.push(bonusData.amount);
      }

      if (bonusData.month !== undefined) {
        updates.push("month = ?");
        params.push(formattedMonth);
      }

      if (bonusData.reason !== undefined) {
        updates.push("reason = ?");
        params.push(bonusData.reason || null);
      }

      if (updates.length === 0) {
        return true;
      }

      updates.push("updated_at = NOW()");
      params.push(id);

      const query = `UPDATE bonuses SET ${updates.join(", ")} WHERE id = ?`;
      console.log("Update Query:", query);
      console.log("Update Params:", params);

      await db.query(query, params);
      console.log("Bonus updated successfully");

      return true;
    } catch (error) {
      console.error("Error updating bonus:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
  // ==============================================
  // DELETE BONUS (NEW METHOD)
  // ==============================================
  static async deleteBonus(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Check if bonus exists
      const [existing] = await db.query("SELECT * FROM bonuses WHERE id = ?", [
        id,
      ]);

      if (!existing || existing.length === 0) {
        throw new Error("Bonus not found");
      }

      // Check if bonus is already paid (optional - prevent deletion of paid bonuses)
      if (existing[0].status === "paid") {
        throw new Error("Cannot delete a paid bonus");
      }

      await db.query("DELETE FROM bonuses WHERE id = ?", [id]);
      return true;
    } catch (error) {
      console.error("Error deleting bonus:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // ============ TARGET METHODS ============

  static async createStaffTarget(targetData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Format target_month to include day (first day of the month)
      const formattedMonth = targetData.target_month
        ? `${targetData.target_month}-01`
        : null;

      const [result] = await db.query(
        `INSERT INTO staff_targets (
        staff_id, target_month, target_type, target_amount, incentive_rate, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          targetData.staff_id,
          formattedMonth, // Use formatted date
          targetData.target_type,
          targetData.target_amount,
          targetData.incentive_rate,
          targetData.created_by,
        ],
      );
      return result.insertId;
    } catch (error) {
      console.error("Error creating target:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  static async updateTargetAchievement(id, achievementData, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [target] = await db.query(
        "SELECT staff_id, target_amount, incentive_rate FROM staff_targets WHERE id = ?",
        [id],
      );

      const achievementPercent =
        (achievementData.achieved_amount / target[0].target_amount) * 100;
      const incentiveAmount =
        (achievementData.achieved_amount * target[0].incentive_rate) / 100;

      let status = "pending";
      if (achievementPercent >= 100) status = "achieved";
      else if (achievementPercent >= 50) status = "partial";
      else status = "missed";

      await db.query(
        `UPDATE staff_targets SET
          achieved_amount = ?,
          achievement_percent = ?,
          incentive_amount = ?,
          status = ?
         WHERE id = ?`,
        [
          achievementData.achieved_amount,
          achievementPercent,
          incentiveAmount,
          status,
          id,
        ],
      );

      if (incentiveAmount > 0) {
        await db.query(
          `INSERT INTO bonuses (
            staff_id, bonus_type, amount, month, reason, created_by
          ) VALUES (?, 'incentive', ?, ?, ?, ?)`,
          [
            target[0].staff_id,
            incentiveAmount,
            achievementData.month,
            `Target incentive for ${achievementData.month}`,
            achievementData.created_by,
          ],
        );
      }
      return true;
    } finally {
      await db.end();
    }
  }

  static async getStaffTargets(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
      SELECT t.*, 
             CONCAT(s.first_name, ' ', s.last_name) as staff_name,
             s.staff_code
      FROM staff_targets t
      JOIN staff s ON t.staff_id = s.id
      WHERE 1=1
    `;
      const params = [];

      if (filters.staff_id) {
        query += " AND t.staff_id = ?";
        params.push(filters.staff_id);
      }
      if (filters.target_type) {
        query += " AND t.target_type = ?";
        params.push(filters.target_type);
      }
      if (filters.month) {
        query += " AND t.target_month = ?";
        params.push(filters.month);
      }
      if (filters.status) {
        query += " AND t.status = ?";
        params.push(filters.status);
      }

      query += " ORDER BY t.target_month DESC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM staff_targets t WHERE 1=1`;
      const countParams = [];

      if (filters.staff_id) {
        countQuery += " AND t.staff_id = ?";
        countParams.push(filters.staff_id);
      }
      if (filters.target_type) {
        countQuery += " AND t.target_type = ?";
        countParams.push(filters.target_type);
      }
      if (filters.month) {
        countQuery += " AND t.target_month = ?";
        countParams.push(filters.month);
      }
      if (filters.status) {
        countQuery += " AND t.status = ?";
        countParams.push(filters.status);
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
    } catch (error) {
      console.error("Error in getStaffTargets:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // ==============================================
  // DELETE STAFF TARGET
  // ==============================================
  static async deleteStaffTarget(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Check if target exists
      const [target] = await db.query(
        "SELECT id FROM staff_targets WHERE id = ?",
        [id],
      );

      if (target.length === 0) {
        return false;
      }

      // Delete the target
      const [result] = await db.query(
        "DELETE FROM staff_targets WHERE id = ?",
        [id],
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting target:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // ============ DASHBOARD STATISTICS ============

  static async getStaffDashboardStats(tenantId, month) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Payroll summary
      const [payrollStats] = await db.query(
        `SELECT 
        COALESCE(SUM(net_salary), 0) as total_salary,
        COUNT(*) as total_payrolls,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN net_salary ELSE 0 END), 0) as amount_paid,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN net_salary ELSE 0 END), 0) as amount_pending
       FROM payroll
       WHERE DATE_FORMAT(payroll_month, '%Y-%m') = ?`,
        [month],
      );

      // Staff Leave Summary (using staff_leaves table instead of leave_requests)
      const [leaveStats] = await db.query(
        `SELECT 
        COUNT(*) as total_leaves,
        COUNT(DISTINCT staff_id) as staff_on_leave,
        SUM(CASE WHEN leave_type = 'sick' THEN 1 ELSE 0 END) as sick_leaves,
        SUM(CASE WHEN leave_type = 'casual' THEN 1 ELSE 0 END) as casual_leaves,
        SUM(CASE WHEN leave_type = 'annual' THEN 1 ELSE 0 END) as annual_leaves,
        SUM(CASE WHEN leave_type = 'unpaid' THEN 1 ELSE 0 END) as unpaid_leaves,
        SUM(CASE WHEN leave_type = 'emergency' THEN 1 ELSE 0 END) as emergency_leaves
       FROM staff_leaves
       WHERE DATE_FORMAT(leave_date, '%Y-%m') = ?`,
        [month],
      );

      // Bonus summary
      const [bonusStats] = await db.query(
        `SELECT 
        COALESCE(SUM(CASE WHEN bonus_type = 'bonus' THEN amount ELSE 0 END), 0) as total_bonus,
        COALESCE(SUM(CASE WHEN bonus_type = 'incentive' THEN amount ELSE 0 END), 0) as total_incentive
       FROM bonuses
       WHERE DATE_FORMAT(month, '%Y-%m') = ? AND status = 'approved'`,
        [month],
      );

      // Overtime summary
      const [overtimeStats] = await db.query(
        `SELECT 
        COALESCE(SUM(hours), 0) as total_hours,
        COALESCE(SUM(amount), 0) as total_amount
       FROM overtime_requests
       WHERE DATE_FORMAT(date, '%Y-%m') = ? AND status = 'approved'`,
        [month],
      );

      // Target summary
      const [targetStats] = await db.query(
        `SELECT 
        COUNT(*) as total_targets,
        COALESCE(SUM(CASE WHEN status = 'achieved' THEN 1 ELSE 0 END), 0) as achieved,
        COALESCE(SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END), 0) as partial,
        COALESCE(SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END), 0) as missed
       FROM staff_targets
       WHERE target_month = ?`,
        [month],
      );

      return {
        payroll: payrollStats[0],
        leaves: leaveStats[0],
        bonuses: bonusStats[0],
        overtime: overtimeStats[0],
        targets: targetStats[0],
      };
    } catch (error) {
      console.error("Error in getStaffDashboardStats:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
}
module.exports = StaffService;
