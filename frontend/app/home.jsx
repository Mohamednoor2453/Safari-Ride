// app/home.jsx - CORRECTED VERSION
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const Home = () => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      console.log('🔍 Loading user for home screen...');
      const userString = await AsyncStorage.getItem('currentUser');
      
      if (userString) {
        const userData = JSON.parse(userString);
        console.log('✅ User loaded:', userData);
        
        // Check if this is admin (compare with admin phone)
        const adminPhone = '+254745827403'; // Your admin phone from .env
        const normalizedAdminPhone = adminPhone.startsWith('0') ? 
          '+254' + adminPhone.slice(1) : adminPhone;
        
        const userPhone = userData.phone;
        const normalizedUserPhone = userPhone.startsWith('0') ? 
          '+254' + userPhone.slice(1) : userPhone;
        
        console.log('🔐 Admin check:');
        console.log('  - User phone:', userPhone);
        console.log('  - Normalized user phone:', normalizedUserPhone);
        console.log('  - Admin phone:', adminPhone);
        console.log('  - Normalized admin phone:', normalizedAdminPhone);
        console.log('  - Is admin?', normalizedUserPhone === normalizedAdminPhone);
        
        if (normalizedUserPhone === normalizedAdminPhone) {
          console.log('🔐 Admin detected in home screen, redirecting to admin panel');
          router.replace('/admin');
          return;
        }
        
        setUser(userData);
      } else {
        console.log('ℹ️ No user found, redirecting to login...');
        router.replace('/login');
      }
    } catch (error) {
      console.error('❌ Error loading user:', error);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleComingSoon = (title) => {
    Alert.alert(`${title}`, 'This feature is coming soon!');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              router.replace('/login');
            } catch (error) {
              console.error('Error logging out:', error);
            }
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={CommonStyles.title}>Safari Ride</Text>
        <Text style={CommonStyles.subtitle}>Choose Your Experience</Text>
        
        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.userInfoText}>Welcome, {user.phone}</Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.grid}>
        {/* Request Ride */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/requestRide')}>
          <Image source={require('../assets/img/request.png')} style={styles.icon} />
          <Text style={styles.cardTitle}>Request Ride</Text>
        </TouchableOpacity>

        {/* Driver App */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/driverLogin')}>
          <Image source={require('../assets/img/driver.png')} style={styles.icon} />
          <Text style={styles.cardTitle}>Safari Driver App</Text>
        </TouchableOpacity>

        {/* Delivery App */}
        <TouchableOpacity style={styles.card} onPress={() => handleComingSoon('Delivery App')}>
          <Image source={require('../assets/img/delivery.png')} style={styles.icon} />
          <Text style={styles.cardTitle}>Safari Eats and Delivery</Text>
        </TouchableOpacity>

        {/* Tourist App */}
        <TouchableOpacity style={styles.card} onPress={() => handleComingSoon('Tourist App')}>
          <Image source={require('../assets/img/tourist.png')} style={styles.icon} />
          <Text style={styles.cardTitle}>Safari Tourist</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  userInfo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 15,
    marginTop: 15,
    width: '100%',
    alignItems: 'center',
  },
  userInfoText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 5,
    paddingVertical: 5,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255,0,0,0.2)',
    borderRadius: 10,
  },
  logoutText: {
    color: '#ff6b6b',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.white,
    marginTop: 10,
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '45%',
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    width: 50,
    height: 50,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 14,
    color: Colors.secondary,
    textAlign: 'center',
  },
});