const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Payment = require("../../shared/Models/payment.js")

//get payment details


exports.getPaymentDetails = async (req, res)=>{
    try {
        console.log("fetching payment details")

        const completePayment = await Payment
  .find(
    { status: "completed" },
    {
      driverId: 1,  
      driverName: 1,
      rideId: 1,
      amount: 1,
      paymentMethod: 1,
      description: 1,
      _id: 0
    }
  )
  .sort({ driverName: 1, createdAt: -1 });


        if(!completePayment){
            return res.status(400).json({error: "No payment yet"})
        }

       return res.status(200).json({
        success: true,
        data: completePayment
       });

    } catch (error) {
        console.error(error)
        return res.status(500).json({error:"Internal server error"})
        
    }
}