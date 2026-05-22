const axios = require('axios');

async function testFullLogin() {
    console.log('\n========================================');
    console.log('Testing Full Login Flow');
    console.log('========================================\n');
    
    const loginData = {
        email: 'admin@samir-gas.com',
        password: 'Admin123',
        subdomain: 'samir-gas'
    };
    
    console.log('Login Payload:', loginData);
    console.log('');
    
    try {
        const response = await axios.post('http://localhost:5000/api/auth/login', loginData);
        
        console.log('✅ Login Successful!');
        console.log('\nResponse:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Save token for further testing
        const token = response.data.data.token;
        console.log('\nToken:', token.substring(0, 50) + '...');
        
        // Test protected endpoint
        console.log('\nTesting protected endpoint...');
        const profileResponse = await axios.get('http://localhost:5000/api/auth/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('✅ Profile fetched successfully!');
        console.log('Profile:', profileResponse.data.data);
        
    } catch (error) {
        console.log('❌ Login Failed!');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Message:', error.response.data.message);
            console.log('Full Response:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
        
        console.log('\nTroubleshooting:');
        console.log('1. Check if server is running: npm run dev');
        console.log('2. Check if tenant exists in main database');
        console.log('3. Check if tenant has correct database connection info');
        console.log('4. Check if admin user exists in tenant database');
    }
}

testFullLogin();