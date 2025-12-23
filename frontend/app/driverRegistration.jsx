// frontend/app/DriverRegistration.jsx - COMPLETE FIXED VERSION
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
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    // Validate inputs
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    
    if (!phone.trim() || phone.trim().length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number (e.g., 0712345678)');
      return;
    }
    
    if (!carPlate.trim()) {
      Alert.alert('Error', 'Please enter your car plate number');
      return;
    }
    
    if (!carType.trim()) {
      Alert.alert('Error', 'Please enter your car type');
      return;
    }
    
    if (!driverImage) {
      Alert.alert('Error', 'Please upload your driver photo');
      return;
    }
    
    if (!idImage) {
      Alert.alert('Error', 'Please upload your ID photo');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('phone', phone.trim());
      formData.append('carPlate', carPlate.trim().toUpperCase());
      formData.append('carType', carType.trim());

      // Prepare driver image
      const driverImageName = driverImage.split('/').pop();
      const driverImageType = driverImageName?.split('.').pop() || 'jpg';
      
      formData.append('driverImage', {
        uri: driverImage,
        type: `image/${driverImageType}`,
        name: `driver_${Date.now()}.${driverImageType}`
      });

      // Prepare ID image
      const idImageName = idImage.split('/').pop();
      const idImageType = idImageName?.split('.').pop() || 'jpg';
      
      formData.append('idImage', {
        uri: idImage,
        type: `image/${idImageType}`,
        name: `id_${Date.now()}.${idImageType}`
      });

      console.log('Sending registration request...');

      const res = await fetch('http://192.168.1.112:3004/api/register', {
        method: 'POST',
        body: formData,
        headers: {
          // Let React Native set the Content-Type with boundary
        },
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
        Alert.alert(
          'Success!', 
          data.message || 'Registration successful! Please wait for admin verification.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Clear form
                setName('');
                setPhone('');
                setCarPlate('');
                setCarType('');
                setDriverImage(null);
                setIdImage(null);
                router.push('/driverLogin');
              }
            }
          ]
        );
      } else {
        Alert.alert('Registration Failed', data.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration Error:', error);
      Alert.alert(
        'Error', 
        error.message || 'Network error. Please check your connection and try again.'
      );
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

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Phone Number (e.g., 0712345678)"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Car Plate Number (e.g., KAA 123A)"
            placeholderTextColor="#666"
            value={carPlate}
            onChangeText={(text) => setCarPlate(text.toUpperCase())}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Car Type (e.g., Toyota Corolla)"
            placeholderTextColor="#666"
            value={carType}
            onChangeText={setCarType}
          />

          <View style={styles.uploadSection}>
            <Text style={styles.uploadLabel}>Driver Photo:</Text>
            <TouchableOpacity 
              style={styles.uploadButton} 
              onPress={() => pickImage(setDriverImage)}
            >
              <Text style={styles.uploadText}>
                {driverImage ? '✓ Photo Selected' : 'Select Driver Photo'}
              </Text>
            </TouchableOpacity>
            {driverImage && (
              <Image 
                source={{ uri: driverImage }} 
                style={styles.previewImage} 
                resizeMode="cover"
              />
            )}
          </View>

          <View style={styles.uploadSection}>
            <Text style={styles.uploadLabel}>ID Document:</Text>
            <TouchableOpacity 
              style={styles.uploadButton} 
              onPress={() => pickImage(setIdImage)}
            >
              <Text style={styles.uploadText}>
                {idImage ? '✓ ID Selected' : 'Select ID Document'}
              </Text>
            </TouchableOpacity>
            {idImage && (
              <Image 
                source={{ uri: idImage }} 
                style={styles.previewImage} 
                resizeMode="cover"
              />
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#4A90E2" style={{ marginTop: 20, marginBottom: 20 }} />
          ) : (
            <View style={styles.buttonWrapper}>
              <PrimaryButton title="Register" onPress={handleRegister} />
            </View>
          )}

          <TouchableOpacity 
            style={styles.loginLink} 
            onPress={() => router.push('/driverLogin')}
          >
            <Text style={styles.loginText}>Already a driver? Login here</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: Colors.primary,
    paddingBottom: 40,
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#4A90E2',
    width: '100%',
  },
  uploadSection: {
    width: '100%',
    marginBottom: 20,
  },
  uploadLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  loginLink: {
    marginTop: 20,
    padding: 10,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  buttonWrapper: {
    marginTop: 10,
    marginBottom: 20,
    width: '100%',
  },
});