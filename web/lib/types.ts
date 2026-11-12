/** Shapes of what the API (../api) sends. */

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'parent' | 'admin';
  city: string;
  country: string;
  childName: string | null;
  childAge: number | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface AuthAnswer {
  ok: boolean;
  user: User;
  token: string;
}

export type Settings = Record<string, string>;

export interface Character {
  name: string;
  file: string;
  url: string;
}

/** A theme as cards show it. */
export interface Theme {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  features: string;
  featureList: string[];
  pack: string;
  packLabel: string;
  price: string;
  /** Razorpay's price in rupees ('' = not offered) */
  priceInr: string;
  /** a Razorpay Payment Button id (pl_...), or '' */
  razorpayButton?: string;
  premium: boolean;
  freeLessons: number;
  isNew?: boolean;
  imageFile: string;
  imageUrl: string | null;
  characters: Character[];
  images: string[];
  position: number;
  published: boolean;
  updatedAt: string;
}

export interface ReleaseInfo {
  version: string;
  size: number;
  notes: string;
  createdAt: string;
}

export interface Pack {
  label: string;
  images: string[];
  note: string;
}

export interface SiteData {
  settings: Settings;
  themes: Theme[];
  lessons: { id: number; slug: string; position: number; emoji: string; name: string; title: string; subtitle: string }[];
  releases: Partial<Record<'windows' | 'mac', ReleaseInfo>>;
  platforms: Record<string, { label: string; extensions: string[] }>;
  packs: Record<string, Pack>;
  countries: string[];
  paypal?: boolean;
}

/** Learning in the browser (/learn): the themes and lessons as the desktop app gets them. */
export interface LearnExample { label: string; explain: string; code: string; output: string }
export interface LearnLesson {
  id: string; position: number; emoji: string; name: string; title: string; subtitle: string; locked?: boolean;
  video: { url?: string; webm_url?: string }; default_code: string; examples: LearnExample[];
}
export interface LearnCourse {
  id: string; name: string; tagline: string; description: string; premium: boolean; price: string;
  free_lessons: number | null; buy_url: string; is_new: boolean; cover: { url: string } | null; images: string[];
  characters: { name: string; url: string }[]; full: boolean; lessons: LearnLesson[];
}
export interface LearnData { childName: string; courses: LearnCourse[] }

export interface AccountData {
  user: User;
  themes: (Theme & { licence: string | null })[];
  releases: Partial<Record<'windows' | 'mac', ReleaseInfo>>;
}

export interface Dashboard {
  stats: { parents: number; newParents: number; downloads: number; lessons: number; drafts: number; themes: number };
  releases: Partial<Record<'windows' | 'mac', { version: string; downloads: number; createdAt: string }>>;
  recent: { name: string; email: string; childAge: number | null; city: string; country: string; createdAt: string }[];
}

export interface AdminThemeRow extends Theme {
  total: number;
  live: number;
}

export interface LessonRow {
  id: number;
  slug: string;
  position: number;
  emoji: string;
  name: string;
  title: string;
  subtitle: string;
  videoBundled: string;
  videoFile: string;
  videoSize: number;
  exampleCount: number;
  published: boolean;
}

export interface AdminThemeDetail {
  theme: Theme;
  live: number;
  lessons: LessonRow[];
}

export interface Example {
  label: string;
  explain: string;
  output: string;
  code: string;
}

export interface LessonDetail {
  id?: number;
  courseId: number;
  slug: string;
  position: number;
  emoji: string;
  name: string;
  title: string;
  subtitle: string;
  videoBundled: string;
  videoFile: string;
  videoSize: number;
  videoUrl: string | null;
  webmUrl?: string | null;
  defaultCode: string;
  examples: Example[];
  published: boolean;
}

export interface Release {
  id: number;
  platform: 'windows' | 'mac';
  version: string;
  notes: string;
  filename: string;
  originalName: string;
  size: number;
  minSupported: string;
  isLatest: boolean;
  downloads: number;
  createdAt: string;
}

export interface ParentRow {
  id: number;
  name: string;
  email: string;
  city: string;
  country: string;
  childName: string | null;
  childAge: number | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
  downloads: number;
  licences: Record<string, string>;
}

export interface ParentsData {
  parents: ParentRow[];
  paidThemes: { id: number; name: string; slug: string }[];
}

export interface Done {
  ok: boolean;
  message?: string;
  id?: number;
  courseId?: number;
}
