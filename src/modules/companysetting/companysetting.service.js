const DatabaseManager = require("../../services/database-manager.service");

class CompanySettingService {
  async getCompanySetting(tenantId) {
    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    console.log("Getting company settings for tenant:", tenantId);

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Check if table exists
      const [tables] = await db.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = 'company_settings'
      `);

      if (tables[0].count === 0) {
        console.log("company_settings table does not exist");
        return null;
      }

      const [rows] = await db.query("SELECT * FROM company_settings LIMIT 1");
      return rows[0] || null;
    } catch (error) {
      console.error("Error in getCompanySetting:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async updateCompanySetting(tenantId, data) {
    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    console.log("Updating company settings for tenant:", tenantId);
    console.log("Received data:", JSON.stringify(data, null, 2));

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Check if table exists, if not create it
      const [tables] = await db.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = 'company_settings'
      `);

      if (tables[0].count === 0) {
        console.log("Creating company_settings table...");
        await db.query(`
          CREATE TABLE IF NOT EXISTS company_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_name VARCHAR(255) NOT NULL,
            brand_tagline VARCHAR(255),
            primary_color VARCHAR(20),
            website VARCHAR(255),
            logo LONGTEXT,
            company_email VARCHAR(150),
            company_phone VARCHAR(20),
            alternate_phone VARCHAR(20),
            company_address TEXT,
            city VARCHAR(100),
            state VARCHAR(100),
            pincode VARCHAR(20),
            bank_name VARCHAR(150),
            account_holder_name VARCHAR(150),
            account_number VARCHAR(100),
            ifsc_code VARCHAR(50),
            branch_name VARCHAR(150),
            upi_id VARCHAR(100),
            gst_number VARCHAR(50),
            pan_number VARCHAR(30),
            tan_number VARCHAR(30),
            business_type VARCHAR(100),
            tax_address TEXT,
            status TINYINT DEFAULT 1,
            created_by INT,
            updated_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
      }

      // Check if record exists
      const [existing] = await db.query(
        "SELECT id FROM company_settings LIMIT 1",
      );

      let result;

      if (existing.length > 0) {
        // Update existing record
        const updateFields = [];
        const updateValues = [];

        const fields = [
          "company_name",
          "brand_tagline",
          "primary_color",
          "website",
          "logo",
          "company_email",
          "company_phone",
          "alternate_phone",
          "company_address",
          "city",
          "state",
          "pincode",
          "bank_name",
          "account_holder_name",
          "account_number",
          "ifsc_code",
          "branch_name",
          "upi_id",
          "gst_number",
          "pan_number",
          "tan_number",
          "business_type",
          "tax_address",
          "status",
        ];

        for (const field of fields) {
          if (data[field] !== undefined) {
            updateFields.push(`${field} = ?`);
            updateValues.push(
              data[field] === null || data[field] === "" ? null : data[field],
            );
          }
        }

        if (updateFields.length > 0) {
          updateValues.push(existing[0].id);
          const query = `UPDATE company_settings SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = ?`;

          console.log("Update query:", query);
          await db.query(query, updateValues);
        }

        result = { id: existing[0].id, ...data };
      } else {
        // Insert new record
        const insertFields = [];
        const insertPlaceholders = [];
        const insertValues = [];

        const fields = [
          "company_name",
          "brand_tagline",
          "primary_color",
          "website",
          "logo",
          "company_email",
          "company_phone",
          "alternate_phone",
          "company_address",
          "city",
          "state",
          "pincode",
          "bank_name",
          "account_holder_name",
          "account_number",
          "ifsc_code",
          "branch_name",
          "upi_id",
          "gst_number",
          "pan_number",
          "tan_number",
          "business_type",
          "tax_address",
          "status",
        ];

        for (const field of fields) {
          if (data[field] !== undefined) {
            insertFields.push(field);
            insertPlaceholders.push("?");
            insertValues.push(
              data[field] === null || data[field] === "" ? null : data[field],
            );
          }
        }

        const query = `INSERT INTO company_settings (${insertFields.join(", ")}, created_at, updated_at) VALUES (${insertPlaceholders.join(", ")}, NOW(), NOW())`;

        console.log("Insert query:", query);
        const [insertResult] = await db.query(query, insertValues);
        result = { id: insertResult.insertId, ...data };
      }

      return result;
    } catch (error) {
      console.error("Error in updateCompanySetting:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
}

module.exports = new CompanySettingService();
