import React, { useContext, useEffect } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles';
import { UserContext } from '../context/UserContext';

const Home = () => {
  const router = useRouter();
  const { user } = useContext(UserContext);

  // Optional: Check if user exists on home screen load
  useEffect(() => {
    console.log('User on home screen:', user);
  }, [user]);

  const handleComingSoon = (title) => {
    Alert.alert(`${title}`, 'This feature is coming soon!');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={CommonStyles.title}>Safari Ride</Text>
      <Text style={CommonStyles.subtitle}>Choose Your Experience</Text>

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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 30,
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