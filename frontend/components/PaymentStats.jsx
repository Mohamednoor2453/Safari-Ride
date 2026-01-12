// app/components/PaymentStats.jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PaymentColors } from '../constants/PaymentColors';

export const PaymentStats = ({ stats }) => {
  const formatAmount = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Overview</Text>
      <View style={styles.grid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatAmount(stats.totalAmount)}</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalPayments}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatAmount(stats.averageAmount)}</Text>
          <Text style={styles.statLabel}>Avg. Payment</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PaymentColors.textPrimary,
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PaymentColors.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
  },
});