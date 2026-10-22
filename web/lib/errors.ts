import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';

/** Turns an API error into friendly sentences. */
export function errorList(err: unknown): string[] {
  if (!err) return [];
  const e = err as FetchBaseQueryError | SerializedError;
  if ('status' in e) {
    if (e.status === 'FETCH_ERROR' || e.status === 'TIMEOUT_ERROR') {
      return ["Can't reach the server right now. Check your internet and try again."];
    }
    if (e.status === 'PARSING_ERROR') return ['The server sent an answer that could not be read. Please try again.'];
    const data = (e as { data?: unknown }).data as { message?: string | string[]; errors?: string[]; error?: string } | undefined;
    const m = data?.message ?? data?.errors ?? data?.error;
    if (Array.isArray(m)) return m.map(String);
    if (typeof m === 'string' && m) return [m];
    if (e.status === 413) return ['That file is too big to upload.'];
    return [`Something went wrong (${String(e.status)}). Please try again.`];
  }
  return [e.message || 'Something went wrong. Please try again.'];
}

export function errorText(err: unknown): string {
  return errorList(err).join(' ');
}

export function httpStatus(err: unknown): number | string | undefined {
  return err && typeof err === 'object' && 'status' in err ? (err as { status: number | string }).status : undefined;
}
