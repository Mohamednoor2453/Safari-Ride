const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true 
    },

    phone: { 
      type: String, 
      required: true 
    }, // encrypted
    
    plainPhone: { 
      type: String, 
      required: true,
      unique: true,
      trim: true
    }, // unencrypted for admin

    carPlate: { 
      type: String, 
      required: true 
    }, // encrypted
    
    plainPlate: { 
      type: String, 
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    }, // unencrypted

    carType: { 
      type: String, 
      required: true,
      trim: true 
    },

    driverImage: { 
      type: [String], 
      default: [] 
    },
    
    IdImage: { 
      type: [String], 
      default: [] 
    },

    verified: { 
      type: Boolean, 
      default: false 
    },
    
    verifiedAt: { 
      type: Date 
    },

    online: { 
      type: Boolean, 
      default: false 
    },
    
    available: { 
      type: Boolean, 
      default: false 
    },
    
    lastLogin: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Add indexes for better query performance
DriverSchema.index({ plainPhone: 1 });
DriverSchema.index({ plainPlate: 1 });
DriverSchema.index({ verified: 1 });
DriverSchema.index({ online: 1 });
DriverSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Driver', DriverSchema);