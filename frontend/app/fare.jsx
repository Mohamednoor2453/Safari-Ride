// frontend/app/fare.jsx
import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  StyleSheet, View, Text, SafeAreaView,
  ScrollView, Alert, ActivityIndicator,
  AppState, Platform, Vibration,
  TouchableOpacity, Linking
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/Colors';
import PrimaryButton from '../components/PrimaryButton';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import io from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.112:3005'; 
const CANCEL_API = "http://192.168.1.112:3005/api/ride/cancel";

// Simple storage helpers
const storageHelpers = {
  setItem: async (key, value) => {
    try {
      // Try localStorage for web, AsyncStorage for native
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      } else if (typeof AsyncStorage !== 'undefined') {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Storage error:', error);
    }
  },
  
  getItem: async (key) => {
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } else if (typeof AsyncStorage !== 'undefined') {
        const item = await AsyncStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
    } catch (error) {
      console.error('Storage error:', error);
      return null;
    }
  },
  
  removeItem: async (key) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      } else if (typeof AsyncStorage !== 'undefined') {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Storage error:', error);
    }
  }
};

// Storage keys
const RIDE_STATE_KEY = 'current_ride_state';
const USER_SESSION_KEY = 'user_session_data';

const FareScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useContext(UserContext);

  const { estimatedFare, currency, destinationName, destinationAddress,
    distance, time, surge, rideId } = params;

  const fareValue = estimatedFare ? parseFloat(estimatedFare).toFixed(2) : 'N/A';
  const surgeValue = surge ? parseFloat(surge) : 1.0;
  const isSurge = surgeValue > 1.0;

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [socket, setSocket] = useState(null);
  const [rideStatus, setRideStatus] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const socketRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const notificationCountRef = useRef(0);

  // Store notifications to show when app comes to foreground
  const [pendingNotifications, setPendingNotifications] = useState([]);

  // Save ride state to storage
  const saveRideState = async (state) => {
    try {
      await storageHelpers.setItem(RIDE_STATE_KEY, {
        ...state,
        savedAt: Date.now()
      });
      console.log('💾 Ride state saved');
    } catch (error) {
      console.error('Error saving ride state:', error);
    }
  };

  // Load ride state from storage
  const loadRideState = async () => {
    try {
      const savedState = await storageHelpers.getItem(RIDE_STATE_KEY);
      if (savedState) {
        console.log('📂 Loaded saved ride state:', savedState);
        
        // Check if saved state is recent (within last hour)
        const isRecent = Date.now() - (savedState.savedAt || 0) < 3600000; // 1 hour
        
        if (isRecent && savedState.rideId) {
          // Restore the ride state
          setRideStatus(savedState.rideStatus);
          setSearching(savedState.searching || false);
          setDriverInfo(savedState.driverInfo || null);
          
          if (savedState.rideStatus === 'driver_assigned' || savedState.rideStatus === 'in_progress') {
            Alert.alert(
              "Ride Restored",
              `Your ride with ${savedState.driverInfo?.name || 'driver'} is still active.`,
              [{ text: "Continue", onPress: () => {} }]
            );
          }
          
          return savedState.rideId;
        } else {
          // Clear old state
          await storageHelpers.removeItem(RIDE_STATE_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading ride state:', error);
    }
    return null;
  };

  // Clear ride state
  const clearRideState = async () => {
    try {
      await storageHelpers.removeItem(RIDE_STATE_KEY);
      console.log('🗑️ Ride state cleared');
    } catch (error) {
      console.error('Error clearing ride state:', error);
    }
  };

  // Save user session
  const saveUserSession = async () => {
    try {
      await storageHelpers.setItem(USER_SESSION_KEY, JSON.stringify({
        userId: user?._id,
        lastActive: Date.now(),
        currentScreen: 'fare',
        rideId: rideId
      }));
    } catch (error) {
      console.error('Error saving user session:', error);
    }
  };

  // Cancel ride function
  const cancelRide = async () => {
    if (!rideId) return;
    
    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);
              const res = await axios.post(CANCEL_API, {
                rideId,
                reason: 'user_cancelled'
              });
              
              if (res.data.success) {
                // Clear saved state
                await clearRideState();
                
                // Clear local state
                setRideStatus(null);
                setSearching(false);
                setDriverInfo(null);
                
                // Show success message
                Alert.alert(
                  "Ride Cancelled",
                  "Your ride has been cancelled successfully.",
                  [{ text: "OK", onPress: () => router.replace("/requestRide") }]
                );
              } else {
                Alert.alert("Error", res.data.message || "Failed to cancel ride");
              }
            } catch (error) {
              console.error("Cancel ride error:", error);
              Alert.alert("Error", "Failed to cancel ride. Please try again.");
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  // Function to call driver
  const callDriver = () => {
    if (driverInfo?.phone) {
      const phoneNumber = driverInfo.phone.startsWith('+') 
        ? driverInfo.phone 
        : `+254${driverInfo.phone.replace(/^0+/, '')}`;
      
      Linking.openURL(`tel:${phoneNumber}`).catch(err => {
        Alert.alert("Error", "Could not make phone call.");
        console.error('Error calling:', err);
      });
    } else {
      Alert.alert("No Phone", "Driver phone number not available.");
    }
  };

  // Function to copy driver phone
  const copyDriverPhone = () => {
    if (driverInfo?.phone) {
      Alert.alert(
        "Driver Phone",
        `Phone: ${driverInfo.phone}\n\nYou can copy this number to call the driver.`,
        [
          { text: "Call Now", onPress: () => callDriver() },
          { text: "OK" }
        ]
      );
    } else {
      Alert.alert("No Phone", "Driver phone number not available.");
    }
  };

  // Handle notification
  const handleNotification = (notification) => {
    const isAppInBackground = appState.current !== 'active';
    
    if (notification.type === 'driver_accepted' && isAppInBackground) {
      const notificationObj = {
        id: Date.now(),
        title: "🚗 Driver Accepted!",
        message: notification.message,
        type: 'driver_accepted',
        payload: notification
      };
      setPendingNotifications(prev => [...prev, notificationObj]);
      notificationCountRef.current++;
    }
  };

  // Function to show pending notifications when app comes to foreground
  const showPendingNotifications = () => {
    if (pendingNotifications.length === 0) {
      console.log('No pending notifications to show');
      return;
    }
    
    console.log(`Showing ${pendingNotifications.length} pending notifications`);
    
    // Get the most recent notification
    const latestNotification = pendingNotifications[pendingNotifications.length - 1];
    
    if (latestNotification.type === 'driver_assigned' || latestNotification.type === 'driver_accepted') {
      const driverName = latestNotification.payload?.driver?.name || latestNotification.payload?.info?.name || 'Unknown';
      const carType = latestNotification.payload?.driver?.carType || latestNotification.payload?.info?.carType || '';
      const carPlate = latestNotification.payload?.driver?.carPlate || '';
      const driverPhone = latestNotification.payload?.driver?.phone || latestNotification.payload?.info?.phone || '';
      
      Alert.alert(
        latestNotification.title,
        latestNotification.message,
        [
          {
            text: "Track Ride",
            onPress: () => {
              router.replace({
                pathname: "/requestRide",
                params: { 
                  rideId: rideId,
                  driverAssigned: true,
                  driverName: driverName,
                  carPlate: carPlate,
                  carType: carType,
                  driverPhone: driverPhone
                }
              });
              // Clear all notifications after action
              setPendingNotifications([]);
              notificationCountRef.current = 0;
            }
          }
        ],
        { cancelable: false }
      );
    } else if (latestNotification.type === 'search_failed') {
      Alert.alert(
        latestNotification.title,
        latestNotification.message,
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/requestRide");
              // Clear all notifications after action
              setPendingNotifications([]);
              notificationCountRef.current = 0;
            }
          }
        ]
      );
    }
  };

  // Function to manually check for notifications
  const checkForNotifications = () => {
    if (pendingNotifications.length > 0) {
      showPendingNotifications();
    } else {
      Alert.alert("No Notifications", "You don't have any pending notifications.");
    }
  };

  useEffect(() => {
    // Save user session when component mounts
    saveUserSession();
    
    // Load saved ride state
    loadRideState().then(savedRideId => {
      if (savedRideId && savedRideId !== rideId) {
        console.log('Found saved ride:', savedRideId);
      }
    });
    
    console.log("Creating socket connection...");
    
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 20000,
      forceNew: true
    });

    socketRef.current = s;
    setSocket(s);

    s.on("connect", () => {
      console.log("User socket connected:", s.id);

      // register user with rideId
      if (rideId) {
        s.emit("register_user", { rideId, userId: user?._id });
        console.log(`Registered user for ride ${rideId}`);
        
        // Request any pending notifications
        s.emit("get_pending_notifications", { 
          userId: user?._id, 
          userType: 'user' 
        });
      }
    });

    // Handle incoming notifications
    s.on("notification", (notification) => {
      console.log("📱 Notification received:", notification);
      handleNotification(notification);
    });

    // Handle pending notifications
    s.on("pending_notifications", ({ notifications }) => {
      console.log(`📱 Received ${notifications?.length || 0} pending notifications`);
      if (notifications && notifications.length > 0) {
        notifications.forEach(notification => {
          handleNotification(notification);
        });
      }
    });

    s.on("ride_update", (payload) => {
      console.log("ride_update received:", payload);

      if (!payload) return;
      if (payload.rideId !== rideId) return;

      setRideStatus(payload.status);

      // Save updated state
      saveRideState({
        rideId,
        rideStatus: payload.status,
        searching: payload.status === 'searching',
        driverInfo: payload.driver || null
      });

      // Handle notifications based on app state
      const isAppInBackground = appState.current !== 'active';

      if (payload.status === "driver_assigned") {
        setSearching(false);
        setDriverInfo(payload.driver);
        
        // Vibrate to notify user
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 500, 200, 500]);
        } else {
          Vibration.vibrate([0, 500, 200, 500]);
        }
        
        // Store notification if app is in background
        if (isAppInBackground) {
          const notification = {
            id: Date.now(),
            title: "🚗 Driver Assigned!",
            message: `Driver ${payload.driver.name} accepted your ride.\nCar: ${payload.driver.carType} (${payload.driver.carPlate})`,
            type: 'driver_assigned',
            payload
          };
          setPendingNotifications(prev => [...prev, notification]);
          notificationCountRef.current++;
          console.log(`📱 Notification stored (background): Driver ${payload.driver.name} assigned`);
        }
        
        // Show alert immediately if app is in foreground
        if (!isAppInBackground) {
          Alert.alert(
            "Driver Assigned",
            `Driver ${payload.driver.name} accepted.\nCar: ${payload.driver.carType} (${payload.driver.carPlate})`,
            [
              {
                text: "Track Ride",
                onPress: () => {
                  router.replace({
                    pathname: "/requestRide",
                    params: { 
                      rideId: rideId,
                      driverAssigned: true,
                      driverName: payload.driver.name,
                      carPlate: payload.driver.carPlate,
                      carType: payload.driver.carType,
                      driverPhone: payload.driver.phone
                    }
                  });
                }
              }
            ],
            { cancelable: false }
          );
        }
      }

      if (payload.status === "search_failed") {
        setSearching(false);
        
        // Vibrate to notify user
        Vibration.vibrate(1000);
        
        // Clear saved state
        clearRideState();
        
        // Store notification if app is in background
        if (isAppInBackground) {
          const notification = {
            id: Date.now(),
            title: "❌ No Drivers Available",
            message: "No drivers accepted the ride. Please try again.",
            type: 'search_failed'
          };
          setPendingNotifications(prev => [...prev, notification]);
          notificationCountRef.current++;
          console.log('📱 Notification stored (background): Search failed');
        }
        
        // Show alert immediately if app is in foreground
        if (!isAppInBackground) {
          Alert.alert(
            "No Drivers Available", 
            "No drivers accepted the ride. Please try again.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/requestRide")
              }
            ]
          );
        }
      }
    });

    // Listen for ride cancelled
    s.on("ride_cancelled_user", (payload) => {
      console.log("Ride cancelled for user:", payload);
      
      if (payload.rideId !== rideId) return;
      
      // Clear state
      setRideStatus('cancelled');
      setSearching(false);
      setDriverInfo(null);
      
      // Clear saved state
      clearRideState();
      
      // Show notification
      Alert.alert(
        "Ride Cancelled",
        "Your ride has been cancelled.",
        [{ text: "OK", onPress: () => router.replace("/requestRide") }]
      );
    });
    
    // Listen for ride started
    s.on("ride_started", (payload) => {
      console.log("Ride started:", payload);
      
      if (payload.rideId !== rideId) return;
      
      setRideStatus('in_progress');
      
      Alert.alert(
        "Ride Started",
        "Your ride has started. Driver is on the way.",
        [{ text: "OK" }]
      );
    });
    
    // Listen for ride completed
    s.on("ride_completed", (payload) => {
      console.log("Ride completed:", payload);
      
      if (payload.rideId !== rideId) return;
      
      // Clear state
      setRideStatus('completed');
      setDriverInfo(null);
      
      // Clear saved state
      clearRideState();
      
      Alert.alert(
        "Ride Completed",
        `Your ride has been completed.\nFare: ${payload.fare || 'N/A'} KES`,
        [{ text: "OK", onPress: () => router.replace("/requestRide") }]
      );
    });

    // Listen for direct driver responses (fallback)
    s.on("driver_response_user", (payload) => {
      console.log("Direct driver response received:", payload);
      
      if (payload.rideId !== rideId) return;
      
      if (payload.accepted) {
        setRideStatus('driver_assigned');
        setSearching(false);
        setDriverInfo(payload.info);
        
        // Save state
        saveRideState({
          rideId,
          rideStatus: 'driver_assigned',
          searching: false,
          driverInfo: payload.info
        });
        
        // Vibrate to notify user
        Vibration.vibrate([0, 500, 200, 500]);
        
        Alert.alert(
          "Driver Accepted!",
          `Driver ${payload.info?.name || 'Unknown'} accepted your ride.`,
          [
            {
              text: "OK",
              onPress: () => {
                router.replace({
                  pathname: "/requestRide",
                  params: { 
                    rideId: rideId,
                    driverAssigned: true,
                    driverName: payload.info?.name,
                    carType: payload.info?.carType,
                    driverPhone: payload.info?.phone
                  }
                });
              }
            }
          ]
        );
      }
    });

    s.on("disconnect", (reason) => {
      console.log("User socket disconnected:", reason);
      // Attempt reconnection
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.connect();
        }
      }, 2000);
    });

    s.on("connect_error", (error) => {
      console.log("Socket connection error:", error.message);
    });

    s.on("error", (error) => {
      console.log("Socket error:", error);
    });

    // Handle app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('App state changed:', appState.current, '->', nextAppState);
      
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        
        // Save session
        saveUserSession();
        
        // Show any pending notifications
        if (pendingNotifications.length > 0) {
          console.log(`Showing ${pendingNotifications.length} pending notifications`);
          showPendingNotifications();
        }
        
        // Request pending notifications from server
        if (socketRef.current?.connected && rideId) {
          socketRef.current.emit("get_pending_notifications", { 
            userId: user?._id, 
            userType: 'user' 
          });
        }
        
        // Re-establish socket connection if needed
        if (socketRef.current && !socketRef.current.connected) {
          console.log('Reconnecting socket...');
          socketRef.current.connect();
        }
      }
      
      appState.current = nextAppState;
    });

    return () => {
      console.log("Cleaning up socket...");
      subscription.remove();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [rideId, user]);

  const handleConfirmBooking = async () => {
    if (!rideId) {
      Alert.alert("Error", "Ride ID missing.");
      return;
    }

    try {
      setLoading(true);
      setSearching(true);
      setRideStatus('searching');
      
      // Save state
      saveRideState({
        rideId,
        rideStatus: 'searching',
        searching: true
      });
      
      // Clear any old notifications when starting new search
      setPendingNotifications([]);
      notificationCountRef.current = 0;

      console.log("Matching ride:", rideId);
      const res = await axios.post("http://192.168.1.112:3005/api/match", {
        rideId,
        userPhone: user?.phone || 'Unknown',
        pickupLocation: params.pickupLocation || {},
        destination: {
          name: destinationName,
          address: destinationAddress,
          coordinates: params.destinationCoordinates || {}
        },
        fare: fareValue,
        distance: distance,
        time: time
      });

      console.log("Match response:", res.data);
      
      if (res.data.success) {
        console.log("Searching for drivers...");
        // The socket will handle the rest of the flow via ride_update events
      } else {
        setSearching(false);
        setLoading(false);
        setRideStatus('search_failed');
        // Clear saved state on failure
        clearRideState();
        Alert.alert("No Drivers", res.data.message || "No drivers available at the moment. Please try again later.");
      }

    } catch (e) {
      console.error("Matching error:", e);
      setLoading(false);
      setSearching(false);
      setRideStatus('error');
      // Clear saved state on error
      clearRideState();
      Alert.alert("Error", "Failed to book ride. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderStatusContent = () => {
    switch (rideStatus) {
      case 'searching':
        return (
          <View style={styles.statusCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.statusTitle}>Finding a Driver</Text>
            <Text style={styles.statusSubtitle}>We're looking for the nearest available driver</Text>
            <Text style={styles.notificationNote}>
              💡 You'll be notified even if you leave the app
            </Text>
            
            {/* Cancel Button */}
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={cancelRide}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.cancelButtonText}>Cancel Search</Text>
                </>
              )}
            </TouchableOpacity>
            
            {pendingNotifications.length > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  🔔 {pendingNotifications.length} notification{pendingNotifications.length > 1 ? 's' : ''} pending
                </Text>
              </View>
            )}
          </View>
        );
      case 'driver_assigned':
        return (
          <View style={[styles.statusCard, styles.successCard]}>
            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
            <Text style={styles.statusTitle}>Driver Found!</Text>
            <Text style={styles.statusSubtitle}>Your driver is on the way</Text>
            
            {driverInfo && (
              <View style={styles.driverInfoContainer}>
                <Text style={styles.driverName}>Driver: {driverInfo.name}</Text>
                <Text style={styles.driverCar}>Car: {driverInfo.carType} {driverInfo.carPlate ? `(${driverInfo.carPlate})` : ''}</Text>
                
                {driverInfo.phone && (
                  <View style={styles.phoneActions}>
                    <TouchableOpacity 
                      style={styles.callButton}
                      onPress={callDriver}
                    >
                      <Ionicons name="call" size={20} color="#fff" />
                      <Text style={styles.callButtonText}>Call Driver</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.copyButton}
                      onPress={copyDriverPhone}
                    >
                      <Ionicons name="copy" size={20} color={Colors.primary} />
                      <Text style={styles.copyButtonText}>Copy Phone</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            
            {/* Cancel Button */}
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={cancelRide}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                </>
              )}
            </TouchableOpacity>
            
            <PrimaryButton
              title="Track Ride"
              onPress={() => {
                router.replace({
                  pathname: "/requestRide",
                  params: { 
                    rideId: rideId,
                    driverAssigned: true,
                    driverName: driverInfo?.name,
                    carPlate: driverInfo?.carPlate,
                    carType: driverInfo?.carType,
                    driverPhone: driverInfo?.phone
                  }
                });
              }}
              style={{ marginTop: 10 }}
            />
          </View>
        );
      case 'in_progress':
        return (
          <View style={[styles.statusCard, styles.inProgressCard]}>
            <Ionicons name="car" size={60} color="#2196F3" />
            <Text style={styles.statusTitle}>Ride In Progress</Text>
            <Text style={styles.statusSubtitle}>Your ride is currently ongoing</Text>
            
            {driverInfo && (
              <View style={styles.driverInfoContainer}>
                <Text style={styles.driverName}>Driver: {driverInfo.name}</Text>
                <Text style={styles.driverCar}>Car: {driverInfo.carType} {driverInfo.carPlate ? `(${driverInfo.carPlate})` : ''}</Text>
                
                {driverInfo.phone && (
                  <View style={styles.phoneActions}>
                    <TouchableOpacity 
                      style={styles.callButton}
                      onPress={callDriver}
                    >
                      <Ionicons name="call" size={20} color="#fff" />
                      <Text style={styles.callButtonText}>Call Driver</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.copyButton}
                      onPress={copyDriverPhone}
                    >
                      <Ionicons name="copy" size={20} color={Colors.primary} />
                      <Text style={styles.copyButtonText}>Copy Phone</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            
            <Text style={styles.statusNote}>Waiting for driver to complete the ride...</Text>
          </View>
        );
      case 'completed':
        return (
          <View style={[styles.statusCard, styles.completedCard]}>
            <Ionicons name="checkmark-done-circle" size={60} color="#4CAF50" />
            <Text style={styles.statusTitle}>Ride Completed!</Text>
            <Text style={styles.statusSubtitle}>Thank you for using Safari Ride</Text>
            
            <PrimaryButton
              title="Book Another Ride"
              onPress={() => router.replace("/requestRide")}
              style={{ marginTop: 20 }}
            />
          </View>
        );
      case 'cancelled':
        return (
          <View style={[styles.statusCard, styles.errorCard]}>
            <Ionicons name="close-circle" size={60} color="#F44336" />
            <Text style={styles.statusTitle}>Ride Cancelled</Text>
            <Text style={styles.statusSubtitle}>Your ride has been cancelled</Text>
            
            <PrimaryButton
              title="Book New Ride"
              onPress={() => router.replace("/requestRide")}
              style={{ marginTop: 20 }}
            />
          </View>
        );
      case 'search_failed':
        return (
          <View style={[styles.statusCard, styles.errorCard]}>
            <Ionicons name="alert-circle" size={60} color="#F44336" />
            <Text style={styles.statusTitle}>No Drivers Available</Text>
            <Text style={styles.statusSubtitle}>Please try again in a few minutes</Text>
            <PrimaryButton
              title="Try Again"
              onPress={handleConfirmBooking}
              style={{ marginTop: 20 }}
            />
          </View>
        );
      default:
        return (
          <View style={styles.card}>
            <Text style={styles.label}>Destination:</Text>
            <Text style={styles.value}>{destinationName}</Text>
            {destinationAddress && <Text style={styles.address}>{destinationAddress}</Text>}

            <View style={styles.row}>
              <Text style={styles.label}>Distance:</Text>
              <Text style={styles.value}>{distance ? `${distance} km` : 'N/A'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Estimated Time:</Text>
              <Text style={styles.value}>{time ? `${time} mins` : 'N/A'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Fare:</Text>
              <Text style={styles.value}>{currency || 'KES'} {fareValue}</Text>
            </View>

            {isSurge && (
              <View style={styles.surgeContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#ff6600" />
                <Text style={styles.surgeText}>Surge Pricing x{surgeValue.toFixed(1)}</Text>
              </View>
            )}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Ride Details</Text>
        
        {renderStatusContent()}

        {!searching && !rideStatus && (
          <PrimaryButton
            title={loading ? "Processing..." : "Confirm Ride"}
            onPress={handleConfirmBooking}
            disabled={loading}
          />
        )}

        {loading && <ActivityIndicator style={{ marginTop: 12 }} color={Colors.secondary} />}
        
        {searching && (
          <View style={styles.searchingContainer}>
            <Text style={styles.backgroundNote}>
              🔔 You'll receive notifications even if you minimize the app
            </Text>
            {pendingNotifications.length > 0 && (
              <TouchableOpacity 
                style={styles.showNotificationsButton}
                onPress={checkForNotifications}
              >
                <Ionicons name="notifications" size={20} color="#fff" />
                <Text style={styles.showNotificationsText}>
                  Show {pendingNotifications.length} Pending Notification{pendingNotifications.length > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default FareScreen;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.primary 
  },
  scrollContent: { 
    padding: 20, 
    flexGrow: 1, 
    justifyContent: 'space-between' 
  },
  title: {
    fontSize: 24, 
    fontWeight: '700',
    color: Colors.secondary, 
    marginBottom: 20, 
    textAlign: 'center'
  },
  card: {
    backgroundColor: '#fff', 
    borderRadius: 15,
    padding: 20, 
    marginBottom: 30, 
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#666' 
  },
  value: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: Colors.primary, 
    marginBottom: 10 
  },
  address: { 
    fontSize: 14, 
    fontStyle: 'italic', 
    color: '#444', 
    marginBottom: 10 
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10 
  },
  surgeContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 10 
  },
  surgeText: { 
    color: '#ff6600', 
    marginLeft: 5, 
    fontWeight: '600', 
    fontSize: 14 
  },
  statusCard: {
    backgroundColor: '#fff', 
    borderRadius: 15,
    padding: 30, 
    marginBottom: 30, 
    elevation: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  successCard: { 
    backgroundColor: '#f0f9f0' 
  },
  inProgressCard: { 
    backgroundColor: '#f0f8ff' 
  },
  completedCard: { 
    backgroundColor: '#f0fff0' 
  },
  errorCard: { 
    backgroundColor: '#fff0f0' 
  },
  statusTitle: {
    fontSize: 22, 
    fontWeight: '700',
    color: Colors.primary, 
    marginTop: 15,
    textAlign: 'center'
  },
  statusSubtitle: {
    fontSize: 16, 
    color: '#666',
    marginTop: 5, 
    textAlign: 'center'
  },
  statusNote: {
    fontSize: 14, 
    color: '#666',
    marginTop: 15, 
    textAlign: 'center',
    fontStyle: 'italic'
  },
  driverInfoContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(240, 249, 240, 0.5)',
    borderRadius: 10,
    width: '100%',
    alignItems: 'center'
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 5
  },
  driverCar: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15
  },
  phoneActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20
  },
  callButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  callButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },
  copyButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  copyButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },
  cancelButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  notificationNote: {
    fontSize: 14, 
    color: '#666',
    marginTop: 15, 
    textAlign: 'center',
    fontStyle: 'italic'
  },
  backgroundNote: {
    fontSize: 14, 
    color: Colors.secondary,
    marginTop: 20, 
    textAlign: 'center',
    fontStyle: 'italic'
  },
  notificationBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 15
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  showNotificationsButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 15,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  showNotificationsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },
  searchingContainer: {
    alignItems: 'center',
    marginTop: 20
  }
});