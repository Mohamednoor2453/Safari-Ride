import React, { useState } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Colors } from '../constants/Colors';
import PrimaryButton from '../components/PrimaryButton';
import { useRouter } from 'expo-router';
import { CommonStyles } from '../components/CommonStyles';

export default function DriverLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone) return Alert.alert('Error', 'Enter your phone number');

    setLoading(true);
    try {
      const res = await fetch('http://192.168.1.112:3004/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Welcome', `Hello ${data.driver.name}`);
        router.push('/driverProfile'); // Redirect to main driver screen
      } else {
        Alert.alert('Error', data.error || 'Login failed');
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong.');
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
            placeholder="Enter phone number"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            maxLength={14}
            value={phone}
            onChangeText={setPhone}
          />

          {loading ? (
            <ActivityIndicator size="large" color={Colors.secondary} style={{ marginVertical: 15 }} />
          ) : (
            <PrimaryButton title="Login" onPress={handleLogin} />
          )}

          <TouchableOpacity onPress={() => router.push('/driverRegistration')}>
            <Text style={styles.redirectText}>First time driver? Register.</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  input: {
    backgroundColor: '#fff',
    width: '90%',
    borderRadius: 25,
    padding: 12,
    fontSize: 16,
    marginVertical: 10,
    color: '#000',
    borderWidth: 1,
    borderColor: Colors.secondary,
    textAlign: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  redirectText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
