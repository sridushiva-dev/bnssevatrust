import fs from "node:fs/promises";
import path from "node:path";

import type { StorageProvider, UploadInput, StoredObject } from "./types";

export class LocalStorageProvider implements StorageProvider {
  async upload(input: UploadInput): Promise<StoredObject> {
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${Date.now()}-${safeName}`;
    const relativeDir = path.join("uploads", input.folder);
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });
    const diskPath = path.join(absoluteDir, storageKey);
    await fs.writeFile(diskPath, input.buffer);
    return {
      storageKey: path.join(input.folder, storageKey).replace(/\\/g, "/"),
      fileUrl: `/${relativeDir}/${storageKey}`.replace(/\\/g, "/"),
      fileSize: input.buffer.length,
    };
  }
}
