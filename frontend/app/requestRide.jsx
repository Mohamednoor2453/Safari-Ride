// frontend/app/requestRide.jsx
import React, { useEffect, useState, useContext } from 'react';
import {
  StyleSheet, View, Text, ActivityIndicator, Alert, Linking,
  SafeAreaView, TextInput, FlatList, TouchableOpacity, ScrollView, Keyboard
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles';
import PrimaryButton from '../components/PrimaryButton';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import io from 'socket.io-client';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const FARE_API = "http://192.168.1.112:3005/api/fare";
const SOCKET_URL = 'http://192.168.1.112:8000'; // ride-service socket server

const popularNarokLocations = [
  { name: "Iltanet Mall Narok", lat: -1.0961, lng: 35.8602, address: "Iltanet Mall, Narok, Kenya" },
  { name: "Naivas Narok", lat: -1.0915, lng: 35.8578, address: "Naivas Supermarket, Narok, Kenya" },
  { name: "Narok Referral Hospital", lat: -1.0869, lng: 35.8583, address: "Narok County Referral Hospital" },
  { name: "Narok Town", lat: -1.0903, lng: 35.8612, address: "Narok Town Center" },
  { name: "Maasai Mara University", lat: -1.1167, lng: 35.8333, address: "Maasai Mara University" },
];

const RideScreen = () => {
  const router = useRouter();
  const { user } = useContext(UserContext);

  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [socket, setSocket] = useState(null);

  useEffect(() => { 
    console.log('User context in requestRide:', user);
    if (!user) {
      console.log('No user found, redirecting to login');
      router.replace('/login');
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
          status = newStatus;
        }
        if (status !== 'granted') {
          Alert.alert('Location Permission Required', 'Enable location permissions', [
            { text: 'Open Settings', onPress: () => Linking.openSettings() }, 
            { text: 'Cancel', style: 'cancel' }
          ]);
          return;
        }
        const locationEnabled = await Location.hasServicesEnabledAsync();
        if (!locationEnabled) {
          Alert.alert('Location Services Disabled', 'Enable location services', [
            { text: 'Open Settings', onPress: () => Linking.openSettings() }, 
            { text: 'Cancel', style: 'cancel' }
          ]);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 15000 });
        setPickup(loc.coords);
      } catch (error) {
        Alert.alert('Location Error', 'Unable to get your current location.');
      } finally { setLoadingLocation(false); }
    })();
  }, []);

  useEffect(() => {
    // connect to ride-service socket to listen for ride updates
    const s = io(SOCKET_URL, { transports: ['websocket'], forceNew: true });
    setSocket(s);

    s.on('connect', () => console.log('connected to ride socket', s.id));

    s.on('ride_update', (payload) => {
      console.log('ride_update (user):', payload);
      if (!payload) return;
      // If the payload has ride id and matches user's active ride, show alerts etc.
      // For simplicity, show alert when driver assigned or search failed
      if (payload.status === 'driver_assigned') {
        Alert.alert('Driver Assigned', `Driver ${payload.driver.name} is on the way. Car: ${payload.driver.carType} (${payload.driver.carPlate})`);
        router.replace('/requestRide');
      } else if (payload.status === 'search_failed') {
        Alert.alert('No Drivers', 'No drivers available right now.');
      }
    });

    s.on('disconnect', () => console.log('socket disconnected'));

    return () => {
      try { s.disconnect(); } catch (e) { /* ignore */ }
    };
  }, []);

  // --- Missing helper functions (restored) ---

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!pickup || query.length < 2) { setSearchResults([]); setShowResults(false); return; }
    setSearching(true);
    setShowResults(true);
    try {
      const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&location=${pickup.latitude},${pickup.longitude}&radius=50000&components=country:ke`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data.status === 'OK' && data.predictions) setSearchResults(data.predictions);
      else setSearchResults([]);
    } catch (e) { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const handleSelectPlace = async (placeId) => {
    try {
      setSearching(true);
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_API_KEY}&fields=name,formatted_address,geometry,vicinity`);
      const data = await res.json();
      if (data.status === 'OK' && data.result?.geometry) {
        const { lat, lng } = data.result.geometry.location;
        setDestination({ latitude: lat, longitude: lng, name: data.result.name, address: data.result.formatted_address || data.result.vicinity });
        setSearchQuery(data.result.name);
        setShowResults(false);
        Keyboard.dismiss();
      } else Alert.alert('Error', 'Could not get place details.');
    } catch (e) { Alert.alert('Error', 'Failed to connect.'); }
    finally { setSearching(false); }
  };

  const handleManualDestination = () => {
    if (!pickup || searchQuery.trim().length < 3) { Alert.alert('Invalid', 'Enter a valid destination.'); return; }
    setDestination({ latitude: pickup.latitude + 0.01, longitude: pickup.longitude + 0.01, name: searchQuery, address: searchQuery, isManual: true });
    setShowResults(false);
    Keyboard.dismiss();
    Alert.alert('Destination Set', 'Driver will confirm exact location.');
  };

  const handlePopularLocation = (loc) => {
    setDestination({ latitude: loc.lat, longitude: loc.lng, name: loc.name, address: loc.address });
    setSearchQuery(loc.name);
    setShowResults(false);
    Keyboard.dismiss();
  };

  const getMapRegion = () => {
    if (!pickup) return null;
    if (destination) {
      return {
        latitude: (pickup.latitude + destination.latitude) / 2,
        longitude: (pickup.longitude + destination.longitude) / 2,
        latitudeDelta: Math.abs(pickup.latitude - destination.latitude) * 2 + 0.01,
        longitudeDelta: Math.abs(pickup.longitude - destination.longitude) * 2 + 0.01,
      };
    }
    return { ...pickup, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  };

  // --- End helper functions ---

  const handleRequestRide = async () => {
    if (!pickup || !destination) { Alert.alert('Select Destination', 'Please pick a destination first.'); return; }
    try {
      const res = await axios.post(FARE_API, {
        pickupLat: pickup.latitude, pickupLng: pickup.longitude,
        destLat: destination.latitude, destLng: destination.longitude,
        destinationName: destination.name, destinationAddress: destination.address,
        userId: user._id, userPhone: user.phone
      });
      const { estimatedFare, details, rideId } = res.data;
      // pass rideId to fare screen so the app can call match endpoint
      router.push({ pathname: '/fare', params: { estimatedFare: estimatedFare.toString(), distance: details.distanceKm.toFixed(1), time: details.timeMinutes.toFixed(0), destinationName: destination.name, destinationAddress: destination.address || destination.name, currency: 'KES', surge: details.surge, rideId } });
    } catch (err) { console.error(err); Alert.alert('Error', 'Failed to calculate fare. Try again.'); }
  };

  if (loadingLocation) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>Detecting your location...</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={CommonStyles.title}>Request a Ride</Text>
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search destination..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={handleSearch}
          onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 300)}
        />
        {searching && <ActivityIndicator size="small" color={Colors.primary} style={styles.searchLoading} />}
        {searchQuery.length >= 3 && !destination && (
          <TouchableOpacity style={styles.manualConfirmButton} onPress={handleManualDestination}>
            <Text style={styles.manualConfirmText}>Use This Address</Text>
          </TouchableOpacity>
        )}
      </View>

      {showResults && (
        <View style={styles.resultsContainer}>
          {searching ? (
            <View style={styles.loadingResults}><ActivityIndicator size="small" color={Colors.primary} /><Text style={styles.loadingResultsText}>Searching...</Text></View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.place_id}
              renderItem={({ item }) => (<TouchableOpacity style={styles.resultItem} onPress={() => handleSelectPlace(item.place_id)}><Text style={styles.resultText}>{item.description}</Text></TouchableOpacity>)}
              style={styles.resultsList}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <View style={styles.noResultsContainer}><Text style={styles.noResultsText}>No locations found</Text>
              {searchQuery.length >= 3 && <TouchableOpacity style={styles.manualConfirmInline} onPress={handleManualDestination}><Text style={styles.manualConfirmInlineText}>Use "{searchQuery}"</Text></TouchableOpacity>}
            </View>
          )}
        </View>
      )}

      {!searchQuery && !destination && (
        <View style={styles.popularLocationsContainer}>
          <Text style={styles.popularTitle}>Popular in Narok:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularScrollView}>
            <View style={styles.popularList}>
              {popularNarokLocations.map((loc, i) => (<TouchableOpacity key={i} style={styles.popularItem} onPress={() => handlePopularLocation(loc)}><Text style={styles.popularText}>{loc.name}</Text></TouchableOpacity>))}
            </View>
          </ScrollView>
        </View>
      )}

      {pickup && (
        <MapView style={styles.map} initialRegion={{ ...pickup, latitudeDelta: 0.01, longitudeDelta: 0.01 }} region={getMapRegion()} showsUserLocation>
          {pickup && <Marker coordinate={pickup} title="Your Location" pinColor={Colors.primary} />}
          {destination && <Marker coordinate={destination} title={destination.name} description={destination.address} pinColor={Colors.accent} />}
        </MapView>
      )}

      <View style={styles.bottomSection}>
        {destination ? (
          <>
            <View style={styles.destinationInfo}>
              <Text style={styles.destinationTitle}>{destination.isManual ? "📍 Manual Destination:" : "📍 Destination Selected:"}</Text>
              <Text style={styles.destinationName}>{destination.name}</Text>
              {destination.address && destination.address !== destination.name && <Text style={styles.destinationAddress}>{destination.address}</Text>}
              {destination.isManual && <Text style={styles.manualNote}>Driver will confirm exact location</Text>}
            </View>
            <PrimaryButton title={destination.isManual ? "Confirm Manual Destination" : "Confirm & See Fare"} onPress={handleRequestRide} />
          </>
        ) : <Text style={styles.instructionText}>🔍 Search for a destination or select from popular locations</Text>}
      </View>
    </SafeAreaView>
  );
};

