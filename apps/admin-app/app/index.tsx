import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/auth.store';

// Entry route. Renders inside the mounted root navigator, so <Redirect> here is
// safe (unlike an imperative router.replace from the root layout's effect).
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Redirect href={isAuthenticated ? '/(app)/dashboard' : '/(auth)/phone'} />;
}
