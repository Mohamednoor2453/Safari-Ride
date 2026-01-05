// app/login.jsx - CLEANED VERSION (removed test button)
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles';
import PrimaryButton from '../components/PrimaryButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const Login = () => {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    const kenyanRegex = /^(?:\+254|0)[17]\d{8}$/;
    if (!kenyanRegex.test(phone)) {
      setError('Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Clear any existing user data before login
      await AsyncStorage.multiRemove(['currentUser', 'userPhone']);
      console.log('🧹 Cleared previous user data');

      console.log('📤 Sending login request for:', phone);
      const res = await fetch('http://192.168.1.112:3003/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      console.log('📄 Login response:', data);

      if (!res.ok) {
        Alert.alert('Error', data.message || 'Login failed');
        setLoading(false);
        return;
      }

      // Store phone for OTP verification
      await AsyncStorage.setItem('userPhone', phone);
      console.log('📱 Phone saved to storage:', phone);
      
      // Check the response to see where to redirect
      if (data.redirect === '/admin') {
        console.log('✅ Admin detected, redirecting to admin panel');
        
        // Save admin user data
        const userData = {
          phone: data.phone,
          _id: data.userId,
          verified: true,
          lastVerifiedAt: new Date().toISOString()
        };
        await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
        
        router.replace('/admin');
      } else if (data.redirect === '/allowLocation') {
        console.log('✅ User already verified within 7 days');
        
        // Save user data
        const userData = {
          phone: data.phone,
          _id: data.userId,
          verified: true,
          lastVerifiedAt: new Date().toISOString()
        };
        await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
        
        router.replace('/allowLocation');
      } else if (data.redirect === '/otp') {
        console.log('📍 Redirecting to OTP page');
        router.replace(`/otp?phone=${phone}`);
      } else {
        console.log('⚠️ Unknown redirect, defaulting to OTP');
        router.replace(`/otp?phone=${phone}`);
      }

    } catch (err) {
      console.error('❌ Login error:', err);
      Alert.alert('Error', 'Network error, please check your connection');
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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Image
            source={require('../assets/img/icon3.png')}
            style={CommonStyles.logo}
            resizeMode="contain"
          />
          
          <Text style={CommonStyles.title}>Welcome Back</Text>
          <Text style={CommonStyles.subtitle}>Enter your phone number to continue</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="0712 345 678 or +254712345678"
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
              editable={!loading}
            />
            <Ionicons name="call-outline" size={24} color={Colors.secondary} style={styles.inputIcon} />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            title={loading ? "Please wait..." : "Continue"}
            onPress={handleLogin}
            disabled={loading}
            style={{ marginTop: 20 }}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>By continuing, you agree to our</Text>
            <TouchableOpacity onPress={() => Alert.alert('Terms', 'Terms of service')}>
              <Text style={styles.linkText}>Terms & Conditions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default Login;

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
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 10,
  },
  inputContainer: {
    width: '100%',
    marginTop: 30,
    position: 'relative',
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 50,
    fontSize: 16,
    color: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    top: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.white,
    fontSize: 12,
    opacity: 0.8,
  },
  linkText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
});