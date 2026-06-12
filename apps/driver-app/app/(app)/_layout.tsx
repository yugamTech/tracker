import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="trip/[tripId]/index" />
      <Stack.Screen name="trip/[tripId]/active" />
      <Stack.Screen name="trip/[tripId]/complete" />
      <Stack.Screen name="trip/alerts" />
      <Stack.Screen name="trip/attendance/[stopId]" />
      <Stack.Screen name="trip/attendance/photo" />
      <Stack.Screen name="vehicle-check" />
    </Stack>
  );
}
