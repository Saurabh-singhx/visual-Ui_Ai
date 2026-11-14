import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function NotificationBanner({ message = 'Update available', type = 'info', onDismiss }) {
  return (
    <View style={[styles.banner, type === 'warning' ? styles.warning : styles.info]}>
      <Text style={styles.messageText}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} style={styles.actionBtn}>
        <Text style={styles.actionText}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  info: {
    backgroundColor: '#E0F2FE',
  },
  warning: {
    backgroundColor: '#FEF3C7',
  },
  messageText: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '500',
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default NotificationBanner;
