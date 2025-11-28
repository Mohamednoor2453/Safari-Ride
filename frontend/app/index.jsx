import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CommonStyles } from '../components/CommonStyles.js';
import PrimaryButton from '../components/PrimaryButton.jsx';

const Splash = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/img/icon3.png')}
        style={CommonStyles.logo}
        resizeMode="contain"
      />
      <Text style={CommonStyles.title}>Safari Ride</Text>
      <Text style={CommonStyles.subtitle}>Your ride, your way</Text>

      <PrimaryButton
        title="Get Started"
        onPress={() => router.push('/login')}
      />
    </View>
  );
};

export default Splash;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
