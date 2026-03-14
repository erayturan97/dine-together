import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="create-group" />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="swipe/[id]" />
      <Stack.Screen name="waiting/[id]" />
      <Stack.Screen name="results/[id]" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
