// driverRegistration.jsx
import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/Colors';
import PrimaryButton from '../components/PrimaryButton';
import { useRouter } from 'expo-router';
import { CommonStyles } from '../components/CommonStyles';

export default function DriverRegister() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [carType, setCarType] = useState('');
  const [driverImage, setDriverImage] = useState(null);
  const [idImage, setIdImage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Pick image from gallery
  const pickImage = async (setter) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setter(result.assets[0].uri);
    }
  };

  // Convert Expo URI to blob for upload
  const uriToBlob = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  };

  const handleRegister = async () => {
    if (!name || !phone || !carPlate || !carType || !driverImage || !idImage) {
      return Alert.alert('Error', 'Please fill all fields and upload images.');
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('carPlate', carPlate);
      formData.append('carType', carType);

      // Append images correctly
      formData.append('images', {
        uri: driverImage,
        type: 'image/jpeg',
        name: 'driver.jpg',
      });

      formData.append('images', {
        uri: idImage,
        type: 'image/jpeg',
        name: 'id.jpg',
      });

      const res = await fetch('http://192.168.1.112:3004/api/register', {
        method: 'POST',
        body: formData,
        // Remove Content-Type header - let React Native set it automatically
      });

      // Check if response is OK before parsing JSON
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Server Error Response:', errorText);
        throw new Error(`Server error! status: ${res.status}`);
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON Parse Error - Response text:', text);
        throw new Error('Server returned invalid JSON response');
      }

      if (data.success) {
        Alert.alert('Success', 'Driver registered successfully!');
        router.push('/driverLogin');
      } else {
        Alert.alert('Error', data.error || 'Registration failed.');
      }
    } catch (error) {
      console.error('Registration Error:', error);
      Alert.alert('Error', error.message || 'Something went wrong. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={require('../assets/img/icon3.png')}
          style={CommonStyles.logo}
          resizeMode="contain"
        />
        <Text style={CommonStyles.title}>Safari Ride</Text>
        <Text style={CommonStyles.subtitle}>Register as Driver</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="Car Plate Number"
          placeholderTextColor="#666"
          value={carPlate}
          onChangeText={setCarPlate}
        />
        <TextInput
          style={styles.input}
          placeholder="Car Type"
          placeholderTextColor="#666"
          value={carType}
          onChangeText={setCarType}
        />

        <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage(setDriverImage)}>
          <Text style={styles.uploadText}>
            {driverImage ? 'Driver Image Selected' : 'Upload Driver Image'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage(setIdImage)}>
          <Text style={styles.uploadText}>
            {idImage ? 'ID Image Selected' : 'Upload ID Image'}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: 20, marginBottom: 20 }} />
        ) : (
          <View style={styles.buttonWrapper}>
            <PrimaryButton title="Register" onPress={handleRegister} />
          </View>
        )}

        <TouchableOpacity onPress={() => router.push('/driverLogin')}>
          <Text style={styles.redirectText}>Already a driver? Login.</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40, // Add extra padding at bottom
  },
  input: {
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.secondary,
    width: '90%', // Ensure consistent width
  },
  uploadButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 15,
    width: '90%',
  },
  uploadText: {
    color: Colors.white,
    fontSize: 16,
  },
  redirectText: {
    color: '#fff',
    marginTop: 20, // Increased margin
    marginBottom: 30, // Add bottom margin for safety
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  buttonWrapper: {
    marginTop: 10,
    marginBottom: 20,
    width: '90%',
  },
});