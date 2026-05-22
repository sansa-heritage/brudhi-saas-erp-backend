const mysql = require('mysql2/promise');

async function testTenantConnection() {
    console.log('\n========================================');
    console.log('Testing Tenant Database Connection');
    console.log('========================================\n');
    
    // Update with your actual tenant database name
    const tenantDbName = 'gasflow_tenant_samir_gas_agency_42a58703';
    
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            port: 3307,
            user: 'root',
            password: 'root',
            database: tenantDbName
        });
        
        console.log('✓ Connected to tenant database\n');
        
        // Check tables
        const [tables] = await connection.query('SHOW TABLES');
        console.log('Tables:');
        tables.forEach(table => {
            console.log(`  - ${Object.values(table)[0]}`);
        });
        
        // Check users
        const [users] = await connection.query('SELECT * FROM users');
        console.log('\nUsers:');
        users.forEach(user => {
            console.log(`  - ${user.name} (${user.email}) - Role: ${user.role}`);
        });
        
        await connection.end();
        console.log('\n✅ Connection test successful!');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error code:', error.code);
    }
}

testTenantConnection();