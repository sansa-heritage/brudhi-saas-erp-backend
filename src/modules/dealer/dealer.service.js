// backend/services/dealer.service.js
const DatabaseManager = require("../../services/database-manager.service");

class DealerService {
  async getAllDealers(tenantId, filters = {}) {
    try {
      const { status, search, dealerType, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      // Get database connection
      const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

      let query = `
      SELECT 
        id, dealer_code, name, email, mobile, 
        alternate_mobile, address, country_id, state_id, city_id, pincode_id,
        gst_number, pan_number, aadhaar_number,
        dealer_type, commission_rate,
        status, created_by, created_at, updated_at
      FROM dealers 
      WHERE 1=1
    `;

      const queryParams = [];

      // Add filters
      if (status) {
        query += ` AND status = ?`;
        queryParams.push(status);
      }

      if (dealerType) {
        query += ` AND dealer_type = ?`;
        queryParams.push(dealerType);
      }

      if (search) {
        query += ` AND (name LIKE ? OR email LIKE ? OR mobile LIKE ? OR dealer_code LIKE ?)`;
        const searchPattern = `%${search}%`;
        queryParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
        );
      }

      // Add order and pagination
      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      queryParams.push(parseInt(limit), offset);

      const [dealers] = await db.query(query, queryParams);

      // Get total count for pagination
      let countQuery = `SELECT COUNT(*) as total FROM dealers WHERE 1=1`;
      const countParams = [];

      if (status) {
        countQuery += ` AND status = ?`;
        countParams.push(status);
      }

      if (dealerType) {
        countQuery += ` AND dealer_type = ?`;
        countParams.push(dealerType);
      }

      if (search) {
        countQuery += ` AND (name LIKE ? OR email LIKE ? OR mobile LIKE ? OR dealer_code LIKE ?)`;
        const searchPattern = `%${search}%`;
        countParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
        );
      }

      const [countResult] = await db.query(countQuery, countParams);
      const total = countResult[0].total;

      // Close connection
      await db.end();

      return {
        data: dealers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error getting all dealers:", error);
      throw error;
    }
  }

  async getDealerById(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid dealer ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const [dealers] = await db.query(
        `SELECT 
          id, dealer_code, name, email, mobile, 
          alternate_mobile, address, country_id, state_id, city_id, pincode_id,
          gst_number, pan_number, aadhaar_number,
          dealer_type, commission_rate,
          status, created_by, created_at, updated_at
        FROM dealers 
        WHERE id = ?`,
        [Number(id)],
      );

      if (!dealers[0]) {
        return null;
      }

      const dealer = dealers[0];

      // Transform to match frontend format
      const transformedDealer = {
        id: dealer.id,
        dealer_code: dealer.dealer_code,
        name: dealer.name,
        company_name: "",
        email: dealer.email,
        mobile: dealer.mobile,
        alternate_mobile: dealer.alternate_mobile,
        address: dealer.address || "",
        country_id: dealer.country_id,
        state_id: dealer.state_id,
        city_id: dealer.city_id,
        pincode_id: dealer.pincode_id,
        gst_number: dealer.gst_number,
        pan_number: dealer.pan_number,
        aadhaar_number: dealer.aadhaar_number,
        dealer_type: dealer.dealer_type,
        commission_rate: parseFloat(dealer.commission_rate) || 0,
        status: dealer.status,
        created_by: dealer.created_by,
        created_at: dealer.created_at,
        updated_at: dealer.updated_at,
      };

      return transformedDealer;
    } catch (error) {
      console.error("Error in getDealerById:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async createDealer(tenantId, dealerData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Check if email already exists
      const [existing] = await db.query(
        "SELECT id FROM dealers WHERE email = ?",
        [dealerData.email],
      );

      if (existing.length > 0) {
        throw new Error("Email already exists");
      }

      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 1000);
      const dealerCode = `DLR_${timestamp}_${randomNum}`;

      const [result] = await db.query(
        `INSERT INTO dealers (
          dealer_code, name, email, mobile, alternate_mobile,
          country_id, state_id, city_id, pincode_id, address,
          gst_number, pan_number, aadhaar_number,
          dealer_type, commission_rate,
          status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          dealerCode,
          dealerData.name || null,
          dealerData.email || null,
          dealerData.mobile || null,
          dealerData.alternate_mobile || dealerData.alternateMobile || null,
          dealerData.country_id || dealerData.countryId || null,
          dealerData.state_id || dealerData.stateId || null,
          dealerData.city_id || dealerData.cityId || null,
          dealerData.pincode_id || dealerData.pincodeId || null,
          dealerData.address || null,
          dealerData.gst_number || dealerData.gstNumber || null,
          dealerData.pan_number || dealerData.panNumber || null,
          dealerData.aadhaar_number || dealerData.aadhaarNumber || null,
          dealerData.dealer_type || dealerData.dealerType || "retailer",
          parseFloat(
            dealerData.commission_rate || dealerData.commissionRate || 0,
          ),
          dealerData.status || "active",
          dealerData.created_by || dealerData.createdBy || null,
        ],
      );

      return result.insertId;
    } catch (error) {
      console.error("Error in createDealer:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async updateDealer(tenantId, id, dealerData) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid dealer ID");
    }

    console.log(
      "🔧 Update Dealer - Received data:",
      JSON.stringify(dealerData, null, 2),
    );
    console.log(
      "💰 Commission rate received:",
      dealerData.commission_rate || dealerData.commissionRate,
    );

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Check if dealer exists
      const [existing] = await db.query(
        "SELECT id, email FROM dealers WHERE id = ?",
        [Number(id)],
      );

      if (existing.length === 0) {
        throw new Error("Dealer not found");
      }

      // Check email uniqueness if email is being changed
      const newEmail = dealerData.email;
      if (newEmail && newEmail !== existing[0].email) {
        const [emailCheck] = await db.query(
          "SELECT id FROM dealers WHERE email = ? AND id != ?",
          [newEmail, Number(id)],
        );
        if (emailCheck.length > 0) {
          throw new Error("Email already exists");
        }
      }

      const updates = [];
      const params = [];

      // Define field mappings - CRITICAL: Include commission_rate
      const fieldMappings = [
        { dbField: "name", reqFields: ["name"] },
        { dbField: "email", reqFields: ["email"] },
        { dbField: "mobile", reqFields: ["mobile"] },
        {
          dbField: "alternate_mobile",
          reqFields: ["alternate_mobile", "alternateMobile"],
        },
        { dbField: "address", reqFields: ["address"] },
        { dbField: "country_id", reqFields: ["country_id", "countryId"] },
        { dbField: "state_id", reqFields: ["state_id", "stateId"] },
        { dbField: "city_id", reqFields: ["city_id", "cityId"] },
        { dbField: "pincode_id", reqFields: ["pincode_id", "pincodeId"] },
        { dbField: "gst_number", reqFields: ["gst_number", "gstNumber"] },
        { dbField: "pan_number", reqFields: ["pan_number", "panNumber"] },
        {
          dbField: "aadhaar_number",
          reqFields: ["aadhaar_number", "aadhaarNumber"],
        },
        { dbField: "dealer_type", reqFields: ["dealer_type", "dealerType"] },
        {
          dbField: "commission_rate",
          reqFields: ["commission_rate", "commissionRate"],
        }, // ✅ Make sure this line exists
        // { dbField: "credit_limit", reqFields: ["credit_limit", "creditLimit"] },
        // { dbField: "territory", reqFields: ["territory"] },
        {
          dbField: "agreement_valid_till",
          reqFields: ["agreement_valid_till", "agreementValidTill"],
        },
        { dbField: "status", reqFields: ["status"] },
        // { dbField: "notes", reqFields: ["notes"] },
      ];

      for (const mapping of fieldMappings) {
        let value = null;
        for (const reqField of mapping.reqFields) {
          if (
            dealerData[reqField] !== undefined &&
            dealerData[reqField] !== null
          ) {
            value = dealerData[reqField];
            break;
          }
        }

        if (value !== undefined && value !== null && value !== "") {
          updates.push(`${mapping.dbField} = ?`);

          if (mapping.dbField === "commission_rate") {
            const numValue = parseFloat(value);
            const finalValue = isNaN(numValue) ? 0 : numValue;
            params.push(finalValue);
            console.log(`💰 Setting commission_rate to: ${finalValue}`);
          } else if (mapping.dbField === "credit_limit") {
            params.push(parseFloat(value) || 0);
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
        console.log("No fields to update");
        await db.end();
        return true;
      }

      updates.push("updated_at = NOW()");
      params.push(Number(id));

      const updateQuery = `UPDATE dealers SET ${updates.join(", ")} WHERE id = ?`;

      console.log("📝 Update Query:", updateQuery);
      console.log("📦 Update Params:", params);
      console.log(
        "💰 Commission rate param index:",
        params.findIndex(
          (p) =>
            p ===
            parseFloat(dealerData.commission_rate || dealerData.commissionRate),
        ),
      );

      const [result] = await db.query(updateQuery, params);
      console.log("✅ Update result affected rows:", result.affectedRows);

      if (result.affectedRows === 0) {
        throw new Error("No rows were updated");
      }

      return true;
    } catch (error) {
      console.error("Error in updateDealer:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

 async deleteDealer(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid dealer ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Check if dealer has orders/invoices
      // First check if dealer_id column exists
      const [columns] = await db.query(`SHOW COLUMNS FROM orders`);
      const hasDealerId = columns.some(col => col.Field === 'dealer_id');
      
      if (hasDealerId) {
        const [orders] = await db.query(
          `SELECT id FROM orders WHERE dealer_id = ? LIMIT 1`,
          [Number(id)]
        );
        
        if (orders.length > 0) {
          throw new Error("Cannot delete dealer with existing orders");
        }
      }

      // Soft delete - update status to 'inactive' (not 'deleted')
      // This assumes your ENUM allows 'active' and 'inactive'
      await db.query(
        "UPDATE dealers SET status = 'inactive', updated_at = NOW() WHERE id = ?",
        [Number(id)]
      );

      return true;
    } catch (error) {
      console.error("Error in deleteDealer:", error);
      throw error;
    } finally {
      await db.end();
    }
}

  async getDealerStats(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const [stats] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN dealer_type = 'distributor' THEN 1 ELSE 0 END) as distributor,
          SUM(CASE WHEN dealer_type = 'retailer' THEN 1 ELSE 0 END) as retailer,
          SUM(CASE WHEN dealer_type = 'franchise' THEN 1 ELSE 0 END) as franchise,
          0 as total_credit_limit
        FROM dealers
        WHERE status != 'deleted'
      `);

      return stats[0];
    } catch (error) {
      console.error("Error in getDealerStats:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
}

module.exports = new DealerService();
