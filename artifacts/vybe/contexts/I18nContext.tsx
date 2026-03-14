import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'tr';

const LANG_KEY = '@dinetogether_lang';

const translations = {
  en: {
    appTagline: 'Pick a place. Together.',
    continueAsGuest: 'Continue as Guest',
    continueWithGoogle: 'Continue with Google',
    whatsYourName: "What's your name?",
    enterYourName: 'Enter your name',
    letsGo: "Let's Go",
    back: 'Back',
    disclaimer: 'By continuing, you agree to our Terms & Privacy Policy',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    startNewGroup: 'Start a new group',
    yourSessions: 'Your Sessions',
    waitingForFriends: 'Waiting for friends',
    swipingNow: 'Swiping now',
    waitingForOthers: 'Waiting for others',
    resultsReady: 'Results ready',
    noSessionsYet: 'No sessions yet',
    noSessionsSubtitle: 'Create a group with friends and start picking a place to eat together!',
    profile: 'Profile',
    settings: 'Settings',
    language: 'Language',
    account: 'Account',
    signOut: 'Sign out',
    signOutConfirm: 'Are you sure you want to sign out?',
    cancel: 'Cancel',
    signedInWith: 'Signed in with',
    guest: 'Guest',
    google: 'Google',
    members: 'Members',
    joined: 'joined',
    setLocation: 'Set Location',
    useMyLocation: 'Use My Location',
    updateLocation: 'Update Location',
    pickOnMap: 'Tap map to pick location',
    searchRadius: 'Search radius',
    startSwiping: 'Start Swiping',
    locationNeeded: 'Location needed',
    locationNeededMsg: 'Please set your location first.',
    waitingForHost: 'Waiting for',
    waitingForHostSuffix: 'to set the location and start.',
    swipeOrTap: 'Swipe or tap',
    allDone: 'All done!',
    waitingForResults: 'Waiting for results...',
    noPlacesFound: 'No places found',
    tryIncreasingRadius: 'Try increasing the search radius',
    goBack: 'Go Back',
    groupDecided: 'The group has decided!',
    tapForDetails: 'Tap any card for full details',
    rankedByVotes: 'All Places — Ranked by votes',
    getDirections: 'Get Directions',
    viewMenuOnline: 'View Menu Online',
    seeFullMenu: 'See Full Menu Online',
    groupVote: 'Group vote',
    liked: 'liked',
    passed: 'passed',
    total: 'total',
    openNow: 'Open now',
    closed: 'Closed',
    menuHighlights: 'Menu Highlights',
    whatPeopleSay: 'What People Say',
    winner: 'Winner',
    backToHome: 'Back to Home',
    calculatingResults: 'Calculating results...',
    findingPlaces: 'Finding great places nearby...',
    yum: 'YUM!',
    pass: 'PASS',
    dishes: 'Dishes',
    drinks: 'Drinks',
    desserts: 'Desserts',
    english: 'English',
    turkish: 'Turkish',
    appVersion: 'App Version',
    yourName: 'Your name',
    deleteGroup: 'Delete group',
    deleteGroupConfirm: 'This will permanently delete the group and all its data. This cannot be undone.',
    deleteGroupError: 'Failed to delete group. Please try again.',
    delete: 'Delete',
    leaveGroup: 'Leave group',
    leaveGroupConfirm: 'You will be removed from this group and it will disappear from your list.',
    leaveGroupError: 'Failed to leave group. Please try again.',
    leave: 'Leave',
    finishedSwiping: 'Finished swiping',
    stillDeciding: 'Still deciding...',
    importContacts: 'Import from Contacts',
    importContactsDesc: 'Find friends already on DineTogether',
    contactsPermissionDenied: 'Contacts permission denied',
    contactsPermissionMsg: 'Please allow access to contacts in your device settings.',
    noContactsFound: 'No contacts found on DineTogether yet',
    contactsFromPhone: 'From Your Contacts',
    inviteFriends: 'Invite Friends',
    inviteFriendsMsg: 'Share a link to invite friends to DineTogether',
    inviteLink: 'Invite via Link',
    inviteLinkText: 'Join me on DineTogether — the app that makes group dining decisions easy! Download and join:',
    shareInvite: 'Share Invite',
    copyLink: 'Copy Link',
    linkCopied: 'Link copied!',
    ok: 'OK',
  },
  tr: {
    appTagline: 'Birlikte bir yer seç.',
    continueAsGuest: 'Misafir Olarak Devam Et',
    continueWithGoogle: "Google ile Devam Et",
    whatsYourName: 'Adın ne?',
    enterYourName: 'Adını gir',
    letsGo: 'Hadi Başla',
    back: 'Geri',
    disclaimer: 'Devam ederek Kullanım Koşullarımızı kabul etmiş olursunuz.',
    goodMorning: 'Günaydın',
    goodAfternoon: 'İyi öğleden sonralar',
    goodEvening: 'İyi akşamlar',
    startNewGroup: 'Yeni grup oluştur',
    yourSessions: 'Oturumların',
    waitingForFriends: 'Arkadaşlar bekleniyor',
    swipingNow: 'Kaydırılıyor',
    waitingForOthers: 'Diğerleri bekleniyor',
    resultsReady: 'Sonuçlar hazır',
    noSessionsYet: 'Henüz oturum yok',
    noSessionsSubtitle: 'Arkadaşlarınla bir grup oluştur ve birlikte yemek yenecek bir yer seçmeye başla!',
    profile: 'Profil',
    settings: 'Ayarlar',
    language: 'Dil',
    account: 'Hesap',
    signOut: 'Çıkış yap',
    signOutConfirm: 'Çıkış yapmak istediğinizden emin misiniz?',
    cancel: 'İptal',
    signedInWith: 'Giriş yapıldı:',
    guest: 'Misafir',
    google: 'Google',
    members: 'Üyeler',
    joined: 'katıldı',
    setLocation: 'Konum Belirle',
    useMyLocation: 'Konumumu Kullan',
    updateLocation: 'Konumu Güncelle',
    pickOnMap: 'Konum seçmek için haritaya dokun',
    searchRadius: 'Arama yarıçapı',
    startSwiping: 'Kaydırmaya Başla',
    locationNeeded: 'Konum gerekli',
    locationNeededMsg: 'Lütfen önce konumunuzu belirleyin.',
    waitingForHost: 'Bekleniyor:',
    waitingForHostSuffix: 'konumu belirlesin ve başlasın.',
    swipeOrTap: 'Kaydır veya dokun',
    allDone: 'Hepsi tamamlandı!',
    waitingForResults: 'Sonuçlar bekleniyor...',
    noPlacesFound: 'Yer bulunamadı',
    tryIncreasingRadius: 'Arama yarıçapını artırmayı deneyin',
    goBack: 'Geri Dön',
    groupDecided: 'Grup karar verdi!',
    tapForDetails: 'Detaylar için karta dokun',
    rankedByVotes: 'Tüm Yerler — Oya göre sıralı',
    getDirections: 'Yol Tarifi',
    viewMenuOnline: 'Menüyü Online Gör',
    seeFullMenu: 'Tam Menüyü Online Gör',
    groupVote: 'Grup oyu',
    liked: 'beğendi',
    passed: 'geçti',
    total: 'toplam',
    openNow: 'Açık',
    closed: 'Kapalı',
    menuHighlights: 'Menü Öne Çıkanlar',
    whatPeopleSay: 'Yorumlar',
    winner: 'Kazanan',
    backToHome: 'Ana Sayfaya Dön',
    calculatingResults: 'Sonuçlar hesaplanıyor...',
    findingPlaces: 'Yakındaki harika yerler aranıyor...',
    yum: 'YUM!',
    pass: 'GEÇT',
    dishes: 'Yemekler',
    drinks: 'İçecekler',
    desserts: 'Tatlılar',
    english: 'İngilizce',
    turkish: 'Türkçe',
    appVersion: 'Uygulama Sürümü',
    yourName: 'Adın',
    deleteGroup: 'Grubu sil',
    deleteGroupConfirm: 'Bu grup ve tüm verileri kalıcı olarak silinecek. Bu işlem geri alınamaz.',
    deleteGroupError: 'Grup silinemedi. Lütfen tekrar deneyin.',
    delete: 'Sil',
    leaveGroup: 'Gruptan ayrıl',
    leaveGroupConfirm: 'Bu gruptan çıkarılacaksın ve grup listenizden kaybolacak.',
    leaveGroupError: 'Gruptan ayrılma başarısız. Lütfen tekrar deneyin.',
    leave: 'Ayrıl',
    finishedSwiping: 'Kaydırma tamamlandı',
    stillDeciding: 'Hâlâ karar veriyor...',
    importContacts: 'Kişilerden İçe Aktar',
    importContactsDesc: 'DineTogether\'da zaten olan arkadaşları bul',
    contactsPermissionDenied: 'Kişi erişimi reddedildi',
    contactsPermissionMsg: 'Lütfen cihaz ayarlarından kişilere erişime izin verin.',
    noContactsFound: 'Henüz DineTogether\'da kişi bulunamadı',
    contactsFromPhone: 'Telefonundan',
    inviteFriends: 'Arkadaşları Davet Et',
    inviteFriendsMsg: 'DineTogether\'a arkadaşlarını davet etmek için bağlantı paylaş',
    inviteLink: 'Bağlantı ile Davet Et',
    inviteLinkText: 'DineTogether\'a katıl — grup yemek kararlarını kolaylaştıran uygulama! İndir ve katıl:',
    shareInvite: 'Davet Paylaş',
    copyLink: 'Bağlantıyı Kopyala',
    linkCopied: 'Bağlantı kopyalandı!',
    ok: 'Tamam',
  },
};

type TranslationKeys = keyof typeof translations.en;

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKeys) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(val => {
      if (val === 'en' || val === 'tr') setLangState(val);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback((key: TranslationKeys): string => {
    return (translations[lang] as any)[key] ?? (translations.en as any)[key] ?? key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
