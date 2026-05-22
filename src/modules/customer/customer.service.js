const DatabaseManager = require("../../services/database-manager.service");

class CustomerService {
  async getAllCustomers(tenantId, filters = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      let query = "SELECT * FROM customers WHERE 1=1";
      const params = [];

      if (filters.status) {
        query += " AND status = ?";
        params.push(filters.status);
      }

      if (filters.search) {
        query += " AND (name LIKE ? OR mobile LIKE ? OR email LIKE ?)";
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (filters.customerType) {
        query += " AND customer_type = ?";
        params.push(filters.customerType);
      }

      query += " ORDER BY name ASC";

      const page = Number(filters.page) || 1;
      const limit = Math.min(100, Number(filters.limit) || 10);
      const offset = (page - 1) * limit;

      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [customers] = await db.query(query, params);

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM customers",
      );

      const total = countResult[0]?.total || 0;

      return {
        data: customers,
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

  async getCustomerById(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid customer ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const [customers] = await db.query(
        "SELECT * FROM customers WHERE id = ?",
        [Number(id)],
      );

      return customers[0] || null;
    } finally {
      await db.end();
    }
  }

  async createCustomer(tenantId, customerData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const timestamp = Date.now();
      const customerCode = `CUST_${timestamp}`;

      const [result] = await db.query(
        `INSERT INTO customers (
          customer_code, name, email, mobile, alternate_mobile,
          country_id, state_id, city_id, pincode_id, address,
          gst_number, pan_number, aadhaar_number,
          customer_type, credit_limit, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerCode,
          customerData.name,
          customerData.email,
          customerData.mobile,
          customerData.alternateMobile || null,
          customerData.countryId || null,
          customerData.stateId || null,
          customerData.cityId || null,
          customerData.pincodeId || null,
          customerData.address || null,
          customerData.gstNumber || null,
          customerData.panNumber || null,
          customerData.aadhaarNumber || null,
          customerData.customerType || "regular",
          customerData.creditLimit || 0,
          customerData.createdBy,
        ],
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }

  async updateCustomer(tenantId, id, customerData) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid customer ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Check if customer exists
      const [existing] = await db.query(
        "SELECT id, email FROM customers WHERE id = ?",
        [Number(id)],
      );

      if (existing.length === 0) {
        throw new Error("Customer not found");
      }

      // Check email uniqueness if email is being changed
      const newEmail = customerData.email || customerData.email;
      if (newEmail && newEmail !== existing[0].email) {
        const [emailCheck] = await db.query(
          "SELECT id FROM customers WHERE email = ? AND id != ?",
          [newEmail, Number(id)],
        );
        if (emailCheck.length > 0) {
          throw new Error("Email already exists");
        }
      }

      const updates = [];
      const params = [];

      // ✅ Define all updatable fields with support for both naming conventions
      const fieldMappings = [
        // Basic fields
        { dbField: "name", reqFields: ["name"] },
        { dbField: "company_name", reqFields: ["company_name", "companyName"] },
        { dbField: "email", reqFields: ["email"] },
        { dbField: "mobile", reqFields: ["mobile"] },
        {
          dbField: "alternate_mobile",
          reqFields: ["alternate_mobile", "alternateMobile"],
        },

        // Address fields
        { dbField: "address", reqFields: ["address"] },
        { dbField: "landmark", reqFields: ["landmark"] },

        // Location fields - CRITICAL: Map camelCase to snake_case
        { dbField: "country_id", reqFields: ["country_id", "countryId"] },
        { dbField: "state_id", reqFields: ["state_id", "stateId"] },
        { dbField: "city_id", reqFields: ["city_id", "cityId"] },
        { dbField: "pincode_id", reqFields: ["pincode_id", "pincodeId"] },

        // Tax fields
        { dbField: "gst_number", reqFields: ["gst_number", "gstNumber"] },
        { dbField: "pan_number", reqFields: ["pan_number", "panNumber"] },
        {
          dbField: "aadhaar_number",
          reqFields: ["aadhaar_number", "aadhaarNumber"],
        },

        // Financial fields - CRITICAL: Include credit_days
        {
          dbField: "customer_type",
          reqFields: ["customer_type", "customerType"],
        },
        { dbField: "credit_limit", reqFields: ["credit_limit", "creditLimit"] },
        { dbField: "credit_days", reqFields: ["credit_days", "creditDays"] },
        {
          dbField: "outstanding_amount",
          reqFields: ["outstanding_amount", "outstandingAmount"],
        },

        // Status and metadata
        { dbField: "status", reqFields: ["status"] },
        { dbField: "notes", reqFields: ["notes"] },
      ];

      for (const mapping of fieldMappings) {
        let value = null;
        for (const reqField of mapping.reqFields) {
          if (customerData[reqField] !== undefined) {
            value = customerData[reqField];
            break;
          }
        }

        if (value !== undefined && value !== null) {
          updates.push(`${mapping.dbField} = ?`);
          // Handle numeric fields
          if (
            mapping.dbField === "credit_limit" ||
            mapping.dbField === "outstanding_amount"
          ) {
            params.push(parseFloat(value) || 0);
          } else if (mapping.dbField === "credit_days") {
            params.push(parseInt(value) || 0);
          } else if (
            ["country_id", "state_id", "city_id", "pincode_id"].includes(
              mapping.dbField,
            )
          ) {
            params.push(value ? parseInt(value) : null);
          } else {
            params.push(value);
          }
        }
      }

      if (updates.length === 0) {
        return true;
      }

      updates.push("updated_at = NOW()");
      params.push(Number(id));

      const updateQuery = `
        UPDATE customers
        SET ${updates.join(", ")}
        WHERE id = ?
      `;

      console.log("Update Query:", updateQuery);
      console.log("Update Params:", params);

      await db.query(updateQuery, params);
      return true;
    } finally {
      await db.end();
    }
  }
  async deleteCustomer(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid customer ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const [invoices] = await db.query(
        `SELECT id FROM invoices
         WHERE party_type = "customer" AND party_id = ? LIMIT 1`,
        [Number(id)],
      );

      if (invoices.length > 0) {
        throw new Error("Cannot delete customer with existing invoices");
      }

      await db.query("DELETE FROM customers WHERE id = ?", [Number(id)]);

      return true;
    } finally {
      await db.end();
    }
  }
}

module.exports = new CustomerService();
