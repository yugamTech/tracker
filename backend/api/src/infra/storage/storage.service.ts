import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Upload a file buffer and return the public URL.
   * Phase 3 stub — returns a deterministic local/fake URL (no DO Spaces / S3).
   * Swap the body for a real S3/Spaces putObject in production.
   */
  async upload(
    _buffer: Buffer,
    filename: string,
    _contentType: string,
  ): Promise<string> {
    const base = this.config.get<string>('STORAGE_PUBLIC_URL') || 'https://saarthi-local.fake';
    return `${base}/${filename.replace(/^\/+/, '')}`;
  }

  async delete(_url: string): Promise<void> {
    // TODO: implement S3/DO Spaces delete
  }
}
