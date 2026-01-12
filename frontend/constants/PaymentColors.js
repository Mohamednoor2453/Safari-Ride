// app/constants/PaymentColors.js
export const PaymentColors = {
  primary: '#4CAF50',        // Green for payments
  secondary: '#2196F3',      // Blue for stats
  warning: '#FF9800',        // Orange for pending
  danger: '#F44336',         // Red for errors
  success: '#4CAF50',        // Green for success
  info: '#2196F3',           // Blue for info
  background: '#F5F7FA',     // Light gray background
  cardBackground: '#FFFFFF', // White for cards
  textPrimary: '#333333',    // Dark text
  textSecondary: '#666666',  // Medium text
  textLight: '#999999',      // Light text
  border: '#E0E0E0',         // Border color
  
  // Status colors
  status: {
    completed: '#4CAF50',
    pending: '#FF9800',
    failed: '#F44336',
    refunded: '#9C27B0',
    manual_paid: '#4CAF50',
    manual_pending: '#FF9800'
  },
  
  // Payment method colors
  paymentMethod: {
    card: '#2196F3',
    cash: '#4CAF50',
    mobile: '#FF9800',
    wallet: '#9C27B0'
  }
};