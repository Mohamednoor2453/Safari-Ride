import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles';

const OtpVerification = () => {
  const router = useRouter();
  const { phone } = useLocalSearchParams();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer;
    if (countdown > 0 && !canResend) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [countdown, canResend]);

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      console.log('Verifying OTP for phone:', phone);
      console.log('OTP entered:', otp);
      
      const res = await fetch('http://192.168.1.112:3003/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await res.json();
      console.log('OTP verification response:', data);
      
      if (data.success) {
        console.log('✅ OTP verified successfully');
        console.log('📱 Phone:', data.phone);
        console.log('📍 Redirecting to:', data.redirect);
        
        // Check if redirect is to admin panel
        if (data.redirect === '/admin') {
          Alert.alert('Welcome Admin!', 'Redirecting to admin dashboard...');
          setTimeout(() => {
            router.replace('/admin');
          }, 1500);
        } else {
          // Regular user flow
          router.replace(data.redirect);
        }
      } else {
        Alert.alert('Error', data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      Alert.alert('Error', 'Failed to verify OTP. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;

    try {
      setCanResend(false);
      setCountdown(60);
      
      const res = await fetch('http://192.168.1.112:3003/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      
      if (res.ok) {
        Alert.alert('Success', 'OTP resent successfully!');
      } else {
        Alert.alert('Error', data.message || 'Failed to resend OTP');
        setCanResend(true);
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      Alert.alert('Error', 'Failed to resend OTP');
      setCanResend(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🔐</Text>
          </View>
          
          <Text style={CommonStyles.title}>OTP Verification</Text>
          <Text style={CommonStyles.subtitle}>
            Enter the 6-digit code sent to
          </Text>
          
          <Text style={styles.phoneText}>{phone}</Text>

          <View style={styles.otpContainer}>
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
              selectTextOnFocus
            />
          </View>

          <TouchableOpacity 
            style={styles.verifyButton}
            onPress={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>
              Didn't receive code?{' '}
              {canResend ? (
                <Text style={styles.resendLink} onPress={handleResendOtp}>
                  Resend OTP
                </Text>
              ) : (
                <Text style={styles.resendCountdown}>
                  Resend in {countdown}s
                </Text>
              )}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>← Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default OtpVerification;

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
  logoContainer: {
    marginBottom: 30,
  },
  logo: {
    fontSize: 60,
  },
  phoneText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 40,
    textAlign: 'center',
  },
  otpContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  otpInput: {
    backgroundColor: '#fff',
    width: '70%',
    borderRadius: 15,
    padding: 15,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 10,
    color: '#000',
  },
  verifyButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resendContainer: {
    marginBottom: 30,
  },
  resendText: {
    color: Colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
  resendLink: {
    color: Colors.secondary,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  resendCountdown: {
    color: '#aaa',
  },
  backButton: {
    marginTop: 20,
  },
  backText: {
    color: Colors.white,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});