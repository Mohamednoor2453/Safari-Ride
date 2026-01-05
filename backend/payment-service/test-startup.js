// payment-service/test-startup.js
const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    console.log('🧪 Testing MongoDB Connection...');
    console.log('='.repeat(50));
    
    try {
        // Test connection
        console.log('🔗 Connection URL:', process.env.dbURL.replace(/\/\/.*@/, '//***:***@'));
        
        await mongoose.connect(process.env.dbURL, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            maxPoolSize: 10,
            family: 4
        });
        
        console.log('✅ MongoDB Connection: SUCCESS');
        console.log('📊 Connection Details:');
        console.log('   Host:', mongoose.connection.host);
        console.log('   Database:', mongoose.connection.name);
        console.log('   State:', mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected');
        
        // Test a simple query
        console.log('\n🧪 Testing Database Query...');
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📁 Collections found:', collections.map(c => c.name));
        
        // Check for payments collection
        const hasPayments = collections.some(c => c.name === 'payments');
        console.log('💳 Payments collection:', hasPayments ? '✅ Found' : '❌ Not found');
        
        if (hasPayments) {
            const count = await mongoose.connection.collection('payments').countDocuments();
            console.log('   Total payments:', count);
        }
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Connection closed');
        process.exit(0);
    }
}

testConnection();