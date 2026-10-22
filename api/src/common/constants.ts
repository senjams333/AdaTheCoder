/** Character packs built into the desktop app. Each theme picks one; "custom" uses uploaded pictures. */
export const PACKS: Record<string, { label: string; images: string[]; note: string }> = {
  friends: { label: 'Tom, Penny & Teddy', images: ['tom.webp', 'penny.webp', 'teddy.webp'], note: 'Teddy celebrates, Tom explains mistakes' },
  fairies: { label: 'Twinkle, Fern & Sparkle', images: ['twinkle.webp', 'fern.webp', 'sparkle.webp'], note: 'Sparkle the unicorn celebrates, Fern explains mistakes' },
  coding_club: { label: 'Ada, Byte & Penny', images: ['ada.webp', 'byte.webp', 'penny.webp'], note: 'Byte the owl celebrates and explains mistakes' },
  custom: { label: 'Your own characters', images: [], note: 'Upload 3 pictures: the first explains mistakes, the last celebrates' },
};
export const CHARACTER_SLOTS = 3;

export const PLATFORMS: Record<string, { label: string; extensions: string[] }> = {
  windows: { label: 'Windows', extensions: ['.exe', '.msi', '.zip'] },
  mac: { label: 'Mac', extensions: ['.dmg', '.pkg', '.zip'] },
};
export const VIDEO_EXTENSIONS = ['.mp4', '.m4v'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

export const SETTING_FIELDS = [
  'hero_title', 'hero_subtitle', 'site_banner', 'app_message', 'parents_note', 'contact_email', 'author_name', 'author_note',
] as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  hero_title: "Your child's first lines of real code",
  hero_subtitle:
    'Ada The Coder teaches Python to children aged 6 to 11 with short, playful lessons. Grown-ups sign up and install ' +
    'the app; kids start making things in the very first lesson.',
  site_banner: '',
  app_message: '',
  parents_note:
    'There are no ads, no chat and no strangers in Ada The Coder. Your child never needs an account, and their ' +
    'progress is saved on your own computer.',
  contact_email: 'ada@adathecoder.com',
  author_name: 'Senjam SD',
  author_note:
    'I made Ada The Coder because I believe every child can learn to code, and that the very first steps should feel ' +
    'like play, not homework.\n\nMany coding tools for young children use blocks. Blocks are a fine start, but lots of ' +
    'kids are ready to type real code much earlier than we expect. They just need a patient, friendly place to begin. ' +
    "That's what Ada, Byte and Twinkle are here for: short lessons, simple words, and a cheer for every small win.\n\n" +
    'There are no ads, no chats and nothing to buy inside the app. Just your child, their ideas, and a computer that ' +
    "does what they tell it to.\n\nIf you have a question, an idea, or a story about your child's first program, I'd " +
    'love to hear it.',
};

export const DEFAULT_COURSES = [
  {
    slug: 'friends', name: 'Friends Adventure', pack: 'friends', price: '$3.69', premium: true,
    tagline: 'Code, explore and learn together with fun friends and exciting challenges.',
    description: 'Tom, Penny the snake and Teddy join your child on a coding adventure. Every lesson becomes a little quest, with friends cheering from the side.',
    features: 'Tom, Penny and Teddy guide every lesson\nBright adventure colours\nAll 17 beginner lessons',
  },
  {
    slug: 'fairies', name: 'Fairies & Angels', pack: 'fairies', price: '$3.69', premium: true,
    tagline: 'Enter a magical world where imagination and coding grow together.',
    description: 'Twinkle, Fern and Sparkle the unicorn turn coding practice into a magical garden, with a shiny star for every challenge solved.',
    features: 'Twinkle cheers on every success\nSparkly pink and gold look\nAll 17 beginner lessons',
  },
  {
    slug: 'coding_club', name: "Ada's Coding Club", pack: 'coding_club', price: '', premium: false,
    tagline: 'Code along with Ada and Byte the owl. Included free.',
    description: 'The free theme that comes with every download.',
    features: 'Ada and Byte the owl\nAll 17 beginner lessons\nFree with the app',
  },
];
