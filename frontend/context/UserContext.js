// context/UserContext.js
import React, { createContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await SecureStore.getItemAsync("safariUser");
        if (storedUser) setUser(JSON.parse(storedUser));
      } catch (e) {
        console.log("Failed to load user", e);
      }
    })();
  }, []);

  const saveUser = async (userData) => {
    setUser(userData);
    await SecureStore.setItemAsync("safariUser", JSON.stringify(userData));
  };

  const logout = async () => {
    setUser(null);
    await SecureStore.deleteItemAsync("safariUser");
  };

  return (
    <UserContext.Provider value={{ user, saveUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};
