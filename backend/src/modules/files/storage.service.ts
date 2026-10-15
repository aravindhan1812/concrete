import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * S3-compatible object storage (MinIO locally, S3 / R2 in production).
 * Two clients: `internal` talks to storage from the API (HEAD on upload confirmation);
 * `public` only signs URLs, using the endpoint browsers and phones can reach.
 */
@Injectable()
export class StorageService {
  private readonly internal: S3Client;
  private readonly signer: S3Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    const region = config.get<string>('S3_REGION', 'us-east-1');
    const credentials = {
      accessKeyId: config.get<string>('S3_ACCESS_KEY', 'concrete'),
      secretAccessKey: config.get<string>('S3_SECRET_KEY', 'concrete-secret'),
    };
    const forcePathStyle = config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';
    const endpoint = config.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    this.bucket = config.get<string>('S3_BUCKET', 'concrete');
    this.internal = new S3Client({ region, credentials, endpoint, forcePathStyle });
    this.signer = new S3Client({ region, credentials, endpoint: config.get<string>('S3_PUBLIC_ENDPOINT', endpoint), forcePathStyle });
  }

  uploadUrl(key: string, contentType: string, expiresIn = 900) {
    return getSignedUrl(this.signer, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), { expiresIn });
  }

  downloadUrl(key: string, fileName: string, opts: { inline?: boolean; expiresIn?: number } = {}) {
    const disposition = `${opts.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: disposition }), {
      expiresIn: opts.expiresIn ?? 300,
    });
  }

  /** Size of a stored object, or null if it is not there. */
  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(res.ContentLength ?? 0), contentType: res.ContentType };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (err as Error).name === 'NotFound') return null;
      throw err;
    }
  }
}
