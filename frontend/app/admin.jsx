// app/admin.jsx - ENHANCED VERSION
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Image, Alert, ActivityIndicator, RefreshControl, Modal, 
  TextInput, Linking 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { CommonStyles } from '../components/CommonStyles';

const API_URL = 'http://192.168.1.112:3006/api/admin/drivers';

export default function AdminPanel() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [verifiedDrivers, setVerifiedDrivers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState({
    totalDrivers: 0,
    verifiedDrivers: 0,
    pendingDrivers: 0,
    activeDrivers: 0
  });
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching drivers...');
      
      // Fetch pending drivers with error handling
      let pendingList = [];
      let pendingError = null;
      try {
        const pendingRes = await fetch(`${API_URL}/unverified`);
        const pendingData = await pendingRes.json();
        console.log('📋 Pending API response:', pendingData);
        
        if (pendingData.success) {
          pendingList = pendingData.data || [];
          console.log(`✅ Loaded ${pendingList.length} pending drivers`);
        } else {
          pendingError = pendingData.error;
          console.error('❌ Pending API error:', pendingError);
        }
      } catch (error) {
        pendingError = error.message;
        console.error('❌ Pending fetch error:', error);
      }
      
      setPendingDrivers(pendingList);

      // Fetch verified drivers
      let verifiedList = [];
      let verifiedError = null;
      try {
        const verifiedRes = await fetch(`${API_URL}/verified`);
        const verifiedData = await verifiedRes.json();
        console.log('📋 Verified API response:', verifiedData);
        
        if (verifiedData.success) {
          verifiedList = verifiedData.data || [];
          console.log(`✅ Loaded ${verifiedList.length} verified drivers`);
        } else {
          verifiedError = verifiedData.error;
          console.error('❌ Verified API error:', verifiedError);
        }
      } catch (error) {
        verifiedError = error.message;
        console.error('❌ Verified fetch error:', error);
      }
      
      setVerifiedDrivers(verifiedList);

      // Calculate active drivers
      const activeCount = verifiedList.filter(driver => driver && driver.online).length;

      // Update stats
      setStats({
        totalDrivers: pendingList.length + verifiedList.length,
        verifiedDrivers: verifiedList.length,
        pendingDrivers: pendingList.length,
        activeDrivers: activeCount
      });

      // Collect debug info
      const debugText = `Last fetch: ${new Date().toLocaleTimeString()}
Pending drivers: ${pendingList.length}
Verified drivers: ${verifiedList.length}
Active drivers: ${activeCount}
${pendingError ? `Pending Error: ${pendingError}\n` : ''}
${verifiedError ? `Verified Error: ${verifiedError}` : ''}`;
      
      setDebugInfo(debugText);

      // Show alert if there were errors
      if (pendingError || verifiedError) {
        Alert.alert(
          'Partial Data Loaded',
          `Some data may not be current. Pending: ${pendingList.length}, Verified: ${verifiedList.length}`,
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('❌ Error in fetchDrivers:', error);
      Alert.alert('Error', 'Failed to load drivers. Please check server connection.');
      
      // Reset to empty arrays
      setPendingDrivers([]);
      setVerifiedDrivers([]);
      setStats({
        totalDrivers: 0,
        verifiedDrivers: 0,
        pendingDrivers: 0,
        activeDrivers: 0
      });
      setDebugInfo(`Error: ${error.message}\nTime: ${new Date().toLocaleTimeString()}`);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    setRefreshing(true);
    await fetchDrivers();
    setRefreshing(false);
  };

  const showDriverDetails = (driver) => {
    if (!driver) return;
    setSelectedDriver(driver);
    setModalVisible(true);
  };

  const handleVerify = async (driverId) => {
    if (!driverId) return;
    
    try {
      setActionLoading(true);
      console.log(`✅ Verifying driver: ${driverId}`);
      
      const response = await fetch(`${API_URL}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driverId }),
      });

      const data = await response.json();
      console.log('Verify response:', data);
      
      if (data.success) {
        Alert.alert('Success', data.message || 'Driver verified successfully!');
        fetchDrivers(); // Refresh the list
      } else {
        Alert.alert('Error', data.error || 'Failed to verify driver');
      }
    } catch (error) {
      console.error('Error verifying driver:', error);
      Alert.alert('Error', 'Failed to verify driver. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (driverId) => {
    if (!driverId) return;
    
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this driver? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              console.log(`🗑️ Deleting driver: ${driverId}`);
              
              const response = await fetch(`${API_URL}/delete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ driverId }),
              });

              const data = await response.json();
              console.log('Delete response:', data);
              
              if (data.success) {
                Alert.alert('Success', data.message || 'Driver deleted successfully!');
                fetchDrivers(); // Refresh the list
              } else {
                Alert.alert('Error', data.error || 'Failed to delete driver');
              }
            } catch (error) {
              console.error('Error deleting driver:', error);
              Alert.alert('Error', 'Failed to delete driver. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const toggleDriverStatus = async (driverId, currentStatus) => {
    if (!driverId) return;
    
    try {
      setActionLoading(true);
      console.log(`🔄 Toggling status for driver: ${driverId} to ${!currentStatus}`);
      
      const response = await fetch(`${API_URL}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          driverId, 
          status: !currentStatus 
        }),
      });

      const data = await response.json();
      console.log('Toggle status response:', data);
      
      if (data.success) {
        Alert.alert('Success', data.message || `Driver ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
        fetchDrivers(); // Refresh the list
      } else {
        Alert.alert('Error', data.error || 'Failed to update driver status');
      }
    } catch (error) {
      console.error('Error updating driver status:', error);
      Alert.alert('Error', 'Failed to update driver status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const callDriver = (phoneNumber) => {
    if (!phoneNumber) {
      Alert.alert('Error', 'No phone number available');
      return;
    }
    
    const phone = phoneNumber.startsWith('+') ? phoneNumber : `+254${phoneNumber.replace(/^0+/, '')}`;
    Linking.openURL(`tel:${phone}`).catch(err => {
      Alert.alert('Error', 'Could not make phone call');
      console.error('Call error:', err);
    });
  };

  const viewAllDrivers = async () => {
    try {
      Alert.alert(
        'Debug Info',
        debugInfo,
        [
          { text: 'Close' },
          { 
            text: 'Refresh', 
            onPress: fetchDrivers 
          },
          { 
            text: 'Test API', 
            onPress: async () => {
              try {
                const res = await fetch(`${API_URL}/test`);
                const data = await res.json();
                Alert.alert(
                  'API Test Result',
                  JSON.stringify(data, null, 2),
                  [{ text: 'OK' }]
                );
              } catch (error) {
                Alert.alert('API Test Failed', error.message);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            router.replace('/login');
          },
        },
      ]
    );
  };

  useEffect(() => {
    fetchDrivers();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDrivers, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const renderDriverCard = (driver, isPending = true) => {
    if (!driver || !driver._id) return null;
    
    const phoneNumber = driver.phone || 'N/A';
    
    return (
      <View key={driver._id} style={styles.driverCard}>
        <TouchableOpacity onPress={() => showDriverDetails(driver)}>
          <Image
            source={{ 
              uri: driver.driverImage || 'https://via.placeholder.com/70?text=Driver'
            }}
            style={styles.driverImage}
            resizeMode="cover"
            defaultSource={require('../assets/img/icon3.png')}
          />
        </TouchableOpacity>
        
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driver.name || 'Unknown Driver'}</Text>
          
          <TouchableOpacity onPress={() => callDriver(phoneNumber)}>
            <Text style={styles.driverDetail}>
              <Ionicons name="call-outline" size={14} color="#4A90E2" /> {phoneNumber}
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.driverDetail}>
            <Ionicons name="car-outline" size={14} color="#666" /> {driver.carType || 'N/A'}
          </Text>
          <Text style={styles.driverDetail}>
            <Ionicons name="document-outline" size={14} color="#666" /> {driver.carPlate || 'N/A'}
          </Text>
          
          {driver.createdAt && (
            <Text style={styles.driverDate}>
              <Ionicons name="time-outline" size={12} color="#999" /> 
              {new Date(driver.createdAt).toLocaleDateString()}
            </Text>
          )}
          
          <View style={[
            styles.statusBadge,
            { backgroundColor: isPending ? '#FFE082' : '#C8E6C9' }
          ]}>
            <Text style={styles.statusBadgeText}>
              {isPending ? '⏳ Pending' : '✅ Verified'}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {isPending ? (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleVerify(driver._id)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleDelete(driver._id)}
                disabled={actionLoading}
              >
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  driver.online ? styles.deactivateButton : styles.activateButton
                ]}
                onPress={() => toggleDriverStatus(driver._id, driver.online)}
                disabled={actionLoading}
              >
                <Ionicons 
                  name={driver.online ? "radio-button-on" : "radio-button-off"} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.buttonText}>
                  {driver.online ? 'Deactivate' : 'Activate'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(driver._id)}
                disabled={actionLoading}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Admin Panel...</Text>
        <Text style={styles.loadingSubtext}>Connecting to server...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout} style={styles.backButton}>
          <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Manage your Safari Ride system</Text>
        </View>
        
        <TouchableOpacity onPress={viewAllDrivers} style={styles.debugButton}>
          <Ionicons name="bug-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.statsContainer}
      >
        <View style={styles.statCard}>
          <Ionicons name="people" size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.totalDrivers}</Text>
          <Text style={styles.statLabel}>Total Drivers</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
          <Text style={styles.statNumber}>{stats.verifiedDrivers}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#FF9800" />
          <Text style={styles.statNumber}>{stats.pendingDrivers}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="radio-button-on" size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.activeDrivers}</Text>
          <Text style={styles.statLabel}>Active Now</Text>
        </View>
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            ⏳ Pending ({pendingDrivers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'verified' && styles.activeTab]}
          onPress={() => setActiveTab('verified')}
        >
          <Text style={[styles.tabText, activeTab === 'verified' && styles.activeTabText]}>
            ✅ Verified ({verifiedDrivers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Drivers List */}
      <ScrollView
        style={styles.driversList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4A90E2']}
            tintColor="#4A90E2"
          />
        }
      >
        {activeTab === 'pending' ? (
          pendingDrivers.length > 0 ? (
            pendingDrivers.map(driver => renderDriverCard(driver, true))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={80} color="#ccc" />
              <Text style={styles.emptyStateText}>No pending drivers</Text>
              <Text style={styles.emptyStateSubtext}>
                When drivers register, they will appear here for verification
              </Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={fetchDrivers}
              >
                <Ionicons name="refresh" size={20} color="#4A90E2" />
                <Text style={styles.refreshText}>Refresh List</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          verifiedDrivers.length > 0 ? (
            verifiedDrivers.map(driver => renderDriverCard(driver, false))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={80} color="#ccc" />
              <Text style={styles.emptyStateText}>No verified drivers</Text>
              <Text style={styles.emptyStateSubtext}>
                Verify drivers from the pending tab
              </Text>
            </View>
          )
        )}
        
        {/* Debug info at bottom */}
        {showDebug && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>Debug Info</Text>
            <Text style={styles.debugText}>{debugInfo}</Text>
          </View>
        )}
      </ScrollView>

      {/* Driver Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedDriver && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Driver Details</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Image
                    source={{ 
                      uri: selectedDriver.driverImage || 'https://via.placeholder.com/200?text=Driver'
                    }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />

                  <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Name</Text>
                      <Text style={styles.detailValue}>{selectedDriver.name || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <TouchableOpacity onPress={() => callDriver(selectedDriver.phone)}>
                        <Text style={[styles.detailValue, { color: '#4A90E2' }]}>
                          {selectedDriver.phone || 'N/A'} 📞
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Car Type</Text>
                      <Text style={styles.detailValue}>{selectedDriver.carType || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Plate No.</Text>
                      <Text style={styles.detailValue}>{selectedDriver.carPlate || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <Text style={[
                        styles.statusText,
                        { 
                          color: selectedDriver.verified ? '#4CAF50' : '#FF9800',
                          backgroundColor: selectedDriver.verified ? '#E8F5E9' : '#FFF3E0',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: '600'
                        }
                      ]}>
                        {selectedDriver.verified ? '✅ Verified' : '⏳ Pending'}
                      </Text>
                    </View>
                    {selectedDriver.createdAt && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Registered</Text>
                        <Text style={styles.detailValue}>
                          {new Date(selectedDriver.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {selectedDriver.idImage && (
                    <TouchableOpacity 
                      style={styles.idImageButton}
                      onPress={() => {
                        if (selectedDriver.idImage) {
                          Alert.alert(
                            'ID Verification',
                            'View ID document in browser?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { 
                                text: 'View', 
                                onPress: () => Linking.openURL(selectedDriver.idImage).catch(() => {
                                  Alert.alert('Error', 'Cannot open image');
                                })
                              }
                            ]
                          );
                        }
                      }}
                    >
                      <Ionicons name="document-outline" size={20} color="#fff" />
                      <Text style={styles.idImageText}>View ID Document</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.modalActions}>
                    {!selectedDriver.verified ? (
                      <>
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.modalApproveButton]}
                          onPress={() => {
                            handleVerify(selectedDriver._id);
                            setModalVisible(false);
                          }}
                          disabled={actionLoading}
                        >
                          {actionLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.modalButtonText}>Approve</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.modalRejectButton]}
                          onPress={() => {
                            handleDelete(selectedDriver._id);
                            setModalVisible(false);
                          }}
                          disabled={actionLoading}
                        >
                          <Text style={styles.modalButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.modalToggleButton]}
                          onPress={() => {
                            toggleDriverStatus(selectedDriver._id, selectedDriver.online);
                            setModalVisible(false);
                          }}
                          disabled={actionLoading}
                        >
                          <Text style={styles.modalButtonText}>
                            {selectedDriver.online ? 'Deactivate' : 'Activate'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.modalButton, styles.modalDeleteButton]}
                          onPress={() => {
                            handleDelete(selectedDriver._id);
                            setModalVisible(false);
                          }}
                          disabled={actionLoading}
                        >
                          <Text style={styles.modalButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </>
                    )}
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubtext: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 14,
    opacity: 0.8,
  },
  header: {
    backgroundColor: Colors.primary,
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  debugButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    marginTop: -30,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 8,
    alignItems: 'center',
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 15,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  driversList: {
    flex: 1,
    padding: 20,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  driverImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 15,
    backgroundColor: '#f0f0f0',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  driverDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
    minWidth: 100,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  deactivateButton: {
    backgroundColor: '#FF9800',
  },
  deleteButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
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
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    gap: 8,
  },
  refreshText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
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
    color: '#333',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 15,
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 20,
  },
  detailItem: {
    width: '48%',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  idImageButton: {
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  idImageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApproveButton: {
    backgroundColor: '#4CAF50',
  },
  modalRejectButton: {
    backgroundColor: '#F44336',
  },
  modalToggleButton: {
    backgroundColor: '#2196F3',
  },
  modalDeleteButton: {
    backgroundColor: '#757575',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  debugSection: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});