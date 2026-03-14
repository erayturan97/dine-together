import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useGroup, Group } from '@/contexts/GroupContext';
import { useI18n } from '@/contexts/I18nContext';
import Colors from '@/constants/colors';

const C = Colors.light;

const STATUS_COLORS = {
  pending: '#F59E0B',
  swiping: C.tint,
  waiting: '#8B5CF6',
  completed: C.success,
};

function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            {!!cancelText && (
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalCancelBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={onCancel}
              >
                <Text style={styles.modalCancelText}>{cancelText}</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                destructive ? styles.modalDestructiveBtn : styles.modalConfirmBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={onConfirm}
            >
              <Text style={destructive ? styles.modalDestructiveText : styles.modalConfirmText}>
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GroupCard({
  group,
  isCreator,
  onPress,
  onDelete,
  onLeave,
  statusLabel,
}: {
  group: Group;
  isCreator: boolean;
  onPress: () => void;
  onDelete: () => void;
  onLeave: () => void;
  statusLabel: string;
}) {
  const VENUE_ICONS: Record<string, 'restaurant' | 'cafe' | 'beer'> = {
    restaurant: 'restaurant',
    cafe: 'cafe',
    bar: 'beer',
  };
  const joined = group.members.filter(m => m.status !== 'invited').length;
  const statusColor = STATUS_COLORS[group.status];
  const { t } = useI18n();

  return (
    <View style={styles.groupCard}>
      <Pressable
        style={({ pressed }) => [styles.groupCardPressable, { opacity: pressed ? 0.92 : 1 }]}
        onPress={onPress}
      >
        <View style={[styles.venueIconBg, { backgroundColor: `${statusColor}15` }]}>
          <Ionicons name={VENUE_ICONS[group.venueType] ?? 'restaurant'} size={22} color={statusColor} />
        </View>
        <View style={styles.groupCardContent}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
          <View style={styles.groupMeta}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.memberCount}>
            {joined} {t('joined')} / {group.members.length}
          </Text>
        </View>
      </Pressable>

      {isCreator ? (
        <Pressable
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [styles.actionIconBtn, styles.deleteBtnBg, { opacity: pressed ? 0.6 : 1 }]}
          onPress={onDelete}
        >
          <Ionicons name="trash-outline" size={18} color={C.dislikeRed} />
        </Pressable>
      ) : (
        <Pressable
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [styles.actionIconBtn, styles.leaveBtnBg, { opacity: pressed ? 0.6 : 1 }]}
          onPress={onLeave}
        >
          <Ionicons name="exit-outline" size={18} color="#8B5CF6" />
        </Pressable>
      )}
    </View>
  );
}

