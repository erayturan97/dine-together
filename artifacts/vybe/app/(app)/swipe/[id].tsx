import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useApi } from '@/hooks/useApi';
import { Restaurant, MenuItem, Review } from '@/contexts/GroupContext';
import { useI18n } from '@/contexts/I18nContext';
import Colors from '@/constants/colors';

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 420);
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.22;
const SPRING_CFG = { tension: 65, friction: 8, useNativeDriver: true };
const EXIT_SPRING = { tension: 120, friction: 12, useNativeDriver: true };

function PriceLevel({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <Text style={styles.price}>
      {'$'.repeat(level)}
      <Text style={{ opacity: 0.3 }}>{'$'.repeat(4 - level)}</Text>
    </Text>
  );
}

function StarRating({ rating, light }: { rating?: number; light?: boolean }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const color = light ? 'rgba(255,255,255,0.9)' : C.amber;
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < full ? 'star' : i === full && half ? 'star-half' : 'star-outline'}
          size={14}
          color={color}
        />
      ))}
      <Text style={[styles.ratingNum, light && { color: 'rgba(255,255,255,0.9)' }]}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

function MenuSection({ items }: { items: MenuItem[] }) {
  const dishes = items.filter(i => i.category === 'dish');
  const drinks = items.filter(i => i.category === 'drink');
  const desserts = items.filter(i => i.category === 'dessert');
  const sections = [
    { label: 'Dishes', icon: 'restaurant-outline', items: dishes },
    { label: 'Drinks', icon: 'wine-outline', items: drinks },
    { label: 'Desserts', icon: 'ice-cream-outline', items: desserts },
  ].filter(s => s.items.length > 0);
  return (
    <View style={styles.menuSection}>
      {sections.map(section => (
        <View key={section.label} style={styles.menuCategory}>
          <View style={styles.menuCategoryHeader}>
            <Ionicons name={section.icon as any} size={14} color={C.textSecondary} />
            <Text style={styles.menuCategoryLabel}>{section.label}</Text>
          </View>
          {section.items.map((item, i) => (
            <View key={i} style={styles.menuItem}>
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
              {item.price ? <Text style={styles.menuItemPrice}>{item.price}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const initial = review.authorName[0]?.toUpperCase() ?? '?';
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewInitial}>{initial}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewAuthor}>{review.authorName}</Text>
          <View style={styles.reviewStars}>
            {Array.from({ length: 5 }, (_, i) => (
              <Ionicons key={i} name={i < review.rating ? 'star' : 'star-outline'} size={11} color={C.amber} />
            ))}
          </View>
        </View>
        {review.timeAgo ? <Text style={styles.reviewTime}>{review.timeAgo}</Text> : null}
      </View>
      <Text style={styles.reviewText} numberOfLines={3}>{review.text}</Text>
    </View>
  );
}

type ExitingCardState = {
  restaurant: Restaurant;
  liked: boolean;
  startX: number;
};

function ExitingCard({ restaurant, liked, startX, onDone }: ExitingCardState & { onDone: () => void }) {
  const position = useRef(new Animated.ValueXY({ x: startX, y: 0 })).current;

  const rotation = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const targetX = liked ? SCREEN_WIDTH + 200 : -(SCREEN_WIDTH + 200);
    Animated.spring(position, {
      toValue: { x: targetX, y: -30 },
      ...EXIT_SPRING,
    }).start(({ finished }) => { if (finished) onDone(); });
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        { zIndex: 30, transform: [{ translateX: position.x }, { translateY: position.y }, { rotate: rotation }] },
      ]}
      pointerEvents="none"
    >
      {restaurant.photos.length > 0 ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: restaurant.photos[0] }} style={styles.photo} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(44,24,16,0.75)']} style={styles.photoGradient} />
          <View style={styles.photoOverlay}>
            <View style={styles.photoTags}>
              {restaurant.cuisine ? (
                <View style={styles.cuisineTag}>
                  <Text style={styles.cuisineText}>{restaurant.cuisine}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.restaurantNamePhoto}>{restaurant.name}</Text>
            <View style={styles.photoMeta}>
              <StarRating rating={restaurant.rating} light />
              {restaurant.distance ? (
                <Text style={styles.distancePhoto}>
                  {restaurant.distance >= 1000
                    ? `${(restaurant.distance / 1000).toFixed(1)} km`
                    : `${restaurant.distance}m`}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={[styles.likeStamp, { opacity: liked ? 1 : 0 }]}>
            <Text style={styles.likeStampText}>YUM!</Text>
          </View>
          <View style={[styles.nopeStamp, { opacity: liked ? 0 : 1 }]}>
            <Text style={styles.nopeStampText}>PASS</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.noPhotoPlaceholder, { flex: 1 }]}>
          <Ionicons name="restaurant-outline" size={48} color={C.textMuted} />
          <Text style={styles.noPhotoName}>{restaurant.name}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export interface SwipeCardHandle {
  swipeLeft: () => void;
  swipeRight: () => void;
}

const SwipeCard = forwardRef<SwipeCardHandle, {
  restaurant: Restaurant;
  onCommit: (liked: boolean, dx: number) => void;
  isTop: boolean;
  index: number;
}>(function SwipeCard({ restaurant, onCommit, isTop, index }, ref) {
  const position = useRef(new Animated.ValueXY()).current;
  const [photoIndex, setPhotoIndex] = useState(0);

  const isTopRef = useRef(isTop);
  const onCommitRef = useRef(onCommit);
  useEffect(() => { isTopRef.current = isTop; }, [isTop]);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

  useEffect(() => {
    if (isTop) position.setValue({ x: 0, y: 0 });
  }, [isTop]);

  const rotation = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useImperativeHandle(ref, () => ({
    swipeRight() {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCommitRef.current(true, SCREEN_WIDTH * 0.3);
    },
    swipeLeft() {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onCommitRef.current(false, -SCREEN_WIDTH * 0.3);
    },
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (!isTopRef.current) return false;
        const { dx, dy } = gesture;
        return Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 10;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gesture) => {
        if (!isTopRef.current) return;
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.2 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (!isTopRef.current) return;
        if (gesture.dx > SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onCommitRef.current(true, gesture.dx);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onCommitRef.current(false, gesture.dx);
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            tension: 120,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const scale = isTop ? 1 : Math.max(0.93, 0.97 - index * 0.02);
  const translateY = isTop ? 0 : 8 + index * 6;

  return (
    <Animated.View
      style={[
        styles.card,
        !isTop && { transform: [{ scale }, { translateY }], zIndex: 10 - index },
        isTop && {
          zIndex: 20,
          transform: [{ translateX: position.x }, { translateY: position.y }, { rotate: rotation }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.cardInner}>
        {restaurant.photos.length > 0 ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: restaurant.photos[photoIndex] }} style={styles.photo} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(44,24,16,0.75)']} style={styles.photoGradient} />
            {restaurant.photos.length > 1 && (
              <>
                <View style={styles.photoDots}>
                  {restaurant.photos.map((_, i) => (
                    <View key={i} style={[styles.photoDot, i === photoIndex && styles.photoDotActive]} />
                  ))}
                </View>
                <Pressable
                  style={[styles.photoNav, styles.photoNavLeft]}
                  onPress={() => isTop && setPhotoIndex(Math.max(0, photoIndex - 1))}
                />
                <Pressable
                  style={[styles.photoNav, styles.photoNavRight]}
                  onPress={() => isTop && setPhotoIndex(Math.min(restaurant.photos.length - 1, photoIndex + 1))}
                />
              </>
            )}
            <View style={styles.photoOverlay}>
              <View style={styles.photoTags}>
                {restaurant.cuisine ? (
                  <View style={styles.cuisineTag}>
                    <Text style={styles.cuisineText}>{restaurant.cuisine}</Text>
                  </View>
                ) : null}
                {restaurant.openNow !== undefined && (
                  <View style={[styles.openTag, !restaurant.openNow && styles.closedTag]}>
                    <View style={styles.openDot} />
                    <Text style={styles.openText}>{restaurant.openNow ? 'Open' : 'Closed'}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.restaurantNamePhoto}>{restaurant.name}</Text>
              <View style={styles.photoMeta}>
                <StarRating rating={restaurant.rating} light />
                {restaurant.reviewCount ? (
                  <Text style={styles.reviewCountPhoto}>({restaurant.reviewCount.toLocaleString()})</Text>
                ) : null}
                <PriceLevel level={restaurant.priceLevel} />
                {restaurant.distance ? (
                  <Text style={styles.distancePhoto}>
                    {restaurant.distance >= 1000
                      ? `${(restaurant.distance / 1000).toFixed(1)} km`
                      : `${restaurant.distance}m`}
                  </Text>
                ) : null}
              </View>
              <View style={styles.addressRowPhoto}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.addressPhoto} numberOfLines={1}>{restaurant.address}</Text>
              </View>
            </View>
            {isTop && (
              <>
                <Animated.View style={[styles.likeStamp, { opacity: likeOpacity }]}>
                  <Text style={styles.likeStampText}>YUM!</Text>
                </Animated.View>
                <Animated.View style={[styles.nopeStamp, { opacity: nopeOpacity }]}>
                  <Text style={styles.nopeStampText}>PASS</Text>
                </Animated.View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.noPhotoPlaceholder}>
            <Ionicons name="restaurant-outline" size={48} color={C.textMuted} />
            <Text style={styles.noPhotoName}>{restaurant.name}</Text>
          </View>
        )}

        <ScrollView
          style={styles.cardContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          scrollEventThrottle={16}
          directionalLockEnabled
        >
          {restaurant.menuItems.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="restaurant-outline" size={14} color={C.tint} />
                <Text style={styles.sectionTitle}>Menu Highlights</Text>
              </View>
              <MenuSection items={restaurant.menuItems} />
            </>
          )}
          {restaurant.reviews.length > 0 && (
            <>
              <View style={[styles.sectionHeader, restaurant.menuItems.length > 0 && styles.sectionHeaderBorder]}>
                <Ionicons name="chatbubble-outline" size={14} color={C.tint} />
                <Text style={styles.sectionTitle}>What People Say</Text>
              </View>
              <View style={styles.reviewsWrap}>
                {restaurant.reviews.map((r, i) => <ReviewCard key={i} review={r} />)}
              </View>
            </>
          )}
          {restaurant.menuItems.length === 0 && restaurant.reviews.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No additional info available</Text>
            </View>
          )}
          <View style={{ height: 16 }} />
        </ScrollView>
      </View>
    </Animated.View>
  );
});

export default function SwipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch } = useApi();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const topCardRef = useRef<SwipeCardHandle>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitingCard, setExitingCard] = useState<ExitingCardState | null>(null);

  const voteQueueRef = useRef<Array<{ restaurantId: string; liked: boolean }>>([]);
  const processingRef = useRef(false);

  const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
    queryKey: ['restaurants', id],
    queryFn: () => apiFetch(`/groups/${id}/restaurants`),
  });

  const processVoteQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    while (voteQueueRef.current.length > 0) {
      const vote = voteQueueRef.current[0];
      try {
        await apiFetch(`/groups/${id}/votes`, {
          method: 'POST',
          body: JSON.stringify({ restaurantId: vote.restaurantId, liked: vote.liked }),
        });
      } catch {
      }
      voteQueueRef.current = voteQueueRef.current.slice(1);
    }
    processingRef.current = false;
  }, [apiFetch, id]);

  const handleSwipeCommit = useCallback((liked: boolean, dx: number) => {
    if (!restaurants) return;
    const restaurant = restaurants[currentIndex];

    voteQueueRef.current = [...voteQueueRef.current, { restaurantId: restaurant.id, liked }];
    processVoteQueue();

    setExitingCard({ restaurant, liked, startX: dx });

    const next = currentIndex + 1;
    setCurrentIndex(next);

    if (next >= restaurants.length) {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        queryClient.invalidateQueries({ queryKey: ['group', id] });
        router.replace({ pathname: '/(app)/waiting/[id]', params: { id } });
      }, 350);
    }
  }, [restaurants, currentIndex, id, processVoteQueue]);

  function handleLike() {
    if (!restaurants || currentIndex >= restaurants.length) return;
    topCardRef.current?.swipeRight();
  }

  function handlePass() {
    if (!restaurants || currentIndex >= restaurants.length) return;
    topCardRef.current?.swipeLeft();
  }

  if (isLoading || !restaurants) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.tint} size="large" />
        <Text style={styles.loadingText}>{t('findingPlaces')}</Text>
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="search-outline" size={48} color={C.textMuted} />
        <Text style={styles.noResultsTitle}>{t('noPlacesFound')}</Text>
        <Text style={styles.noResultsText}>{t('tryIncreasingRadius')}</Text>
        <Pressable style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackBtnText}>{t('goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const remaining = restaurants.length - currentIndex;
  const progress = currentIndex / restaurants.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="close" size={24} color={C.textSecondary} />
        </Pressable>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.progressText}>{currentIndex} / {restaurants.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stack}>
        {remaining === 0 ? (
          <View style={styles.doneCard}>
            <Ionicons name="checkmark-circle" size={64} color={C.success} />
            <Text style={styles.doneTitle}>{t('allDone')}</Text>
            <Text style={styles.doneText}>{t('waitingForResults')}</Text>
          </View>
        ) : (
          [...restaurants.slice(currentIndex, currentIndex + 3)].reverse().map((restaurant, revI) => {
            const i = Math.min(2, remaining - 1) - revI;
            const isTop = i === 0;
            return (
              <SwipeCard
                key={restaurant.id}
                ref={isTop ? topCardRef : undefined}
                restaurant={restaurant}
                onCommit={handleSwipeCommit}
                isTop={isTop}
                index={i}
              />
            );
          })
        )}

        {exitingCard && (
          <ExitingCard
            key={`exiting-${exitingCard.restaurant.id}`}
            {...exitingCard}
            onDone={() => setExitingCard(null)}
          />
        )}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16) }]}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.passBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handlePass}
          disabled={remaining === 0}
        >
          <Ionicons name="close" size={30} color={C.dislikeRed} />
        </Pressable>

        <View style={styles.swipeHint}>
          <Ionicons name="swap-horizontal" size={16} color={C.textMuted} />
          <Text style={styles.swipeHintText}>{t('swipeOrTap')}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.likeBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handleLike}
          disabled={remaining === 0}
        >
          <Ionicons name="heart" size={28} color={C.likeGreen} />
        </Pressable>
      </View>
    </View>
  );
}

