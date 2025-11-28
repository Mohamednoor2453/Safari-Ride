// constants/Colors.js
import { StyleSheet } from "react-native";

export const Colors = {
  primary: "#046A38",
  accent: "#FFD700",

  dark: {
    text: "#d4d4d4",
    title: "#fff",
    background: "#252231",
    navBackground: "#201e2b",
    uiBackground: "#2f2b3d",
    accent: "#FFD700",
    primary: "#046A38",
  },

  light: {
    text: "#625f72",
    title: "#201e2b",
    background: "#e0dfe8",
    navBackground: "#e8e7ef",
    uiBackground: "#d6d5e1",
    accent: "#FFD700",
    primary: "#046A38",
  },
};

export const createAppStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.primary,
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
