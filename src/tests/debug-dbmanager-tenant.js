const mysql = require('mysql2/promise');
const config = require('../config/env');

async function debugDbManagerTenant() {
    console.log('\n========================================');
    console.log('Debugging Database Manager Tenant Retrieval');
    console.log('========================================\n');
    
    try {
        // Connect directly to main database
        const mainConn = await mysql.createConnection({
            host: config.MAIN_DB.HOST,
            port: config.MAIN_DB.PORT,
            user: config.MAIN_DB.USER,
            password: config.MAIN_DB.PASSWORD,
            database: config.MAIN_DB.NAME
        });
        
        console.log('Connected to main database\n');
        
        // Get tenant by subdomain
        const subdomain = 'samir-gas';
        const [tenants] = await mainConn.query(
            `SELECT id, name, subdomain, database_name, database_host, database_port, 
                    database_user, database_password, status 
             FROM tenants 
             WHERE subdomain = ?`,
            [subdomain]
        );
        
        console.log('Tenant query result:');
        console.log(tenants);
        
        if (tenants.length > 0) {
            const tenant = tenants[0];
            console.log('\nTenant found:');
            console.log(`  ID: ${tenant.id}`);
            console.log(`  Name: ${tenant.name}`);
            console.log(`  Database Name: ${tenant.database_name}`);
            console.log(`  Database Host: ${tenant.database_host}`);
            console.log(`  Database Port: ${tenant.database_port}`);
            console.log(`  Database User: ${tenant.database_user}`);
            console.log(`  Database Password: ${tenant.database_password ? '***' : 'MISSING'}`);
            console.log(`  Status: ${tenant.status}`);
            
            // Test connection to tenant database
            console.log('\nTesting connection to tenant database...');
            const tenantConn = await mysql.createConnection({
                host: tenant.database_host,
                port: tenant.database_port,
                user: tenant.database_user,
                password: tenant.database_password,
                database: tenant.database_name
            });
            
            console.log('✓ Connected to tenant database');
            
            const [users] = await tenantConn.query('SELECT id, name, email FROM users');
            console.log('\nUsers in tenant database:');
            users.forEach(user => {
                console.log(`  - ${user.name} (${user.email})`);
            });
            
            await tenantConn.end();
        } else {
            console.log('❌ No tenant found with subdomain:', subdomain);
        }
        
        await mainConn.end();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugDbManagerTenant();