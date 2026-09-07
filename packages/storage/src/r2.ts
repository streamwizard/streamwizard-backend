import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Server-only R2 wrapper. R2 speaks the S3 API at
// https://{accountId}.r2.cloudflarestorage.com with region "auto".

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified?: Date;
}

export class R2Storage {
  private client: S3Client;
  private bucket: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // SDK >=3.729 defaults to injecting CRC32 checksums, which end up baked
      // into presigned URLs (computed over an empty body) and confuse R2.
      // Cloudflare's guidance for R2 is to only send checksums when required.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  /** Presigned PUT URL the browser uploads directly to. */
  async presignPut(key: string, contentType: string, expiresInSeconds = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /** Returns object metadata, or null when the object does not exist. */
  async headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Lists every object under a prefix (paginates internally). */
  async listPrefix(prefix: string): Promise<R2ObjectInfo[]> {
    const objects: R2ObjectInfo[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) objects.push({ key: obj.Key, size: obj.Size ?? 0, lastModified: obj.LastModified });
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);
    return objects;
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (("name" in err && (err as { name: string }).name === "NotFound") ||
      ("$metadata" in err &&
        (err as { $metadata: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404))
  );
}
