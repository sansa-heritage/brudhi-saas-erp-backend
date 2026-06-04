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

      // 🔍 DEBUG: Log the first record to see all fields
      if (result.data && result.data.length > 0) {
        console.log("First staff record keys:", Object.keys(result.data[0]));
        console.log(
          "First staff record:",
          JSON.stringify(result.data[0], null, 2),
        );
      } else {
        console.log("No staff records found");
      }

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
  // async createStaff(req, res) {
  //   try {
  //     console.log("=== CREATE STAFF ===");
  //     console.log("Body:", req.body);
  //     console.log("File:", req.file);

  //     const tenantId = req.user.tenant_id;

  //     // Extract form-data fields
  //     const {
  //       first_name,
  //       last_name,
  //       email,
  //       password,
  //       role_id,
  //       phone,
  //       department,
  //       designation,
  //       joining_date,
  //       address,
  //       city,
  //       state,
  //       country,
  //       zip_code,
  //       status,
  //     } = req.body;

  //     // Validate required fields
  //     if (!first_name) {
  //       return ResponseUtil.error(res, "First name is required", 400);
  //     }
  //     if (!last_name) {
  //       return ResponseUtil.error(res, "Last name is required", 400);
  //     }
  //     if (!email) {
  //       return ResponseUtil.error(res, "Email is required", 400);
  //     }
  //     if (!password) {
  //       return ResponseUtil.error(res, "Password is required", 400);
  //     }
  //     if (!role_id) {
  //       return ResponseUtil.error(res, "Role ID is required", 400);
  //     }

  //     // Check if email exists
  //     const emailExists = await StaffService.emailExists(email, tenantId);
  //     if (emailExists) {
  //       if (req.file && fs.existsSync(req.file.path)) {
  //         fs.unlinkSync(req.file.path);
  //       }
  //       return ResponseUtil.error(res, "Email already exists", 400);
  //     }

  //     // Prepare staff data
  //     const staffData = {
  //       first_name,
  //       last_name,
  //       email,
  //       phone: phone || null,
  //       password: password,
  //       role_id: parseInt(role_id),
  //       department: department || null,
  //       designation: designation || null,
  //       joining_date: joining_date || null,
  //       address: address || null,
  //       city: city || null,
  //       state: state || null,
  //       country: country || null,
  //       zip_code: zip_code || null,
  //       tenant_id: tenantId,
  //       created_by: req.user.id,
  //       status: status || "active",
  //     };

  //     const staffId = await StaffService.create(staffData, req.file);
  //     const newStaff = await StaffService.findById(staffId, tenantId);

  //     // Log activity
  //     await StaffService.logActivity({
  //       staff_id: req.user.id,
  //       action: "STAFF_CREATE",
  //       entity_type: "staff",
  //       entity_id: staffId,
  //       new_values: JSON.stringify(staffData),
  //       ip_address: req.ip,
  //       tenant_id: tenantId,
  //     });

  //     return ResponseUtil.success(
  //       res,
  //       newStaff,
  //       "Staff member created successfully",
  //       201,
  //     );
  //   } catch (error) {
  //     console.error("Create staff error:", error);
  //     if (req.file && fs.existsSync(req.file.path)) {
  //       fs.unlinkSync(req.file.path);
  //     }
  //     return ResponseUtil.error(
  //       res,
  //       error.message || "Failed to create staff member",
  //       500,
  //     );
  //   }
  // }

  // Create new staff member
  // async createStaff(req, res) {
  //   try {
  //     console.log("=== CREATE STAFF ===");
  //     console.log("Body:", req.body);
  //     console.log("File:", req.file);

  //     const tenantId = req.user.tenant_id;

  //     if (!tenantId) {
  //       return ResponseUtil.error(
  //         res,
  //         "Tenant ID not found. Please login again.",
  //         401,
  //       );
  //     }

  //     // Extract form-data fields
  //     const {
  //       first_name,
  //       last_name,
  //       email,
  //       password,
  //       role_id,
  //       phone,
  //       department,
  //       designation,
  //       joining_date,
  //       address,
  //       city,
  //       state,
  //       country,
  //       zip_code,
  //       status,
  //     } = req.body;

  //     // Validate required fields
  //     if (!first_name)
  //       return ResponseUtil.error(res, "First name is required", 400);
  //     if (!last_name)
  //       return ResponseUtil.error(res, "Last name is required", 400);
  //     if (!email) return ResponseUtil.error(res, "Email is required", 400);
  //     if (!password)
  //       return ResponseUtil.error(res, "Password is required", 400);
  //     if (!role_id) return ResponseUtil.error(res, "Role ID is required", 400);

  //     // ✅ CORRECT: tenantId first, then email
  //     const emailExists = await StaffService.emailExists(tenantId, email);
  //     if (emailExists) {
  //       if (req.file && fs.existsSync(req.file.path)) {
  //         fs.unlinkSync(req.file.path);
  //       }
  //       return ResponseUtil.error(res, "Email already exists", 400);
  //     }

  //     // Prepare staff data
  //     const staffData = {
  //       first_name,
  //       last_name,
  //       email,
  //       phone: phone || null,
  //       password: password,
  //       role_id: parseInt(role_id),
  //       department: department || null,
  //       designation: designation || null,
  //       joining_date: joining_date || null,
  //       address: address || null,
  //       city: city || null,
  //       state: state || null,
  //       country: country || null,
  //       zip_code: zip_code || null,
  //       tenant_id: tenantId,
  //       created_by: req.user.id,
  //       status: status || "active",
  //     };

  //     const staffId = await StaffService.create(staffData, req.file);
  //     const newStaff = await StaffService.findById(staffId, tenantId);

  //     // Log activity
  //     await StaffService.logActivity({
  //       staff_id: req.user.id,
  //       action: "STAFF_CREATE",
  //       entity_type: "staff",
  //       entity_id: staffId,
  //       new_values: JSON.stringify(staffData),
  //       ip_address: req.ip,
  //       tenant_id: tenantId,
  //     });

  //     return ResponseUtil.success(
  //       res,
  //       newStaff,
  //       "Staff member created successfully",
  //       201,
  //     );
  //   } catch (error) {
  //     console.error("Create staff error:", error);
  //     if (req.file && fs.existsSync(req.file.path)) {
  //       fs.unlinkSync(req.file.path);
  //     }
  //     return ResponseUtil.error(
  //       res,
  //       error.message || "Failed to create staff member",
  //       500,
  //     );
  //   }
  // }

  async createStaff(req, res) {
    try {
      console.log("=== CREATE STAFF ===");
      console.log("Body:", req.body);
      console.log("File:", req.file);

      const tenantId = req.user.tenant_id;

      if (!tenantId) {
        return ResponseUtil.error(
          res,
          "Tenant ID not found. Please login again.",
          401,
        );
      }

      // Extract ALL form-data fields (including new ones)
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
        // New fields for staff management
        pan_number,
        aadhaar_number,
        bank_name,
        account_number,
        ifsc_code,
        uan_number,
        esic_number,
        resignation_date,
        salary_type,
        base_salary,
        overtime_rate,
        target_amount,
      } = req.body;

      // Validate required fields
      if (!first_name)
        return ResponseUtil.error(res, "First name is required", 400);
      if (!last_name)
        return ResponseUtil.error(res, "Last name is required", 400);
      if (!email) return ResponseUtil.error(res, "Email is required", 400);
      if (!password)
        return ResponseUtil.error(res, "Password is required", 400);
      if (!role_id) return ResponseUtil.error(res, "Role ID is required", 400);

      // Check if email exists
      const emailExists = await StaffService.emailExists(tenantId, email);
      if (emailExists) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return ResponseUtil.error(res, "Email already exists", 400);
      }

      // Prepare staff data with ALL fields
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
        // New fields
        pan_number: pan_number || null,
        aadhaar_number: aadhaar_number || null,
        bank_name: bank_name || null,
        account_number: account_number || null,
        ifsc_code: ifsc_code || null,
        uan_number: uan_number || null,
        esic_number: esic_number || null,
        resignation_date: resignation_date || null,
        salary_type: salary_type || "monthly",
        base_salary: base_salary ? parseFloat(base_salary) : 0,
        overtime_rate: overtime_rate ? parseFloat(overtime_rate) : 0,
        target_amount: target_amount ? parseFloat(target_amount) : 0,
      };

      const staffId = await StaffService.create(staffData, req.file);
      const newStaff = await StaffService.findById(staffId, tenantId);

      // Remove null values from response for cleaner output
      const cleanStaff = {};
      if (newStaff) {
        for (const [key, value] of Object.entries(newStaff)) {
          if (value !== null && value !== undefined) {
            cleanStaff[key] = value;
          }
        }
      }

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
        cleanStaff,
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
  // async updateStaff(req, res) {
  //   try {
  //     console.log("=== UPDATE STAFF CONTROLLER ===");
  //     console.log("Request params:", req.params);
  //     console.log("Request body:", req.body);
  //     console.log("Request file:", req.file);

  //     const { id } = req.params;
  //     const tenantId = req.user.tenant_id;

  //     // Check if staff exists
  //     const staff = await StaffService.findById(id, tenantId);
  //     if (!staff) {
  //       return ResponseUtil.notFound(res, "Staff member not found");
  //     }

  //     // Prepare update data from both body and file
  //     const updateData = {};

  //     // Handle profile image if uploaded
  //     if (req.file) {
  //       // Save the profile image
  //       const profileImagePath = await StaffService.saveProfileImage(
  //         req.file,
  //         tenantId,
  //       );
  //       if (profileImagePath) {
  //         updateData.profile_image = profileImagePath;
  //       }
  //     }

  //     // Handle text fields
  //     const textFields = [
  //       "first_name",
  //       "last_name",
  //       "email",
  //       "phone",
  //       "role_id",
  //       "department",
  //       "designation",
  //       "status",
  //       "address",
  //       "city",
  //       "state",
  //       "country",
  //       "zip_code",
  //     ];

  //     for (const field of textFields) {
  //       if (req.body[field] !== undefined && req.body[field] !== "") {
  //         updateData[field] = req.body[field];
  //       }
  //     }

  //     console.log("Update data prepared:", updateData);

  //     // Check if there's any data to update
  //     if (Object.keys(updateData).length === 0) {
  //       return ResponseUtil.error(
  //         res,
  //         "No data provided for update. Please provide at least one field to update.",
  //         400,
  //       );
  //     }

  //     // Convert role_id to number if present
  //     if (updateData.role_id) {
  //       updateData.role_id = parseInt(updateData.role_id);
  //     }

  //     // Check email uniqueness if changed
  //     if (updateData.email && updateData.email !== staff.email) {
  //       const emailExists = await StaffService.emailExists(
  //         updateData.email,
  //         tenantId,
  //         id,
  //       );
  //       if (emailExists) {
  //         // Clean up uploaded file if exists
  //         if (req.file && fs.existsSync(req.file.path)) {
  //           fs.unlinkSync(req.file.path);
  //         }
  //         return ResponseUtil.error(res, "Email already exists", 400);
  //       }
  //     }

  //     const updated = await StaffService.update(id, tenantId, updateData);

  //     if (!updated) {
  //       return ResponseUtil.error(res, "Failed to update staff member", 500);
  //     }

  //     const updatedStaff = await StaffService.findById(id, tenantId);

  //     // Log activity
  //     await StaffService.logActivity({
  //       staff_id: req.user.id,
  //       action: "STAFF_UPDATE",
  //       entity_type: "staff",
  //       entity_id: parseInt(id),
  //       old_values: JSON.stringify(staff),
  //       new_values: JSON.stringify(updateData),
  //       ip_address: req.ip,
  //       tenant_id: tenantId,
  //     });

  //     return ResponseUtil.success(
  //       res,
  //       updatedStaff,
  //       "Staff member updated successfully",
  //     );
  //   } catch (error) {
  //     console.error("Update staff error:", error);
  //     return ResponseUtil.error(
  //       res,
  //       "Failed to update staff member",
  //       500,
  //       error.message,
  //     );
  //   }
  // }

  // async updateStaff(req, res) {
  //   try {
  //     console.log("=== UPDATE STAFF CONTROLLER ===");
  //     console.log("Request params:", req.params);
  //     console.log("Request body:", req.body);
  //     console.log("Request file:", req.file);

  //     const { id } = req.params;
  //     const tenantId = req.user.tenant_id;

  //     // Check if staff exists
  //     const staff = await StaffService.findById(id, tenantId);
  //     if (!staff) {
  //       return ResponseUtil.notFound(res, "Staff member not found");
  //     }

  //     // Prepare update data from both body and file
  //     const updateData = {};

  //     // Handle profile image if uploaded
  //     if (req.file) {
  //       const profileImagePath = await StaffService.saveProfileImage(req.file, tenantId);
  //       if (profileImagePath) {
  //         updateData.profile_image = profileImagePath;
  //       }
  //     }

  //     // Handle text fields
  //     const textFields = [
  //       "first_name", "last_name", "email", "phone", "role_id",
  //       "department", "designation", "status", "address",
  //       "city", "state", "country", "zip_code"
  //     ];

  //     for (const field of textFields) {
  //       if (req.body[field] !== undefined && req.body[field] !== "") {
  //         updateData[field] = req.body[field];
  //       }
  //     }

  //     console.log("Update data prepared:", updateData);

  //     if (Object.keys(updateData).length === 0) {
  //       return ResponseUtil.error(res, "No data provided for update", 400);
  //     }

  //     // Convert role_id to number if present
  //     if (updateData.role_id) {
  //       updateData.role_id = parseInt(updateData.role_id);
  //     }

  //     // ✅ CORRECT: tenantId first, then email, then excludeId
  //     if (updateData.email && updateData.email !== staff.email) {
  //       const emailExists = await StaffService.emailExists(tenantId, updateData.email, id);
  //       if (emailExists) {
  //         if (req.file && fs.existsSync(req.file.path)) {
  //           fs.unlinkSync(req.file.path);
  //         }
  //         return ResponseUtil.error(res, "Email already exists", 400);
  //       }
  //     }

  //     const updated = await StaffService.update(id, tenantId, updateData);

  //     if (!updated) {
  //       return ResponseUtil.error(res, "Failed to update staff member", 500);
  //     }

  //     const updatedStaff = await StaffService.findById(id, tenantId);

  //     // Log activity
  //     await StaffService.logActivity({
  //       staff_id: req.user.id,
  //       action: "STAFF_UPDATE",
  //       entity_type: "staff",
  //       entity_id: parseInt(id),
  //       old_values: JSON.stringify(staff),
  //       new_values: JSON.stringify(updateData),
  //       ip_address: req.ip,
  //       tenant_id: tenantId,
  //     });

  //     return ResponseUtil.success(res, updatedStaff, "Staff member updated successfully");
  //   } catch (error) {
  //     console.error("Update staff error:", error);
  //     return ResponseUtil.error(res, "Failed to update staff member", 500, error.message);
  //   }
  // }

  // staff.controller.js - updateStaff method
  async updateStaff(req, res) {
    try {
      console.log("=== UPDATE STAFF CONTROLLER ===");
      console.log("Request params:", req.params);
      console.log("Request body:", req.body);
      console.log("Request file:", req.file);

      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      if (!tenantId) {
        return ResponseUtil.error(
          res,
          "Tenant ID not found. Please login again.",
          401,
        );
      }

      console.log("Staff ID to update:", id);
      console.log("Tenant ID:", tenantId);

      // Check if staff exists
      const staff = await StaffService.findById(id, tenantId);
      if (!staff) {
        return ResponseUtil.notFound(res, "Staff member not found");
      }

      // Extract all fields from request body
      const {
        first_name,
        last_name,
        email,
        phone,
        role_id,
        department,
        designation,
        joining_date,
        address,
        city,
        state,
        country,
        zip_code,
        status,
        pan_number,
        aadhaar_number,
        bank_name,
        account_number,
        ifsc_code,
        uan_number,
        esic_number,
        resignation_date,
        salary_type,
        base_salary,
        overtime_rate,
        target_amount,
      } = req.body;

      // Prepare update data (only include fields that are provided)
      const updateData = {};

      if (first_name !== undefined && first_name !== "")
        updateData.first_name = first_name;
      if (last_name !== undefined && last_name !== "")
        updateData.last_name = last_name;
      if (email !== undefined && email !== "") updateData.email = email;
      if (phone !== undefined) updateData.phone = phone || null;
      if (role_id !== undefined && role_id !== "")
        updateData.role_id = parseInt(role_id);
      if (department !== undefined) updateData.department = department || null;
      if (designation !== undefined)
        updateData.designation = designation || null;
      if (joining_date !== undefined && joining_date !== "")
        updateData.joining_date = joining_date;
      if (address !== undefined) updateData.address = address || null;
      if (city !== undefined) updateData.city = city || null;
      if (state !== undefined) updateData.state = state || null;
      if (country !== undefined) updateData.country = country || null;
      if (zip_code !== undefined) updateData.zip_code = zip_code || null;
      if (status !== undefined && status !== "") updateData.status = status;
      if (pan_number !== undefined) updateData.pan_number = pan_number || null;
      if (aadhaar_number !== undefined)
        updateData.aadhaar_number = aadhaar_number || null;
      if (bank_name !== undefined) updateData.bank_name = bank_name || null;
      if (account_number !== undefined)
        updateData.account_number = account_number || null;
      if (ifsc_code !== undefined) updateData.ifsc_code = ifsc_code || null;
      if (uan_number !== undefined) updateData.uan_number = uan_number || null;
      if (esic_number !== undefined)
        updateData.esic_number = esic_number || null;
      if (resignation_date !== undefined && resignation_date !== "")
        updateData.resignation_date = resignation_date;
      if (salary_type !== undefined && salary_type !== "")
        updateData.salary_type = salary_type;
      if (base_salary !== undefined && base_salary !== "")
        updateData.base_salary = parseFloat(base_salary);
      if (overtime_rate !== undefined && overtime_rate !== "")
        updateData.overtime_rate = parseFloat(overtime_rate);
      if (target_amount !== undefined && target_amount !== "")
        updateData.target_amount = parseFloat(target_amount);

      console.log("Update data prepared:", updateData);

      if (Object.keys(updateData).length === 0) {
        return ResponseUtil.error(res, "No data provided for update", 400);
      }

      // Check email uniqueness if changed
      if (updateData.email && updateData.email !== staff.email) {
        const emailExists = await StaffService.emailExists(
          tenantId,
          updateData.email,
          id,
        );
        if (emailExists) {
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return ResponseUtil.error(res, "Email already exists", 400);
        }
      }

      // Handle profile image if uploaded
      let profileImageFile = null;
      if (req.file) {
        profileImageFile = req.file;
      }

      // Call update service
      const updated = await StaffService.update(
        parseInt(id),
        updateData,
        profileImageFile,
        tenantId,
      );

      if (!updated) {
        return ResponseUtil.error(res, "Failed to update staff member", 500);
      }

      // Get updated staff data
      const updatedStaff = await StaffService.findById(id, tenantId);

      // Remove null values from response for cleaner output
      const cleanStaff = {};
      if (updatedStaff) {
        for (const [key, value] of Object.entries(updatedStaff)) {
          if (value !== null && value !== undefined) {
            cleanStaff[key] = value;
          }
        }
      }

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
        cleanStaff,
        "Staff member updated successfully",
      );
    } catch (error) {
      console.error("Update staff error:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return ResponseUtil.error(
        res,
        error.message || "Failed to update staff member",
        500,
      );
    }
  }

  // Soft delete staff member
  // staff.controller.js - Fixed deleteStaff
  async deleteStaff(req, res) {
    try {
      const id = Number(req.params.id);
      const tenantId = req.user.tenant_id; // ✅ Use req.user.tenant_id

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid staff ID", 400);
      }

      // ✅ Use the correct method name
      await StaffService.hardDeleteStaff(tenantId, id);

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
  async createSalaryStructure(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const data = { ...req.body, created_by: req.user.id };
      const id = await StaffService.createSalaryStructure(data, tenantId);
      return ResponseUtil.success(
        res,
        { id },
        "Salary structure created successfully",
        201,
      );
    } catch (error) {
      console.error("Create salary structure error:", error);
      return ResponseUtil.error(
        res,
        "Failed to create salary structure",
        500,
        error.message,
      );
    }
  }

  async getSalaryStructure(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { staffId } = req.params;
      const structure = await StaffService.getSalaryStructure(
        staffId,
        tenantId,
      );
      return ResponseUtil.success(
        res,
        structure,
        "Salary structure retrieved successfully",
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to retrieve salary structure",
        500,
        error.message,
      );
    }
  }

  async getAllSalaryStructures(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { page = 1, limit = 10, staff_id } = req.query;
      const result = await StaffService.getAllSalaryStructures(
        tenantId,
        { staff_id },
        { page, limit },
      );
      return ResponseUtil.success(
        res,
        result,
        "Salary structures retrieved successfully",
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to retrieve salary structures",
        500,
        error.message,
      );
    }
  }

  // ============ PAYROLL ============

  async generatePayroll(req, res) {
    try {
      const { staff_id, month } = req.body;
      const tenantId = req.user.tenant_id;

      if (!staff_id) {
        return ResponseUtil.error(res, "Staff ID is required", 400);
      }

      if (!month) {
        return ResponseUtil.error(
          res,
          "Month is required (format: YYYY-MM)",
          400,
        );
      }

      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return ResponseUtil.error(res, "Month must be in YYYY-MM format", 400);
      }

      const payroll = await StaffService.generatePayroll(
        staff_id,
        month,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        payroll,
        "Payroll generated successfully",
        201,
      );
    } catch (error) {
      console.error("Generate payroll error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to generate payroll",
        500,
      );
    }
  }

  async getAllPayrolls(req, res) {
    console.log("🔵 getAllPayrolls controller was called!");
    console.log("Request URL:", req.originalUrl);
    console.log("Request params:", req.params);
    console.log("Request query:", req.query);
    console.log("User:", req.user);

    try {
      const tenantId = req.user.tenant_id;
      console.log("Tenant ID:", tenantId);

      const { page = 1, limit = 10, staff_id, month, status } = req.query;

      const result = await StaffService.getAllPayrolls(
        tenantId,
        { staff_id, month, status },
        // console.log(result),
        { page: parseInt(page), limit: parseInt(limit) },
      );

      console.log("Result found:", result.data.length);

      return ResponseUtil.success(
        res,
        result,
        "Payrolls retrieved successfully",
      );
    } catch (error) {
      console.error("Get all payrolls error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to retrieve payrolls",
        500,
        error.message,
      );
    }
  }

  async getPayrollById(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;
      const payroll = await StaffService.getPayrollById(id, tenantId);
      if (!payroll) return ResponseUtil.notFound(res, "Payroll not found");
      return ResponseUtil.success(
        res,
        payroll,
        "Payroll retrieved successfully",
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to retrieve payroll",
        500,
        error.message,
      );
    }
  }

  async processPayrollPayment(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;
      await StaffService.processPayrollPayment(id, req.body, tenantId);
      return ResponseUtil.success(res, null, "Payment processed successfully");
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to process payment",
        500,
        error.message,
      );
    }
  }

  // ============ PAYSLIP DOWNLOAD METHODS ============

  async downloadExcelPayslip(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const workbook = await StaffService.generateExcelPayslip(id, tenantId);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=payslip_${id}_${Date.now()}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Download Excel payslip error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to generate Excel payslip",
        500,
      );
    }
  }

  // StaffController.js - Complete downloadPDFPayslip method

  async downloadPDFPayslip(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers["x-tenant-id"];

      console.log(
        `Downloading payslip for payroll ID: ${id}, Tenant: ${tenantId}`,
      );

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: "Tenant ID is required",
        });
      }

      // Generate PDF buffer
      const pdfBuffer = await StaffService.generatePDFPayslip(id, tenantId);

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("Generated PDF is empty");
      }

      console.log(
        `PDF generated successfully, size: ${pdfBuffer.length} bytes`,
      );

      // Get payroll data for filename
      const payrollData = await StaffService.getPayslipData(id, tenantId);
      const month = new Date(payrollData.payroll_month).toLocaleDateString(
        "en-IN",
        {
          year: "numeric",
          month: "long",
        },
      );
      const filename = `payslip_${payrollData.staff_code}_${month.replace(/ /g, "_")}.pdf`;

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.setHeader("Cache-Control", "no-cache");

      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error downloading PDF payslip:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate PDF payslip",
      });
    }
  }

  async viewPDFPayslip(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const pdfBuffer = await StaffService.generatePDFPayslip(id, tenantId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=payslip_${id}.pdf`,
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error("View PDF payslip error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to generate PDF payslip",
        500,
      );
    }
  }

  // ============ LEAVE MANAGEMENT CONTROLLERS ============

  async markLeaveDirectly(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { staff_id, leave_date, leave_type, reason } = req.body;
      const adminId = req.user.id;

      // Validate required fields
      if (!staff_id) {
        return ResponseUtil.error(res, "Staff ID is required", 400);
      }

      if (!leave_date) {
        return ResponseUtil.error(res, "Leave date is required", 400);
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(leave_date)) {
        return ResponseUtil.error(
          res,
          "Leave date must be in YYYY-MM-DD format",
          400,
        );
      }

      // Validate leave type
      const validLeaveTypes = [
        "sick",
        "casual",
        "annual",
        "unpaid",
        "emergency",
      ];
      if (leave_type && !validLeaveTypes.includes(leave_type)) {
        return ResponseUtil.error(
          res,
          `Invalid leave type. Allowed: ${validLeaveTypes.join(", ")}`,
          400,
        );
      }

      const result = await StaffService.markLeaveDirectly(
        tenantId,
        staff_id,
        { leave_date, leave_type, reason },
        adminId,
      );

      return ResponseUtil.success(
        res,
        result,
        "Leave marked successfully for staff member",
      );
    } catch (error) {
      console.error("Mark leave error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to mark leave",
        500,
      );
    }
  }

  async getStaffLeaveHistory(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { staff_id } = req.params;
      const {
        leave_type,
        from_date,
        to_date,
        page = 1,
        limit = 10,
      } = req.query;

      const result = await StaffService.getStaffLeaveHistory(
        tenantId,
        staff_id,
        { leave_type, from_date, to_date },
        { page, limit },
      );

      return ResponseUtil.success(
        res,
        result,
        "Leave history retrieved successfully",
      );
    } catch (error) {
      console.error("Get leave history error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to retrieve leave history",
        500,
      );
    }
  }

  async getLeaveSummary(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { staff_id, year } = req.query;

      const summary = await StaffService.getLeaveSummary(
        tenantId,
        staff_id,
        year,
      );

      return ResponseUtil.success(
        res,
        summary,
        "Leave summary retrieved successfully",
      );
    } catch (error) {
      console.error("Get leave summary error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to retrieve leave summary",
        500,
      );
    }
  }
  // ============ OVERTIME REQUESTS ============

  async createOvertimeRequest(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const overtimeId = await StaffService.createOvertimeRequest(
        req.body,
        tenantId,
      );
      return ResponseUtil.success(
        res,
        { id: overtimeId },
        "Overtime request created successfully",
        201,
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to create overtime request",
        500,
        error.message,
      );
    }
  }

  async updateOvertimeStatus(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;
      const statusData = { ...req.body, approved_by: req.user.id };
      await StaffService.updateOvertimeStatus(id, statusData, tenantId);
      return ResponseUtil.success(
        res,
        null,
        `Overtime ${statusData.status} successfully`,
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to update overtime status",
        500,
        error.message,
      );
    }
  }

  async getOvertimeRequests(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const {
        page = 1,
        limit = 10,
        staff_id,
        status,
        from_date,
        to_date,
      } = req.query;
      const result = await StaffService.getOvertimeRequests(
        tenantId,
        { staff_id, status, from_date, to_date },
        { page, limit },
      );
      return ResponseUtil.success(
        res,
        result,
        "Overtime requests retrieved successfully",
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to retrieve overtime requests",
        500,
        error.message,
      );
    }
  }

  // ============ DELETE OVERTIME REQUEST ============
  // StaffController.js

  // ============ DELETE OVERTIME REQUEST ============
  async deleteOvertimeRequest(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid overtime request ID", 400);
      }

      await StaffService.deleteOvertimeRequest(id, tenantId, req.user.id);

      return ResponseUtil.success(
        res,
        null,
        "Overtime request deleted successfully",
      );
    } catch (error) {
      console.error("Delete overtime request error:", error);

      if (error.message === "Overtime request not found") {
        return ResponseUtil.error(res, error.message, 404);
      }
      if (error.message.includes("Cannot delete")) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(
        res,
        "Failed to delete overtime request",
        500,
        error.message,
      );
    }
  }

  // ============ GET OVERTIME REQUEST BY ID ============
  async getOvertimeRequestById(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid overtime request ID", 400);
      }

      const overtime = await StaffService.getOvertimeRequestById(id, tenantId);

      if (!overtime) {
        return ResponseUtil.notFound(res, "Overtime request not found");
      }

      return ResponseUtil.success(
        res,
        overtime,
        "Overtime request retrieved successfully",
      );
    } catch (error) {
      console.error("Get overtime request by ID error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve overtime request",
        500,
        error.message,
      );
    }
  }
  // ============ BONUSES ============

  async createBonus(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const bonusData = { ...req.body, created_by: req.user.id };
      const bonusId = await StaffService.createBonus(bonusData, tenantId);
      return ResponseUtil.success(
        res,
        { id: bonusId },
        "Bonus created successfully",
        201,
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to create bonus",
        500,
        error.message,
      );
    }
  }

  async updateBonusStatus(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;
      const statusData = { ...req.body, approved_by: req.user.id };
      await StaffService.updateBonusStatus(id, statusData, tenantId);
      return ResponseUtil.success(
        res,
        null,
        `Bonus ${statusData.status} successfully`,
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to update bonus status",
        500,
        error.message,
      );
    }
  }

  async getBonuses(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const {
        page = 1,
        limit = 10,
        staff_id,
        bonus_type,
        status,
        month,
      } = req.query;
      const result = await StaffService.getBonuses(
        tenantId,
        { staff_id, bonus_type, status, month },
        { page, limit },
      );
      return ResponseUtil.success(
        res,
        result,
        "Bonuses retrieved successfully",
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to retrieve bonuses",
        500,
        error.message,
      );
    }
  }

  // controllers/staff.controller.js

  // ✅ ADD THIS - Get bonus by ID
  async getBonusById(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid bonus ID", 400);
      }

      const bonus = await StaffService.getBonusById(id, tenantId);

      if (!bonus) {
        return ResponseUtil.notFound(res, "Bonus not found");
      }

      return ResponseUtil.success(res, bonus, "Bonus retrieved successfully");
    } catch (error) {
      logger.error("Get bonus by ID error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve bonus",
        500,
        error.message,
      );
    }
  }

  // ✅ ADD THIS - Update bonus
  async updateBonus(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid bonus ID", 400);
      }

      await StaffService.updateBonus(id, req.body, tenantId);
      const updatedBonus = await StaffService.getBonusById(id, tenantId);

      return ResponseUtil.success(
        res,
        updatedBonus,
        "Bonus updated successfully",
      );
    } catch (error) {
      logger.error("Update bonus error:", error);

      if (error.message === "Bonus not found") {
        return ResponseUtil.error(res, error.message, 404);
      }
      return ResponseUtil.error(
        res,
        "Failed to update bonus",
        500,
        error.message,
      );
    }
  }
  // ✅ ADD THIS - Delete bonus
  async deleteBonus(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid bonus ID", 400);
      }

      await StaffService.deleteBonus(id, tenantId);

      return ResponseUtil.success(res, null, "Bonus deleted successfully");
    } catch (error) {
      logger.error("Delete bonus error:", error);

      if (error.message === "Bonus not found") {
        return ResponseUtil.error(res, error.message, 404);
      }
      if (error.message === "Cannot delete a paid bonus") {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(
        res,
        "Failed to delete bonus",
        500,
        error.message,
      );
    }
  }

  // ============ STAFF TARGETS ============

  async createStaffTarget(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const targetData = { ...req.body, created_by: req.user.id };
      const targetId = await StaffService.createStaffTarget(
        targetData,
        tenantId,
      );
      return ResponseUtil.success(
        res,
        { id: targetId },
        "Target created successfully",
        201,
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to create target",
        500,
        error.message,
      );
    }
  }

  async updateTargetAchievement(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;
      const achievementData = { ...req.body, created_by: req.user.id };
      await StaffService.updateTargetAchievement(id, achievementData, tenantId);
      return ResponseUtil.success(
        res,
        null,
        "Target achievement updated successfully",
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to update target achievement",
        500,
        error.message,
      );
    }
  }

  async getStaffTargets(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const {
        page = 1,
        limit = 10,
        staff_id,
        target_type,
        month,
        status,
      } = req.query;
      const result = await StaffService.getStaffTargets(
        tenantId,
        { staff_id, target_type, month, status },
        { page, limit },
      );
      return ResponseUtil.success(
        res,
        result,
        "Targets retrieved successfully",
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to retrieve targets",
        500,
        error.message,
      );
    }
  }
  // ==============================================
  // DELETE STAFF TARGET - USING SERVICE
  // ==============================================
  async deleteStaffTargets(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid target ID", 400);
      }

      // You need to add this method to your StaffService
      // For now, let's call a service method
      const deleted = await StaffService.deleteStaffTarget(id, tenantId);

      if (!deleted) {
        return ResponseUtil.notFound(res, "Target not found");
      }

      return ResponseUtil.success(res, null, "Target deleted successfully");
    } catch (error) {
      console.error("Delete target error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to delete target",
        500,
      );
    }
  }
  // ============ DASHBOARD STATISTICS ============

  async getStaffDashboardStats(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { month = new Date().toISOString().slice(0, 7) } = req.query;
      const stats = await StaffService.getStaffDashboardStats(tenantId, month);
      return ResponseUtil.success(
        res,
        { ...stats, month },
        "Dashboard statistics retrieved successfully",
      );
    } catch (error) {
      return ResponseUtil.error(
        res,
        "Failed to retrieve dashboard statistics",
        500,
        error.message,
      );
    }
  }
}

module.exports = new StaffController();
