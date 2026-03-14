import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { Group, GroupMember } from '@/contexts/GroupContext';
import { useI18n } from '@/contexts/I18nContext';
import Colors from '@/constants/colors';

const C = Colors.light;

function PulsingDot({ delay }: { delay: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, tension: 60, friction: 5 }),
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 5 }),
          Animated.timing(opacity, { toValue: 0.6, duration: 300, useNativeDriver: true }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [delay]);

  return (
    <Animated.View style={[styles.pulseDot, { transform: [{ scale }], opacity }]} />
  );
}

function MemberStatus({ member, isCurrentUser }: { member: GroupMember; isCurrentUser: boolean }) {
  const isDone = member.status === 'done';
  const { t } = useI18n();
  return (
    <View style={styles.memberRow}>
      <View style={[styles.memberAvatar, isDone && styles.memberAvatarDone]}>
        <Text style={[styles.memberInitial, isDone && styles.memberInitialDone]}>
          {member.name[0]?.toUpperCase()}
        </Text>
        {isDone && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {member.name} {isCurrentUser ? '(you)' : ''}
        </Text>
        <Text style={[styles.memberStatus, isDone && styles.memberStatusDone]}>
          {isDone ? t('finishedSwiping') : t('stillDeciding')}
        </Text>
      </View>
      {isDone ? (
        <Ionicons name="checkmark-circle" size={22} color={C.success} />
      ) : (
        <View style={styles.thinkingDots}>
          <PulsingDot delay={0} />
          <PulsingDot delay={200} />
          <PulsingDot delay={400} />
        </View>
      )}
    </View>
  );
}

export default function WaitingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const insets = useSafeAreaInsets();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const { data: group } = useQuery<Group>({
    queryKey: ['group', id],
    queryFn: () => apiFetch(`/groups/${id}`),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (group?.status === 'completed') {
      router.replace({ pathname: '/(app)/results/[id]', params: { id } });
    }
  }, [group?.status]);

  const joinedMembers = group?.members.filter(m => m.status !== 'invited') ?? [];
  const doneCount = joinedMembers.filter(m => m.status === 'done').length;
  const totalCount = joinedMembers.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0), paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }]}>
      <View style={styles.heroSection}>
        <View style={styles.spinnerContainer}>
          <Animated.View style={[styles.spinnerOuter, { transform: [{ rotate: rotation }] }]}>
            {[0, 60, 120, 180, 240, 300].map(deg => (
              <View
                key={deg}
                style={[styles.spinnerDot, { transform: [{ rotate: `${deg}deg` }, { translateY: -34 }] }]}
              />
            ))}
          </Animated.View>
          <View style={styles.spinnerInner}>
            <Ionicons name="restaurant" size={28} color={C.tint} />
          </View>
        </View>

        <Text style={styles.heroTitle}>Waiting for the crew</Text>
        <Text style={styles.heroSubtitle}>
          {doneCount === totalCount
            ? 'Everyone is done! Calculating results...'
            : `${doneCount} of ${totalCount} finished swiping`}
        </Text>

        <View style={styles.progressRow}>
          {joinedMembers.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i < doneCount && styles.progressSegmentDone,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.membersSection}>
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.membersList}>
          {joinedMembers.map(m => (
            <MemberStatus
              key={m.userId}
              member={m}
              isCurrentUser={m.userId === user?.id}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Ionicons name="lock-closed-outline" size={14} color={C.textMuted} />
        <Text style={styles.footerText}>Results reveal when everyone finishes</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.backgroundSecondary,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
  },
  spinnerContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  spinnerOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.tint,
    opacity: 0.6,
  },
  spinnerInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${C.tint}15`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: `${C.tint}30`,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    backgroundColor: C.cardBorder,
    borderRadius: 2,
    maxWidth: 40,
  },
  progressSegmentDone: {
    backgroundColor: C.tint,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  membersSection: { flex: 1 },
  membersList: {
    backgroundColor: C.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  memberAvatarDone: {
    backgroundColor: `${C.success}20`,
  },
  memberInitial: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  memberInitialDone: {
    color: C.success,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.card,
  },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.text },
  memberStatus: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textMuted },
  memberStatusDone: { color: C.success },
  thinkingDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.tint,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
  },
  footerText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textMuted },
});
