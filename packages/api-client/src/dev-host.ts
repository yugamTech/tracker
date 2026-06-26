import Constants from 'expo-constants';

/**
 * Self-healing dev host.
 *
 * In development the Expo/Metro bundler already knows the developer machine's
 * CURRENT LAN IP — it's how the phone reaches Metro in the first place. We reuse
 * that IP as the API/socket host so a changed DHCP lease (a new Wi-Fi IP) never
 * breaks login again: no more hand-editing EXPO_PUBLIC_API_URL in .env.
 *
 * Behaviour:
 *  - Production builds (or anything not in __DEV__) return the configured URL
 *    UNCHANGED — real deployments must use their real host.
 *  - If the bundler host can't be resolved (or is localhost), the configured URL
 *    is returned unchanged as a safe fallback.
 *  - Only the hostname is swapped; scheme, port and path are preserved.
 */
export function resolveDevHost(url: string): string {
  // __DEV__ is a React Native (Metro) global; read it off globalThis so this file
  // doesn't depend on RN ambient types. Falsy/absent → treated as production.
  const isDev = !!(globalThis as unknown as { __DEV__?: boolean }).__DEV__;
  if (!isDev) return url;

  try {
    // `hostUri` is the modern field (e.g. "192.168.0.2:8081"); the others are
    // Expo Go / classic-manifest fallbacks.
    const hostUri: string =
      (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ||
      (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ||
      (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ||
      '';

    const devIp = String(hostUri).split(':')[0].trim();
    if (!devIp || devIp === 'localhost' || devIp === '127.0.0.1') return url;

    // Swap only the hostname; keep scheme + port + any path intact.
    return url.replace(
      /^(https?:\/\/)([^/:]+)(:\d+)?(.*)$/,
      (_match, scheme: string, _host: string, port = '', rest = '') =>
        `${scheme}${devIp}${port}${rest}`,
    );
  } catch {
    return url;
  }
}
