import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/Colors';
import PrimaryButton from '../components/PrimaryButton';
import { Ionicons } from '@expo/vector-icons';

const FareScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const { estimatedFare, currency, destinationName, destinationAddress, distance, time, surge } = params;

  const fareValue = estimatedFare ? parseFloat(estimatedFare).toFixed(2) : 'N/A';
  const surgeValue = surge ? parseFloat(surge) : 1.0;
  const isSurge = surgeValue > 1.0;

  const handleConfirmBooking = () => {
    Alert.alert('Ride Confirmed!', `Your ride to ${destinationName} is being matched with a driver.`);
    // Optionally, navigate back to home or rides list
    router.push('/requestRide');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Fare Details</Text>

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
              <Text style={styles.surgeText}>Surge Pricing: x{surgeValue.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <PrimaryButton title="Confirm Ride" onPress={handleConfirmBooking} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default FareScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  scrollContent: { padding: 20, flexGrow: 1, justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '700', color: Colors.secondary, marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 30, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5 },
  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 3 },
  value: { fontSize: 18, fontWeight: '700', color: Colors.primary, marginBottom: 10 },
  address: { fontSize: 14, fontStyle: 'italic', color: '#444', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  surgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  surgeText: { color: '#ff6600', marginLeft: 5, fontWeight: '600', fontSize: 14 },
});
