import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n, Lang } from '@/contexts/I18nContext';
import Colors from '@/constants/colors';

const C = Colors.light;
const APP_VERSION = '1.0.0';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const insets = useSafeAreaInsets();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const firstName = user?.name?.split(' ')[0] ?? '';
  const initial = firstName[0]?.toUpperCase() ?? '?';
  const providerLabel = user?.provider === 'google' ? t('google') : t('guest');

  function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowSignOutModal(true);
  }

  async function confirmSignOut() {
    setShowSignOutModal(false);
    await signOut();
    router.replace('/auth');
  }

  function handleLang(l: Lang) {
    if (l === lang) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLang(l);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('profile')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[`${C.tint}18`, C.backgroundSecondary]}
          style={styles.avatarSection}
        >
          <View style={styles.avatarWrap}>
            <LinearGradient colors={[C.tint, C.tintDark]} style={styles.avatar}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </LinearGradient>
          </View>
          <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
          <View style={styles.providerBadge}>
            <Ionicons
              name={user?.provider === 'google' ? 'logo-google' : 'person-outline'}
              size={13}
              color={C.textSecondary}
            />
            <Text style={styles.providerText}>{t('signedInWith')} {providerLabel}</Text>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('language')}</Text>
          <View style={styles.langToggle}>
            <Pressable
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              onPress={() => handleLang('en')}
            >
              <Text style={styles.langFlag}>🇬🇧</Text>
              <Text style={[styles.langLabel, lang === 'en' && styles.langLabelActive]}>
                {t('english')}
              </Text>
              {lang === 'en' && <Ionicons name="checkmark-circle" size={16} color={C.tint} />}
            </Pressable>
            <View style={styles.langDivider} />
            <Pressable
              style={[styles.langBtn, lang === 'tr' && styles.langBtnActive]}
              onPress={() => handleLang('tr')}
            >
              <Text style={styles.langFlag}>🇹🇷</Text>
              <Text style={[styles.langLabel, lang === 'tr' && styles.langLabelActive]}>
                {t('turkish')}
              </Text>
              {lang === 'tr' && <Ionicons name="checkmark-circle" size={16} color={C.tint} />}
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('account')}</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color={C.textSecondary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{t('yourName')}</Text>
                <Text style={styles.infoValue}>{user?.name ?? '—'}</Text>
              </View>
            </View>
            {user?.email ? (
              <>
                <View style={styles.rowDivider} />
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={18} color={C.textSecondary} />
                  <View style={styles.infoText}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{user.email}</Text>
                  </View>
                </View>
              </>
            ) : null}
            <View style={styles.rowDivider} />
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={C.textSecondary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{t('signedInWith')}</Text>
                <Text style={styles.infoValue}>{providerLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={18} color={C.textSecondary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{t('appVersion')}</Text>
                <Text style={styles.infoValue}>{APP_VERSION}</Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, { opacity: pressed ? 0.85 : 1 }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={C.dislikeRed} />
          <Text style={styles.signOutText}>{t('signOut')}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSignOutModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={28} color={C.dislikeRed} />
            </View>
            <Text style={styles.modalTitle}>{t('signOut')}</Text>
            <Text style={styles.modalMessage}>{t('signOutConfirm')}</Text>
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalConfirmBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={confirmSignOut}
              >
                <Text style={styles.modalConfirmText}>{t('signOut')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.text },
  content: { paddingHorizontal: 20, gap: 20 },
  avatarSection: {
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
  },
  avatarWrap: {
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#fff' },
  profileName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  providerText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: C.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  langToggle: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  langBtnActive: { backgroundColor: `${C.tint}10` },
  langFlag: { fontSize: 22 },
  langLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: C.text },
  langLabelActive: { fontFamily: 'Inter_600SemiBold', color: C.tint },
  langDivider: { height: 1, backgroundColor: C.cardBorder, marginHorizontal: 16 },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.text },
  rowDivider: { height: 1, backgroundColor: C.cardBorder, marginHorizontal: 16 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: `${C.dislikeRed}12`,
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: `${C.dislikeRed}30`,
    marginTop: 4,
  },
  signOutText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.dislikeRed },
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
    maxWidth: 340,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: `${C.dislikeRed}12`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${C.dislikeRed}25`,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: C.backgroundSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: C.dislikeRed,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
