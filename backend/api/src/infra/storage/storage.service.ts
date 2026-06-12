import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Upload a file buffer and return the public URL.
   * Stub implementation — wire up DO Spaces / S3 in production.
   */
  async upload(
    _buffer: Buffer,
    _filename: string,
    _contentType: string,
  ): Promise<string> {
    // TODO: implement S3/DO Spaces upload
    const bucket = this.config.get<string>('STORAGE_BUCKET', 'saarthi-dev');
    return `https://${bucket}.placeholder.com/${_filename}`;
  }

  async delete(_url: string): Promise<void> {
    // TODO: implement S3/DO Spaces delete
  }
}
