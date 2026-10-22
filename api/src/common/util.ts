import { createHash } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join, resolve } from 'path';

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const SLUG_RE = /^[A-Za-z0-9_-]+$/;
export const VERSION_RE = /^\d+\.\d+\.\d+$/;

export function versionTuple(v: string | null | undefined): number[] {
  const parts = String(v || '').split('.').map((p) => Number(p));
  return parts.some((n) => Number.isNaN(n)) ? [0] : parts;
}

/** a > b for version numbers like 1.10.0 vs 1.9.2 */
export function versionNewer(a: string, b: string): boolean {
  const x = versionTuple(a), y = versionTuple(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** JSON with sorted keys, so the same data always gives the same text (and the same revision). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value instanceof Date ? value.toISOString() : value);
}

export function revisionOf(data: unknown): string {
  return createHash('sha256').update(stableStringify(data)).digest('hex').slice(0, 16);
}

export function ext(filename: string | undefined): string {
  return extname(filename || '').toLowerCase();
}

/** Where uploads live: UPLOAD_DIR/{videos,courses,releases}. Folders are made when needed. */
export function uploadDir(kind: 'videos' | 'courses' | 'releases' | 'tmp' | '' = ''): string {
  const dir = resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), kind);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The API's public address, for links to videos and pictures, e.g. http://127.0.0.1:3000 */
export function apiOrigin(): string {
  return (process.env.API_PUBLIC_URL || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

/** The website's address (Next.js), for links in emails and the app's Upgrade button. */
export function siteUrl(): string {
  return (process.env.SITE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
}

export function mediaUrl(kind: 'videos' | 'courses', file: string): string {
  return `${apiOrigin()}/media/${kind}/${encodeURIComponent(file)}`;
}

export function trimmed(v: unknown, max = 255): string {
  return String(v ?? '').trim().slice(0, max);
}

export function truthy(v: unknown): boolean {
  return v === true || v === 1 || ['1', 'true', 'on', 'yes'].includes(String(v).toLowerCase());
}
