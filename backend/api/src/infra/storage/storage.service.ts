import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile, rm } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';

/** URL path under which locally-stored uploads are served (see main.ts). */
export const STORAGE_URL_PREFIX = '/uploads';

/** Absolute directory where uploads are written in the local-storage stub. */
export function localStorageRoot(): string {
  return resolve(process.env.STORAGE_LOCAL_DIR || join(process.cwd(), 'uploads'));
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Persist a file buffer and return its public URL.
   *
   * Phase 3 implementation: writes the bytes to the local `uploads/` directory,
   * which `main.ts` serves statically under `/uploads`, so the photo is actually
   * fetched back (not a dangling fake URL). The returned URL is absolute when
   * `STORAGE_PUBLIC_URL` is set, otherwise a server-relative `/uploads/...` path
   * the apps resolve against their API base. Swap the body for an S3/DO Spaces
   * putObject in production — the URL contract stays the same.
   */
  async upload(buffer: Buffer, filename: string, _contentType: string): Promise<string> {
    const rel = this.safeRelativePath(filename);
    const root = localStorageRoot();
    const dest = join(root, rel);

    // Guard against path traversal escaping the storage root.
    if (!dest.startsWith(root + sep)) {
      throw new Error(`Invalid storage path: ${filename}`);
    }

    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
    this.logger.debug(`Stored ${buffer.byteLength} bytes → ${dest}`);

    const urlPath = `${STORAGE_URL_PREFIX}/${rel.split(sep).join('/')}`;
    const base = this.config.get<string>('STORAGE_PUBLIC_URL');
    return base ? `${base.replace(/\/+$/, '')}${urlPath}` : urlPath;
  }

  async delete(url: string): Promise<void> {
    const idx = url.indexOf(STORAGE_URL_PREFIX);
    if (idx === -1) return;
    const rel = this.safeRelativePath(url.slice(idx + STORAGE_URL_PREFIX.length));
    const dest = join(localStorageRoot(), rel);
    await rm(dest, { force: true });
  }

  /** Normalise to a safe relative path (no leading slash, no `..` segments). */
  private safeRelativePath(filename: string): string {
    return normalize(filename.replace(/^\/+/, '')).replace(/^(\.\.(\/|\\|$))+/, '');
  }
}
