import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  Modal,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useGroup, User } from '@/contexts/GroupContext';
import { useI18n } from '@/contexts/I18nContext';
import { useContactsMatch } from '@/hooks/useContactsMatch';
import Colors from '@/constants/colors';

const C = Colors.light;

const INVITE_URL = 'https://dinetogether.app/invite';

type VenueType = 'restaurant' | 'cafe' | 'bar';

const VENUE_OPTIONS: { type: VenueType; label: string; icon: string; description: string }[] = [
  { type: 'restaurant', label: 'Restaurant', icon: 'restaurant', description: 'Full dining experience' },
  { type: 'cafe', label: 'Cafe', icon: 'cafe', description: 'Coffee & light bites' },
  { type: 'bar', label: 'Bar', icon: 'beer', description: 'Drinks & nightlife' },
];

function UserChip({ user, onRemove }: { user: User; onRemove: () => void }) {
  const initial = user.name[0]?.toUpperCase() ?? '?';
  return (
    <View style={styles.chip}>
      <View style={styles.chipAvatar}>
        <Text style={styles.chipInitial}>{initial}</Text>
      </View>
      <Text style={styles.chipName} numberOfLines={1}>{user.name}</Text>
      <Pressable onPress={onRemove} style={styles.chipRemove}>
        <Ionicons name="close" size={14} color={C.textSecondary} />
      </Pressable>
    </View>
  );
}