const PHOTO_HEIGHT = 280;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSecondary },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  headerBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progressContainer: { flex: 1, gap: 5 },
  progressBar: { height: 5, backgroundColor: C.cardBorder, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.tint, borderRadius: 3 },
  progressText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textMuted, textAlign: 'center' },
  stack: { flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16 },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: '96%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: C.card,
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cardInner: { flex: 1 },
  photoContainer: { height: PHOTO_HEIGHT, position: 'relative', backgroundColor: C.backgroundTertiary },
  photo: { width: '100%', height: '100%' },
  photoGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: PHOTO_HEIGHT * 0.65 },
  photoDots: { position: 'absolute', top: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  photoDotActive: { backgroundColor: '#fff', width: 20 },
  photoNav: { position: 'absolute', top: 0, bottom: 0, width: '40%' },
  photoNavLeft: { left: 0 },
  photoNavRight: { right: 0 },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, gap: 6 },
  photoTags: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  cuisineTag: { backgroundColor: 'rgba(232,96,44,0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  cuisineText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  openTag: {
    backgroundColor: 'rgba(39,174,96,0.85)',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4,
  },
  closedTag: { backgroundColor: 'rgba(192,57,43,0.85)' },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  openText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_500Medium' },
  restaurantNamePhoto: {
    fontSize: 24, fontFamily: 'Inter_700Bold', color: '#fff', lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  photoMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reviewCountPhoto: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  distancePhoto: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.amber },
  addressRowPhoto: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressPhoto: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.75)' },
  likeStamp: {
    position: 'absolute', top: 24, left: 20, transform: [{ rotate: '-15deg' }],
    borderWidth: 4, borderColor: C.likeGreen, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(39,174,96,0.15)',
  },
  likeStampText: { color: C.likeGreen, fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  nopeStamp: {
    position: 'absolute', top: 24, right: 20, transform: [{ rotate: '15deg' }],
    borderWidth: 4, borderColor: C.dislikeRed, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(192,57,43,0.15)',
  },
  nopeStampText: { color: C.dislikeRed, fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  noPhotoPlaceholder: {
    height: 180, backgroundColor: C.backgroundTertiary,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  noPhotoName: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
  cardContent: { flex: 1, backgroundColor: C.card },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
  },
  sectionHeaderBorder: { borderTopWidth: 1, borderTopColor: C.cardBorder, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  menuSection: { paddingHorizontal: 16, gap: 12, paddingVertical: 6 },
  menuCategory: { gap: 6 },
  menuCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  menuCategoryLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4,
  },
  menuItemText: { flex: 1 },
  menuItemName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  menuItemDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2, lineHeight: 15 },
  menuItemPrice: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.tint },
  reviewsWrap: { paddingHorizontal: 12, paddingBottom: 6, gap: 10 },
  reviewCard: { backgroundColor: C.backgroundSecondary, borderRadius: 12, padding: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  reviewAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: `${C.tint}30`, alignItems: 'center', justifyContent: 'center',
  },
  reviewInitial: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.tint },
  reviewMeta: { flex: 1, gap: 2 },
  reviewAuthor: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textMuted },
  reviewText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, lineHeight: 17 },
  emptyCard: { padding: 20, alignItems: 'center' },
  emptyCardText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textMuted },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingNum: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.amber, marginLeft: 2 },
  price: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.amber },
  doneCard: {
    alignItems: 'center', justifyContent: 'center', gap: 12,
    padding: 32, backgroundColor: C.card, borderRadius: 24,
    width: CARD_WIDTH,
    shadowColor: '#2C1810', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  doneTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text },
  doneText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 20, paddingTop: 10 },
  actionBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  passBtn: { backgroundColor: C.card, borderWidth: 2, borderColor: `${C.dislikeRed}30` },
  likeBtn: { backgroundColor: C.card, borderWidth: 2, borderColor: `${C.likeGreen}30` },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swipeHintText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textMuted },
  noResultsTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  noResultsText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  goBackBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: C.tint, borderRadius: 14,
  },
  goBackBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
