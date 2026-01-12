// app/admin-payments.jsx - COMPLETE PAYMENT MANAGEMENT PAGE
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, RefreshControl,
  Modal, TextInput, FlatList, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { PaymentColors } from '../constants/PaymentColors';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';

const API_URL = 'http://192.168.1.112:3006/api/admin/payment/payments';
const { width } = Dimensions.get('window');

export default function AdminPayments() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, amount, driver
  const [filterBy, setFilterBy] = useState('all'); // all, today, week, month
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalPayments: 0,
    averageAmount: 0,
    recentPayments: 0,
    todayAmount: 0
  });
  const [paidStatus, setPaidStatus] = useState({}); // Track manual paid status
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentStats, setPaymentStats] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch payment data
  const fetchPayments = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching payment details...');
      
      const response = await fetch(API_URL);
      const data = await response.json();
      console.log('📊 Payments API response:', data);
      
      if (data.success && data.data) {
        // Add a default manual status field for UI management
        const paymentsWithStatus = data.data.map(payment => ({
          ...payment,
          paymentId: payment.rideId || payment.driverId + Date.now(), // Create unique ID
          manualStatus: 'pending', // Default status for admin action
          createdAt: payment.createdAt || new Date().toISOString()
        }));
        
        setPayments(paymentsWithStatus);
        applyFiltersAndSort(paymentsWithStatus);
        
        // Calculate statistics
        calculateStats(paymentsWithStatus);
        
        console.log(`✅ Loaded ${paymentsWithStatus.length} payments`);
      } else {
        Alert.alert('Error', data.error || 'Failed to load payments');
        setPayments([]);
        applyFiltersAndSort([]);
      }
    } catch (error) {
      console.error('❌ Error fetching payments:', error);
      Alert.alert('Connection Error', 'Failed to connect to payment server');
      setPayments([]);
      applyFiltersAndSort([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (paymentsData) => {
    if (!paymentsData || paymentsData.length === 0) {
      setStats({
        totalAmount: 0,
        totalPayments: 0,
        averageAmount: 0,
        recentPayments: 0,
        todayAmount: 0
      });
      return;
    }

    const totalAmount = paymentsData.reduce((sum, payment) => 
      sum + (parseFloat(payment.amount) || 0), 0
    );
    const totalPayments = paymentsData.length;
    const averageAmount = totalPayments > 0 ? totalAmount / totalPayments : 0;
    
    // Count recent payments (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentPayments = paymentsData.filter(payment => 
      new Date(payment.createdAt) > oneWeekAgo
    ).length;
    
    // Today's payments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPayments = paymentsData.filter(payment => 
      new Date(payment.createdAt) >= today
    );
    const todayAmount = todayPayments.reduce((sum, payment) => 
      sum + (parseFloat(payment.amount) || 0), 0
    );
    
    setStats({
      totalAmount,
      totalPayments,
      averageAmount,
      recentPayments,
      todayAmount
    });

    // Payment method statistics
    const methodStats = {};
    paymentsData.forEach(payment => {
      const method = payment.paymentMethod || 'unknown';
      methodStats[method] = (methodStats[method] || 0) + 1;
    });
    
    setPaymentStats(Object.entries(methodStats).map(([method, count]) => ({
      method,
      count,
      percentage: ((count / totalPayments) * 100).toFixed(1)
    })));
  };

  const applyFiltersAndSort = (data) => {
    let filtered = [...data];
    
    // Apply time filter
    const now = new Date();
    switch (filterBy) {
      case 'today':
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        filtered = filtered.filter(p => new Date(p.createdAt) >= today);
        break;
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(p => new Date(p.createdAt) >= weekAgo);
        break;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter(p => new Date(p.createdAt) >= monthAgo);
        break;
      default:
        // 'all' - no time filter
        break;
    }
    
    // Apply search filter
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(payment =>
        payment.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.driverId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.rideId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.amount?.toString().includes(searchQuery)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
        case 'driver':
          return (a.driverName || '').localeCompare(b.driverName || '');
        case 'date':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
    
    setFilteredPayments(filtered);
  };

  useEffect(() => {
    applyFiltersAndSort(payments);
  }, [searchQuery, sortBy, filterBy, payments]);

  const onRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    setRefreshing(true);
    await fetchPayments();
    setRefreshing(false);
  };

  const handleMarkAsPaid = (paymentId) => {
    Alert.alert(
      'Confirm Payment',
      'Are you sure you want to mark this payment as manually paid?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Paid',
          onPress: () => {
            setActionLoading(true);
            // Simulate API call
            setTimeout(() => {
              setPaidStatus(prev => ({
                ...prev,
                [paymentId]: 'paid'
              }));
              
              // Update the payment in the list
              setPayments(prev => prev.map(p => 
                p.paymentId === paymentId 
                  ? { ...p, manualStatus: 'paid' }
                  : p
              ));
              
              setActionLoading(false);
              Alert.alert('Success', 'Payment marked as manually paid!');
            }, 1000);
          }
        }
      ]
    );
  };

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setModalVisible(true);
  };

  const handleExport = () => {
    Alert.alert(
      'Export Data',
      'Export payment data as:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'CSV', onPress: () => exportToCSV() },
        { text: 'PDF', onPress: () => exportToPDF() }
      ]
    );
  };

  const exportToCSV = () => {
    // Simple CSV export logic
    const headers = ['Driver Name', 'Driver ID', 'Ride ID', 'Amount', 'Payment Method', 'Description', 'Date'];
    const csvData = filteredPayments.map(p => [
      p.driverName || 'N/A',
      p.driverId || 'N/A',
      p.rideId || 'N/A',
      `$${parseFloat(p.amount || 0).toFixed(2)}`,
      p.paymentMethod || 'N/A',
      p.description || 'N/A',
      new Date(p.createdAt).toLocaleDateString()
    ].join(','));
    
    const csvContent = [headers.join(','), ...csvData].join('\n');
    
    // In a real app, you would use a library to download the file
    Alert.alert('CSV Export', `Exported ${filteredPayments.length} records`);
    console.log('CSV Content:', csvContent);
  };

  const exportToPDF = () => {
    Alert.alert('PDF Export', 'PDF export functionality would be implemented here');
  };

  const getPaymentMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'card':
        return <FontAwesome5 name="credit-card" size={16} color={PaymentColors.paymentMethod.card} />;
      case 'cash':
        return <FontAwesome5 name="money-bill-wave" size={16} color={PaymentColors.paymentMethod.cash} />;
      case 'mobile':
        return <Ionicons name="phone-portrait" size={16} color={PaymentColors.paymentMethod.mobile} />;
      case 'wallet':
        return <MaterialIcons name="account-balance-wallet" size={16} color={PaymentColors.paymentMethod.wallet} />;
      default:
        return <Ionicons name="card" size={16} color={PaymentColors.textSecondary} />;
    }
  };

  const getStatusColor = (status) => {
    return PaymentColors.status[status] || PaymentColors.textSecondary;
  };

  const formatAmount = (amount) => {
    const num = parseFloat(amount || 0);
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderPaymentCard = ({ item }) => {
    const isManuallyPaid = paidStatus[item.paymentId] === 'paid' || item.manualStatus === 'paid';
    
    return (
      <TouchableOpacity 
        style={styles.paymentCard}
        onPress={() => handleViewDetails(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.driverInfo}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {(item.driverName || 'D').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.driverName}>{item.driverName || 'Unknown Driver'}</Text>
              <Text style={styles.driverId}>ID: {item.driverId || 'N/A'}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isManuallyPaid ? PaymentColors.status.manual_paid : PaymentColors.status.manual_pending }]}>
            <Text style={styles.statusBadgeText}>
              {isManuallyPaid ? '✅ Paid' : '⏳ Pending'}
            </Text>
          </View>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
          </View>
          
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={14} color={PaymentColors.textSecondary} />
              <Text style={styles.detailText}>Ride: {item.rideId || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailRow}>
              {getPaymentMethodIcon(item.paymentMethod)}
              <Text style={styles.detailText}>Method: {item.paymentMethod || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color={PaymentColors.textSecondary} />
              <Text style={styles.detailText}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={[
              styles.payButton,
              isManuallyPaid && styles.paidButton
            ]}
            onPress={() => handleMarkAsPaid(item.paymentId)}
            disabled={isManuallyPaid || actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons 
                  name={isManuallyPaid ? "checkmark-circle" : "cash-outline"} 
                  size={18} 
                  color="#fff" 
                />
                <Text style={styles.payButtonText}>
                  {isManuallyPaid ? 'Already Paid' : 'Mark as Paid'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.detailsButton}
            onPress={() => handleViewDetails(item)}
          >
            <Ionicons name="eye-outline" size={18} color={PaymentColors.primary} />
            <Text style={styles.detailsButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatsCard = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
          <Ionicons name="cash-outline" size={24} color={PaymentColors.success} />
        </View>
        <Text style={styles.statValue}>{formatAmount(stats.totalAmount)}</Text>
        <Text style={styles.statLabel}>Total Revenue</Text>
      </View>
      
      <View style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
          <Ionicons name="receipt-outline" size={24} color={PaymentColors.info} />
        </View>
        <Text style={styles.statValue}>{stats.totalPayments}</Text>
        <Text style={styles.statLabel}>Total Payments</Text>
      </View>
      
      <View style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: 'rgba(255, 152, 0, 0.1)' }]}>
          <Ionicons name="today-outline" size={24} color={PaymentColors.warning} />
        </View>
        <Text style={styles.statValue}>{formatAmount(stats.todayAmount)}</Text>
        <Text style={styles.statLabel}>Today's Revenue</Text>
      </View>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={PaymentColors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by driver, ID, or amount..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={PaymentColors.textLight}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={PaymentColors.textLight} />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity 
            style={[styles.filterChip, filterBy === 'all' && styles.filterChipActive]}
            onPress={() => setFilterBy('all')}
          >
            <Text style={[styles.filterChipText, filterBy === 'all' && styles.filterChipTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterChip, filterBy === 'today' && styles.filterChipActive]}
            onPress={() => setFilterBy('today')}
          >
            <Text style={[styles.filterChipText, filterBy === 'today' && styles.filterChipTextActive]}>
              Today
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterChip, filterBy === 'week' && styles.filterChipActive]}
            onPress={() => setFilterBy('week')}
          >
            <Text style={[styles.filterChipText, filterBy === 'week' && styles.filterChipTextActive]}>
              This Week
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterChip, filterBy === 'month' && styles.filterChipActive]}
            onPress={() => setFilterBy('month')}
          >
            <Text style={[styles.filterChipText, filterBy === 'month' && styles.filterChipTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>
        </ScrollView>
        
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="filter" size={20} color={PaymentColors.primary} />
        </TouchableOpacity>
      </View>
      
      {showFilters && (
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          <View style={styles.sortOptions}>
            <TouchableOpacity 
              style={[styles.sortChip, sortBy === 'date' && styles.sortChipActive]}
              onPress={() => setSortBy('date')}
            >
              <Text style={[styles.sortChipText, sortBy === 'date' && styles.sortChipTextActive]}>
                Date
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.sortChip, sortBy === 'amount' && styles.sortChipActive]}
              onPress={() => setSortBy('amount')}
            >
              <Text style={[styles.sortChipText, sortBy === 'amount' && styles.sortChipTextActive]}>
                Amount
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.sortChip, sortBy === 'driver' && styles.sortChipActive]}
              onPress={() => setSortBy('driver')}
            >
              <Text style={[styles.sortChipText, sortBy === 'driver' && styles.sortChipTextActive]}>
                Driver Name
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  useEffect(() => {
    fetchPayments();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchPayments, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PaymentColors.primary} />
        <Text style={styles.loadingText}>Loading Payment Details...</Text>
        <Text style={styles.loadingSubtext}>Fetching transaction data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Payment Management</Text>
          <Text style={styles.headerSubtitle}>Monitor and manage driver payments</Text>
        </View>
        
        <TouchableOpacity onPress={handleExport} style={styles.exportButton}>
          <Ionicons name="download-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PaymentColors.primary]}
            tintColor={PaymentColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Cards */}
        {renderStatsCard()}
        
        {/* Filters */}
        {renderFilters()}
        
        {/* Payment Method Stats */}
        {paymentStats.length > 0 && (
          <View style={styles.methodStatsContainer}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <View style={styles.methodStats}>
              {paymentStats.map((stat, index) => (
                <View key={index} style={styles.methodStat}>
                  <Text style={styles.methodName}>{stat.method}</Text>
                  <Text style={styles.methodCount}>{stat.count} ({stat.percentage}%)</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* Payments List */}
        <View style={styles.paymentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Recent Payments ({filteredPayments.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              {filterBy !== 'all' && `Showing ${filterBy} payments`}
            </Text>
          </View>
          
          {filteredPayments.length > 0 ? (
            <FlatList
              data={filteredPayments}
              renderItem={renderPaymentCard}
              keyExtractor={(item) => item.paymentId}
              scrollEnabled={false}
              contentContainerStyle={styles.paymentsList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={80} color="#ccc" />
              <Text style={styles.emptyStateText}>No payments found</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery ? 'Try a different search term' : 'No payment records available'}
              </Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={fetchPayments}
              >
                <Ionicons name="refresh" size={20} color={PaymentColors.primary} />
                <Text style={styles.refreshText}>Refresh Payments</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Payment Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedPayment && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Payment Details</Text>
                  <TouchableOpacity 
                    onPress={() => setModalVisible(false)}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color={PaymentColors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                  <View style={styles.modalDriverInfo}>
                    <View style={styles.modalAvatar}>
                      <Text style={styles.modalAvatarText}>
                        {(selectedPayment.driverName || 'D').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.modalDriverDetails}>
                      <Text style={styles.modalDriverName}>{selectedPayment.driverName}</Text>
                      <Text style={styles.modalDriverId}>Driver ID: {selectedPayment.driverId}</Text>
                    </View>
                  </View>

                  <View style={styles.modalAmountCard}>
                    <Text style={styles.modalAmountLabel}>Payment Amount</Text>
                    <Text style={styles.modalAmount}>{formatAmount(selectedPayment.amount)}</Text>
                    <View style={[
                      styles.modalStatusBadge,
                      { 
                        backgroundColor: paidStatus[selectedPayment.paymentId] === 'paid' || selectedPayment.manualStatus === 'paid' 
                          ? PaymentColors.status.manual_paid 
                          : PaymentColors.status.manual_pending 
                      }
                    ]}>
                      <Text style={styles.modalStatusText}>
                        {paidStatus[selectedPayment.paymentId] === 'paid' || selectedPayment.manualStatus === 'paid' 
                          ? '✅ Manually Paid' 
                          : '⏳ Payment Pending'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalDetailsGrid}>
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Ride ID</Text>
                      <Text style={styles.modalDetailValue}>{selectedPayment.rideId || 'N/A'}</Text>
                    </View>
                    
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Payment Method</Text>
                      <View style={styles.modalPaymentMethod}>
                        {getPaymentMethodIcon(selectedPayment.paymentMethod)}
                        <Text style={styles.modalDetailValue}>{selectedPayment.paymentMethod || 'N/A'}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Transaction Date</Text>
                      <Text style={styles.modalDetailValue}>{formatDate(selectedPayment.createdAt)}</Text>
                    </View>
                    
                    {selectedPayment.description && (
                      <View style={styles.modalDetailItem}>
                        <Text style={styles.modalDetailLabel}>Description</Text>
                        <Text style={styles.modalDetailValue}>{selectedPayment.description}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={[
                        styles.modalActionButton,
                        (paidStatus[selectedPayment.paymentId] === 'paid' || selectedPayment.manualStatus === 'paid') 
                          ? styles.modalActionButtonDisabled 
                          : styles.modalActionButtonPrimary
                      ]}
                      onPress={() => {
                        handleMarkAsPaid(selectedPayment.paymentId);
                        setModalVisible(false);
                      }}
                      disabled={paidStatus[selectedPayment.paymentId] === 'paid' || selectedPayment.manualStatus === 'paid' || actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons 
                            name={
                              (paidStatus[selectedPayment.paymentId] === 'paid' || selectedPayment.manualStatus === 'paid') 
                                ? "checkmark-circle" 
                                : "cash-outline"
                            } 
                            size={20} 
                            color="#fff" 
                          />
                          <Text style={styles.modalActionButtonText}>
                            {(paidStatus[selectedPayment.paymentId] === 'paid' || selectedPayment.manualStatus === 'paid') 
                              ? 'Already Paid' 
                              : 'Mark as Manually Paid'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.modalActionButtonSecondary}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.modalActionButtonTextSecondary}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PaymentColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PaymentColors.background,
    padding: 20,
  },
  loadingText: {
    color: PaymentColors.textPrimary,
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubtext: {
    color: PaymentColors.textSecondary,
    marginTop: 10,
    fontSize: 14,
  },
  header: {
    backgroundColor: PaymentColors.primary,
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  exportButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    marginTop: -30,
  },
  statCard: {
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 6,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PaymentColors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
    textAlign: 'center',
  },
  filterContainer: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: PaymentColors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterScroll: {
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: PaymentColors.border,
  },
  filterChipActive: {
    backgroundColor: PaymentColors.primary,
    borderColor: PaymentColors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sortButton: {
    padding: 8,
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 8,
    marginLeft: 5,
  },
  sortContainer: {
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 10,
    padding: 15,
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PaymentColors.textPrimary,
    marginBottom: 10,
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 15,
    marginRight: 10,
    marginBottom: 8,
  },
  sortChipActive: {
    backgroundColor: PaymentColors.primary,
  },
  sortChipText: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  methodStatsContainer: {
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  methodStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  methodStat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '48%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
    marginRight: '2%',
  },
  methodName: {
    fontSize: 12,
    fontWeight: '600',
    color: PaymentColors.textPrimary,
  },
  methodCount: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
  },
  paymentsSection: {
    paddingHorizontal: 15,
    marginBottom: 30,
  },
  sectionHeader: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PaymentColors.textPrimary,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
  },
  paymentsList: {
    paddingBottom: 10,
  },
  paymentCard: {
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PaymentColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PaymentColors.textPrimary,
  },
  driverId: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardBody: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  amountSection: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: PaymentColors.border,
    paddingRight: 15,
  },
  amountLabel: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
    marginBottom: 5,
  },
  amount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: PaymentColors.primary,
  },
  detailsSection: {
    flex: 2,
    paddingLeft: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PaymentColors.primary,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  paidButton: {
    backgroundColor: PaymentColors.success,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PaymentColors.primary,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  detailsButtonText: {
    color: PaymentColors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: PaymentColors.cardBackground,
    borderRadius: 15,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PaymentColors.textSecondary,
    marginTop: 15,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: PaymentColors.textLight,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    gap: 8,
  },
  refreshText: {
    color: PaymentColors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: PaymentColors.cardBackground,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: PaymentColors.textPrimary,
  },
  modalCloseButton: {
    padding: 5,
  },
  modalScroll: {
    flex: 1,
  },
  modalDriverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PaymentColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  modalAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalDriverDetails: {
    flex: 1,
  },
  modalDriverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PaymentColors.textPrimary,
    marginBottom: 4,
  },
  modalDriverId: {
    fontSize: 14,
    color: PaymentColors.textSecondary,
  },
  modalAmountCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAmountLabel: {
    fontSize: 14,
    color: PaymentColors.textSecondary,
    marginBottom: 10,
  },
  modalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: PaymentColors.primary,
    marginBottom: 15,
  },
  modalStatusBadge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  modalDetailItem: {
    width: '100%',
    marginBottom: 15,
  },
  modalDetailLabel: {
    fontSize: 12,
    color: PaymentColors.textSecondary,
    marginBottom: 5,
    fontWeight: '500',
  },
  modalDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: PaymentColors.textPrimary,
  },
  modalPaymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalActions: {
    marginTop: 20,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  modalActionButtonPrimary: {
    backgroundColor: PaymentColors.primary,
  },
  modalActionButtonDisabled: {
    backgroundColor: PaymentColors.success,
  },
  modalActionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PaymentColors.border,
    paddingVertical: 15,
    borderRadius: 10,
  },
  modalActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalActionButtonTextSecondary: {
    color: PaymentColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});