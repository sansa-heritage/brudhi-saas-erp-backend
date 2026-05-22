const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../.env.development') });

const logger = console;

async function setupMainDatabase() {
  let connection;
  
  try {
    logger.log('🔧 Setting up main database...');
    
    // Connect to MySQL server
    connection = await mysql.createConnection({
      host: process.env.MAIN_DB_HOST,
      port: process.env.MAIN_DB_PORT,
      user: process.env.DB_ROOT_USER || process.env.MAIN_DB_USER,
      password: process.env.DB_ROOT_PASSWORD || process.env.MAIN_DB_PASSWORD,
      multipleStatements: true
    });

    // Create main database if not exists
    const dbName = process.env.MAIN_DB_NAME;
    logger.log(`📦 Creating database: ${dbName}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` 
                            CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${dbName}\``);

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../../database/main-schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    const statements = schema.split(';').filter(stmt => stmt.trim());
    let executed = 0;
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
        executed++;
      }
    }
    
    logger.log(`✅ Executed ${executed} schema statements`);

    // Create superadmin user
    logger.log('👤 Creating superadmin user...');
    const hashedPassword = await bcrypt.hash('SuperAdmin@123', 12);
    
    await connection.query(
      `INSERT INTO superadmins (name, email, password, mobile, role, status) 
       VALUES (?, ?, ?, ?, 'superadmin', 'active')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      ['Super Administrator', 'superadmin@gasflow.com', hashedPassword, '9876543210']
    );

    // Insert default plans
    logger.log('📋 Inserting default plans...');
    await connection.query(`
      INSERT INTO plans (name, description, price, max_users, max_invoices, max_customers, max_dealers, features, is_active) VALUES
      ('Basic', 'Basic plan for small businesses', 999.00, 5, 100, 100, 20, '{"features": ["Basic Reports", "Email Support", "5 Users"]}', true),
      ('Professional', 'Professional plan for growing businesses', 2499.00, 20, 500, 500, 100, '{"features": ["Advanced Reports", "Priority Support", "20 Users", "API Access"]}', true),
      ('Enterprise', 'Enterprise plan for large businesses', 4999.00, 100, 5000, 5000, 500, '{"features": ["Custom Reports", "24/7 Support", "Unlimited Users", "API Access", "Custom Integration"]}', true)
    `);

    // Insert global lookup data
    logger.log('🌍 Inserting global lookup data...');
    
    await connection.query(`
      INSERT INTO countries (name, code) VALUES
      ('India', 'IN'),
      ('United States', 'US'),
      ('United Kingdom', 'GB'),
      ('Canada', 'CA'),
      ('Australia', 'AU')
    `);

    await connection.query(`
      INSERT INTO brands (name, code) VALUES
      ('Indane Gas', 'INDANE'),
      ('HP Gas', 'HP'),
      ('Bharat Gas', 'BPCL'),
      ('Reliance Gas', 'RELIANCE'),
      ('Go Gas', 'GOGAS')
    `);

    await connection.query(`
      INSERT INTO cylinder_types (name, weight, type, capacity_kg) VALUES
      ('Domestic 14.2kg', 14.2, 'Domestic', 14.2),
      ('Domestic 5kg', 5.0, 'Domestic', 5.0),
      ('Commercial 19kg', 19.0, 'Commercial', 19.0),
      ('Commercial 47.5kg', 47.5, 'Commercial', 47.5),
      ('Industrial 50kg', 50.0, 'Industrial', 50.0)
    `);

    logger.log('\n✅ Main database setup completed successfully!');
    logger.log('\n╔══════════════════════════════════════════════════════════╗');
    logger.log('║              SUPERADMIN CREDENTIALS                      ║');
    logger.log('╠══════════════════════════════════════════════════════════╣');
    logger.log('║ Email:    superadmin@gasflow.com                         ║');
    logger.log('║ Password: SuperAdmin@123                                 ║');
    logger.log('╚══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    logger.error('❌ Setup failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run setup
setupMainDatabase().catch(console.error);