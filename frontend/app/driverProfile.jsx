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
  AppState
} from 'react-native';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import io from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.112:3005';
const PROFILE_API = 'http://192.168.1.112:3004/api/driverProfile';
const TOGGLE_ONLINE_API = 'http://192.168.1.112:3004/api/toggleOnline';

export default function DriverProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const locationWatcherRef = useRef(null);
  const router = useRouter();
  const appState = useRef(AppState.currentState);

  // Use ref for profile to access current value in socket callbacks
  const profileRef = useRef(null);

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
        profileRef.current = profileData; // Update the ref
        setOnline(profileData.online || false);
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
    
    // Handle app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        socketRef.current
      ) {
        console.log('App came to foreground, reconnecting socket...');
        if (!socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Initialize socket connection when component mounts
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

    s.on('ride_request', (payload) => {
      console.log('🎯 RIDE REQUEST RECEIVED!', payload);
      if (!payload) return;
      
      // Use profileRef.current to access current profile value
      const currentProfile = profileRef.current;
      if (!currentProfile || !currentProfile._id) {
        console.log('❌ Profile not available when ride request received');
        Alert.alert('Error', 'Driver profile not loaded. Please refresh and try again.');
        return;
      }
      
      // Show accept/decline alert to driver
      Alert.alert(
        '🚗 NEW RIDE REQUEST!',
        `📍 Pickup: ${payload.pickup?.lat ? `${payload.pickup.lat.toFixed(4)}, ${payload.pickup.lng.toFixed(4)}` : 'Location not specified'}\n🎯 Destination: ${payload.destinationName || 'Not specified'}\n💰 Fare: ${payload.fare || '0'} KES\n📞 User: ${payload.userPhone || 'Not specified'}`,
        [
          { 
            text: '❌ DECLINE', 
            onPress: () => {
              console.log('Driver DECLINED ride:', payload.rideId);
              s.emit('driver_response', { 
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
              s.emit('driver_response', { 
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
    });

    s.on('ride_confirmed_to_driver', (payload) => {
      console.log('✅ Ride confirmed to driver:', payload);
      Alert.alert('Ride Confirmed', `Ride to ${payload.destination} has been confirmed.`);
    });

    return () => {
      console.log('🧹 Cleaning up socket connection...');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Update profileRef when profile changes
  useEffect(() => {
    profileRef.current = profile;
    
    // Register driver when profile loads or changes
    const registerDriver = async () => {
      if (!profile?._id || !socketRef.current?.connected) return;
      
      console.log('🔄 Profile updated, registering driver with ID:', profile._id);
      
      try {
        // Get current location before registering
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission not granted');
          return;
        }
        
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        
        // Update driver's location
        socketRef.current.emit('update_location', {
          driverId: profile._id.toString(),
          location: { lat: latitude, lng: longitude }
        });
        
        // Register driver with socket
        socketRef.current.emit('register_driver', { 
          driverId: profile._id.toString(),
          location: { lat: latitude, lng: longitude },
          carType: profile.carType || 'Standard'
        });
        
        // Start location updates if online
        if (online && !locationWatcherRef.current) {
          startLocationUpdates();
        }
        
      } catch (error) {
        console.error('Error getting location:', error);
      }
    };
    
    registerDriver();
  }, [profile, online]);

  const startLocationUpdates = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      // Stop existing watcher
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
      }

      // Start new watcher
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

    } catch (error) {
      console.error('Error starting location updates:', error);
    }
  };

  const stopLocationUpdates = () => {
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
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
        
        if (newOnlineStatus) {
          // Start location updates
          startLocationUpdates();
          
          // Register with socket
          if (socketRef.current?.connected && location) {
            socketRef.current.emit('register_driver', { 
              driverId: profile._id.toString(),
              location,
              carType: profile.carType || 'Standard'
            });
          }
          
          Alert.alert('✅ You are now online', 'You will receive ride requests in your area');
        } else {
          // Stop location updates
          stopLocationUpdates();
          Alert.alert('⏸️ You are now offline', 'You will not receive ride requests');
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
          You are now visible to passengers and will receive ride requests.
        </Text>
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => router.replace('/login')}
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