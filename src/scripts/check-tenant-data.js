const mysql = require('mysql2/promise');
const config = require('../config/env');

async function checkTenantData() {
    console.log('\n========================================');
    console.log('Checking Tenant Data');
    console.log('========================================\n');
    
    let connection;
    try {
        // Connect to main database
        connection = await mysql.createConnection({
            host: config.MAIN_DB.HOST,
            port: config.MAIN_DB.PORT,
            user: config.MAIN_DB.USER,
            password: config.MAIN_DB.PASSWORD,
            database: config.MAIN_DB.NAME
        });
        
        // Get all columns in tenants table
        const [columns] = await connection.query(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tenants' AND TABLE_SCHEMA = ?",
            [config.MAIN_DB.NAME]
        );
        
        console.log('Columns in tenants table:');
        columns.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
        
        console.log('\n');
        
        // Get all tenants
        const [tenants] = await connection.query('SELECT * FROM tenants');
        
        console.log(`Found ${tenants.length} tenant(s):\n`);
        
        for (const tenant of tenants) {
            console.log(`📁 Tenant ID: ${tenant.id}`);
            console.log(`   Name: ${tenant.name}`);
            console.log(`   Subdomain: ${tenant.subdomain}`);
            console.log(`   Email: ${tenant.email}`);
            console.log(`   Database Name: ${tenant.database_name || 'MISSING'}`);
            console.log(`   Database Host: ${tenant.database_host || 'MISSING'}`);
            console.log(`   Database Port: ${tenant.database_port || 'MISSING'}`);
            console.log(`   Database User: ${tenant.database_user || 'MISSING'}`);
            console.log(`   Database Password: ${tenant.database_password ? '✓ SET' : 'MISSING'}`);
            console.log(`   Status: ${tenant.status}`);
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkTenantData();