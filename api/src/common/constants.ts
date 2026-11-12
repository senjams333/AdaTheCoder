import { SITE_TEXT_DEFAULTS, SITE_TEXT_FIELDS } from './site-text';
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
/** Lesson videos the admin can upload; the API makes the WebM copy the app plays from any of them (ffmpeg). */
export const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

export const SETTING_FIELDS = [
  'hero_title', 'hero_subtitle', 'site_banner', 'app_message', 'parents_note', 'contact_email', 'author_name', 'author_note',
  'app_welcome', 'app_home_theme', 'business_details',
  'break_minutes', 'break_title', 'break_intro', 'break_steps', 'break_button', 'break_lock', 'break_lock_minutes', 'policy_purchases',
  'home_char1_name', 'home_char2_name', 'home_char3_name', 'grievance_name', 'grievance_email', 'legal_city', 'hero_code_file', 'hero_code', 'hero_code_output',
  'install_video_url', 'social_youtube', 'social_x', 'social_facebook',
  ...SITE_TEXT_FIELDS,
] as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  ...SITE_TEXT_DEFAULTS,
  hero_title: "Your child's first lines of real code",
  hero_subtitle:
    'Ada The Coder teaches Python to children aged 6 to 11 with short, playful lessons. Grown-ups sign up and install ' +
    'the app; kids start making things in the very first lesson.',
  site_banner: '',
  app_message: '',
  // the Ada The Coder app's home screen: the greeting, and the theme whose characters stand on it ('' = Tom, Ada and Unicorn)
  app_welcome: 'Welcome to Ada The Coder',
  app_home_theme: '',
  // the app's break reminder ("The Quick Reset"): every N minutes of use (0 = off). {minutes} in the text is replaced.
  // break_steps: one step per line, "emoji | title | what to do"
  break_minutes: '30',
  break_title: '⏰ Time for The Quick Reset!',
  break_intro: "You've been coding for {minutes} minutes. Super work! Let's give your eyes, body and brain a little break. 🌟",
  break_steps:
    '👀 | 1. Block (Eyes) | Look at something 20 feet away. Stop looking at the screen to rest your eye muscles.\n' +
    '🤸 | 2. Stretch & Jump (Body) | Do 5 star-jumps or reach for the sky! It wakes up your body and gets your blood moving.\n' +
    '🎈 | 3. Breathe (Mind) | Take 3 balloon breaths: breathe in deep to fill your belly, then blow it out slowly.\n' +
    '💧 | 4. Drink (Hydration) | Take 3 big sips of water. It keeps your brain happy and running smoothly.',
  break_button: 'I did it! Back to coding 🚀',
  // '1': the break can't be closed for break_lock_minutes (children really rest); '0': they can close it at once
  break_lock: '1',
  break_lock_minutes: '5',
  // the app's home screen characters (when no theme is chosen for it): the name over each picture, and the picture the
  // admin uploaded ('' = the one built into the app: Tom, Ada, Unicorn). The *_file keys are set only by the uploads.
  // the little code window on the home page, next to Ada: its file name, the code, and "What it shows"
  hero_code_file: 'stars.py',
  hero_code: 'for count_star in range(3):\n    print("Golden star ⭐")',
  hero_code_output: 'Golden star ⭐\nGolden star ⭐\nGolden star ⭐',
  home_char1_name: 'Tom',
  home_char2_name: 'Ada',
  home_char3_name: 'Unicorn',
  home_char1_file: '',
  home_char2_file: '',
  home_char3_file: '',
  // "Purchases and cancellation" on the Policies page: an empty line between paragraphs, "- " starts a bullet,
  // "Title: text" in a bullet makes the title bold, {email} becomes the contact email
  policy_purchases:
    "Every paid theme opens its first lessons free, so your child can try it properly before you decide. Prices are shown in Indian rupees before you pay, include any taxes we have to charge, and are one-time payments: there is no subscription, and you are never charged again unless you choose to buy another theme.\n\n- Delivery: Themes are digital, so nothing is shipped. As soon as your payment goes through, your licence code is shown on screen, emailed to you and listed on your account page, and the app unlocks the theme by itself within a few minutes.\n- Cancellation: You can cancel at any time before the payment is complete, just by closing the payment window: nothing is charged. Once a licence is issued the purchase is complete, and there is nothing further to cancel.\n- No refunds once a licence is issued: A theme is unlocked and yours to keep as soon as its licence is issued, and you can try its free lessons first, so we don't refund a purchase because of a change of mind after the licence has been issued.\n\nWe will always put things right in these cases. Write to {email} with your account's email and the Razorpay payment reference:\n- Charged twice for the same theme: the extra payment is refunded in full.\n- Charged, but no licence was issued: we issue it, and if we can't do that within 2 working days, your payment is refunded in full.\n- The theme doesn't work as described on a supported computer: if we can't fix it within 7 days of your report, your payment is refunded in full.\n- Money left your account but the payment failed: your bank or payment provider reverses this by itself, under the Reserve Bank of India's rules for failed transactions (usually within 1 to 5 working days). If it doesn't come back, write to us and we'll help.\n\nRefunds go back the way you paid (card, UPI or net banking). We start them within 2 working days of confirming the problem, and banks usually show the money within 5 to 7 working days.\n\nNothing in this policy takes away your rights as a consumer under the Consumer Protection Act, 2019.",
  // links: the installation tutorial (Byte's bubble on the home page) and the footer's YouTube, X and Facebook buttons
  // ('' = the button is shown but goes nowhere yet)
  install_video_url: '',
  social_youtube: '',
  social_x: '',
  social_facebook: '',
  // on the Terms and Policies pages (payment providers ask for a legal name and address)
  business_details: 'Ada The Coder\n(Your legal name)\n(Your address, city, PIN code, India)\nPhone: (your phone number)',
  // the Grievance Officer named on the Policies and Terms pages (Indian law asks for a name and a way to reach them);
  // empty: the author's name and the contact email are shown. legal_city: the city whose courts the Terms name.
  grievance_name: '',
  grievance_email: '',
  legal_city: '',
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

/** The purchases text shipped before 12 November 2026. If a website still has it saved unchanged, the current text
 *  above is shown instead (an admin's own edited text is always kept as it is). */
export const LEGACY_POLICY_PURCHASES = "We keep our themes affordable, and every paid theme opens its first lessons free, so your child can explore it fully before you decide.\n\nBecause a theme is yours to keep the moment it is unlocked, we are not able to offer refunds once its licence has been issued. We hope the free lessons make it easy to be sure the theme is the right fit first.\n\nIf anything ever goes wrong with a payment, we will always make it right. Write to {email} with your account's email and the payment reference from Razorpay or PayPal:\n- Charged twice for the same theme: the extra payment is returned to you.\n- Charged, but the theme didn't unlock: we unlock it for you straight away, and if we can't, your payment is returned.\n\nAny money returned goes back the way you paid (card, UPI, bank or PayPal) within 2 working days of us confirming it; your bank or PayPal usually shows it within 5 to 7 working days.\n\nThere is nothing to cancel: licences are one-time payments, not subscriptions, so you will never be charged again. You can close your account at any time from your account page.";