type DialogConfig = {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  onConfirm: () => void;
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const { setCurrentGroup } = useGroup();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const { t } = useI18n();

  const { data: groups, isLoading, refetch } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => apiFetch('/groups'),
    refetchInterval: 8000,
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiFetch(`/groups/${groupId}`, { method: 'DELETE' }),
    onMutate: async (groupId: string) => {
      await queryClient.cancelQueries({ queryKey: ['groups'] });
      const prev = queryClient.getQueryData<Group[]>(['groups']);
      queryClient.setQueryData<Group[]>(['groups'], old => (old ?? []).filter(g => g.id !== groupId));
      return { prev };
    },
    onError: (_err, _groupId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['groups'], ctx.prev);
      setDialog({
        title: 'Error',
        message: t('deleteGroupError'),
        confirmText: 'OK',
        cancelText: '',
        destructive: false,
        onConfirm: () => setDialog(null),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiFetch(`/groups/${groupId}/leave`, { method: 'DELETE' }),
    onMutate: async (groupId: string) => {
      await queryClient.cancelQueries({ queryKey: ['groups'] });
      const prev = queryClient.getQueryData<Group[]>(['groups']);
      queryClient.setQueryData<Group[]>(['groups'], old => (old ?? []).filter(g => g.id !== groupId));
      return { prev };
    },
    onError: (_err, _groupId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['groups'], ctx.prev);
      setDialog({
        title: 'Error',
        message: t('leaveGroupError'),
        confirmText: 'OK',
        cancelText: '',
        destructive: false,
        onConfirm: () => setDialog(null),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  function handleGroupPress(group: Group) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentGroup(group);
    if (group.status === 'pending') {
      router.push({ pathname: '/(app)/group/[id]', params: { id: group.id } });
    } else if (group.status === 'swiping') {
      router.push({ pathname: '/(app)/swipe/[id]', params: { id: group.id } });
    } else if (group.status === 'waiting') {
      router.push({ pathname: '/(app)/waiting/[id]', params: { id: group.id } });
    } else {
      router.push({ pathname: '/(app)/results/[id]', params: { id: group.id } });
    }
  }

  function handleDeletePress(group: Group) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDialog({
      title: t('deleteGroup'),
      message: t('deleteGroupConfirm'),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      destructive: true,
      onConfirm: () => {
        setDialog(null);
        deleteMutation.mutate(group.id);
      },
    });
  }

  function handleLeavePress(group: Group) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDialog({
      title: t('leaveGroup'),
      message: t('leaveGroupConfirm'),
      confirmText: t('leave'),
      cancelText: t('cancel'),
      destructive: true,
      onConfirm: () => {
        setDialog(null);
        leaveMutation.mutate(group.id);
      },
    });
  }

  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? t('goodMorning') : timeOfDay < 17 ? t('goodAfternoon') : t('goodEvening');
  const firstName = user?.name?.split(' ')[0] ?? '';
  const initial = firstName[0]?.toUpperCase() ?? '?';

  const STATUS_LABELS = {
    pending: t('waitingForFriends'),
    swiping: t('swipingNow'),
    waiting: t('waitingForOthers'),
    completed: t('resultsReady'),
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.userName}>{firstName}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.avatarBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(app)/profile');
          }}
        >
          <LinearGradient colors={[C.tint, C.tintDark]} style={styles.avatar}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.newGroupBtn, { opacity: pressed ? 0.9 : 1 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(app)/create-group'); }}
      >
        <LinearGradient
          colors={[C.tint, '#FF2D55']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.newGroupBtnGradient}
        >
          <View style={styles.newGroupBtnIcon}>
            <Ionicons name="add" size={22} color={C.tint} />
          </View>
          <Text style={styles.newGroupBtnText}>{t('startNewGroup')}</Text>
          <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </Pressable>

      <Text style={styles.sectionTitle}>{t('yourSessions')}</Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.tint} />
        </View>
      ) : (
        <FlatList
          data={groups ?? []}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              isCreator={item.creatorId === user?.id}
              statusLabel={STATUS_LABELS[item.status]}
              onPress={() => handleGroupPress(item)}
              onDelete={() => handleDeletePress(item)}
              onLeave={() => handleLeavePress(item)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.tint}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={36} color={C.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{t('noSessionsYet')}</Text>
              <Text style={styles.emptySubtitle}>{t('noSessionsSubtitle')}</Text>
            </View>
          }
        />
      )}

      {dialog && (
        <ConfirmModal
          visible
          title={dialog.title}
          message={dialog.message}
          confirmText={dialog.confirmText}
          cancelText={dialog.cancelText}
          destructive={dialog.destructive}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSecondary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  userName: { fontSize: 28, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 2 },
  avatarBtn: {},
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  newGroupBtn: {
    marginHorizontal: 20,
    marginBottom: 28,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  newGroupBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12,
  },
  newGroupBtnIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newGroupBtnText: { flex: 1, color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  list: { paddingHorizontal: 20, gap: 10 },
  groupCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  groupCardPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  venueIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupCardContent: { flex: 1, gap: 3 },
  groupName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
  groupMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  memberCount: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textMuted },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnBg: { backgroundColor: `${C.dislikeRed}12` },
  leaveBtnBg: { backgroundColor: 'rgba(139,92,246,0.1)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: C.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.text },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: C.backgroundTertiary,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  modalConfirmBtn: {
    backgroundColor: C.tint,
  },
  modalConfirmText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  modalDestructiveBtn: {
    backgroundColor: `${C.dislikeRed}18`,
  },
  modalDestructiveText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.dislikeRed,
  },
});
