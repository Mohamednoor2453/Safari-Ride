import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert
} from 'react-native';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';

export default function DriverProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(false);
  const router = useRouter();

  const fetchProfile = async () => {
    try {
      const res = await fetch('http://192.168.1.112:3004/api/driverProfile', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await res.json();
      if (data.success) {
        setProfile({ ...data.data, online: data.data.online || false });
        setOnline(data.data.online || false);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error(error);
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const toggleOnline = async () => {
    try {
      const res = await fetch('http://192.168.1.112:3004/api/toggleOnline', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setOnline(data.online);
        Alert.alert(data.message);
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: '#fff', fontSize: 18 }}>Unable to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Image
        source={{ uri: profile.driverImage[0] }}
        style={styles.profileImage}
      />

      <Text style={styles.name}>{profile.name}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Phone:</Text>
        <Text style={styles.value}>{profile.phone}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Car Type:</Text>
        <Text style={styles.value}>{profile.carType}</Text>
      </View>

      {/* Go Online / Offline Button */}
      <TouchableOpacity
        style={[
          styles.onlineButton,
          { backgroundColor: online ? Colors.green : Colors.secondary },
        ]}
        onPress={toggleOnline}
      >
        <Text style={styles.onlineText}>{online ? 'Go Offline' : 'Go Online'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => router.replace('/login')}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  retryButton: {
    marginTop: 15,
    backgroundColor: Colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: Colors.secondary,
    marginBottom: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    letterSpacing: 1,
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    borderLeftWidth: 6,
    borderLeftColor: Colors.secondary,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 17,
    color: '#444',
  },
  value: {
    fontSize: 20,
    color: Colors.secondary,
    fontWeight: 'bold',
    marginTop: 5,
  },
  onlineButton: {
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
    marginTop: 20,
  },
  onlineText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
    marginTop: 30,
  },
  logoutText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
