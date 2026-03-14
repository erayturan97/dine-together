import React, { useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Text, ActivityIndicator, TextInput } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT, MapPressEvent } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';

const C = Colors.light;

interface Props {
  location: { lat: number; lng: number } | null;
  radius: number;
  onLocationChange: (loc: { lat: number; lng: number }) => void;
  locatingLabel: string;
  pickOnMapLabel: string;
}

interface GeoResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export function MapLocationPicker({ location, radius, onLocationChange, locatingLabel, pickOnMapLabel }: Props) {
  const mapRef = useRef<MapView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  async function handleMyLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const newLoc = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      onLocationChange(newLoc);
      mapRef.current?.animateToRegion({
        latitude: newLoc.lat,
        longitude: newLoc.lng,
        latitudeDelta: Math.max(0.01, (radius / 111000) * 3.5),
        longitudeDelta: Math.max(0.01, (radius / 111000) * 3.5),
      }, 600);
    } finally {
      setLocating(false);
    }
  }

  function handleMapPress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onLocationChange({ lat: latitude, lng: longitude });
  }

  function handleSearchChange(text: string) {
    setSearchText(text);
    setShowResults(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5`,
          { headers: { 'Accept-Language': 'tr,en', 'User-Agent': 'DineTogether/1.0' } }
        );
        const data: GeoResult[] = await res.json();
        setSearchResults(data);
        setShowResults(true);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 500);
  }

  function handleSelectResult(result: GeoResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    onLocationChange({ lat, lng });
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: Math.max(0.01, (radius / 111000) * 3.5),
      longitudeDelta: Math.max(0.01, (radius / 111000) * 3.5),
    }, 600);
    setSearchText(result.display_name.split(',').slice(0, 2).join(','));
    setShowResults(false);
    setSearchResults([]);
  }

  const region = location
    ? {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: Math.max(0.01, (radius / 111000) * 3.5),
        longitudeDelta: Math.max(0.01, (radius / 111000) * 3.5),
      }
    : {
        latitude: 41.0082,
        longitude: 28.9784,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      };

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={handleSearchChange}
            placeholder="Search address or place…"
            placeholderTextColor={C.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
          />
          {searching && <ActivityIndicator size="small" color={C.tint} style={{ marginRight: 8 }} />}
        </View>
      </View>

      {showResults && searchResults.length > 0 && (
        <View style={styles.dropdown}>
          {searchResults.map(r => (
            <Pressable
              key={r.place_id}
              style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
              onPress={() => handleSelectResult(r)}
            >
              <Ionicons name="location-outline" size={14} color={C.tint} />
              <Text style={styles.dropdownText} numberOfLines={2}>{r.display_name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.myLocBtn, { opacity: pressed ? 0.8 : 1 }]}
        onPress={handleMyLocation}
        disabled={locating}
      >
        {locating
          ? <ActivityIndicator color="#fff" size="small" />
          : <Ionicons name="locate" size={18} color="#fff" />}
        <Text style={styles.myLocBtnText}>{locatingLabel}</Text>
      </Pressable>

      <View style={styles.mapContainer}>
        {!location && (
          <View style={styles.hintOverlay} pointerEvents="none">
            <View style={styles.hintBubble}>
              <Ionicons name="finger-print-outline" size={16} color={C.tint} />
              <Text style={styles.hintText}>{pickOnMapLabel}</Text>
            </View>
          </View>
        )}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          region={region}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {location && (
            <>
              <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.markerOuter}>
                  <View style={styles.markerInner} />
                </View>
              </Marker>
              <Circle
                center={{ latitude: location.lat, longitude: location.lng }}
                radius={radius}
                fillColor="rgba(232,96,44,0.12)"
                strokeColor="rgba(232,96,44,0.55)"
                strokeWidth={2}
              />
            </>
          )}
        </MapView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    height: '100%',
  },
  dropdown: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 11, gap: 8,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  dropdownItemPressed: { backgroundColor: C.backgroundSecondary },
  dropdownText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.text, lineHeight: 18 },
  myLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  myLocBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  mapContainer: {
    height: 240,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  map: { flex: 1 },
  hintOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'none',
  },
  hintBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,252,248,0.95)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: '#2C1810', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  hintText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  markerOuter: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(232,96,44,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: C.tint,
  },
  markerInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.tint },
});
