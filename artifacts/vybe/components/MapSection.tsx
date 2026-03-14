import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Circle, PROVIDER_DEFAULT } from 'react-native-maps';

export function MapSection({ lat, lng, radius }: { lat: number; lng: number; radius: number }) {
  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: (radius / 111000) * 3,
          longitudeDelta: (radius / 111000) * 3,
        }}
      >
        <Circle
          center={{ latitude: lat, longitude: lng }}
          radius={radius}
          fillColor="rgba(255,71,87,0.1)"
          strokeColor="rgba(255,71,87,0.5)"
          strokeWidth={2}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: { flex: 1 },
});
