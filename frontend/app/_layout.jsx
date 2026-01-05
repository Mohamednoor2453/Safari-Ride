// app/_layout.jsx - CORRECTED VERSION
import React from "react";
import { Stack, useRouter, usePathname } from "expo-router";
import { useColorScheme, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";
import { UserProvider } from "../context/UserContext.js";

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? Colors.dark : Colors.light;
  const router = useRouter();
  const pathname = usePathname();

  // Custom back handler that redirects to login when on admin page
  const handleBackPress = () => {
    if (pathname === "/admin") {
      // When on admin page, redirect to login instead of going back
      router.replace("/login");
    } else {
      // For other pages, use normal back navigation
      router.back();
    }
  };

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
              <Pressable 
                onPress={handleBackPress}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 10,
                  padding: 5
                })}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.title}
                />
              </Pressable>
            ) : null,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ 
            title: "Home", 
            headerShown: false,
            headerLeft: () => null // Disable back button on index
          }}
        />
        <Stack.Screen 
          name="login" 
          options={{ 
            title: "Login",
            headerLeft: ({ canGoBack }) => canGoBack ? (
              <Pressable 
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 10,
                  padding: 5
                })}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.title}
                />
              </Pressable>
            ) : null
          }} 
        />
        <Stack.Screen 
          name="otp" 
          options={{ 
            title: "Verify OTP",
            headerLeft: ({ canGoBack }) => canGoBack ? (
              <Pressable 
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 10,
                  padding: 5
                })}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.title}
                />
              </Pressable>
            ) : null
          }} 
        />
        <Stack.Screen
          name="allowLocation"
          options={{ 
            title: "Allow Location",
            headerLeft: ({ canGoBack }) => canGoBack ? (
              <Pressable 
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 10,
                  padding: 5
                })}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.title}
                />
              </Pressable>
            ) : null
          }}
        />
        <Stack.Screen
          name="home"
          options={{ 
            title: "Home",
            headerShown: false, // Home should have no header
            headerLeft: () => null
          }}
        />
        <Stack.Screen
          name="requestRide"
          options={{ 
            title: "Request Ride",
            headerLeft: ({ canGoBack }) => canGoBack ? (
              <Pressable 
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 10,
                  padding: 5
                })}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.title}
                />
              </Pressable>
            ) : null
          }}
        />
        <Stack.Screen
          name="fare"
          options={{ 
            title: "Fare Estimate",
            headerLeft: ({ canGoBack }) => canGoBack ? (
              <Pressable 
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 10,
                  padding: 5
                })}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.title}
                />
              </Pressable>
            ) : null
          }}
        />
        <Stack.Screen
          name="admin"
          options={{ 
            title: "Admin Panel",
            headerShown: true,
            headerLeft: ({ canGoBack }) => canGoBack ? (
              <Pressable 
                onPress={() => router.replace("/login")}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 10,
                  padding: 5
                })}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.title}
                />
              </Pressable>
            ) : null
          }}
        />
      </Stack>
    </UserProvider>
  );
}