const mysql = require("mysql2/promise");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const config = require("../config/env");
const logger = require("../config/logger");
const db = require("../config/db");

class DatabaseManager {
  constructor() {
    this.mainPool = null;
    this.templateSchema = null;
    this.isInitialized = false;
  }
 
  
  async init() {
    if (!this.isInitialized) {
      this.mainPool = db.getPool();
      await this.loadTemplateSchema();
      this.isInitialized = true;
      console.log("✓ DatabaseManager initialized");
    }
    return this;
  }

  async loadTemplateSchema() {
    if (!this.templateSchema) {
      const schemaPath = path.join(
        __dirname,
        "../../database/tenant-schema-template.sql",
      );
      try {
        this.templateSchema = await fs.readFile(schemaPath, "utf8");
        logger.info("Tenant schema template loaded");
      } catch (error) {
        logger.warn("Tenant schema template not found, using minimal schema");
        this.templateSchema = this.getMinimalSchema();
      }
    }
    return this.templateSchema;
  }

  getMinimalSchema() {
    return `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'staff', 'manager') DEFAULT 'staff',
                mobile VARCHAR(20),
                status ENUM('active', 'inactive') DEFAULT 'active',
                email_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS cylinder_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                weight DECIMAL(5,2),
                type VARCHAR(50),
                price DECIMAL(10,2),
                gst_percent DECIMAL(5,2) DEFAULT 5.00,
                status TINYINT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS gas_stocks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cylinder_type_id INT,
                total_stock INT DEFAULT 0,
                available_stock INT DEFAULT 0,
                min_stock_level INT DEFAULT 10,
                reorder_level INT DEFAULT 20,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cylinder_type_id) REFERENCES cylinder_types(id)
            );
        `;
  }

  async generateDatabaseName(tenantName) {
    const sanitizedName = tenantName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const timestamp = Date.now();
    const hash = crypto
      .createHash("md5")
      .update(`${sanitizedName}_${timestamp}`)
      .digest("hex")
      .substring(0, 8);
    return `gasflow_tenant_${sanitizedName}_${hash}`;
  }

  async generateDatabaseCredentials() {
    const username = `tenant_${crypto.randomBytes(8).toString("hex")}`;
    const password = crypto.randomBytes(16).toString("hex");
    return { username, password };
  }

  async getRootConnection() {
    try {
      const host = config.ROOT_DB?.HOST || config.MAIN_DB?.HOST || "localhost";
      const port = config.ROOT_DB?.PORT || config.MAIN_DB?.PORT || 3307;
      const user = config.ROOT_DB?.USER || config.MAIN_DB?.USER || "root";
      const password =
        config.ROOT_DB?.PASSWORD || config.MAIN_DB?.PASSWORD || "root";

      console.log(`Connecting to MySQL at ${host}:${port} as ${user}`);

      const connection = await mysql.createConnection({
        host: host,
        port: port,
        user: user,
        password: password,
        multipleStatements: true,
        connectTimeout: 10000,
      });

      console.log("✓ Successfully connected to MySQL server");
      return connection;
    } catch (error) {
      console.error("Failed to connect to MySQL:", error.message);
      throw new Error(
        `Cannot connect to MySQL server. Error: ${error.message}`,
      );
    }
  }

