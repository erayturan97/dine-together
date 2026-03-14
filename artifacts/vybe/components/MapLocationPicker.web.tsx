import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

let leafletLoadPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise = new Promise(resolve => {
    if (typeof window === 'undefined') { resolve(null); return; }
    if ((window as any).L) { resolve((window as any).L); return; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

function makeIcon(L: any) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:rgba(232,96,44,0.22);border:3px solid #E8602C;box-sizing:border-box;display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:50%;background:#E8602C;"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function MapLocationPicker({ location, radius, onLocationChange, locatingLabel, pickOnMapLabel }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const searchTimerRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const placeOnMap = useCallback((lat: number, lng: number, zoom = 15) => {
    if (!mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const ll: [number, number] = [lat, lng];
    if (markerRef.current) {
      markerRef.current.setLatLng(ll);
    } else {
      markerRef.current = L.marker(ll, { icon: makeIcon(L) }).addTo(mapRef.current);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng(ll);
    } else {
      circleRef.current = L.circle(ll, {
        radius,
        color: '#E8602C',
        fillColor: '#E8602C',
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(mapRef.current);
    }
    mapRef.current.setView(ll, zoom, { animate: true, duration: 0.6 });
  }, [radius]);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !L || !divRef.current || mapRef.current) return;
      LRef.current = L;

      const center: [number, number] = location ? [location.lat, location.lng] : [41.0082, 28.9784];
      const zoom = location ? 14 : 12;

      const map = L.map(divRef.current, { zoomControl: true }).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (location) {
        markerRef.current = L.marker(center, { icon: makeIcon(L) }).addTo(map);
        circleRef.current = L.circle(center, {
          radius,
          color: '#E8602C',
          fillColor: '#E8602C',
          fillOpacity: 0.12,
          weight: 2,
        }).addTo(map);
      }

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        onLocationChange({ lat, lng });
        const ll: [number, number] = [lat, lng];
        if (markerRef.current) {
          markerRef.current.setLatLng(ll);
        } else {
          markerRef.current = L.marker(ll, { icon: makeIcon(L) }).addTo(map);
        }
        if (circleRef.current) {
          circleRef.current.setLatLng(ll);
        } else {
          circleRef.current = L.circle(ll, {
            radius,
            color: '#E8602C',
            fillColor: '#E8602C',
            fillOpacity: 0.12,
            weight: 2,
          }).addTo(map);
        }
      });

      mapRef.current = map;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 150);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; circleRef.current = null; }
    };
  }, []);

  useEffect(() => { if (circleRef.current) circleRef.current.setRadius(radius); }, [radius]);

  useEffect(() => {
    if (!mapRef.current || !location || !LRef.current) return;
    placeOnMap(location.lat, location.lng, 14);
  }, [location?.lat, location?.lng]);

  function handleSearchChange(text: string) {
    setSearchText(text);
    setShowResults(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.trim().length < 3) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
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
    placeOnMap(lat, lng, 15);
    setSearchText(result.display_name.split(',').slice(0, 2).join(','));
    setShowResults(false);
    setSearchResults([]);
  }

  function handleMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocationChange(newLoc);
        placeOnMap(newLoc.lat, newLoc.lng, 15);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 12000 }
    );
  }

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
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
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
              <Text style={styles.dropdownText} numberOfLines={2}>
                {r.display_name}
              </Text>
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
        <div ref={divRef} style={{ width: '100%', height: '100%' }} />

        {!ready && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color={C.tint} size="small" />
            <Text style={styles.loadingText}>Loading map…</Text>
          </View>
        )}

        {ready && !location && (
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.hintBubble}>
              <Ionicons name="finger-print-outline" size={16} color={C.tint} />
              <Text style={styles.hintText}>{pickOnMapLabel}</Text>
            </View>
          </View>
        )}
      </View>

      {location && (
        <View style={styles.coordChip}>
          <Ionicons name="location" size={12} color={C.tint} />
          <Text style={styles.coordText}>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </Text>
        </View>
      )}
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
    backgroundColor: C.card,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
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
    height: 250,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: '#E8F4F8',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    pointerEvents: 'none',
  },
  loadingText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  hintBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,252,248,0.95)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  hintText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  coordChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center',
    backgroundColor: `${C.tint}10`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  coordText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.tint },
});
