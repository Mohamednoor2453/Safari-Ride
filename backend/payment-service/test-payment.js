// test-payment.js
const axios = require('axios');

const testPayment = async () => {
  const testData = {
    rideId: "TEST123",
    userPhone: "254745827403",
    amount: 100,
    driverId: "DRV001",
    driverName: "Test Driver"
  };

  console.log("🚀 Testing payment endpoint...");
  
  try {
    const response = await axios.post('http://localhost:3007/api/payments/mpesa', testData);
    
    console.log("✅ SUCCESS!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log("\n💡 Next steps:");
      console.log(`1. Check payment status: GET http://localhost:3007/api/payments/status?paymentId=${response.data.paymentId}`);
      console.log(`2. Simulate completion: POST http://localhost:3007/api/payments/simulate with {"paymentId": "${response.data.paymentId}"}`);
      console.log(`3. Health check: GET http://localhost:3007/api/payments/health`);
    }
  } catch (error) {
    console.error("❌ FAILED!");
    console.error("Error:", error.response?.data || error.message);
    
    if (error.response?.data?.details) {
      console.log("\n💡 Suggestion: Check your MongoDB connection in .env file");
    }
  }
};

testPayment();