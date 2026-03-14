import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useGroup, Group, GroupMember } from '@/contexts/GroupContext';
import { useI18n } from '@/contexts/I18nContext';
import { MapLocationPicker } from '@/components/MapLocationPicker';
import Colors from '@/constants/colors';

const C = Colors.light;

function MemberBubble({ member }: { member: GroupMember }) {
  const initial = member.name[0]?.toUpperCase() ?? '?';
  const isJoined = member.status === 'joined' || member.status === 'done';
  return (
    <View style={styles.memberBubbleWrap}>
      <View style={[styles.memberBubble, !isJoined && styles.memberBubbleInvited]}>
        <Text style={[styles.memberInitial, !isJoined && styles.memberInitialInvited]}>{initial}</Text>
        {isJoined && <View style={styles.memberOnline} />}
      </View>
      <Text style={styles.memberName} numberOfLines={1}>{member.name.split(' ')[0]}</Text>
    </View>
  );
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const { setCurrentGroup } = useGroup();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [starting, setStarting] = useState(false);

  const { data: group, isLoading } = useQuery<Group>({
    queryKey: ['group', id],
    queryFn: () => apiFetch(`/groups/${id}`),
    refetchInterval: 5000,
  });

  async function handleStart() {
    if (!location) {
      Alert.alert(t('locationNeeded'), t('locationNeededMsg'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStarting(true);
    try {
      const updated = await apiFetch(`/groups/${id}/start`, {
        method: 'POST',
        body: JSON.stringify({ lat: location.lat, lng: location.lng, radius }),
      });
      setCurrentGroup(updated);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.replace({ pathname: '/(app)/swipe/[id]', params: { id } });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to start. Try again.');
    } finally {
      setStarting(false);
    }
  }

  const isCreator = group?.creatorId === user?.id;
  const joinedCount = group?.members.filter(m => m.status !== 'invited').length ?? 0;
  const radiusLabel = radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`;

  if (isLoading || !group) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.membersSection}>
          <Text style={styles.sectionLabel}>
            {t('members')} · {joinedCount}/{group.members.length} {t('joined')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.membersRow}>
              {group.members.map(m => (
                <MemberBubble key={m.userId} member={m} />
              ))}
            </View>
          </ScrollView>
        </View>

        {isCreator && (
          <>
            <Text style={styles.sectionLabel}>{t('setLocation')}</Text>
            <View style={styles.locationCard}>
              <MapLocationPicker
                location={location}
                radius={radius}
                onLocationChange={setLocation}
                locatingLabel={t('useMyLocation')}
                pickOnMapLabel={t('pickOnMap')}
              />

              <View style={styles.radiusRow}>
                <View style={styles.radiusLabelWrap}>
                  <Ionicons name="radio-outline" size={16} color={C.tint} />
                  <Text style={styles.radiusLabel}>{t('searchRadius')}</Text>
                </View>
                <View style={styles.radiusValueBadge}>
                  <Text style={styles.radiusValue}>{radiusLabel}</Text>
                </View>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={250}
                maximumValue={5000}
                step={250}
                value={radius}
                onValueChange={setRadius}
                minimumTrackTintColor={C.tint}
                maximumTrackTintColor={C.cardBorder}
                thumbTintColor={C.tint}
              />

              {location && (
                <View style={styles.coordChip}>
                  <Ionicons name="location" size={12} color={C.tint} />
                  <Text style={styles.coordChipText}>
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {!isCreator && (
          <View style={styles.waitingForCreator}>
            <Ionicons name="time-outline" size={28} color={C.textMuted} />
            <Text style={styles.waitingText}>
              {t('waitingForHost')} {group.members.find(m => m.userId === group.creatorId)?.name ?? 'the host'} {t('waitingForHostSuffix')}
            </Text>
          </View>
        )}
      </ScrollView>

      {isCreator && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16) }]}>
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              (!location || starting) && styles.startBtnDisabled,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleStart}
            disabled={!location || starting}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <LinearGradient
                colors={[C.tint, '#FF2D55']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startBtnGradient}
              >
                <Ionicons name="play" size={22} color="#fff" />
                <Text style={styles.startBtnText}>{t('startSwiping')}</Text>
              </LinearGradient>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSecondary },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.text, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 20,
  },
  membersSection: { marginBottom: 8 },
  membersRow: { flexDirection: 'row', gap: 16, paddingBottom: 4 },
  memberBubbleWrap: { alignItems: 'center', gap: 6, width: 56 },
  memberBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.tint,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  memberBubbleInvited: {
    backgroundColor: C.backgroundTertiary,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.cardBorder,
  },
  memberInitial: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff' },
  memberInitialInvited: { color: C.textMuted },
  memberOnline: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.backgroundSecondary,
  },
  memberName: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center' },
  locationCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  radiusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  radiusLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radiusLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  radiusValueBadge: {
    backgroundColor: `${C.tint}15`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${C.tint}40`,
  },
  radiusValue: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.tint },
  slider: { width: '100%', height: 36, marginTop: -4 },
  coordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    backgroundColor: `${C.tint}10`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  coordChipText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.tint },
  waitingForCreator: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  waitingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  startBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  startBtnDisabled: { opacity: 0.5 },
  startBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_600SemiBold' },
});
