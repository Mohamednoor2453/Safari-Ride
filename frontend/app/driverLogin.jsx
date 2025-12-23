// frontend/app/driverLogin.js - COMPLETE FIXED VERSION
import React, { useState } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, Image, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Colors } from '../constants/Colors';
import PrimaryButton from '../components/PrimaryButton';
import { useRouter } from 'expo-router';
import { CommonStyles } from '../components/CommonStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DriverLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    
    if (!carPlate.trim()) {
      Alert.alert('Error', 'Please enter your car plate number');
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting login with:', { phone: phone.trim(), carPlate: carPlate.trim() });
      
      const res = await fetch('http://192.168.1.112:3004/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          phone: phone.trim(), 
          carPlate: carPlate.trim().toUpperCase() 
        }),
      });

      console.log('Response status:', res.status);
      
      const responseText = await res.text();
      console.log('Response text:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Invalid server response');
      }
      
      if (data.success) {
        // Save token and driver info
        if (data.token) {
          await AsyncStorage.setItem('driverToken', data.token);
        }
        
        await AsyncStorage.setItem('driverInfo', JSON.stringify(data.driver));
        
        Alert.alert(
          'Success!', 
          `Welcome back, ${data.driver.name}!`,
          [
            { 
              text: 'Continue', 
              onPress: () => {
                // Clear form
                setPhone('');
                setCarPlate('');
                router.replace('/driverProfile');
              }
            }
          ]
        );
      } else {
        if (data.status === 'pending') {
          Alert.alert(
            'Verification Pending', 
            data.error || 'Your account is awaiting admin verification.',
            [
              { 
                text: 'OK', 
                onPress: () => {
                  // Optionally navigate to a pending verification screen
                  router.push('/pendingVerification');
                }
              }
            ]
          );
        } else {
          Alert.alert('Login Failed', data.error || 'Invalid phone number or car plate');
        }
      }

    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
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
          <Text style={CommonStyles.subtitle}>Driver Login</Text>

          <TextInput
            style={styles.input}
            placeholder="Phone number (e.g., 0712345678)"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Car plate number (e.g., KAA 123A)"
            placeholderTextColor="#999"
            value={carPlate}
            onChangeText={(text) => setCarPlate(text.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {loading ? (
            <ActivityIndicator size="large" color={Colors.secondary} style={{ marginVertical: 15 }} />
          ) : (
            <PrimaryButton title="Login" onPress={handleLogin} />
          )}

          <TouchableOpacity 
            style={styles.registerLink} 
            onPress={() => router.push('/driverRegistration')}
          >
            <Text style={styles.registerText}>New driver? Register here</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { 
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  input: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginVertical: 10,
    color: '#000',
    borderWidth: 1,
    borderColor: Colors.secondary,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  registerLink: {
    marginTop: 20,
    padding: 10,
  },
  registerText: {
    color: '#fff',
    fontSize: 16,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});