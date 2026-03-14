import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri } from 'expo-auth-session';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import Colors from '@/constants/colors';

WebBrowser.maybeCompleteAuthSession();

const C = Colors.light;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

function getPlatformClientId(): string {
  if (Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID) return GOOGLE_IOS_CLIENT_ID;
  if (Platform.OS === 'android' && GOOGLE_ANDROID_CLIENT_ID) return GOOGLE_ANDROID_CLIENT_ID;
  return GOOGLE_WEB_CLIENT_ID;
}
const GOOGLE_CLIENT_ID = getPlatformClientId();

function InfoModal({
  visible,
  icon,
  iconColor,
  title,
  message,
  onClose,
  children,
}: {
  visible: boolean;
  icon: string;
  iconColor: string;
  title: string;
  message: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={[styles.modalIcon, { backgroundColor: `${iconColor}18`, borderColor: `${iconColor}30` }]}>
            <Ionicons name={icon as any} size={28} color={iconColor} />
          </View>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          {children}
          <Pressable
            style={({ pressed }) => [styles.modalCloseBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={onClose}
          >
            <Text style={styles.modalCloseBtnText}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function AuthScreen() {
  const { signInAsGuest, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const inputAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const redirectUri = makeRedirectUri({ scheme: 'dinetogether', path: 'auth' });

  const GOOGLE_DISCOVERY = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID || 'unconfigured',
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: 'token',
    },
    GOOGLE_DISCOVERY
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const accessToken = (response.params as any)?.access_token ?? (response as any).authentication?.accessToken;
      handleGoogleSuccess(accessToken);
    } else if (response?.type === 'error') {
      setGoogleLoading(false);
      setErrorModal({
        title: 'Google Sign-In Failed',
        message: (response as any).error?.message ?? 'Something went wrong. Please try again.',
      });
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      setGoogleLoading(false);
    }
  }, [response]);

  async function handleGoogleSuccess(accessToken?: string | null) {
    if (!accessToken) {
      setGoogleLoading(false);
      setErrorModal({ title: 'Sign-In Failed', message: 'No access token received. Please try again.' });
      return;
    }
    setGoogleLoading(true);
    try {
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await res.json();
      await signInWithGoogle({
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        photo: userInfo.picture,
      });
      router.replace('/(app)/home');
    } catch {
      setErrorModal({ title: 'Sign-In Failed', message: 'Could not complete sign-in. Please try again.' });
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleGuestPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowInput(true);
    Animated.timing(inputAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }

  async function handleContinue() {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await signInAsGuest(name.trim());
      router.replace('/(app)/home');
    } catch {
      setErrorModal({ title: 'Error', message: 'Failed to sign in. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleGooglePress() {
    if (Platform.OS === 'web') {
      setErrorModal({
        title: 'Use the Mobile App',
        message: 'Google Sign-In is available on iPhone and Android. Use "Continue as Guest" to try the app here in the browser.',
      });
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      setErrorModal({
        title: 'Google Sign-In Not Configured',
        message: 'No Google OAuth client ID is set for this platform.',
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch {
      setGoogleLoading(false);
      setErrorModal({ title: 'Error', message: 'Could not open Google sign-in. Please try again.' });
    }
  }

  const inputTranslate = inputAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const inputOpacity = inputAnim;

  return (
    <LinearGradient
      colors={['#1A0A00', '#2C1206', '#1A0A00']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <Animated.View
          style={[styles.logoSection, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        >
          <View style={styles.logoMark}>
            <View style={styles.logoInner}>
              <Ionicons name="restaurant" size={36} color="#fff" />
            </View>
            <View style={styles.logoPulse} />
          </View>
          <Text style={styles.appName}>DineTogether</Text>
          <Text style={styles.tagline}>{t('appTagline')}</Text>
        </Animated.View>

        <View style={styles.actions}>
          {!showInput ? (
            <>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleGuestPress}
              >
                <LinearGradient
                  colors={[C.tint, '#C94E1E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                >
                  <Ionicons name="person-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>{t('continueAsGuest')}</Text>
                </LinearGradient>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  { opacity: pressed || googleLoading ? 0.75 : 1 },
                ]}
                onPress={handleGooglePress}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="logo-google" size={20} color="#fff" />
                )}
                <Text style={styles.googleBtnText}>{t('continueWithGoogle')}</Text>
              </Pressable>
            </>
          ) : (
            <Animated.View
              style={[
                styles.inputSection,
                { opacity: inputOpacity, transform: [{ translateY: inputTranslate }] },
              ]}
            >
              <Text style={styles.inputLabel}>{t('whatsYourName')}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('enterYourName')}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoFocus
                  onSubmitEditing={handleContinue}
                  returnKeyType="go"
                  maxLength={30}
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.continueBtn,
                  { opacity: !name.trim() || loading ? 0.5 : pressed ? 0.85 : 1 },
                ]}
                onPress={handleContinue}
                disabled={!name.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <LinearGradient
                    colors={[C.tint, '#C94E1E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.continueBtnGradient}
                  >
                    <Text style={styles.continueBtnText}>{t('letsGo')}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </LinearGradient>
                )}
              </Pressable>

              <Pressable
                style={styles.backBtn}
                onPress={() => {
                  setShowInput(false);
                  setName('');
                }}
              >
                <Text style={styles.backBtnText}>{t('back')}</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        <Text style={styles.disclaimer}>{t('disclaimer')}</Text>
      </KeyboardAvoidingView>

      <InfoModal
        visible={!!errorModal}
        icon="alert-circle-outline"
        iconColor="#E8602C"
        title={errorModal?.title ?? ''}
        message={errorModal?.message ?? ''}
        onClose={() => setErrorModal(null)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 100,
  },
  logoMark: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  logoInner: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  logoPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 33,
    borderWidth: 1.5,
    borderColor: 'rgba(232,96,44,0.35)',
  },
  appName: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.2,
  },
  actions: {
    width: '100%',
    gap: 12,
    marginBottom: 40,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  googleBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    minHeight: 54,
  },
  googleBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_500Medium',
  },
  inputSection: {
    width: '100%',
    gap: 12,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  inputRow: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  input: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  continueBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  continueBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backBtnText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#2C1206',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 6,
  },
  modalCloseBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    marginTop: 4,
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
