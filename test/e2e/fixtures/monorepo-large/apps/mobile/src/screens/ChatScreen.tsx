import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export const ChatScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>ChatScreen Screen</Text>
      <Text style={styles.body}>Mobile application screen</Text>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Tap ChatScreen</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  heading: { fontSize: 20, fontWeight: "bold", color: "#333" },
  body: { fontSize: 14, color: "#666", marginVertical: 8 },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" }
});

export default ChatScreen;
