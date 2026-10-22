/** Where the API runs (set NEXT_PUBLIC_API_URL in .env.local). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/api').replace(/\/$/, '');
