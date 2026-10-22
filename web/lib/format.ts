export function mb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function day(iso: string | null | undefined): string {
  return iso ? String(iso).slice(0, 10) : '–';
}

export function when(iso: string | null | undefined): string {
  return iso ? String(iso).replace('T', ' ').slice(0, 16) : '–';
}
