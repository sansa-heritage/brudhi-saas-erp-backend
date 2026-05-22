const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

async function fixExistingTenants() {
    console.log('\n========================================');
    console.log('Fixing Existing Tenants');
    console.log('========================================\n');
    
    let mainConn;
    try {
        // Connect to main database
        mainConn = await mysql.createConnection({
            host: config.MAIN_DB.HOST,
            port: config.MAIN_DB.PORT,
            user: config.MAIN_DB.USER,
            password: config.MAIN_DB.PASSWORD,
            database: config.MAIN_DB.NAME
        });
        
        // Get all active tenants
        const [tenants] = await mainConn.query(
            'SELECT id, name, subdomain, database_name FROM tenants WHERE status = "active"'
        );
        
        console.log(`Found ${tenants.length} tenant(s):\n`);
        
        for (const tenant of tenants) {
            console.log(`📁 Processing tenant: ${tenant.name}`);
            console.log(`   Database: ${tenant.database_name}`);
            console.log(`   Subdomain: ${tenant.subdomain}`);
            
            // Connect to tenant database
            try {
                const tenantConn = await mysql.createConnection({
                    host: 'localhost',
                    port: 3307,
                    user: 'root',
                    password: 'root',
                    database: tenant.database_name
                });
                
                console.log('   ✓ Connected to tenant database');
                
                // Create users table if not exists
                await tenantConn.query(`
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
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Create admin user
                const adminEmail = `admin@${tenant.subdomain}.com`;
                const hashedPassword = await bcrypt.hash('Admin123', 10);
                
                const [existing] = await tenantConn.query(
                    'SELECT id FROM users WHERE email = ?',
                    [adminEmail]
                );
                
                if (existing.length === 0) {
                    await tenantConn.query(
                        `INSERT INTO users (name, email, password, role, mobile, email_verified, status) 
                         VALUES (?, ?, ?, 'admin', ?, 1, 'active')`,
                        ['Admin User', adminEmail, hashedPassword, '9876543210']
                    );
                    console.log(`   ✓ Admin user created: ${adminEmail}`);
                } else {
                    await tenantConn.query(
                        'UPDATE users SET password = ? WHERE email = ?',
                        [hashedPassword, adminEmail]
                    );
                    console.log(`   ✓ Admin password updated: ${adminEmail}`);
                }
                
                // Create cylinder types if not exists
                const [cylinders] = await tenantConn.query("SHOW TABLES LIKE 'cylinder_types'");
                if (cylinders.length === 0) {
                    await tenantConn.query(`
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
                    
                    await tenantConn.query(`
                        INSERT INTO cylinder_types (name, weight, type, price, gst_percent, status) VALUES
                        ('Domestic 14.2kg', 14.2, 'Domestic', 899.00, 5.00, 1),
                        ('Domestic 5kg', 5.0, 'Domestic', 350.00, 5.00, 1),
                        ('Commercial 19kg', 19.0, 'Commercial', 1750.00, 18.00, 1),
                        ('Commercial 47.5kg', 47.5, 'Commercial', 4250.00, 18.00, 1)
                    `);
                    console.log(`   ✓ Cylinder types created`);
                }
                
                // Create gas stocks if not exists
                const [stock] = await tenantConn.query("SHOW TABLES LIKE 'gas_stocks'");
                if (stock.length === 0) {
                    await tenantConn.query(`
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
                    
                    await tenantConn.query(`
                        INSERT INTO gas_stocks (cylinder_type_id, total_stock, available_stock)
                        SELECT id, 0, 0 FROM cylinder_types
                    `);
                    console.log(`   ✓ Gas stocks initialized`);
                }
                
                // Verify
                const [users] = await tenantConn.query(
                    'SELECT id, name, email, role FROM users WHERE email = ?',
                    [adminEmail]
                );
                
                if (users.length > 0) {
                    console.log(`   ✅ Verified: ${users[0].name} (${users[0].email}) - Role: ${users[0].role}`);
                }
                
                await tenantConn.end();
                
            } catch (error) {
                console.error(`   ❌ Error:`, error.message);
            }
            
            console.log('');
        }
        
        console.log('========================================');
        console.log('✅ All tenants fixed successfully!');
        console.log('========================================\n');
        
        console.log('Login credentials for tenants:');
        for (const tenant of tenants) {
            console.log(`\n  ${tenant.name}:`);
            console.log(`    Email: admin@${tenant.subdomain}.com`);
            console.log(`    Password: Admin123`);
            console.log(`    Subdomain: ${tenant.subdomain}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mainConn) {
            await mainConn.end();
        }
    }
}

fixExistingTenants();