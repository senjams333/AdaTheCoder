import { randomBytes } from 'crypto';
import { rename, unlink } from 'fs/promises';
import { diskStorage } from 'multer';
import { join } from 'path';
import { ext, uploadDir } from './util';

export type UploadedFile = Express.Multer.File;
export type UploadedFiles = Record<string, UploadedFile[] | undefined>;

/** Uploads land in uploads/tmp first and are moved into place only when the form is valid. */
export const uploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir('tmp')),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ext(file.originalname)}`),
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 500) * 1024 * 1024 },
};

export function first(files: UploadedFiles | undefined, field: string): UploadedFile | undefined {
  return files?.[field]?.[0];
}

/** Moves an upload into uploads/<kind>/ under a new name; returns that name. */
export async function keep(file: UploadedFile, kind: 'videos' | 'courses' | 'releases', base: string): Promise<string> {
  const name = `${base}-${randomBytes(4).toString('hex')}${ext(file.originalname)}`;
  await rename(file.path, join(uploadDir(kind), name));
  return name;
}

/** Deletes uploads that won't be used (the form had mistakes). */
export async function discard(...files: (UploadedFile | undefined)[]) {
  for (const f of files) {
    if (f?.path) await unlink(f.path).catch(() => undefined);
  }
}
