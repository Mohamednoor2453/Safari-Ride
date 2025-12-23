// app/_layout.jsx
import React from "react";
import { Stack, useRouter } from "expo-router";
import { useColorScheme, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";
import { UserProvider } from "../context/UserContext.js";

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? Colors.dark : Colors.light;
  const router = useRouter();

  return (
    <UserProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.navBackground },
          headerTintColor: theme.title,
          headerTitleStyle: { fontWeight: "bold", color: theme.title },
          contentStyle: { backgroundColor: theme.background },
          headerLeft: ({ canGoBack }) =>
            canGoBack ? (
              <Pressable onPress={() => router.back()}>
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.title}
                  style={{ marginLeft: 10 }}
                />
              </Pressable>
            ) : null,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: "Home", headerShown: false }}
        />
        <Stack.Screen name="login" options={{ title: "Login" }} />
        <Stack.Screen 
          name="otp" 
          options={{ title: "Verify OTP" }} 
        />
        <Stack.Screen
          name="requestRide"
          options={{ title: "Request Ride" }}
        />
        <Stack.Screen
          name="setDestination"
          options={{ title: "Set Destination" }}
        />
        <Stack.Screen
          name="allowLocation"
          options={{ title: "Allow Location" }}
        />
        {/* ADD THIS LINE - Admin Panel Route */}
        <Stack.Screen
          name="admin"
          options={{ 
            title: "Admin Panel",
            headerShown: true,
            headerBackVisible: true
          }}
        />
      </Stack>
    </UserProvider>
  );
}