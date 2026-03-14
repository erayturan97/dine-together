import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  provider: string;
}

export interface GroupMember {
  userId: string;
  name: string;
  avatar?: string;
  status: 'invited' | 'joined' | 'done';
  doneAt?: string;
}

export interface Group {
  id: string;
  name: string;
  creatorId: string;
  venueType: 'restaurant' | 'cafe' | 'bar';
  status: 'pending' | 'swiping' | 'waiting' | 'completed';
  members: GroupMember[];
  restaurantCount?: number;
  createdAt?: string;
}

export interface MenuItem {
  name: string;
  description?: string;
  category: 'dish' | 'drink' | 'dessert';
  price?: string;
  photo?: string;
}

export interface Review {
  authorName: string;
  rating: number;
  text: string;
  timeAgo?: string;
  authorPhoto?: string;
}

export interface Restaurant {
  id: string;
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  photos: string[];
  cuisine?: string;
  openNow?: boolean;
  distance?: number;
  menuItems: MenuItem[];
  reviews: Review[];
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  menuSearchUrl?: string;
  phone?: string;
  website?: string;
}

export interface RestaurantResult {
  restaurant: Restaurant;
  likeCount: number;
  dislikeCount: number;
  totalVotes: number;
  score: number;
}

interface GroupContextValue {
  currentGroup: Group | null;
  setCurrentGroup: (group: Group | null) => void;
  restaurants: Restaurant[];
  setRestaurants: (r: Restaurant[]) => void;
  results: RestaurantResult[];
  setResults: (r: RestaurantResult[]) => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: ReactNode }) {
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [results, setResults] = useState<RestaurantResult[]>([]);

  const value = useMemo(() => ({
    currentGroup,
    setCurrentGroup,
    restaurants,
    setRestaurants,
    results,
    setResults,
  }), [currentGroup, restaurants, results]);

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup must be used within GroupProvider');
  return ctx;
}
