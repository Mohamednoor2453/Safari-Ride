// app/otp.jsx - MINOR IMPROVEMENT
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles';
import PrimaryButton from '../components/PrimaryButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const Otp = () => {
  const router = useRouter();
  const { phone } = useLocalSearchParams();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = [];

  useEffect(() => {
    // Create refs for each input
    for (let i = 0; i < 6; i++) {
      inputRefs[i] = React.createRef();
    }
    
    // Start countdown for resend
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return; // Allow only numbers

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs[index + 1]?.current?.focus();
    }

    // Auto-submit when last digit is entered
    if (value && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleVerify = async (enteredOtp = null) => {
    const fullOtp = enteredOtp || otp.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Get phone from AsyncStorage (stored during login)
      const storedPhone = await AsyncStorage.getItem('userPhone');
      const verifyPhone = phone || storedPhone;

      if (!verifyPhone) {
        setError('Phone number not found. Please login again.');
        setLoading(false);
        return;
      }

      console.log('🔐 Verifying OTP for:', verifyPhone);
      const res = await fetch("http://192.168.1.112:3003/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: verifyPhone, otp: fullOtp }),
      });

      const data = await res.json();
      console.log('📄 OTP verification response:', data);

      if (!res.ok) {
        setError(data.message || "Invalid OTP");
        setLoading(false);
        return;
      }

      if (data.success) {
        console.log('✅ OTP verified successfully');
        
        // Save user data to AsyncStorage with grace period info
        const userData = {
          phone: data.phone,
          _id: data.userId || data.userData?._id,
          verified: true,
          lastVerifiedAt: new Date().toISOString(),
          nextVerification: data.userData?.nextVerification
        };
        
        await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('✅ User data saved for 7-day grace period');
        
        // Clear OTP phone
        await AsyncStorage.removeItem('userPhone');
        
        // Navigate based on redirect from backend
        if (data.redirect) {
          console.log('📍 Redirecting to:', data.redirect);
          router.replace(data.redirect);
        } else {
          console.log('⚠️ No redirect specified, defaulting to /home');
          router.replace("/home");
        }
      } else {
        setError(data.message || "Verification failed");
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      setError("Network error, try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    }
  };

  const handleResend = async () => {
    try {
      const storedPhone = await AsyncStorage.getItem('userPhone');
      const resendPhone = phone || storedPhone;
      
      if (!resendPhone) {
        Alert.alert('Error', 'Phone number not found');
        return;
      }
      
      setLoading(true);
      const res = await fetch('http://192.168.1.112:3003/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: resendPhone }),
      });
      
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'New OTP sent successfully');
        setCanResend(false);
        setCountdown(60);
        
        // Start countdown again
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              setCanResend(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        // Clear OTP fields
        setOtp(['', '', '', '', '', '']);
        inputRefs[0]?.current?.focus();
      } else {
        Alert.alert('Error', data.message || 'Failed to resend OTP');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Ionicons name="lock-closed" size={80} color={Colors.secondary} />
          <Text style={CommonStyles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to {phone || 'your phone'}
          </Text>
          
          <Text style={styles.infoText}>
            After verification, you won't need OTP for 7 days
          </Text>

          <View style={styles.otpContainer}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <TextInput
                key={index}
                ref={ref => inputRefs[index] = { current: ref }}
                style={[styles.otpInput, otp[index] && styles.otpInputFilled]}
                keyboardType="number-pad"
                maxLength={1}
                value={otp[index]}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                editable={!loading}
                selectTextOnFocus
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            title={loading ? "Verifying..." : "Verify OTP"}
            onPress={() => handleVerify()}
            disabled={loading}
            style={{ marginTop: 20 }}
          />

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>
              Didn't receive code? 
            </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.countdownText}>
                Resend in {countdown}s
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default Otp;

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 10,
  },
  subtitle: {
    color: Colors.white,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  infoText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 20,
  },
  otpInput: {
    width: 45,
    height: 55,
    backgroundColor: '#fff',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  otpInputFilled: {
    backgroundColor: '#e6f7ff',
    borderColor: Colors.accent,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    color: Colors.white,
    fontSize: 14,
    marginRight: 5,
  },
  resendLink: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  countdownText: {
    color: '#aaa',
    fontSize: 14,
  },
});