// login.jsx
import {
  StyleSheet, Text, View, Image, TextInput,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles';
import PrimaryButton from '../components/PrimaryButton';

const Login = () => {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleGetCode = async () => {
    const isNumeric = /^[0-9+]+$/.test(phone);
    if (!isNumeric) return setError("Phone must contain only numbers.");
    if (phone.length < 10) return setError("Phone must be at least 10 digits.");

    try {
      const res = await fetch("http://192.168.1.112:3003/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) return setError(data.message || "Error sending OTP");

      console.log('Login response:', data);
      
      // AUTO-REDIRECT if verified in last 7 days
      if (data.redirect) {
        console.log('Redirecting to:', data.redirect);
        
        if (data.redirect === "/admin") {
          // Admin detected - go directly to admin panel
          console.log('✅ Admin detected, going to admin panel');
          router.push("/admin");
        } else if (data.redirect === "/allowLocation") {
          // Regular user - go to allowLocation
          router.push("/allowLocation");
        } else {
          // Go to OTP screen
          router.push({
            pathname: "/otp",
            params: { phone: data.phone }
          });
        }
        return;
      }

      // Default fallback → OTP
      router.push({
        pathname: "/otp",
        params: { phone: data.phone }
      });

    } catch (err) {
      console.log(err);
      setError("Network error, try again.");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Image source={require('../assets/img/icon3.png')}
            style={CommonStyles.logo}
            resizeMode="contain"
          />
          <Text style={CommonStyles.title}>Safari Ride</Text>
          <Text style={CommonStyles.subtitle}>Your ride, your way</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            keyboardType="number-pad"
            maxLength={15}
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              if (error) setError("");
            }}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton title="Get Code" onPress={handleGetCode} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default Login;

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  input: {
    backgroundColor: "#fff",
    width: "90%",
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    textAlign: "center",
  },
  errorText: { color: "red", marginBottom: 10 },
});