export default RideScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, paddingTop: 50 },
  map: { flex: 1, marginBottom: 160 },
  searchSection: { position: "absolute", top: 120, left: 20, right: 20, zIndex: 10 },
  searchInput: { height: 50, backgroundColor: "#fff", borderRadius: 25, paddingHorizontal: 20, fontSize: 16, borderWidth: 2, borderColor: Colors.secondary, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 },
  searchLoading: { position: "absolute", right: 20, top: 15 },
  manualConfirmButton: { backgroundColor: Colors.accent, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignSelf: "flex-end", marginTop: 10, elevation: 5 },
  manualConfirmText: { fontSize: 14, fontWeight: "600", color: "#000" },
  resultsContainer: { position: "absolute", top: 175, left: 20, right: 20, backgroundColor: "#fff", borderRadius: 15, maxHeight: 250, elevation: 8, borderWidth: 2, borderColor: Colors.secondary, zIndex: 9 },
  resultsList: { borderRadius: 15 },
  resultItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  resultText: { fontSize: 14, color: '#333' },
  loadingResults: { padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  loadingResultsText: { marginLeft: 10, color: '#666', fontSize: 14 },
  noResultsContainer: { padding: 20, alignItems: "center" },
  noResultsText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 10 },
  manualConfirmInline: { backgroundColor: Colors.accent, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 15, marginTop: 5 },
  manualConfirmInlineText: { color: '#000', fontSize: 12, fontWeight: '600' },
  popularLocationsContainer: { position: "absolute", top: 180, left: 20, right: 20, backgroundColor: "#fff", borderRadius: 15, padding: 15, elevation: 5, borderWidth: 2, borderColor: Colors.secondary, zIndex: 2 },
  popularScrollView: { flexGrow: 0 },
  popularTitle: { fontSize: 16, fontWeight: "600", marginBottom: 10, color: Colors.primary },
  popularList: { flexDirection: "row", paddingBottom: 5 },
  popularItem: { backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 5 },
  popularText: { fontSize: 12, fontWeight: "500", color: '#000' },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.primary },
  loadingText: { color: Colors.white, marginTop: 10, fontSize: 16 },
  bottomSection: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 20, paddingBottom: 30, paddingHorizontal: 20, backgroundColor: Colors.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 5 },
  destinationInfo: { marginBottom: 15, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 15, padding: 15 },
  destinationTitle: { fontSize: 14, fontWeight: "600", color: '#666', marginBottom: 5 },
  destinationName: { fontSize: 16, fontWeight: "700", color: Colors.primary, marginBottom: 5 },
  destinationAddress: { fontSize: 12, color: "#666", fontStyle: 'italic' },
  manualNote: { fontSize: 12, marginTop: 4, color: "#ff6600", fontStyle: 'italic' },
  instructionText: { fontSize: 14, fontWeight: "600", color: Colors.primary, textAlign: 'center', marginBottom: 5 },
});
