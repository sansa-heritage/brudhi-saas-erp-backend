const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function checkPasswordInTenant() {
    console.log('\n========================================');
    console.log('Checking Password in Tenant Database');
    console.log('========================================\n');
    
    // Your actual tenant database name
    const tenantDbName = 'gasflow_tenant_samir_gas_agency_42a58703';
    
    let connection;
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            port: 3307,
            user: 'root',
            password: 'root',
            database: tenantDbName
        });
        
        console.log('✓ Connected to:', tenantDbName);
        
        // Check all users
        const [users] = await connection.query('SELECT id, name, email, password FROM users');
        
        console.log('\nUsers in database:');
        users.forEach(user => {
            console.log(`\n  User ID: ${user.id}`);
            console.log(`  Name: ${user.name}`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Password: ${user.password}`);
            console.log(`  Password Type: ${typeof user.password}`);
            console.log(`  Password Length: ${user.password ? user.password.length : 0}`);
            console.log(`  Is Null: ${user.password === null}`);
            console.log(`  Is Empty: ${user.password === ''}`);
        });
        
        // Check if admin user exists
        const [admin] = await connection.query(
            'SELECT * FROM users WHERE email = ?',
            ['admin@samir-gas.com']
        );
        
        if (admin.length === 0) {
            console.log('\n❌ Admin user not found! Creating...');
            const hashedPassword = await bcrypt.hash('Admin123', 10);
            await connection.query(
                `INSERT INTO users (name, email, password, role, mobile, email_verified, status) 
                 VALUES (?, ?, ?, 'admin', ?, true, 'active')`,
                ['Admin User', 'admin@samir-gas.com', hashedPassword, '9876543210']
            );
            console.log('✓ Admin user created');
        } else {
            console.log('\n✓ Admin user found');
            const adminUser = admin[0];
            
            if (!adminUser.password || adminUser.password === 'null' || adminUser.password === '') {
                console.log('⚠️  Password is missing or invalid!');
                console.log('Fixing password...');
                
                const hashedPassword = await bcrypt.hash('Admin123', 10);
                await connection.query(
                    'UPDATE users SET password = ? WHERE email = ?',
                    [hashedPassword, 'admin@samir-gas.com']
                );
                console.log('✓ Password updated');
            } else {
                console.log('Password hash found:', adminUser.password.substring(0, 30) + '...');
                
                // Test the password
                const isValid = await bcrypt.compare('Admin123', adminUser.password);
                console.log(`Password "Admin123" verification: ${isValid ? '✓ VALID' : '✗ INVALID'}`);
                
                if (!isValid) {
                    console.log('\n⚠️  Password verification failed! Updating password...');
                    const hashedPassword = await bcrypt.hash('Admin123', 10);
                    await connection.query(
                        'UPDATE users SET password = ? WHERE email = ?',
                        [hashedPassword, 'admin@samir-gas.com']
                    );
                    console.log('✓ Password updated');
                }
            }
        }
        
        // Final verification
        const [finalCheck] = await connection.query(
            'SELECT id, name, email, password FROM users WHERE email = ?',
            ['admin@samir-gas.com']
        );
        
        if (finalCheck.length > 0) {
            const finalUser = finalCheck[0];
            console.log('\n✅ Final Verification:');
            console.log(`  Name: ${finalUser.name}`);
            console.log(`  Email: ${finalUser.email}`);
            console.log(`  Password Hash: ${finalUser.password.substring(0, 30)}...`);
            
            const finalTest = await bcrypt.compare('Admin123', finalUser.password);
            console.log(`  Password Test: ${finalTest ? '✓ VALID' : '✗ INVALID'}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
    
    console.log('\n========================================\n');
}

checkPasswordInTenant();