function UserRow({ user, onAdd, isContact }: { user: User; onAdd: () => void; isContact?: boolean }) {
  const initial = user.name[0]?.toUpperCase() ?? '?';
  return (
    <Pressable
      style={({ pressed }) => [styles.userRow, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onAdd}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.userInitial}>{initial}</Text>
        {isContact && (
          <View style={styles.contactBadge}>
            <Ionicons name="people" size={8} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.name}</Text>
        {user.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
      </View>
      <View style={styles.addBtn}>
        <Ionicons name="add" size={18} color={C.tint} />
      </View>
    </Pressable>
  );
}

export default function CreateGroupScreen() {
  const { user: currentUser } = useAuth();
  const { apiFetch } = useApi();
  const { setCurrentGroup } = useGroup();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [groupName, setGroupName] = useState('');
  const [venueType, setVenueType] = useState<VenueType>('restaurant');
  const [selectedFriends, setSelectedFriends] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [contactsImported, setContactsImported] = useState(false);

  const contacts = useContactsMatch();

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['friends'],
    queryFn: () => apiFetch('/users/friends'),
  });

  const { data: searchResults } = useQuery<User[]>({
    queryKey: ['search', search],
    queryFn: () => apiFetch(`/users/search?q=${encodeURIComponent(search)}`),
    enabled: search.length >= 2,
  });

  const displayUsers = search.length >= 2 ? (searchResults ?? []) : (allUsers ?? []);
  const filteredUsers = displayUsers.filter(
    u => u.id !== currentUser?.id && !selectedFriends.some(f => f.id === u.id)
  );

  const contactUsers = contacts.matched.filter(
    u => u.id !== currentUser?.id && !selectedFriends.some(f => f.id === u.id)
  );

  function addFriend(user: User) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriends(prev => [...prev, user]);
  }

  function removeFriend(userId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriends(prev => prev.filter(f => f.id !== userId));
  }

  async function handleImportContacts() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await contacts.fetch();
    setContactsImported(true);
    if (contacts.permissionDenied) {
      Alert.alert(t('contactsPermissionDenied'), t('contactsPermissionMsg'));
    }
  }

  async function handleShareInvite() {
    const msg = `${t('inviteLinkText')} ${INVITE_URL}`;
    if (Platform.OS === 'web') {
      setShowInviteModal(true);
      return;
    }
    try {
      await Share.share({ message: msg, url: INVITE_URL });
    } catch {
      setShowInviteModal(true);
    }
  }

  function handleCopyLink() {
    Clipboard.setString(INVITE_URL);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  }

  async function handleCreate() {
    if (!groupName.trim()) {
      Alert.alert('Name required', 'Please give your group a name');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreating(true);
    try {
      const group = await apiFetch('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName.trim(),
          memberIds: selectedFriends.map(f => f.id),
          venueType,
        }),
      });
      setCurrentGroup(group);
      router.replace({ pathname: '/(app)/group/[id]', params: { id: group.id } });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>New Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Group Name</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Friday Night Crew..."
            placeholderTextColor={C.textMuted}
            maxLength={40}
          />
        </View>

        <Text style={styles.sectionLabel}>What are you looking for?</Text>
        <View style={styles.venueGrid}>
          {VENUE_OPTIONS.map(opt => (
            <Pressable
              key={opt.type}
              style={({ pressed }) => [
                styles.venueOption,
                venueType === opt.type && styles.venueOptionSelected,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVenueType(opt.type); }}
            >
              <Ionicons
                name={opt.icon as any}
                size={26}
                color={venueType === opt.type ? C.tint : C.textSecondary}
              />
              <Text style={[styles.venueLabel, venueType === opt.type && styles.venueLabelSelected]}>
                {opt.label}
              </Text>
              <Text style={[styles.venueDesc, venueType === opt.type && { color: C.tint + '80' }]}>
                {opt.description}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Add Friends</Text>

        <View style={styles.friendActions}>
          <Pressable
            style={({ pressed }) => [styles.actionPill, { opacity: pressed ? 0.8 : 1 }]}
            onPress={handleImportContacts}
            disabled={contacts.loading}
          >
            {contacts.loading ? (
              <ActivityIndicator size="small" color={C.tint} />
            ) : (
              <Ionicons name="people-outline" size={16} color={C.tint} />
            )}
            <Text style={styles.actionPillText}>{t('importContacts')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionPill, styles.actionPillSecondary, { opacity: pressed ? 0.8 : 1 }]}
            onPress={handleShareInvite}
          >
            <Ionicons name="share-outline" size={16} color={C.textSecondary} />
            <Text style={[styles.actionPillText, { color: C.textSecondary }]}>{t('inviteLink')}</Text>
          </Pressable>
        </View>

        {contactsImported && contactUsers.length > 0 && (
          <>
            <Text style={styles.subsectionLabel}>{t('contactsFromPhone')}</Text>
            <View style={styles.usersList}>
              {contactUsers.map(u => (
                <UserRow key={u.id} user={u} onAdd={() => addFriend(u)} isContact />
              ))}
            </View>
          </>
        )}

        {contactsImported && !contacts.loading && contactUsers.length === 0 && !contacts.permissionDenied && (
          <View style={styles.noContacts}>
            <Ionicons name="people-outline" size={20} color={C.textMuted} />
            <Text style={styles.noContactsText}>{t('noContactsFound')}</Text>
          </View>
        )}

        {selectedFriends.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              {selectedFriends.map(f => (
                <UserChip key={f.id} user={f} onRemove={() => removeFriend(f.id)} />
              ))}
            </View>
          </ScrollView>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name..."
            placeholderTextColor={C.textMuted}
          />
        </View>

        {filteredUsers.length > 0 ? (
          <View style={styles.usersList}>
            {filteredUsers.map(u => (
              <UserRow key={u.id} user={u} onAdd={() => addFriend(u)} />
            ))}
          </View>
        ) : (
          <View style={styles.noFriends}>
            <Ionicons name="person-add-outline" size={28} color={C.textMuted} />
            <Text style={styles.noFriendsText}>
              {search.length >= 2 ? 'No users found' : 'Invite your friends by sharing DineTogether'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            (!groupName.trim() || creating) && styles.createBtnDisabled,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handleCreate}
          disabled={!groupName.trim() || creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.createBtnText}>
                Create Group {selectedFriends.length > 0 ? `(${selectedFriends.length + 1})` : ''}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </Pressable>
      </View>

      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowInviteModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIcon}>
                <Ionicons name="share-social" size={28} color={C.tint} />
              </View>
            </View>
            <Text style={styles.modalTitle}>{t('inviteFriends')}</Text>
            <Text style={styles.modalMessage}>{t('inviteFriendsMsg')}</Text>

            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={1}>{INVITE_URL}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.copyBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={handleCopyLink}
            >
              <Ionicons name={linkCopied ? 'checkmark' : 'copy-outline'} size={18} color="#fff" />
              <Text style={styles.copyBtnText}>{linkCopied ? t('linkCopied') : t('copyLink')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.closeModalBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setShowInviteModal(false)}
            >
              <Text style={styles.closeModalText}>{t('ok')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },
  subsectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: C.tint,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  inputContainer: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: C.text,
  },
  venueGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  venueOption: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: C.cardBorder,
  },
  venueOptionSelected: {
    borderColor: C.tint,
    backgroundColor: `${C.tint}08`,
  },
  venueLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  venueLabelSelected: {
    color: C.tint,
  },
  venueDesc: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
  },
  friendActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${C.tint}12`,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: `${C.tint}30`,
    flex: 1,
    justifyContent: 'center',
  },
  actionPillSecondary: {
    backgroundColor: C.card,
    borderColor: C.cardBorder,
  },
  actionPillText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.tint,
  },
  noContacts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  noContactsText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  chipScroll: {
    marginTop: 12,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${C.tint}15`,
    borderRadius: 100,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: `${C.tint}30`,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInitial: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  chipName: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: C.text,
    maxWidth: 80,
  },
  chipRemove: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    gap: 8,
    marginBottom: 12,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: C.text,
  },
  usersList: {
    gap: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  contactBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.tint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.card,
  },
  userInitial: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: C.text,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${C.tint}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFriends: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  noFriendsText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  createBtn: {
    backgroundColor: C.tint,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
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
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    gap: 8,
  },
  modalIconRow: {
    marginBottom: 4,
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: `${C.tint}15`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${C.tint}30`,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  linkBox: {
    width: '100%',
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  linkText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: C.tint,
  },
  copyBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  copyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  closeModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 2,
  },
  closeModalText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
  },
});
