// frontend/app/driverProfile.jsx - FIXED VERSION
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
  Modal
} from 'react-native';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = 'http://192.168.1.112:3005';
const PROFILE_API = 'http://192.168.1.112:3004/api/driverProfile';
const TOGGLE_ONLINE_API = 'http://192.168.1.112:3004/api/toggleOnline';
const RIDE_API = "http://192.168.1.112:3005/api/ride";
const PAYMENT_API = "http://192.168.1.112:3007/api/payments";

// Storage keys
const DRIVER_TOKEN_KEY = 'driverToken';
const DRIVER_INFO_KEY = 'driverInfo';
const DRIVER_STATE_KEY = 'driver_state_data';

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
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [completedRide, setCompletedRide] = useState(null);
  const [authError, setAuthError] = useState(null);
  
  const socketRef = useRef(null);
  const locationWatcherRef = useRef(null);
  const router = useRouter();
  const appState = useRef(AppState.currentState);
  const profileRef = useRef(null);

  // Get authentication headers
  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem(DRIVER_TOKEN_KEY);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  };

  // Fetch driver profile
  const fetchProfile = async () => {
    try {
      console.log('🔍 Fetching driver profile...');
      setAuthError(null);
      
      const headers = await getAuthHeaders();
      
      const res = await fetch(PROFILE_API, {
        method: 'GET',
        headers: headers,
      });

      const data = await res.json();
      console.log('📄 Profile API Response:', data);
      
      if (data.success) {
        const profileData = { 
          ...data.data, 
          online: data.data.online || false 
        };
        
        if (!profileData._id) {
          console.log('❌ No _id field in profile response');
          setAuthError('Driver ID not found in profile');
          return;
        }
        
        setProfile(profileData);
        profileRef.current = profileData;
        
        // Set online status from profile
        setOnline(profileData.online || false);
        
        console.log('✅ Profile loaded - Name:', profileData.name, 'ID:', profileData._id);
        
        // Register with socket
        if (profileData._id && socketRef.current && socketConnected) {
          console.log('🚗 Registering driver with socket:', profileData._id);
          socketRef.current.emit('register_driver', { 
            driverId: profileData._id.toString(),
            name: profileData.name,
            carType: profileData.carType
          });
        }
        
        // Load any saved ride state
        const savedState = await AsyncStorage.getItem(DRIVER_STATE_KEY);
        if (savedState) {
          try {
            const state = JSON.parse(savedState);
            if (state.currentRide && Date.now() - (state.savedAt || 0) < 3600000) {
              setCurrentRide(state.currentRide);
              fetchRideStatus(state.currentRide.rideId);
            }
          } catch (e) {
            console.error('Error loading saved state:', e);
          }
        }
      } else {
        console.log('❌ Profile load failed:', data.error || data.message);
        setAuthError(data.error || data.message || 'Failed to load profile');
        
        // If authentication failed, redirect to login
        if (data.error?.includes('logged in') || data.message?.includes('logged in')) {
          Alert.alert(
            'Session Expired',
            'Please login again',
            [
              { 
                text: 'Login', 
                onPress: () => {
                  AsyncStorage.clear();
                  router.replace('/driverLogin');
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('❌ Profile fetch error:', error);
      setAuthError('Network error: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Save driver state
  const saveDriverState = async (state) => {
    try {
      await AsyncStorage.setItem(DRIVER_STATE_KEY, JSON.stringify({
        ...state,
        savedAt: Date.now()
      }));
    } catch (error) {
      console.error('Error saving driver state:', error);
    }
  };

  // Clear driver state
  const clearDriverState = async () => {
    try {
      await AsyncStorage.removeItem(DRIVER_STATE_KEY);
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

  useEffect(() => {
    fetchProfile();
    
    // Handle app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('Driver app state changed:', appState.current, '->', nextAppState);
      
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('Driver app came to foreground!');
        
        // Show pending notifications
        if (pendingNotifications.length > 0) {
          showPendingNotifications();
        }
        
        // Reconnect socket if needed
        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        }
        
        // Refresh profile
        fetchProfile();
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
        s.emit('register_driver', { 
          driverId: profileRef.current._id.toString(),
          name: profileRef.current.name,
          carType: profileRef.current.carType
        });
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

    s.on('ride_request', (payload) => {
      console.log('🎯 RIDE REQUEST RECEIVED!', payload);
      if (!payload) return;
      
      const currentProfile = profileRef.current;
      if (!currentProfile || !currentProfile._id) {
        console.log('❌ Profile not available when ride request received');
        Alert.alert('Error', 'Driver profile not loaded. Please refresh and try again.');
        return;
      }
      
      // Notify server that ride request was received
      s.emit('ride_request_received', { 
        driverId: currentProfile._id,
        rideId: payload.rideId 
      });
      
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
      
      Alert.alert(
        'Ride Cancelled',
        'The user has cancelled the ride. You are now available for new requests.',
        [{ text: 'OK' }]
      );
    });

    // Handle payment confirmation
    s.on('payment_confirmed', (payload) => {
      console.log('💰 Payment confirmed:', payload);
      
      if (payload.rideId === currentRide?.rideId) {
        setPaymentSuccess(true);
        Alert.alert('Payment Successful', `Payment of ${payload.amount} KES confirmed!`);
        
        // Clear everything after successful payment
        setTimeout(() => {
          setCurrentRide(null);
          setRideStatus(null);
          setShowPaymentOptions(false);
          setPaymentSuccess(false);
          setCompletedRide(null);
          clearDriverState();
        }, 3000);
      }
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
  }, [profile]);

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
  
  // Process M-Pesa Payment
  const processMpesaPayment = async () => {
    if (!currentRide?.rideId || !currentRide?.userPhone || !currentRide?.fare) {
      Alert.alert('Error', 'Missing ride information for payment');
      return;
    }

    try {
      setProcessingPayment(true);
      setPaymentMethod('mpesa');
      
      console.log('💰 Processing M-Pesa payment...');
      
      // Call your payment service
      const response = await fetch(`${PAYMENT_API}/mpesa/stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rideId: currentRide.rideId,
          userPhone: currentRide.userPhone,
          amount: currentRide.fare,
          driverId: profile?._id,
          driverName: profile?.name,
          description: `Safari Ride Payment - ${currentRide.destination}`
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPaymentSuccess(true);
        Alert.alert(
          'Payment Initiated',
          `M-Pesa payment request sent to ${currentRide.userPhone}. Amount: ${currentRide.fare} KES`,
          [
            {
              text: 'OK',
              onPress: () => {
                setPaymentModalVisible(true);
              }
            }
          ]
        );
        
        // Notify socket server
        if (socketRef.current) {
          socketRef.current.emit('payment_initiated', {
            rideId: currentRide.rideId,
            amount: currentRide.fare,
            method: 'mpesa',
            status: 'pending'
          });
        }
      } else {
        Alert.alert('Payment Failed', data.error || 'Failed to initiate M-Pesa payment');
        setProcessingPayment(false);
        setPaymentMethod(null);
      }
    } catch (error) {
      console.error('M-Pesa payment error:', error);
      Alert.alert('Payment Error', 'Failed to process M-Pesa payment');
      setProcessingPayment(false);
      setPaymentMethod(null);
    }
  };

  // Process Cash Payment
  const processCashPayment = async () => {
    if (!currentRide?.rideId || !currentRide?.fare) {
      Alert.alert('Error', 'Missing ride information for payment');
      return;
    }

    Alert.alert(
      'Confirm Cash Payment',
      `Mark this ride as paid in cash?\n\nAmount: ${currentRide.fare} KES`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Payment',
          onPress: async () => {
            try {
              setProcessingPayment(true);
              setPaymentMethod('cash');
              
              console.log('💰 Processing cash payment...');
              
              // Call payment service to record cash payment
              const response = await fetch(`${PAYMENT_API}/cash`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  rideId: currentRide.rideId,
                  amount: currentRide.fare,
                  driverId: profile?._id,
                  driverName: profile?.name,
                  paymentMethod: 'cash'
                }),
              });

              const data = await response.json();
              
              if (data.success) {
                setPaymentSuccess(true);
                
                // Notify socket server
                if (socketRef.current) {
                  socketRef.current.emit('payment_completed', {
                    rideId: currentRide.rideId,
                    amount: currentRide.fare,
                    method: 'cash',
                    status: 'completed'
                  });
                }
                
                Alert.alert(
                  'Payment Recorded',
                  `Cash payment of ${currentRide.fare} KES has been recorded.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Clear everything after payment
                        setCurrentRide(null);
                        setRideStatus(null);
                        setShowPaymentOptions(false);
                        setPaymentSuccess(false);
                        setCompletedRide(null);
                        clearDriverState();
                        setProcessingPayment(false);
                        setPaymentMethod(null);
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Payment Failed', data.error || 'Failed to record cash payment');
                setProcessingPayment(false);
                setPaymentMethod(null);
              }
            } catch (error) {
              console.error('Cash payment error:', error);
              Alert.alert('Payment Error', 'Failed to process cash payment');
              setProcessingPayment(false);
              setPaymentMethod(null);
            }
          }
        }
      ]
    );
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
                setRideStatus('completed');
                setShowPaymentOptions(true);
                setCompletedRide(currentRide);
                
                Alert.alert(
                  'Ride Completed',
                  'Please collect payment from the passenger.',
                  [
                    { 
                      text: 'OK', 
                      onPress: () => {
                        saveDriverState({
                          online: true,
                          currentRide: currentRide,
                          rideStatus: 'completed',
                          showPaymentOptions: true
                        });
                      }
                    }
                  ]
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

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      if (socketRef.current && profileRef.current?._id) {
        socketRef.current.emit('driver_location', { 
          driverId: profileRef.current._id.toString(), 
          lat: latitude, 
          lng: longitude, 
          available: true 
        });
        
        socketRef.current.emit('register_driver', { 
          driverId: profileRef.current._id.toString(),
          location: { lat: latitude, lng: longitude },
          carType: profileRef.current.carType || 'Standard'
        });
      }

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

      const headers = await getAuthHeaders();
      
      const res = await fetch(TOGGLE_ONLINE_API, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          online: newOnlineStatus,
          location,
          carType: profile.carType || 'Standard'
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        setOnline(newOnlineStatus);
        
        if (newOnlineStatus) {
          const started = await startLocationUpdates();
          if (started) {
            Alert.alert('✅ You are now online', 'You will receive ride requests.');
          }
        } else {
          stopLocationUpdates();
          setCurrentRide(null);
          setRideStatus(null);
          setShowPaymentOptions(false);
          clearDriverState();
          Alert.alert('⏸️ You are now offline', 'You will not receive ride requests.');
        }
        
        fetchProfile();
      } else {
        Alert.alert('Error', data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('❌ Toggle online error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.clear();
      clearDriverState();
      router.replace('/driverLogin');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  // Render payment options
  const renderPaymentOptions = () => {
    if (!showPaymentOptions || !completedRide) return null;
    
    return (
      <View style={styles.paymentCard}>
        <Text style={styles.paymentTitle}>💳 Collect Payment</Text>
        <Text style={styles.paymentAmount}>{completedRide.fare} KES</Text>
        <Text style={styles.paymentSubtitle}>Select payment method:</Text>
        
        <View style={styles.paymentButtonsContainer}>
          <TouchableOpacity 
            style={[styles.paymentButton, styles.mpesaButton]}
            onPress={processMpesaPayment}
            disabled={processingPayment}
          >
            {processingPayment && paymentMethod === 'mpesa' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="phone-portrait" size={24} color="#fff" />
                <Text style={styles.paymentButtonText}>Pay via M-Pesa</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.paymentButton, styles.cashButton]}
            onPress={processCashPayment}
            disabled={processingPayment}
          >
            {processingPayment && paymentMethod === 'cash' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cash" size={24} color="#fff" />
                <Text style={styles.paymentButtonText}>Pay in Cash</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        {processingPayment && (
          <Text style={styles.processingText}>
            Processing {paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'} payment...
          </Text>
        )}
        
        <TouchableOpacity 
          style={styles.skipPaymentButton}
          onPress={() => {
            Alert.alert(
              'Skip Payment',
              'Are you sure? This will mark the ride as completed without payment.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Skip',
                  style: 'destructive',
                  onPress: () => {
                    setCurrentRide(null);
                    setRideStatus(null);
                    setShowPaymentOptions(false);
                    setCompletedRide(null);
                    clearDriverState();
                  }
                }
              ]
            );
          }}
        >
          <Text style={styles.skipPaymentText}>Skip Payment for Now</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCurrentRideCard = () => {
    if (!currentRide) return null;
    
    return (
      <View style={styles.currentRideCard}>
        <Text style={styles.currentRideTitle}>🚗 Current Ride</Text>
        <Text style={styles.currentRideText}>To: {currentRide.destination}</Text>
        <Text style={styles.currentRideText}>User: {currentRide.userPhone}</Text>
        <Text style={styles.currentRideText}>Fare: {currentRide.fare} KES</Text>
        
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
               rideStatus === 'completed' ? 'Completed - Awaiting Payment' : 
               'Assigned'}
            </Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.callUserButton}
          onPress={callUser}
        >
          <Ionicons name="call" size={20} color="#fff" />
          <Text style={styles.callUserText}>Call User</Text>
        </TouchableOpacity>
        
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

  if (!profile && authError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={80} color="#ff4444" />
        <Text style={styles.errorTitle}>Unable to load profile</Text>
        <Text style={styles.errorMessage}>{authError}</Text>
        
        <View style={styles.errorButtons}>
          <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.loginButton} onPress={logout}>
            <Text style={styles.loginText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
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
        source={{ uri: profile.driverImage || 'https://via.placeholder.com/150' }}
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

      {renderPaymentOptions()}
      
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
        onPress={logout}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  errorMessage: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.9,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  paymentCard: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderLeftWidth: 6,
    borderLeftColor: '#FF9800',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 5,
    textAlign: 'center',
  },
  paymentAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 10,
  },
  paymentSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  paymentButtonsContainer: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 15,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 10,
  },
  mpesaButton: {
    backgroundColor: '#4CAF50',
  },
  cashButton: {
    backgroundColor: '#2196F3',
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  processingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  skipPaymentButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  skipPaymentText: {
    color: '#666',
    fontSize: 14,
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