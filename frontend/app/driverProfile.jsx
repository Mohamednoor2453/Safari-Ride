// frontend/app/driverProfile.jsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  AppState,
  Linking,
  Vibration
} from 'react-native';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';

const SOCKET_URL = 'http://192.168.1.112:3005';
const PROFILE_API = 'http://192.168.1.112:3004/api/driverProfile';
const TOGGLE_ONLINE_API = 'http://192.168.1.112:3004/api/toggleOnline';
const RIDE_API = "http://192.168.1.112:3005/api/ride";

// Simple storage helpers
const storageHelpers = {
  setItem: async (key, value) => {
    try {
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
const DRIVER_STATE_KEY = 'driver_state_data';
const DRIVER_SESSION_KEY = 'driver_session_data';

export default function DriverProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentRide, setCurrentRide] = useState(null);
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const [rideStatus, setRideStatus] = useState(null);
  const [startingRide, setStartingRide] = useState(false);
  const [endingRide, setEndingRide] = useState(false);
  const socketRef = useRef(null);
  const locationWatcherRef = useRef(null);
  const router = useRouter();
  const appState = useRef(AppState.currentState);

  // Use ref for profile to access current value in socket callbacks
  const profileRef = useRef(null);

  // Save driver state
  const saveDriverState = async (state) => {
    try {
      await storageHelpers.setItem(DRIVER_STATE_KEY, {
        ...state,
        savedAt: Date.now()
      });
    } catch (error) {
      console.error('Error saving driver state:', error);
    }
  };

  // Load driver state
  const loadDriverState = async () => {
    try {
      const savedState = await storageHelpers.getItem(DRIVER_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        const isRecent = Date.now() - (state.savedAt || 0) < 3600000; // 1 hour
        
        if (isRecent) {
          setOnline(state.online || false);
          if (state.currentRide) {
            setCurrentRide(state.currentRide);
            fetchRideStatus(state.currentRide.rideId);
          }
          return state;
        }
      }
    } catch (error) {
      console.error('Error loading driver state:', error);
    }
    return null;
  };

  // Save driver session
  const saveDriverSession = async () => {
    try {
      await storageHelpers.setItem(DRIVER_SESSION_KEY, JSON.stringify({
        driverId: profile?._id,
        lastActive: Date.now(),
        currentScreen: 'driverProfile',
        online: online
      }));
    } catch (error) {
      console.error('Error saving driver session:', error);
    }
  };

  // Clear driver state
  const clearDriverState = async () => {
    try {
      await storageHelpers.removeItem(DRIVER_STATE_KEY);
    } catch (error) {
      console.error('Error clearing driver state:', error);
    }
  };

  // Fetch ride status
  const fetchRideStatus = async (rideId) => {
    try {
      const res = await fetch(`${RIDE_API}/status/${rideId}`);
      const data = await res.json();
      if (data.success) {
        setRideStatus(data.ride.status);
      }
    } catch (error) {
      console.error('Error fetching ride status:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      console.log('🔍 Fetching driver profile...');
      const res = await fetch(PROFILE_API, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await res.json();
      console.log('📄 Profile API Response:', data);
      
      if (data.success) {
        const profileData = { 
          ...data.data, 
          online: data.data.online || false 
        };
        
        if (!profileData._id) {
          console.log('❌ CRITICAL: No _id field in profile response!');
          Alert.alert('Error', 'Driver ID not found in profile');
          return;
        }
        
        setProfile(profileData);
        profileRef.current = profileData;
        
        // Load saved state
        const savedState = await loadDriverState();
        if (savedState && savedState.online !== undefined) {
          setOnline(savedState.online);
          console.log('✅ Loaded saved driver state, online:', savedState.online);
        } else {
          setOnline(profileData.online || false);
        }
        
        console.log('✅ Profile loaded - Name:', profileData.name, 'ID:', profileData._id);
        
        // Register with socket if we have ID and socket is connected
        if (profileData._id && socketRef.current && socketConnected) {
          console.log('🚗 Re-registering driver with socket:', profileData._id);
          socketRef.current.emit('register_driver', { driverId: profileData._id.toString() });
        }
      } else {
        setProfile(null);
        profileRef.current = null;
        console.log('❌ Profile load failed:', data.error);
      }
    } catch (error) {
      console.error('❌ Profile fetch error:', error);
      setProfile(null);
      profileRef.current = null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    
    // Save session when component mounts
    saveDriverSession();
    
    // Handle app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('Driver app state changed:', appState.current, '->', nextAppState);
      
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('Driver app came to foreground!');
        
        // Save session
        saveDriverSession();
        
        // Show any pending notifications
        if (pendingNotifications.length > 0) {
          showPendingNotifications();
        }
        
        // Request pending notifications from server
        if (socketRef.current?.connected && profileRef.current?._id) {
          socketRef.current.emit("get_pending_notifications", { 
            userId: profileRef.current._id, 
            userType: 'driver' 
          });
        }
        
        // Reconnect socket if needed
        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
      
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Initialize socket connection
  useEffect(() => {
    console.log('🔌 Initializing socket connection to:', SOCKET_URL);
    
    const s = io(SOCKET_URL, { 
      transports: ['websocket', 'polling'], 
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 20000
    });

    socketRef.current = s;

    s.on('connect', () => {
      console.log('✅ Socket connected successfully! ID:', s.id);
      setSocketConnected(true);
      
      // Register driver when socket connects AND profile is loaded
      if (profileRef.current && profileRef.current._id) {
        console.log('🚗 Auto-registering driver with ID:', profileRef.current._id);
        s.emit('register_driver', { driverId: profileRef.current._id.toString() });
      } else {
        console.log('⚠️ Profile not loaded yet, will register when available');
      }
    });

    s.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setSocketConnected(false);
      
      // Auto-reconnect
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.connect();
        }
      }, 2000);
    });

    s.on('connect_error', (error) => {
      console.log('❌ Socket connection error:', error.message);
      setSocketConnected(false);
    });

    // Handle notifications
    s.on('notification', (notification) => {
      console.log('📱 Driver notification received:', notification);
      handleNotification(notification);
    });

    // Handle pending notifications
    s.on('pending_notifications', ({ notifications }) => {
      console.log(`📱 Driver received ${notifications?.length || 0} pending notifications`);
      if (notifications && notifications.length > 0) {
        notifications.forEach(notification => {
          handleNotification(notification);
        });
      }
    });

    s.on('ride_request', (payload) => {
      console.log('🎯 RIDE REQUEST RECEIVED!', payload);
      if (!payload) return;
      
      // Notify server that ride request was sent
      s.emit('ride_request_sent', { 
        driverId: profileRef.current?._id,
        rideId: payload.rideId 
      });
      
      const currentProfile = profileRef.current;
      if (!currentProfile || !currentProfile._id) {
        console.log('❌ Profile not available when ride request received');
        Alert.alert('Error', 'Driver profile not loaded. Please refresh and try again.');
        return;
      }
      
      // Check if app is in background
      const isAppInBackground = appState.current !== 'active';
      
      if (isAppInBackground) {
        // Store notification for when app comes to foreground
        const notification = {
          id: Date.now(),
          title: '🚗 NEW RIDE REQUEST!',
          message: `Pickup: ${payload.pickup?.lat ? `${payload.pickup.lat.toFixed(4)}, ${payload.pickup.lng.toFixed(4)}` : 'Location'}\nDestination: ${payload.destinationName || 'Not specified'}\nFare: ${payload.fare || '0'} KES`,
          type: 'ride_request',
          payload
        };
        setPendingNotifications(prev => [...prev, notification]);
        console.log('📱 Ride request stored (background)');
      } else {
        // Show accept/decline alert immediately
        showRideRequestAlert(payload, s, currentProfile);
      }
    });

    s.on('ride_confirmed_to_driver', (payload) => {
      console.log('✅ Ride confirmed to driver:', payload);
      
      // Save current ride state
      setCurrentRide(payload);
      setRideStatus('driver_assigned');
      saveDriverState({
        online: true,
        currentRide: payload
      });
      
      Alert.alert('Ride Confirmed', `Ride to ${payload.destination} has been confirmed.`);
    });

    // Handle ride cancelled
    s.on('ride_cancelled', (payload) => {
      console.log('Ride cancelled notification:', payload);
      
      // Clear current ride
      setCurrentRide(null);
      setRideStatus(null);
      
      // Clear saved state
      clearDriverState();
      
      // Show alert
      Alert.alert(
        'Ride Cancelled',
        'The user has cancelled the ride. You are now available for new requests.',
        [{ text: 'OK' }]
      );
    });

    return () => {
      console.log('🧹 Cleaning up socket connection...');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Update profileRef when profile changes
  useEffect(() => {
    profileRef.current = profile;
    
    // Save state when profile changes
    if (profile) {
      saveDriverState({
        online,
        profile: { _id: profile._id, name: profile.name }
      });
    }
  }, [profile, online]);

  const showRideRequestAlert = (payload, socket, currentProfile) => {
    Alert.alert(
      '🚗 NEW RIDE REQUEST!',
      `📍 Pickup: ${payload.pickup?.lat ? `${payload.pickup.lat.toFixed(4)}, ${payload.pickup.lng.toFixed(4)}` : 'Location not specified'}\n🎯 Destination: ${payload.destinationName || 'Not specified'}\n💰 Fare: ${payload.fare || '0'} KES\n📞 User: ${payload.userPhone || 'Not specified'}`,
      [
        { 
          text: '❌ DECLINE', 
          onPress: () => {
            console.log('Driver DECLINED ride:', payload.rideId);
            socket.emit('driver_response', { 
              rideId: payload.rideId, 
              driverId: currentProfile._id.toString(), 
              accepted: false 
            });
            Alert.alert('Ride Declined', 'You declined the ride request.');
          }, 
          style: 'destructive' 
        },
        { 
          text: '✅ ACCEPT', 
          onPress: () => {
            console.log('Driver ACCEPTED ride:', payload.rideId);
            socket.emit('driver_response', { 
              rideId: payload.rideId, 
              driverId: currentProfile._id.toString(), 
              accepted: true, 
              info: { 
                name: currentProfile.name, 
                carPlate: currentProfile.plainPlate,
                carType: currentProfile.carType,
                phone: currentProfile.phone
              } 
            });
            Alert.alert('Ride Accepted!', 'You have accepted the ride. Please proceed to the pickup location.');
          } 
        }
      ],
      { cancelable: false }
    );
  };

  const handleNotification = (notification) => {
    const isAppInBackground = appState.current !== 'active';
    
    if (notification.type === 'ride_request' && isAppInBackground) {
      const notificationObj = {
        id: Date.now(),
        title: notification.title || '🚗 New Ride Request',
        message: notification.message,
        type: 'ride_request',
        payload: notification.payload
      };
      setPendingNotifications(prev => [...prev, notificationObj]);
    }
  };

  const showPendingNotifications = () => {
    if (pendingNotifications.length === 0) {
      Alert.alert("No Notifications", "You don't have any pending notifications.");
      return;
    }
    
    // Show most recent notification
    const latestNotification = pendingNotifications[pendingNotifications.length - 1];
    
    if (latestNotification.type === 'ride_request') {
      const payload = latestNotification.payload;
      const currentProfile = profileRef.current;
      
      if (currentProfile) {
        showRideRequestAlert(payload, socketRef.current, currentProfile);
        // Remove this notification after showing
        setPendingNotifications(prev => prev.filter(n => n.id !== latestNotification.id));
      }
    }
  };

  // Function to call user
  const callUser = () => {
    if (currentRide?.userPhone) {
      const phoneNumber = currentRide.userPhone.startsWith('+') 
        ? currentRide.userPhone 
        : `+254${currentRide.userPhone.replace(/^0+/, '')}`;
      
      Linking.openURL(`tel:${phoneNumber}`).catch(err => {
        Alert.alert("Error", "Could not make phone call.");
        console.error('Error calling:', err);
      });
    } else {
      Alert.alert("No Phone", "User phone number not available.");
    }
  };

  // Start ride function
  const startRide = async () => {
    if (!currentRide?.rideId || !profile?._id) {
      Alert.alert('Error', 'No active ride or driver info');
      return;
    }
    
    try {
      setStartingRide(true);
      const res = await fetch(`${RIDE_API}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: currentRide.rideId,
          driverId: profile._id
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setRideStatus('in_progress');
        saveDriverState({
          online: true,
          currentRide: currentRide,
          rideStatus: 'in_progress'
        });
        Alert.alert('Ride Started', 'You have started the ride.');
      } else {
        Alert.alert('Error', data.message || 'Failed to start ride');
      }
    } catch (error) {
      console.error('Start ride error:', error);
      Alert.alert('Error', 'Failed to start ride');
    } finally {
      setStartingRide(false);
    }
  };
  
  // End ride function
  const endRide = async () => {
    if (!currentRide?.rideId || !profile?._id) {
      Alert.alert('Error', 'No active ride or driver info');
      return;
    }
    
    Alert.alert(
      'End Ride',
      'Are you sure you want to end this ride?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, End Ride', 
          style: 'destructive',
          onPress: async () => {
            try {
              setEndingRide(true);
              const res = await fetch(`${RIDE_API}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  rideId: currentRide.rideId,
                  driverId: profile._id
                })
              });
              
              const data = await res.json();
              
              if (data.success) {
                // Clear current ride
                setCurrentRide(null);
                setRideStatus(null);
                
                // Clear saved state
                clearDriverState();
                
                Alert.alert(
                  'Ride Completed',
                  'You have successfully completed the ride.',
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Error', data.message || 'Failed to end ride');
              }
            } catch (error) {
              console.error('End ride error:', error);
              Alert.alert('Error', 'Failed to end ride');
            } finally {
              setEndingRide(false);
            }
          }
        }
      ]
    );
  };

  const startLocationUpdates = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return false;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Send initial location to socket
      if (socketRef.current && profileRef.current?._id) {
        socketRef.current.emit('driver_location', { 
          driverId: profileRef.current._id.toString(), 
          lat: latitude, 
          lng: longitude, 
          available: true 
        });
        
        // Register with socket
        socketRef.current.emit('register_driver', { 
          driverId: profileRef.current._id.toString(),
          location: { lat: latitude, lng: longitude },
          carType: profileRef.current.carType || 'Standard'
        });
      }

      // Start location watcher
      locationWatcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: 10000
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          if (socketRef.current && profileRef.current && profileRef.current._id) {
            socketRef.current.emit('driver_location', { 
              driverId: profileRef.current._id.toString(), 
              lat: latitude, 
              lng: longitude, 
              available: true 
            });
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Error starting location updates:', error);
      Alert.alert('Location Error', 'Failed to start location tracking.');
      return false;
    }
  };

  const stopLocationUpdates = () => {
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
      console.log('📍 Location tracking stopped');
    }
  };

  const onRefresh = () => {
    console.log('🔄 Refreshing profile...');
    setRefreshing(true);
    fetchProfile();
  };

  const toggleOnline = async () => {
    if (!profile?._id) {
      Alert.alert('Error', 'Driver profile not loaded');
      return;
    }

    try {
      const newOnlineStatus = !online;
      
      // Get current location for going online
      let location = null;
      if (newOnlineStatus) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Location permission is needed to go online');
          return;
        }
        
        const loc = await Location.getCurrentPositionAsync({});
        location = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }

      // Update online status via API
      const res = await fetch(TOGGLE_ONLINE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          online: newOnlineStatus,
          location,
          carType: profile.carType || 'Standard'
        }),
        credentials: 'include',
      });

      const data = await res.json();
      
      if (data.success) {
        setOnline(newOnlineStatus);
        
        // Save state
        saveDriverState({
          online: newOnlineStatus,
          profile: { _id: profile._id, name: profile.name }
        });
        
        if (newOnlineStatus) {
          // Start location updates
          const started = await startLocationUpdates();
          if (started) {
            Alert.alert('✅ You are now online', 'You will receive ride requests even when the app is in background.');
          }
        } else {
          // Stop location updates
          stopLocationUpdates();
          // Clear current ride
          setCurrentRide(null);
          setRideStatus(null);
          clearDriverState();
          Alert.alert('⏸️ You are now offline', 'You will not receive ride requests.');
        }
        
        // Refresh profile
        fetchProfile();
      } else {
        Alert.alert('Error', data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('❌ Toggle online error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const renderCurrentRideCard = () => {
    if (!currentRide) return null;
    
    return (
      <View style={styles.currentRideCard}>
        <Text style={styles.currentRideTitle}>🚗 Current Ride</Text>
        <Text style={styles.currentRideText}>To: {currentRide.destination}</Text>
        <Text style={styles.currentRideText}>User: {currentRide.userPhone}</Text>
        <Text style={styles.currentRideText}>Fare: {currentRide.fare} KES</Text>
        
        {/* Ride Status */}
        {rideStatus && (
          <View style={styles.rideStatusContainer}>
            <View style={[
              styles.rideStatusDot, 
              { backgroundColor: 
                rideStatus === 'in_progress' ? '#4CAF50' : 
                rideStatus === 'completed' ? '#2196F3' : 
                '#FF9800'
              }
            ]} />
            <Text style={styles.rideStatusText}>
              {rideStatus === 'in_progress' ? 'In Progress' : 
               rideStatus === 'completed' ? 'Completed' : 
               'Assigned'}
            </Text>
          </View>
        )}
        
        {/* Call User Button */}
        <TouchableOpacity 
          style={styles.callUserButton}
          onPress={callUser}
        >
          <Ionicons name="call" size={20} color="#fff" />
          <Text style={styles.callUserText}>Call User</Text>
        </TouchableOpacity>
        
        {/* Start/End Ride Buttons */}
        <View style={styles.rideActionsContainer}>
          {rideStatus !== 'in_progress' && rideStatus !== 'completed' && (
            <TouchableOpacity 
              style={styles.startRideButton}
              onPress={startRide}
              disabled={startingRide}
            >
              {startingRide ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={20} color="#fff" />
                  <Text style={styles.startRideText}>Start Ride</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          {rideStatus === 'in_progress' && (
            <TouchableOpacity 
              style={styles.endRideButton}
              onPress={endRide}
              disabled={endingRide}
            >
              {endingRide ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.endRideText}>End Ride</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Unable to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Image
        source={{ uri: profile.driverImage }}
        style={styles.profileImage}
      />

      <Text style={styles.name}>{profile.name}</Text>

      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: online ? Colors.green : '#ff4444' }]} />
        <Text style={styles.statusText}>
          {online ? 'ONLINE' : 'OFFLINE'} | 
          Socket: {socketConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}
        </Text>
      </View>

      {renderCurrentRideCard()}

      <View style={styles.card}>
        <Text style={styles.label}>Driver ID:</Text>
        <Text style={styles.smallValue}>{profile._id}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Phone:</Text>
        <Text style={styles.value}>{profile.phone}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Car Type:</Text>
        <Text style={styles.value}>{profile.carType}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>License Plate:</Text>
        <Text style={styles.value}>{profile.plainPlate}</Text>
      </View>

      {/* Pending Notifications */}
      {pendingNotifications.length > 0 && (
        <TouchableOpacity 
          style={styles.notificationsButton}
          onPress={showPendingNotifications}
        >
          <Ionicons name="notifications" size={20} color="#fff" />
          <Text style={styles.notificationsButtonText}>
            {pendingNotifications.length} Pending Notification{pendingNotifications.length > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* Go Online / Offline Button */}
      <TouchableOpacity
        style={[
          styles.onlineButton,
          { backgroundColor: online ? '#ff4444' : Colors.green },
        ]}
        onPress={toggleOnline}
      >
        <Text style={styles.onlineText}>
          {online ? 'GO OFFLINE' : 'GO ONLINE'}
        </Text>
      </TouchableOpacity>

      {online && (
        <Text style={styles.onlineNote}>
          ✅ You will receive ride requests even when the app is in background.
          {pendingNotifications.length > 0 && ` You have ${pendingNotifications.length} pending notification(s).`}
        </Text>
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {
          clearDriverState();
          router.replace('/login');
        }}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: Colors.secondary,
    marginBottom: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    letterSpacing: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  currentRideCard: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    borderLeftWidth: 6,
    borderLeftColor: Colors.green,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentRideTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 10,
  },
  currentRideText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  rideStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'center'
  },
  rideStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  rideStatusText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600'
  },
  callUserButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  callUserText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },
  rideActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10
  },
  startRideButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5
  },
  startRideText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },
  endRideButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5
  },
  endRideText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    borderLeftWidth: 6,
    borderLeftColor: Colors.secondary,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 17,
    color: '#444',
    fontWeight: '600',
  },
  value: {
    fontSize: 20,
    color: Colors.secondary,
    fontWeight: 'bold',
    marginTop: 5,
  },
  smallValue: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontFamily: 'monospace',
  },
  notificationsButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
  },
  notificationsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  onlineButton: {
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  onlineText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  onlineNote: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  logoutButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
    marginTop: 30,
  },
  logoutText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});