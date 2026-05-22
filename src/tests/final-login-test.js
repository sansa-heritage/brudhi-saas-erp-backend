const axios = require('axios');

async function finalLoginTest() {
    console.log('\n========================================');
    console.log('Final Login Test');
    console.log('========================================\n');
    
    const loginData = {
        email: 'admin@samir-gas.com',
        password: 'Admin123',
        subdomain: 'samir-gas'
    };
    
    console.log('Attempting login with:');
    console.log(`  Email: ${loginData.email}`);
    console.log(`  Password: ${loginData.password}`);
    console.log(`  Subdomain: ${loginData.subdomain}`);
    console.log('');
    
    try {
        const response = await axios.post('http://localhost:5000/api/auth/login', loginData, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Login Successful!');
        console.log('\nResponse:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Test a protected endpoint
        const token = response.data.data.token;
        console.log('\nTesting protected endpoint...');
        const profileResponse = await axios.get('http://localhost:5000/api/auth/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('✅ Profile fetched successfully!');
        console.log('Profile:', profileResponse.data.data);
        
    } catch (error) {
        console.log('❌ Login Failed!');
        
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Message: ${error.response.data.message}`);
            console.log('Full error:', error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            console.log('Cannot connect to server. Make sure server is running: npm run dev');
        } else {
            console.log('Error:', error.message);
        }
        
        console.log('\nTroubleshooting Steps:');
        console.log('1. Make sure server is running: npm run dev');
        console.log('2. Check if main database has tenant with subdomain "samir-gas"');
        console.log('3. Check if tenant database has admin user');
        console.log('4. Check server logs for detailed error messages');
    }
}

finalLoginTest();