  async createTenantDatabase(tenantName, tenantData) {
    const connection = await this.getRootConnection();

    try {
      const databaseName = await this.generateDatabaseName(tenantName);
      const { username, password } = await this.generateDatabaseCredentials();

      logger.info(`Creating database ${databaseName} for tenant ${tenantName}`);
      console.log(`\n📦 Creating tenant database: ${databaseName}`);

      // Create database
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` 
                                    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✓ Database created: ${databaseName}`);

      // Create database user
      await connection.query(
        `CREATE USER IF NOT EXISTS '${username}'@'%' IDENTIFIED BY '${password}'`,
      );
      await connection.query(
        `GRANT ALL PRIVILEGES ON \`${databaseName}\`.* TO '${username}'@'%'`,
      );
      await connection.query("FLUSH PRIVILEGES");
      console.log(`✓ Database user created: ${username}`);

      // Load and execute schema template
      const schema = await this.loadTemplateSchema();
      await connection.query(`USE \`${databaseName}\``);

      const statements = schema.split(";").filter((stmt) => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await connection.query(statement);
          } catch (err) {
            logger.warn(`Statement failed: ${err.message}`);
          }
        }
      }

      // Insert default data for tenant
      await this.insertTenantDefaultData(connection, databaseName, tenantData);

      logger.info(`Database ${databaseName} created successfully`);
      console.log(`✅ Tenant database setup complete!\n`);

      return {
        databaseName,
        username,
        password,
        host: config.MAIN_DB?.HOST || "localhost",
        port: config.MAIN_DB?.PORT || 3307,
      };
    } catch (error) {
      logger.error("Error creating tenant database:", error);
      console.error("❌ Error creating tenant database:", error.message);
      throw error;
    } finally {
      await connection.end();
    }
  }

  async insertTenantDefaultData(connection, databaseName, tenantData) {
    console.log(`\n📝 Inserting default data for tenant: ${databaseName}`);
    console.log(`   Admin Email: ${tenantData.adminEmail}`);

    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(tenantData.adminPassword, 10);
      console.log(`   Password hash generated`);

      // Create users table if not exists
      await connection.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(150) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    role ENUM('admin', 'staff', 'manager') NOT NULL DEFAULT 'staff',
                    mobile VARCHAR(20),
                    status ENUM('active', 'inactive', 'blocked') DEFAULT 'active',
                    email_verified BOOLEAN DEFAULT FALSE,
                    last_login DATETIME,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

      // Insert admin user
      await connection.query(
        `INSERT INTO users (name, email, password, role, mobile, email_verified, status) 
                 VALUES (?, ?, ?, 'admin', ?, true, 'active')`,
        [
          tenantData.adminName,
          tenantData.adminEmail,
          hashedPassword,
          tenantData.adminMobile,
        ],
      );
      console.log(`   ✓ Admin user created: ${tenantData.adminEmail}`);

      // Create cylinder types
      await connection.query(`
                CREATE TABLE IF NOT EXISTS cylinder_types (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    weight DECIMAL(5,2),
                    type VARCHAR(50),
                    price DECIMAL(10,2),
                    gst_percent DECIMAL(5,2) DEFAULT 5.00,
                    status TINYINT DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

      await connection.query(`
                INSERT INTO cylinder_types (name, weight, type, price, gst_percent, status) VALUES
                ('Domestic 14.2kg', 14.2, 'Domestic', 899.00, 5.00, 1),
                ('Domestic 5kg', 5.0, 'Domestic', 350.00, 5.00, 1),
                ('Commercial 19kg', 19.0, 'Commercial', 1750.00, 18.00, 1),
                ('Commercial 47.5kg', 47.5, 'Commercial', 4250.00, 18.00, 1)
                ON DUPLICATE KEY UPDATE name = name
            `);
      console.log(`   ✓ Cylinder types inserted`);

      // Create gas stocks
      await connection.query(`
                CREATE TABLE IF NOT EXISTS gas_stocks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    cylinder_type_id INT,
                    total_stock INT DEFAULT 0,
                    available_stock INT DEFAULT 0,
                    min_stock_level INT DEFAULT 10,
                    reorder_level INT DEFAULT 20,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (cylinder_type_id) REFERENCES cylinder_types(id)
                )
            `);

      await connection.query(`
                INSERT INTO gas_stocks (cylinder_type_id, total_stock, available_stock, min_stock_level, reorder_level)
                SELECT id, 0, 0, 10, 20 FROM cylinder_types
                ON DUPLICATE KEY UPDATE updated_at = NOW()
            `);
      console.log(`   ✓ Stock initialized`);

      console.log(`✅ Default data insertion complete!\n`);
    } catch (error) {
      console.error(`❌ Error inserting default data:`, error.message);
      logger.error("Error inserting default data:", error);
      throw error;
    }
  }

  async getTenantDatabaseConnection(tenantId) {
    try {
      console.log(
        `Getting tenant database connection for tenant ID: ${tenantId}`,
      );

      // Create direct connection to main database
      const mainConnection = await mysql.createConnection({
        host: config.MAIN_DB.HOST,
        port: config.MAIN_DB.PORT,
        user: config.MAIN_DB.USER,
        password: config.MAIN_DB.PASSWORD,
        database: config.MAIN_DB.NAME,
      });

      try {
        // Use query() instead of execute() to avoid parameter issues
        const [rows] = await mainConnection.query(
          `SELECT id, name, database_name, database_host, database_port, 
                        database_user, database_password, status
                 FROM tenants 
                 WHERE id = ? AND status = 'active'`,
          [tenantId],
        );

        console.log("Query result rows:", rows);
        console.log("Rows length:", rows.length);

        if (rows.length === 0) {
          console.error(`Tenant not found or inactive: ${tenantId}`);
          throw new Error("Tenant not found or inactive");
        }

        const tenantInfo = rows[0];
        console.log("Tenant data retrieved:", {
          id: tenantInfo.id,
          name: tenantInfo.name,
          database_name: tenantInfo.database_name,
          database_host: tenantInfo.database_host,
          database_port: tenantInfo.database_port,
          database_user: tenantInfo.database_user,
          has_password: !!tenantInfo.database_password,
        });

        if (!tenantInfo.database_name) {
          console.error("Missing database_name for tenant");
          throw new Error("Tenant database not configured");
        }

        console.log(`\nConnecting to tenant database:`);
        console.log(`  Database: ${tenantInfo.database_name}`);
        console.log(`  Host: ${tenantInfo.database_host}`);
        console.log(`  Port: ${tenantInfo.database_port}`);
        console.log(`  User: ${tenantInfo.database_user}`);

        const pool = mysql.createPool({
          host: tenantInfo.database_host,
          port: parseInt(tenantInfo.database_port),
          user: tenantInfo.database_user,
          password: tenantInfo.database_password,
          database: tenantInfo.database_name,
          waitForConnections: true,
          connectionLimit: 5,
          queueLimit: 0,
          connectTimeout: 10000,
        });

        const testConn = await pool.getConnection();
        console.log(
          `✓ Successfully connected to tenant database: ${tenantInfo.database_name}`,
        );
        testConn.release();

        return pool;
      } finally {
        await mainConnection.end();
      }
    } catch (error) {
      console.error("Error getting tenant database connection:", error.message);
      throw new Error(`Failed to connect to tenant database: ${error.message}`);
    }
  }
  async deleteTenantDatabase(tenantId) {
    const tenant = await this.mainPool.query(
      "SELECT database_name, database_user FROM tenants WHERE id = ?",
      [tenantId],
    );

    if (tenant.length === 0) {
      throw new Error("Tenant not found");
    }

    const { database_name, database_user } = tenant[0];
    const connection = await this.getRootConnection();

    try {
      if (database_name) {
        await connection.query(`DROP DATABASE IF EXISTS \`${database_name}\``);
        console.log(`✓ Dropped database: ${database_name}`);
      }
      if (database_user) {
        await connection.query(`DROP USER IF EXISTS '${database_user}'@'%'`);
        console.log(`✓ Dropped user: ${database_user}`);
      }
      await connection.query("FLUSH PRIVILEGES");
      logger.info(`Database ${database_name} deleted for tenant ${tenantId}`);
      return true;
    } finally {
      await connection.end();
    }
  }

  async deleteTenantDatabaseByCredentials(databaseName, username) {
    const connection = await this.getRootConnection();
    try {
      if (databaseName) {
        await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
        console.log(`✓ Dropped database: ${databaseName}`);
      }
      if (username) {
        await connection.query(`DROP USER IF EXISTS '${username}'@'%'`);
        console.log(`✓ Dropped user: ${username}`);
      }
      await connection.query("FLUSH PRIVILEGES");
      logger.info(`Cleaned up database ${databaseName}`);
      return true;
    } finally {
      await connection.end();
    }
  }
}

module.exports = new DatabaseManager();
