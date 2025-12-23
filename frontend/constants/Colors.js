// constants/Colors.js
export const Colors = {
  primary: "#046A38",
  secondary: "#4A90E2", // Added this - valid React Native color
  accent: "#FFD700",
  
  // Optional: Add more color variations
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#F44336",
  info: "#2196F3",

  dark: {
    text: "#d4d4d4",
    title: "#fff",
    background: "#252231",
    navBackground: "#201e2b",
    uiBackground: "#2f2b3d",
    accent: "#FFD700",
    primary: "#046A38",
    secondary: "#4A90E2", // Also add to dark theme
  },

  light: {
    text: "#625f72",
    title: "#201e2b",
    background: "#e0dfe8",
    navBackground: "#e8e7ef",
    uiBackground: "#d6d5e1",
    accent: "#FFD700",
    primary: "#046A38",
    secondary: "#4A90E2", // Also add to light theme
  },
};

// Optional: Helper function to get color based on theme
export const getColor = (theme, colorName) => {
  if (theme && Colors[theme] && Colors[theme][colorName]) {
    return Colors[theme][colorName];
  }
  return Colors[colorName] || '#4A90E2'; // Default fallback
};

export const createAppStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    logo: {
      width: 120,
      height: 60,
      marginTop: 50,
      marginBottom: 20,
    },
  });