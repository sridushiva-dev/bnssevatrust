import type { Archiver } from "archiver";
import { PassThrough } from "node:stream";

// archiver is CJS; use require for Next.js compatibility
function createArchiver(): Archiver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const archiver = require("archiver") as (format: string, options?: { zlib?: { level: number } }) => Archiver;
  return archiver("zip", { zlib: { level: 9 } });
}

export async function zipBuffers(files: Array<{ name: string; content: string | Buffer }>): Promise<Buffer> {
  const archive = createArchiver();
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (c) => chunks.push(Buffer.from(c)));

  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(stream);
  for (const file of files) {
    archive.append(file.content, { name: file.name });
  }
  await archive.finalize();
  return done;
}

export { createArchiver };
