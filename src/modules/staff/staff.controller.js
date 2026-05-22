const StaffService = require("./staff.service");
const ResponseUtil = require("../../utils/response");
const fs = require("fs");
const path = require("path");
const logger = require("../../config/logger");

class StaffController {
  // Get all staff members
  async getAllStaff(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const {
        role_id,
        status,
        department,
        search,
        page = 1,
        limit = 10,
      } = req.query;

      const filters = { role_id, status, department, search };
      const result = await StaffService.findAll(tenantId, filters, {
        page,
        limit,
      });
      const stats = await StaffService.getStats(tenantId);
      const departments = await StaffService.getDepartments(tenantId);

      return ResponseUtil.success(
        res,
        {
          staff: result.data,
          pagination: result.pagination,
          stats: stats,
          departments: departments,
        },
        "Staff members retrieved successfully",
      );
    } catch (error) {
      console.error("Get all staff error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve staff members",
        500,
        error.message,
      );
    }
  }

  // Create new staff member
  async createStaff(req, res) {
    try {
      console.log("=== CREATE STAFF ===");
      console.log("Body:", req.body);
      console.log("File:", req.file);

      const tenantId = req.user.tenant_id;

      // Extract form-data fields
      const {
        first_name,
        last_name,
        email,
        password,
        role_id,
        phone,
        department,
        designation,
        joining_date,
        address,
        city,
        state,
        country,
        zip_code,
        status,
      } = req.body;

      // Validate required fields
      if (!first_name) {
        return ResponseUtil.error(res, "First name is required", 400);
      }
      if (!last_name) {
        return ResponseUtil.error(res, "Last name is required", 400);
      }
      if (!email) {
        return ResponseUtil.error(res, "Email is required", 400);
      }
      if (!password) {
        return ResponseUtil.error(res, "Password is required", 400);
      }
      if (!role_id) {
        return ResponseUtil.error(res, "Role ID is required", 400);
      }

      // Check if email exists
      const emailExists = await StaffService.emailExists(email, tenantId);
      if (emailExists) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return ResponseUtil.error(res, "Email already exists", 400);
      }

      // Prepare staff data
      const staffData = {
        first_name,
        last_name,
        email,
        phone: phone || null,
        password: password,
        role_id: parseInt(role_id),
        department: department || null,
        designation: designation || null,
        joining_date: joining_date || null,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        zip_code: zip_code || null,
        tenant_id: tenantId,
        created_by: req.user.id,
        status: status || "active",
      };

      const staffId = await StaffService.create(staffData, req.file);
      const newStaff = await StaffService.findById(staffId, tenantId);

      // Log activity
      await StaffService.logActivity({
        staff_id: req.user.id,
        action: "STAFF_CREATE",
        entity_type: "staff",
        entity_id: staffId,
        new_values: JSON.stringify(staffData),
        ip_address: req.ip,
        tenant_id: tenantId,
      });

      return ResponseUtil.success(
        res,
        newStaff,
        "Staff member created successfully",
        201,
      );
    } catch (error) {
      console.error("Create staff error:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return ResponseUtil.error(
        res,
        error.message || "Failed to create staff member",
        500,
      );
    }
  }

  // Get staff by ID
  async getStaffById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const staff = await StaffService.findById(id, tenantId);

      if (!staff) {
        return ResponseUtil.notFound(res, "Staff member not found");
      }

      return ResponseUtil.success(
        res,
        staff,
        "Staff details retrieved successfully",
      );
    } catch (error) {
      console.error("Get staff by ID error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve staff details",
        500,
        error.message,
      );
    }
  }

  // Update staff member
  async updateStaff(req, res) {
    try {
      console.log("=== UPDATE STAFF CONTROLLER ===");
      console.log("Request params:", req.params);
      console.log("Request body:", req.body);
      console.log("Request file:", req.file);

      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      // Check if staff exists
      const staff = await StaffService.findById(id, tenantId);
      if (!staff) {
        return ResponseUtil.notFound(res, "Staff member not found");
      }

      // Prepare update data from both body and file
      const updateData = {};

      // Handle profile image if uploaded
      if (req.file) {
        // Save the profile image
        const profileImagePath = await StaffService.saveProfileImage(
          req.file,
          tenantId,
        );
        if (profileImagePath) {
          updateData.profile_image = profileImagePath;
        }
      }

      // Handle text fields
      const textFields = [
        "first_name",
        "last_name",
        "email",
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
      ];

      for (const field of textFields) {
        if (req.body[field] !== undefined && req.body[field] !== "") {
          updateData[field] = req.body[field];
        }
      }

      console.log("Update data prepared:", updateData);

      // Check if there's any data to update
      if (Object.keys(updateData).length === 0) {
        return ResponseUtil.error(
          res,
          "No data provided for update. Please provide at least one field to update.",
          400,
        );
      }

      // Convert role_id to number if present
      if (updateData.role_id) {
        updateData.role_id = parseInt(updateData.role_id);
      }

      // Check email uniqueness if changed
      if (updateData.email && updateData.email !== staff.email) {
        const emailExists = await StaffService.emailExists(
          updateData.email,
          tenantId,
          id,
        );
        if (emailExists) {
          // Clean up uploaded file if exists
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return ResponseUtil.error(res, "Email already exists", 400);
        }
      }

      const updated = await StaffService.update(id, tenantId, updateData);

      if (!updated) {
        return ResponseUtil.error(res, "Failed to update staff member", 500);
      }

      const updatedStaff = await StaffService.findById(id, tenantId);

      // Log activity
      await StaffService.logActivity({
        staff_id: req.user.id,
        action: "STAFF_UPDATE",
        entity_type: "staff",
        entity_id: parseInt(id),
        old_values: JSON.stringify(staff),
        new_values: JSON.stringify(updateData),
        ip_address: req.ip,
        tenant_id: tenantId,
      });

      return ResponseUtil.success(
        res,
        updatedStaff,
        "Staff member updated successfully",
      );
    } catch (error) {
      console.error("Update staff error:", error);
      return ResponseUtil.error(
        res,
        "Failed to update staff member",
        500,
        error.message,
      );
    }
  }

  // Soft delete staff member
  async deleteStaff(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid staff ID", 400);
      }

      await StaffService.deleteStaff(req.tenantId, id);

      return ResponseUtil.success(
        res,
        null,
        "Staff member deleted successfully",
      );
    } catch (error) {
      logger.error("Delete staff error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
  // Reset staff password
  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const { new_password } = req.body;

      const staff = await StaffService.findById(id, tenantId);
      if (!staff) {
        return ResponseUtil.notFound(res, "Staff member not found");
      }

      const reset = await StaffService.resetPassword(
        id,
        tenantId,
        new_password,
      );

      if (!reset) {
        return ResponseUtil.error(res, "Failed to reset password", 500);
      }

      // Log activity
      await StaffService.logActivity({
        staff_id: req.user.id,
        action: "STAFF_PASSWORD_RESET",
        entity_type: "staff",
        entity_id: id,
        ip_address: req.ip,
        tenant_id: tenantId,
      });

      return ResponseUtil.success(res, null, "Password reset successfully");
    } catch (error) {
      console.error("Reset password error:", error);
      return ResponseUtil.error(
        res,
        "Failed to reset password",
        500,
        error.message,
      );
    }
  }

  // Get staff activity log
  async getStaffActivity(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const { page = 1, limit = 20 } = req.query;

      const staff = await StaffService.findById(id, tenantId);
      if (!staff) {
        return ResponseUtil.notFound(res, "Staff member not found");
      }

      const activity = await StaffService.getActivityLog(id, tenantId, {
        page,
        limit,
      });

      return ResponseUtil.success(
        res,
        {
          staff: {
            id: staff.id,
            name: `${staff.first_name} ${staff.last_name}`,
          },
          activities: activity.data,
          pagination: activity.pagination,
        },
        "Staff activity retrieved successfully",
      );
    } catch (error) {
      console.error("Get staff activity error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve staff activity",
        500,
        error.message,
      );
    }
  }

  // Get staff statistics
  async getStaffStatistics(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const stats = await StaffService.getStats(tenantId);

      return ResponseUtil.success(
        res,
        stats,
        "Statistics retrieved successfully",
      );
    } catch (error) {
      console.error("Get staff statistics error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve statistics",
        500,
        error.message,
      );
    }
  }

  // Get staff by role
  async getStaffByRole(req, res) {
    try {
      const { roleId } = req.params;
      const tenantId = req.user.tenant_id;

      const staff = await StaffService.getByRole(tenantId, roleId);

      return ResponseUtil.success(
        res,
        staff,
        "Staff members retrieved successfully",
      );
    } catch (error) {
      console.error("Get staff by role error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve staff members",
        500,
        error.message,
      );
    }
  }

  // Get staff by department
  async getStaffByDepartment(req, res) {
    try {
      const { department } = req.params;
      const tenantId = req.user.tenant_id;

      const staff = await StaffService.getByDepartment(tenantId, department);

      return ResponseUtil.success(
        res,
        staff,
        "Staff members retrieved successfully",
      );
    } catch (error) {
      console.error("Get staff by department error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve staff members",
        500,
        error.message,
      );
    }
  }

  // Get all departments
  async getAllDepartments(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const departments = await StaffService.getDepartments(tenantId);

      return ResponseUtil.success(
        res,
        departments,
        "Departments retrieved successfully",
      );
    } catch (error) {
      console.error("Get departments error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve departments",
        500,
        error.message,
      );
    }
  }

  // Get staff by email
  async getStaffByEmail(req, res) {
    try {
      const { email } = req.params;
      const tenantId = req.user.tenant_id;

      if (!email) {
        return ResponseUtil.error(res, "Email is required", 400);
      }

      const staff = await StaffService.findByEmail(email, tenantId);

      if (!staff) {
        return ResponseUtil.notFound(res, "Staff member not found");
      }

      return ResponseUtil.success(res, staff, "Staff retrieved successfully");
    } catch (error) {
      console.error("Get staff by email error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve staff",
        500,
        error.message,
      );
    }
  }
}

module.exports = new StaffController();
