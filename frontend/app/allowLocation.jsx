// app/allowLocation.jsx - CORRECTED VERSION
import { 
  StyleSheet, Text, View, Image, KeyboardAvoidingView, 
  Platform, ScrollView, Alert, TouchableOpacity 
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles.js';
import PrimaryButton from '../components/PrimaryButton.jsx';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AllowLocation = () => {
  console.log('📍 AllowLocation screen loaded');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');

  useEffect(() => {
    // Load user phone when component mounts
    const loadUserData = async () => {
      try {
        const userString = await AsyncStorage.getItem('currentUser');
        if (userString) {
          const userData = JSON.parse(userString);
          setUserPhone(userData.phone);
          console.log('📱 User phone loaded:', userData.phone);
        }
      } catch (error) {
        console.error('❌ Error loading user data:', error);
      }
    };
    loadUserData();
  }, []);

  const ensureUserIsSaved = async () => {
    try {
      // Check if user exists in storage
      const userString = await AsyncStorage.getItem('currentUser');
      if (!userString && userPhone) {
        // Create and save user if not exists
        const userData = {
          phone: userPhone,
          verified: true,
          _id: `user_${Date.now()}`,
          lastVerifiedAt: new Date().toISOString()
        };
        await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('✅ User saved in allowLocation:', userPhone);
      }
    } catch (error) {
      console.error('❌ Error ensuring user is saved:', error);
    }
  };

  const handleAllowLocation = async () => {
    try {
      setLoading(true);

      // Ensure user is saved before proceeding
      await ensureUserIsSaved();

      // Ask user for permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      // Save location permission status
      await AsyncStorage.setItem('locationPermission', status === 'granted' ? 'granted' : 'denied');
      
      console.log('✅ Location permission:', status);
      console.log('✅ Navigating to home...');
      
      // Navigate to home regardless of permission status
      router.replace('/home');

    } catch (error) {
      console.error('❌ Error in handleAllowLocation:', error);
      Alert.alert('Error', 'Unable to process location request. You can still continue.', [
        { 
          text: 'Continue Anyway', 
          onPress: async () => {
            await ensureUserIsSaved();
            router.replace('/home');
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await ensureUserIsSaved();
    router.replace('/home');
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
          
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>
              We need your location to provide accurate ride services and show nearby drivers.
            </Text>
            <Text style={styles.noteText}>
              🔒 Your location data is secure and only used to improve your experience.
            </Text>
          </View>

          <PrimaryButton
            title={loading ? 'Detecting...' : 'Allow Location Access'}
            onPress={handleAllowLocation}
            disabled={loading}
          />
          
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
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
  messageContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    borderRadius: 15,
    marginVertical: 30,
    width: '100%',
  },
  messageText: {
    color: Colors.white,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  noteText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  skipButton: {
    marginTop: 20,
    padding: 10,
  },
  skipText: {
    color: '#aaa',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});