import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Animated,
  Linking,
  Platform,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useApi } from '@/hooks/useApi';
import { Restaurant, RestaurantResult } from '@/contexts/GroupContext';
import { useI18n } from '@/contexts/I18nContext';
import Colors from '@/constants/colors';

const C = Colors.light;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82;

function StarRating({ rating, size = 13 }: { rating?: number; size?: number }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < full ? 'star' : i === full && half ? 'star-half' : 'star-outline'}
          size={size}
          color={C.amber}
        />
      ))}
    </View>
  );
}

function PriceLevel({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <Text style={styles.priceText}>
      {'$'.repeat(level)}
      <Text style={{ opacity: 0.35 }}>{'$'.repeat(4 - level)}</Text>
    </Text>
  );
}

function RestaurantSheet({
  item,
  rank,
  visible,
  onClose,
}: {
  item: RestaurantResult;
  rank: number;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [photoIndex, setPhotoIndex] = useState(0);
  const r = item.restaurant;
  const pct = item.totalVotes > 0 ? Math.round((item.likeCount / item.totalVotes) * 100) : 0;

  useEffect(() => {
    if (visible) {
      setPhotoIndex(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  function openMaps() {
    if (r.mapsUrl) {
      Linking.openURL(r.mapsUrl);
    } else if (r.lat && r.lng) {
      const q = encodeURIComponent(r.name);
      const url = Platform.OS === 'ios'
        ? `maps://maps.apple.com/?q=${q}&ll=${r.lat},${r.lng}`
        : `https://maps.google.com/?q=${r.lat},${r.lng}`;
      Linking.openURL(url);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}`);
    }
  }

  function openMenu() {
    const url = r.menuSearchUrl ?? r.website ??
      `https://www.google.com/search?q=${encodeURIComponent(r.name + ' ' + (r.address ?? '') + ' online menu')}`;
    Linking.openURL(url);
  }

  const dishes = r.menuItems.filter(i => i.category === 'dish');
  const drinks = r.menuItems.filter(i => i.category === 'drink');
  const desserts = r.menuItems.filter(i => i.category === 'dessert');
  const menuSections = [
    { label: t('dishes'), icon: 'restaurant-outline' as const, items: dishes },
    { label: t('drinks'), icon: 'wine-outline' as const, items: drinks },
    { label: t('desserts'), icon: 'ice-cream-outline' as const, items: desserts },
  ].filter(s => s.items.length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalWrap}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16) },
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.sheetHandle} />

          <ScrollView showsVerticalScrollIndicator={false} bounces>
            {r.photos.length > 0 ? (
              <View style={styles.sheetPhotoWrap}>
                <Image
                  source={{ uri: r.photos[photoIndex] }}
                  style={styles.sheetPhoto}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(44,24,16,0.65)']}
                  style={styles.sheetPhotoGradient}
                />
                {r.photos.length > 1 && (
                  <>
                    <Pressable
                      style={[styles.sheetPhotoNav, { left: 0 }]}
                      onPress={() => setPhotoIndex(Math.max(0, photoIndex - 1))}
                    />
                    <Pressable
                      style={[styles.sheetPhotoNav, { right: 0 }]}
                      onPress={() => setPhotoIndex(Math.min(r.photos.length - 1, photoIndex + 1))}
                    />
                    <View style={styles.sheetPhotoDots}>
                      {r.photos.map((_, i) => (
                        <Pressable
                          key={i}
                          onPress={() => setPhotoIndex(i)}
                          style={[styles.sheetPhotoDot, i === photoIndex && styles.sheetPhotoDotActive]}
                        />
                      ))}
                    </View>
                  </>
                )}
                <View style={styles.sheetRankBadge}>
                  {rank === 1 ? (
                    <LinearGradient colors={[C.tint, C.tintDark]} style={styles.sheetRankInner}>
                      <Ionicons name="trophy" size={14} color="#fff" />
                      <Text style={styles.sheetRankText}>{t('winner')}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.sheetRankInner, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                      <Text style={styles.sheetRankText}>#{rank}</Text>
                    </View>
                  )}
                </View>
                <Pressable style={styles.sheetCloseBtn} onPress={onClose}>
                  <Ionicons name="close" size={20} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.sheetNoPhoto}>
                <Ionicons name="restaurant-outline" size={40} color={C.textMuted} />
                <Pressable style={[styles.sheetCloseBtn, { top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.15)' }]} onPress={onClose}>
                  <Ionicons name="close" size={20} color={C.textSecondary} />
                </Pressable>
              </View>
            )}

            <View style={styles.sheetBody}>
              <View style={styles.sheetTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetName}>{r.name}</Text>
                  <View style={styles.sheetSubRow}>
                    {r.cuisine ? <Text style={styles.sheetCuisine}>{r.cuisine}</Text> : null}
                    {r.cuisine && r.rating ? <Text style={styles.sheetDot}>·</Text> : null}
                    <StarRating rating={r.rating} size={13} />
                    {r.rating ? <Text style={styles.sheetRatingNum}>{r.rating.toFixed(1)}</Text> : null}
                    {r.reviewCount ? <Text style={styles.sheetReviewCount}>({r.reviewCount.toLocaleString()})</Text> : null}
                    <PriceLevel level={r.priceLevel} />
                  </View>
                </View>
                {r.openNow !== undefined && (
                  <View style={[styles.openBadge, !r.openNow && styles.closedBadge]}>
                    <View style={[styles.openDot, !r.openNow && styles.closedDot]} />
                    <Text style={[styles.openBadgeText, !r.openNow && styles.closedBadgeText]}>
                      {r.openNow ? t('openNow') : t('closed')}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.sheetAddressRow}>
                <Ionicons name="location-outline" size={14} color={C.textMuted} />
                <Text style={styles.sheetAddress}>{r.address}</Text>
                {r.distance ? (
                  <Text style={styles.sheetDistance}>
                    {r.distance >= 1000 ? `${(r.distance / 1000).toFixed(1)} km` : `${r.distance}m`}
                  </Text>
                ) : null}
              </View>

              <View style={styles.voteBox}>
                <View style={styles.voteBoxHeader}>
                  <Ionicons name="people-outline" size={15} color={C.tint} />
                  <Text style={styles.voteBoxTitle}>{t('groupVote')}</Text>
                  <Text style={styles.votePct}>{pct}% {t('liked')}</Text>
                </View>
                <View style={styles.voteBar}>
                  <View style={[styles.voteFill, { width: `${pct}%` as any }]} />
                </View>
                <View style={styles.voteNums}>
                  <View style={styles.voteNum}>
                    <Ionicons name="heart" size={13} color={C.likeGreen} />
                    <Text style={styles.voteNumText}>{item.likeCount} {t('liked')}</Text>
                  </View>
                  <View style={styles.voteNum}>
                    <Ionicons name="close-circle-outline" size={13} color={C.dislikeRed} />
                    <Text style={styles.voteNumText}>{item.dislikeCount} {t('passed')}</Text>
                  </View>
                  <View style={styles.voteNum}>
                    <Ionicons name="people-outline" size={13} color={C.textMuted} />
                    <Text style={styles.voteNumText}>{item.totalVotes} {t('total')}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.sheetActions}>
                <Pressable
                  style={({ pressed }) => [styles.sheetActionBtn, styles.sheetActionBtnSecondary, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={openMaps}
                >
                  <Ionicons name="navigate-outline" size={18} color={C.tint} />
                  <Text style={styles.sheetActionBtnSecondaryText}>{t('getDirections')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.sheetActionBtn, styles.sheetActionBtnPrimary, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={openMenu}
                >
                  <LinearGradient
                    colors={[C.tint, C.tintDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sheetActionGradient}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#fff" />
                    <Text style={styles.sheetActionBtnPrimaryText}>{t('viewMenuOnline')}</Text>
                  </LinearGradient>
                </Pressable>
              </View>

              {menuSections.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons name="restaurant-outline" size={14} color={C.tint} />
                    <Text style={styles.sectionTitle}>{t('menuHighlights')}</Text>
                  </View>
                  {menuSections.map(sec => (
                    <View key={sec.label} style={styles.menuCategory}>
                      <View style={styles.menuCatHeader}>
                        <Ionicons name={sec.icon} size={12} color={C.textSecondary} />
                        <Text style={styles.menuCatLabel}>{sec.label}</Text>
                      </View>
                      {sec.items.map((item, i) => (
                        <View key={i} style={styles.menuItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.menuItemName}>{item.name}</Text>
                            {item.description ? (
                              <Text style={styles.menuItemDesc}>{item.description}</Text>
                            ) : null}
                          </View>
                          {item.price ? <Text style={styles.menuItemPrice}>{item.price}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ))}
                  <Pressable
                    style={({ pressed }) => [styles.fullMenuBtn, { opacity: pressed ? 0.8 : 1 }]}
                    onPress={openMenu}
                  >
                    <Text style={styles.fullMenuBtnText}>{t('seeFullMenu')}</Text>
                    <Ionicons name="open-outline" size={14} color={C.tint} />
                  </Pressable>
                </View>
              )}

              {r.reviews.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons name="chatbubbles-outline" size={14} color={C.tint} />
                    <Text style={styles.sectionTitle}>{t('whatPeopleSay')}</Text>
                  </View>
                  {r.reviews.map((review, i) => (
                    <View key={i} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewAvatar}>
                          <Text style={styles.reviewInitial}>{review.authorName[0]?.toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewAuthor}>{review.authorName}</Text>
                          <View style={styles.reviewStarsRow}>
                            {Array.from({ length: 5 }, (_, j) => (
                              <Ionicons key={j} name={j < review.rating ? 'star' : 'star-outline'} size={10} color={C.amber} />
                            ))}
                          </View>
                        </View>
                        {review.timeAgo ? <Text style={styles.reviewTime}>{review.timeAgo}</Text> : null}
                      </View>
                      <Text style={styles.reviewText}>{review.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function AnimatedResultItem({
  item,
  rank,
  delay,
  onPress,
}: {
  item: RestaurantResult;
  rank: number;
  delay: number;
  onPress: () => void;
}) {
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, tension: 70, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, [delay]);

  const isTop = rank === 1;
  const pct = item.totalVotes > 0 ? Math.round((item.likeCount / item.totalVotes) * 100) : 0;
  const r = item.restaurant;

  return (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>
      <Pressable
        style={({ pressed }) => [
          styles.resultCard,
          isTop && styles.resultCardTop,
          { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        {isTop && (
          <LinearGradient
            colors={[`${C.tint}18`, 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.resultCardContent}>
          <View style={styles.rankBadge}>
            {isTop ? (
              <LinearGradient colors={[C.tint, C.tintDark]} style={styles.rankBadgeGradient}>
                <Ionicons name="trophy" size={13} color="#fff" />
              </LinearGradient>
            ) : (
              <View style={[
                styles.rankBadgeSimple,
                rank === 2 && styles.rankBadgeSilver,
                rank === 3 && styles.rankBadgeBronze,
              ]}>
                <Text style={styles.rankNum}>{rank}</Text>
              </View>
            )}
          </View>

          {r.photos.length > 0 ? (
            <Image source={{ uri: r.photos[0] }} style={styles.resultPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.resultPhoto, styles.resultPhotoPlaceholder]}>
              <Ionicons name="restaurant-outline" size={26} color={C.textMuted} />
            </View>
          )}

          <View style={styles.resultInfo}>
            <Text style={[styles.resultName, isTop && styles.resultNameTop]} numberOfLines={1}>
              {r.name}
            </Text>
            <View style={styles.resultMetaRow}>
              {r.cuisine ? <Text style={styles.resultCuisine}>{r.cuisine}</Text> : null}
              {r.rating ? (
                <View style={styles.resultRatingRow}>
                  <Ionicons name="star" size={10} color={C.amber} />
                  <Text style={styles.resultRatingText}>{r.rating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.voteRowSmall}>
              <View style={styles.voteBarSmall}>
                <View style={[styles.voteFillSmall, { width: `${pct}%` as any }]} />
              </View>
              <View style={styles.voteCountsSmall}>
                <Ionicons name="heart" size={10} color={C.likeGreen} />
                <Text style={styles.voteCountSmallText}>{item.likeCount}</Text>
                <Text style={styles.voteCountSmallSep}>·</Text>
                <Ionicons name="close" size={10} color={C.dislikeRed} />
                <Text style={styles.voteCountSmallText}>{item.dislikeCount}</Text>
              </View>
            </View>
          </View>

          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch } = useApi();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<{ item: RestaurantResult; rank: number } | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { data: results } = useQuery<RestaurantResult[]>({
    queryKey: ['results', id],
    queryFn: () => apiFetch(`/groups/${id}/results`),
  });

  const headerScale = useRef(new Animated.Value(0.8)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (results?.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.spring(headerScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [results?.length]);

  function handleCardPress(item: RestaurantResult, rank: number) {
    setSelectedItem({ item, rank });
    setSheetVisible(true);
  }

  function handleCloseSheet() {
    setSheetVisible(false);
    setTimeout(() => setSelectedItem(null), 300);
  }

  const winner = results?.[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
      <Animated.View style={[styles.heroSection, { opacity: headerOpacity, transform: [{ scale: headerScale }] }]}>
        <LinearGradient
          colors={[C.tint, C.tintDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.trophyBg}
        >
          <Ionicons name="trophy" size={30} color="#fff" />
        </LinearGradient>
        <Text style={styles.heroTitle}>{t('groupDecided')}</Text>
        {winner && (
          <Text style={styles.heroWinner} numberOfLines={1}>
            {winner.restaurant.name}
          </Text>
        )}
      </Animated.View>

      <FlatList
        data={results ?? []}
        keyExtractor={item => item.restaurant.id}
        renderItem={({ item, index }) => (
          <AnimatedResultItem
            item={item}
            rank={index + 1}
            delay={index * 80}
            onPress={() => handleCardPress(item, index + 1)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.sectionLabel}>{t('tapForDetails')}</Text>
        }
        ListEmptyComponent={
          <View style={styles.loading}>
            <Text style={styles.loadingText}>{t('calculatingResults')}</Text>
          </View>
        }
      />

      <View style={[styles.homeFooter, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16) }]}>
        <Pressable
          style={({ pressed }) => [styles.homeBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            router.replace('/(app)/home');
          }}
        >
          <Ionicons name="home-outline" size={18} color={C.textSecondary} />
          <Text style={styles.homeBtnText}>{t('backToHome')}</Text>
        </Pressable>
      </View>

      {selectedItem && (
        <RestaurantSheet
          item={selectedItem.item}
          rank={selectedItem.rank}
          visible={sheetVisible}
          onClose={handleCloseSheet}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSecondary },

  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  trophyBg: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  heroTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center' },
  heroWinner: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.tint, textAlign: 'center' },

  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textMuted,
    letterSpacing: 0.3,
    marginBottom: 10,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  list: { paddingTop: 4, paddingHorizontal: 16, gap: 8 },

  resultCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  resultCardTop: {
    borderColor: `${C.tint}50`,
    shadowColor: C.tint,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  resultCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  rankBadge: { width: 32, alignItems: 'center' },
  rankBadgeGradient: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeSimple: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeSilver: { backgroundColor: '#E8E8ED' },
  rankBadgeBronze: { backgroundColor: `${C.amber}30` },
  rankNum: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.textSecondary },
  resultPhoto: { width: 68, height: 68, borderRadius: 12 },
  resultPhotoPlaceholder: {
    backgroundColor: C.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: { flex: 1, gap: 3 },
  resultName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, lineHeight: 19 },
  resultNameTop: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  resultMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultCuisine: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textMuted },
  resultRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  resultRatingText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  voteRowSmall: { gap: 4, marginTop: 2 },
  voteBarSmall: { height: 3, backgroundColor: C.backgroundTertiary, borderRadius: 2, overflow: 'hidden' },
  voteFillSmall: { height: '100%', backgroundColor: C.likeGreen, borderRadius: 2 },
  voteCountsSmall: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  voteCountSmallText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  voteCountSmallSep: { fontSize: 10, color: C.textMuted },
  chevron: { paddingLeft: 4 },

  homeFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: C.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    paddingVertical: 13,
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  homeBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary },

  loading: { paddingTop: 40, alignItems: 'center' },
  loadingText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: C.textSecondary },

  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  priceText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,24,16,0.55)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.cardBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  sheetPhotoWrap: {
    height: 220,
    position: 'relative',
    backgroundColor: C.backgroundTertiary,
  },
  sheetPhoto: { width: '100%', height: '100%' },
  sheetPhotoGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 100,
  },
  sheetPhotoNav: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: '40%',
  },
  sheetPhotoDots: {
    position: 'absolute',
    bottom: 12, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  sheetPhotoDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  sheetPhotoDotActive: { backgroundColor: '#fff', width: 18 },
  sheetRankBadge: {
    position: 'absolute',
    top: 12,
    left: 14,
  },
  sheetRankInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sheetRankText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' },
  sheetCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetNoPhoto: {
    height: 120,
    backgroundColor: C.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetBody: { padding: 20, gap: 16 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sheetName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text, lineHeight: 28 },
  sheetSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 3 },
  sheetCuisine: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  sheetDot: { color: C.textMuted, fontSize: 12 },
  sheetRatingNum: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  sheetReviewCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textMuted },
  openBadge: {
    backgroundColor: `${C.likeGreen}20`,
    borderWidth: 1,
    borderColor: `${C.likeGreen}50`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  closedBadge: {
    backgroundColor: `${C.dislikeRed}15`,
    borderColor: `${C.dislikeRed}40`,
  },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.likeGreen },
  closedDot: { backgroundColor: C.dislikeRed },
  openBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.likeGreen },
  closedBadgeText: { color: C.dislikeRed },
  sheetAddressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  sheetAddress: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, lineHeight: 18 },
  sheetDistance: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.tint },

  voteBox: {
    backgroundColor: C.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  voteBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voteBoxTitle: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  votePct: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.tint },
  voteBar: { height: 6, backgroundColor: C.backgroundTertiary, borderRadius: 3, overflow: 'hidden' },
  voteFill: { height: '100%', backgroundColor: C.likeGreen, borderRadius: 3 },
  voteNums: { flexDirection: 'row', gap: 16 },
  voteNum: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  voteNumText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },

  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetActionBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  sheetActionBtnSecondary: {
    borderWidth: 1.5,
    borderColor: C.tint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 6,
  },
  sheetActionBtnSecondaryText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.tint },
  sheetActionBtnPrimary: {},
  sheetActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 7,
  },
  sheetActionBtnPrimaryText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  section: { gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: C.tint,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  menuCategory: { gap: 6 },
  menuCatHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  menuCatLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.backgroundSecondary,
    borderRadius: 10,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  menuItemName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  menuItemDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, lineHeight: 15, marginTop: 2 },
  menuItemPrice: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.tint, paddingTop: 1 },
  fullMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.tint,
    borderRadius: 10,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  fullMenuBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.tint },

  reviewCard: {
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.backgroundTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  reviewInitial: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.textSecondary },
  reviewStarsRow: { flexDirection: 'row', gap: 1, marginTop: 2 },
  reviewAuthor: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  reviewTime: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textMuted },
  reviewText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, lineHeight: 17 },
});
