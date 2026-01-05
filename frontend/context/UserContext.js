// context/UserContext.jsx - ENHANCED VERSION
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔧 UserProvider mounted');
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      console.log('🔍 Loading user from storage...');
      
      // Try to get user from 'currentUser' key
      const userString = await AsyncStorage.getItem('currentUser');
      
      if (userString) {
        try {
          const userData = JSON.parse(userString);
          console.log('✅ User loaded from storage:', {
            phone: userData.phone,
            id: userData._id ? userData._id.substring(0, 8) + '...' : 'no-id',
            verified: userData.verified
          });
          setUser(userData);
        } catch (parseError) {
          console.error('❌ Error parsing user data:', parseError);
          // Clear corrupted data
          await AsyncStorage.removeItem('currentUser');
        }
      } else {
        console.log('ℹ️ No user found in storage');
      }
    } catch (error) {
      console.error('❌ Error loading user from storage:', error);
    } finally {
      setLoading(false);
      console.log('🏁 UserProvider loading complete');
    }
  };

  const updateUser = async (userData) => {
    console.log('🔄 Updating user:', {
      phone: userData.phone,
      id: userData._id ? userData._id.substring(0, 8) + '...' : 'no-id'
    });
    
    setUser(userData);
    try {
      await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
      console.log('✅ User saved to storage');
    } catch (err) {
      console.error('❌ Error saving user:', err);
    }
  };

  const logout = async () => {
    console.log('👋 Logging out user');
    try {
      await AsyncStorage.multiRemove(['currentUser', 'userPhone']);
      console.log('✅ User data cleared from storage');
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
    }
    setUser(null);
  };

  const clearUserData = async () => {
    console.log('🧹 Clearing all user data');
    try {
      await AsyncStorage.clear();
      console.log('✅ All storage cleared');
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
    }
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      updateUser, 
      logout, 
      clearUserData,
      loading 
    }}>
      {children}
    </UserContext.Provider>
  );
};

// Create a custom hook for better error handling
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    console.error('❌ useUser must be used within a UserProvider');
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};