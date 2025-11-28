import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import React, { useRef, useState, useContext } from 'react';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles.js';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { UserContext } from '../context/UserContext';

const otp = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const { phone } = useLocalSearchParams();
  const router = useRouter();
  const inputRefs = useRef([]);
  const { saveUser } = useContext(UserContext);

  // ✅ Handle input changes
  const handleChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) inputRefs.current[index + 1]?.focus();
    if (!text && index > 0) inputRefs.current[index - 1]?.focus();
  };

  // ✅ Verify OTP and navigate based on backend response
  const handleVerify = async () => {
    const otpValue = code.join('');

    if (otpValue.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit OTP.');
      return;
    }

    try {
      const response = await fetch('http://192.168.1.112:3003/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otpValue }),
      });

      const data = await response.json();
      console.log('🔍 Backend Response:', data);

      if (response.ok) {
        // ✅ CRITICAL: Save user data to context and SecureStore
        if (data.userId) {
          const userData = {
            _id: data.userId,
            phone: data.phone,
            lastVerifiedAt: new Date().toISOString()
          };
          await saveUser(userData);
        }

        Alert.alert('✅ Success', 'OTP verified successfully!');

        // ✅ Redirect based on backend's response
        if (data.redirect === '/admin') {
          router.push('/admin');
        } else {
          router.push('/allowLocation');
        }
      } else {
        Alert.alert('❌ Error', data.message || 'Invalid OTP');
      }
    } catch (err) {
      console.error('Network error:', err);
      Alert.alert('Error', 'Failed to connect to the server.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('../assets/img/icon3.png')}
          style={CommonStyles.logo}
          resizeMode="contain"
        />
        <Text style={CommonStyles.title}>Safari Ride</Text>
        <Text style={CommonStyles.subtitle}>Your ride, your way</Text>

        <Text style={styles.prompt}>Verify your number</Text>
        <Text style={styles.subPrompt}>
          Enter the 6-digit code we sent to {phone || '+254 7XX XXX XXX'}
        </Text>

        {/* ✅ OTP Inputs */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              style={styles.codeInput}
              maxLength={1}
              keyboardType="numeric"
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              returnKeyType="next"
            />
          ))}
        </View>

        <PrimaryButton title="Verify" onPress={handleVerify} />

        <TouchableOpacity>
          <Text style={styles.resend}>Didn't receive code? Resend</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default otp;

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  prompt: {
    fontSize: 18,
    color: 'white',
    marginTop: 30,
    fontWeight: 'bold',
  },
  subPrompt: {
    fontSize: 14,
    color: 'white',
    marginVertical: 10,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    width: '100%',
  },
  codeInput: {
    width: 40,
    height: 50,
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 5,
    textAlign: 'center',
    fontSize: 18,
    color: 'white',
    backgroundColor: 'transparent',
  },
  resend: {
    marginTop: 15,
    fontSize: 14,
    color: 'white',
    textDecorationLine: 'underline',
  },
});