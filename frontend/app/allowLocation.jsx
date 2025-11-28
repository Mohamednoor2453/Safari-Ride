import { StyleSheet, Text, View, Image, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles.js';
import PrimaryButton from '../components/PrimaryButton.jsx';

const AllowLocation = () => {
    console.log('Button pressed ✅'); 
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAllowLocation = async () => {
    try {
      setLoading(true);

      // Ask user for permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please enable location permissions in your settings to use Safari Ride.'
        );
        setLoading(false);
        return;
      }

      // Get current position
      let userLocation = await Location.getCurrentPositionAsync({});
      setLocation(userLocation.coords);

      Alert.alert('Location Access Granted', 'Your location has been detected successfully!');
      console.log('User Location:', userLocation.coords);

      // Navigate to next screen (e.g., home or map)
      router.push('/home'); // Change '/home' to your next page route

    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to fetch location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Image
            source={require('../assets/img/icon3.png')}
            style={CommonStyles.logo}
            resizeMode="contain"
          />
          <Text style={CommonStyles.title}>Safari Ride</Text>
          <Text style={CommonStyles.subtitle}>Your ride, your way</Text>

          <PrimaryButton
            title={loading ? 'Detecting...' : 'Allow Location Access'}
            onPress={handleAllowLocation}
            disabled={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AllowLocation;

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
