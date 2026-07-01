import { API_BASE_URL } from './axios';

/**
 * Resolve a stored photo URL into something React Native's <Image> can actually
 * load.
 *
 * WHY: `StorageService.upload` returns a SERVER-RELATIVE path ("/uploads/…")
 * when `STORAGE_PUBLIC_URL` is unset (the local-storage stub), and RN's <Image>
 * silently renders a relative URI as a grey box — it needs an ABSOLUTE url. Those
 * files are served by the API at `{host}/uploads/…`, OUTSIDE the `/api/v1` prefix
 * (see backend main.ts `useStaticAssets`), so we prefix with the API *origin*,
 * not the API base. Absolute urls (production object storage, or a local
 * `file://` camera capture) are returned untouched.
 *
 * Use this at EVERY <Image source={{ uri }}> that renders an uploaded photo
 * (boarding, bus-condition, driver) across parent / admin / driver apps.
 */

/** The host origin static uploads are served from — API base minus the `/api/vN` suffix. */
export function apiOrigin(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/api\/v\d+\/?$/, '');
}

/**
 * Pure core: prefix a server-relative path with `origin`; leave anything that is
 * already absolute (has a scheme, or a `file://`/`data:` capture URI) alone. Only
 * paths beginning with "/" are treated as server-relative.
 */
export function withPhotoHost(url: string | null | undefined, origin: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${origin}${url}` : url;
}

/** Resolve a stored photo URL against the app's configured API host. */
export function resolvePhotoUrl(url?: string | null): string | undefined {
  return withPhotoHost(url, apiOrigin(API_BASE_URL));
}
