import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors.js";

export const CommonStyles = StyleSheet.create({
  logo: {
    width: 200,
    height: 100,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.secondary, // yellow
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    marginBottom: 60,
  },
});
