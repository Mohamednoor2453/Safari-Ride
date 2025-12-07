// frontend/app/fare.jsx
import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  StyleSheet, View, Text, SafeAreaView,
  ScrollView, Alert, ActivityIndicator,
  AppState, Platform, Vibration, // Vibration is built into React Native
  TouchableOpacity
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/Colors';
import PrimaryButton from '../components/PrimaryButton';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import io from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.112:3005'; 

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
  const socketRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const notificationCountRef = useRef(0);

  // Store notifications to show when app comes to foreground
  const [pendingNotifications, setPendingNotifications] = useState([]);

  useEffect(() => {
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
      }
    });

    s.on("ride_update", (payload) => {
      console.log("ride_update received:", payload);

      if (!payload) return;
      if (payload.rideId !== rideId) return;

      setRideStatus(payload.status);

      // Handle notifications based on app state
      const isAppInBackground = appState.current !== 'active';

      if (payload.status === "driver_assigned") {
        setSearching(false);
        
        // Vibrate to notify user (using React Native's built-in Vibration)
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 500, 200, 500]); // iOS pattern
        } else {
          Vibration.vibrate([0, 500, 200, 500]); // Android pattern
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
                      carType: payload.driver.carType
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
        Vibration.vibrate(1000); // Simple 1 second vibration
        
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

    // Listen for direct driver responses (fallback)
    s.on("driver_response_user", (payload) => {
      console.log("Direct driver response received:", payload);
      
      if (payload.rideId !== rideId) return;
      
      if (payload.accepted) {
        setRideStatus('driver_assigned');
        setSearching(false);
        
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
                    carType: payload.info?.carType
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
        
        // Show any pending notifications
        if (pendingNotifications.length > 0) {
          console.log(`Showing ${pendingNotifications.length} pending notifications`);
          showPendingNotifications();
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

  // Function to show pending notifications when app comes to foreground
  const showPendingNotifications = () => {
    if (pendingNotifications.length === 0) {
      console.log('No pending notifications to show');
      return;
    }
    
    console.log(`Showing ${pendingNotifications.length} pending notifications`);
    
    // Get the most recent notification
    const latestNotification = pendingNotifications[pendingNotifications.length - 1];
    
    if (latestNotification.type === 'driver_assigned') {
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
                  driverName: latestNotification.payload.driver.name,
                  carPlate: latestNotification.payload.driver.carPlate,
                  carType: latestNotification.payload.driver.carType
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

  const handleConfirmBooking = async () => {
    if (!rideId) {
      Alert.alert("Error", "Ride ID missing.");
      return;
    }

    try {
      setLoading(true);
      setSearching(true);
      setRideStatus('searching');
      
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
        Alert.alert("No Drivers", res.data.message || "No drivers available at the moment. Please try again later.");
      }

    } catch (e) {
      console.error("Matching error:", e);
      setLoading(false);
      setSearching(false);
      setRideStatus('error');
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
              💡 We'll notify you even if you leave the app
            </Text>
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