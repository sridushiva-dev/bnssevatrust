import { LocalStorageProvider } from "./local-provider";
import { S3StorageProvider } from "./s3-provider";
import type { StorageProvider, UploadInput, StoredObject } from "./types";

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  provider = driver === "s3" ? new S3StorageProvider() : new LocalStorageProvider();
  return provider;
}

export async function uploadAttachmentFile(
  input: UploadInput,
): Promise<StoredObject> {
  return getStorageProvider().upload(input);
}

export type { StoredObject, UploadInput };
