import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { StorageProvider, UploadInput, StoredObject } from "./types";

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION ?? "ap-south-1";
    if (!bucket) {
      throw new Error("S3_BUCKET is required for S3 storage");
    }
    this.bucket = bucket;
    this.publicBaseUrl =
      process.env.S3_PUBLIC_BASE_URL ??
      `https://${bucket}.s3.${region}.amazonaws.com`;
    this.client = new S3Client({
      region,
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async upload(input: UploadInput): Promise<StoredObject> {
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${input.folder}/${Date.now()}-${safeName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );
    return {
      storageKey,
      fileUrl: `${this.publicBaseUrl}/${storageKey}`,
      fileSize: input.buffer.length,
    };
  }
}
