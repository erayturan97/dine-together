import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

const C = Colors.light;

export function MapSection({ lat, lng, radius }: { lat: number; lng: number; radius: number }) {
  return (
    <View style={styles.mapWebPlaceholder}>
      <Ionicons name="map-outline" size={32} color={C.textMuted} />
      <Text style={styles.mapWebText}>{lat.toFixed(4)}, {lng.toFixed(4)}</Text>
      <Text style={styles.mapWebSub}>Radius: {radius >= 1000 ? `${(radius/1000).toFixed(1)} km` : `${radius} m`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWebPlaceholder: {
    height: 160,
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mapWebText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  mapWebSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textMuted },
});
