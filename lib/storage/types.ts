export type StoredObject = {
  storageKey: string;
  fileUrl: string;
  fileSize: number;
};

export type UploadInput = {
  folder: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export interface StorageProvider {
  upload(input: UploadInput): Promise<StoredObject>;
}
