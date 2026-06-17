import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/auth.store';

// Entry route. Renders inside the mounted root navigator, so <Redirect> here is
// safe (unlike an imperative router.replace from the root layout's effect).
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Authenticated parents land on the child selector (which auto-skips to home
  // for single-child accounts). See app/(app)/child-select.tsx.
  return <Redirect href={(isAuthenticated ? '/(app)/child-select' : '/(auth)/phone') as never} />;
}
