/** The home page sections and the Policies / Terms pages, as the admin edits them (Admin → Website text →
 *  "Home page sections" and "Policy pages"). These are the texts used until the admin changes them.
 *
 *  Lists (friends, levels, steps, facts, questions) are kept as JSON. In any text:
 *  **bold**, [link text](https://… or /page), and these words in braces are filled in by the website:
 *  {break_minutes} the app's break reminder (a fact or question that uses it is hidden while breaks are off),
 *  {computers} "Windows (Mac coming soon)" / "Windows or Mac", {mac} a sentence about the Mac version,
 *  {install_video} the installation video link, {email} the contact email. */

const j = (v: unknown) => JSON.stringify(v);

export const SITE_TEXT_FIELDS = [
  'friends_title', 'friends_intro', 'friends_items',
  'learn_title', 'learn_intro', 'learn_items', 'learn_note',
  'steps_title', 'steps_intro', 'steps_bubble', 'steps_items',
  'parents_title', 'parents_ages', 'parents_tip', 'parents_facts',
  'faq_title', 'faq_items',
  'policy_privacy', 'policy_terms',
] as const;

const PRIVACY = `# Our policies

Last updated: 12 November 2026

Ada The Coder teaches children to write Python. This page explains, in plain words, what information we collect, why, and the choices you have; and then how purchases, delivery, cancellation and refunds work. On this page, "we" means Ada The Coder (details at the end), and "you" means the parent or guardian who has the account.

#! Privacy {#privacy}

## The short version

- Accounts are for **parents and guardians aged 18 or over**. Children use the app through their grown-up's account.
- About your child, we keep at most a **first name and age**, and only if you choose to add them.
- Your child's code, answers and progress **stay on your computer**. The app doesn't send them to us.
- **No adverts, no tracking, no selling of data**, and no profiling of children.
- You can see, correct or delete your information at any time, and delete your account from your account page.

## What we collect, and why

- **Your account:** your name, email address, city, country and a scrambled (hashed) version of your password, so you can log in, download the app and reach your licences. When you sign up on the website, we check your email address with a code.
- **Your consent:** the date and time you confirmed, when signing up, that you are 18 or over and the child's parent or guardian, and agreed to this policy.
- **Your child (optional):** a first name and an age. The app uses the first name to greet your child. Leave them out if you prefer; everything works without them.
- **Purchases:** which theme, the amount, the date, whether the payment went through, the payment reference from Razorpay, and your licence code, so we can unlock the theme, show your licence and sort out any payment problem.
- **Using the website and app:** when you last logged in, when the app was downloaded, and the technical records every website keeps (the internet address, browser and time of each request), used only to keep the service working and secure, and to stop abuse.
- **Messages:** what you write to us through the Contact page or by email, so we can answer you.

We only collect what we need for these purposes, and we use it only for them. We rely on your consent, given when you sign up; and for purchase records, also on our legal duty to keep tax and accounting records.

## Children

Ada The Coder is made for children, so we take extra care. Only a parent or guardian aged 18 or over can create an account, after confirming their email address, and they give consent for their child when they sign up. We never track or behaviourally monitor children, never show them adverts or target anything at them, and never process their information in a way that could harm their well-being. The app doesn't send your child's programs, answers or progress to us. Under India's Digital Personal Data Protection Act, 2023, anyone under 18 is a child.

## What we don't do

We don't sell or rent your information, show adverts, use advertising or analytics cookies, or build profiles. We don't send marketing emails unless you ask for them.

## Who helps us run the service

These companies process information only on our instructions and only to provide their service to us:

- **Amazon Web Services** hosts the website, its database and its backups, in Mumbai, India.
- **Razorpay** handles payments. Your card, UPI and bank details go straight to Razorpay; we never see or store them. Their own privacy policies cover what they collect.
- **Brevo** sends our emails (your sign-up code, password resets, licence emails). Brevo is based in the European Union, so your name and email address may be processed outside India.
- **Google Fonts** supplies the website's lettering, so your browser connects to Google to fetch it.

We share information with the authorities only when Indian law requires it.

## On your computer

The website keeps you logged in using your browser's storage; logging out removes it. The app keeps a log-in token (never your password), the lessons and videos it has downloaded, and your child's programs, all on your computer; logging out of the app removes the token. We use no advertising or tracking cookies.

## Keeping it safe

Everything travels over an encrypted connection (HTTPS). Passwords are stored only in a scrambled form that can't be turned back into the password. Access to our systems is limited and protected, backups are kept in private storage, and the copies kept away from our server are encrypted. If a breach ever affects your information, we will tell you and the Data Protection Board of India as the law requires, and explain what happened and what we are doing about it.

## How long we keep it

- **Your account and your child's details:** until you delete your account, or ask us to delete them.
- **Purchase records:** as long as tax and accounting laws require (generally up to 8 years), even after the account is deleted.
- **Technical records:** a few weeks, unless needed to look into a security problem.
- **Backups:** deleted data also leaves our backups within 60 days.

## Your rights

Under the Digital Personal Data Protection Act, 2023 you can:

- **See** a summary of the information we hold about you and your child, and who we have shared it with;
- **Correct, complete or update** it (most of it you can change yourself on your account page);
- **Delete** it: delete your account from your account page, or ask us;
- **Withdraw your consent** at any time, as easily as you gave it, by deleting your account or your child's details, or by writing to us. Withdrawing doesn't affect what was done before;
- **Nominate** someone to use these rights for you if you die or can't act yourself;
- **Complain** to our Grievance Officer (below), and then to the Data Protection Board of India.

To use any of these rights, write to the Grievance Officer from your account's email address.

## Grievance Officer {#grievance}

{grievance_officer}

We acknowledge every complaint within 48 hours and resolve it within 30 days. If you aren't satisfied, you can complain to the Data Protection Board of India (about your data), or to the National Consumer Helpline: call 1915, or visit consumerhelpline.gov.in (about a purchase).

#! Purchases, delivery, cancellation and refunds {#purchases}

{purchases}

## Changes to this page

If we change these policies we will update the date at the top, and email account holders about important changes before they apply.

## Contact

Questions about your data or a purchase? Email {email}, or use the [Contact page](/contact).

{business_details}`;

const TERMS = `# Terms of use

Last updated: 12 November 2026

These terms are an agreement between you and Ada The Coder for using this website and the Ada The Coder app. Please read them with our [policies](/privacy), which explain how we look after your information and how purchases and refunds work. By creating an account or buying a licence, you agree to these terms.

## 1. Who we are

Ada The Coder ("we", "us") runs this website and the Ada The Coder app, which teach children to write Python. Our details are at the end of this page.

## 2. Who can use it

Accounts are for parents, guardians and teachers aged 18 or over who live in India or elsewhere. Children use the app through a grown-up's account and don't need one of their own. By creating an account you confirm that you are 18 or over, that you are the parent or legal guardian of the children who will use it (or have their parent's permission, for teachers), and that you are responsible for how they use Ada The Coder. We recommend a grown-up stays nearby while young children use any computer.

## 3. Your account

Give true details when you sign up, and keep your password private. You are responsible for what happens with your account. Tell us straight away at {email} if you think someone else has used it. You can delete your account at any time from your account page.

## 4. Free and paid themes

The app is free to download, and some themes are free. Every paid theme opens its first lessons free, so your child can try it first. Buying a licence unlocks every lesson of that theme. A licence is for your family's own, non-commercial use on the computers in your home, is linked to your account, and can't be sold, shared or passed on. Schools and groups: write to us for a group licence.

## 5. Prices and payment

Prices are shown on your account page and on the pay page before you pay, in Indian rupees, and include any taxes we have to charge. Payments are handled by Razorpay; we never see or store your card, UPI or bank details. A licence is a one-time payment, not a subscription: we never charge you again unless you choose to buy something new. If a price is ever shown wrongly, we will tell you before taking any payment.

## 6. Delivery

Themes are digital, so nothing is shipped. When a payment goes through, your licence code is shown on screen straight away, emailed to you and listed on your account page, and the app unlocks the theme by itself within a few minutes. If it doesn't, write to us and we'll unlock it.

## 7. Cancellation and refunds

You can cancel a purchase at any time before the payment is complete. Because a theme is unlocked and yours to keep as soon as its licence is issued, and you can try its free lessons first, we don't refund a purchase because of a change of mind once the licence has been issued. Payment mistakes and problems we can't fix are always refunded: see [purchases, delivery, cancellation and refunds](/privacy#purchases) for exactly when, and how long it takes.

## 8. Using the app and the lessons fairly

The app, lessons, videos, characters, pictures and music belong to us or to the people who licensed them to us, and are protected by copyright. You may use them for learning. Children may keep and share the programs they write themselves. Please don't copy, resell, publish or share our lessons, videos or characters, get round the licence checks, or use Ada The Coder for anything unlawful or harmful.

## 9. Your computer

The app needs a supported computer (shown on the website) and an internet connection to download lessons and check licences. It runs the Python programs children write on your computer, in a folder of its own.

## 10. Availability and changes

We work to keep the website and the lessons available and correct, and we add new lessons over time. Sometimes the service may be briefly unavailable, for example during updates. We may change or retire a theme; if we ever stop offering a paid theme you have bought, you keep the lessons already on your computer.

## 11. Our responsibility

We provide Ada The Coder with reasonable care and skill. As far as the law allows, we are not responsible for losses that weren't foreseeable, or for problems caused by your computer, internet connection or other software, and our total responsibility to you is limited to what you paid us in the 12 months before the claim. Nothing in these terms limits any responsibility that can't be limited by law, or your rights as a consumer under the Consumer Protection Act, 2019.

## 12. Ending your use

You can stop using Ada The Coder and delete your account at any time. We may suspend or close an account that seriously or repeatedly breaks these terms, after telling you why and giving you a chance to put it right where we can. If we close an account for no fault of yours, we will refund any licence you bought in the previous 12 months.

## 13. Complaints

If something isn't right, please tell us first so we can fix it. Our Grievance Officer acknowledges every complaint within 48 hours and resolves it within 30 days:

{grievance_officer}

You can also contact the National Consumer Helpline (call 1915, or visit consumerhelpline.gov.in), or file a complaint with a Consumer Commission.

## 14. Law

These terms are governed by the laws of India. Disputes are decided by the courts {courts}, without affecting your right to approach a Consumer Commission or any rights you have under the laws of the country where you live.

## 15. Changes to these terms

If we change these terms we'll update the date at the top, and email account holders about important changes before they apply. Changes never affect a licence you have already bought.

## 16. Contact

{business_details}`;

export const SITE_TEXT_DEFAULTS: Record<string, string> = {
  friends_title: 'Meet your coding friends',
  friends_intro: 'Three friends keep your child company in every lesson, so learning to code never feels lonely or scary.',
  friends_items: j([
    { name: 'Ada', role: 'Your guide', text: 'Ada explains each new idea in short, simple sentences and sets a small challenge to try.', pic: '/img/ada.webp' },
    { name: 'Byte the owl', role: 'The helper', text: 'Stuck? Byte gives a hint, and when code goes wrong he explains the bug in words kids understand.', pic: '/img/byte.webp' },
    { name: 'Tom', role: 'The cheer & fix-it buddy', text: 'When the code works, Tom cheers with a big wave. When something goes wrong, he pops up to show what to fix.', pic: '/img/tom-friend.webp' },
  ]),

  learn_title: 'What your child will learn',
  learn_intro: 'Lessons with examples and videos that build on each other, from a first hello to loops, lists and even teaching the computer to see with OpenCV. New lessons arrive in the app automatically.',
  learn_items: j([
    { label: 'Level 1', title: 'First steps', text: 'Meet Python, make the computer say hello, print fun messages with emojis and leave secret notes that only coders can read.', makes: 'A hello card for friends' },
    { label: 'Level 2', title: 'Boxes and data', text: 'Store names and numbers in variables like labelled boxes, do quick maths, and join words together to build fun sentences.', makes: 'A pocket calculator' },
    { label: 'Level 3', title: 'Choices and loops', text: 'Ask the player questions, let the program make decisions with if and else, and use loops to repeat things automatically.', makes: 'A quiz and a rocket countdown' },
    { label: 'Level 4', title: 'Bigger adventures', text: 'Create your own commands with functions, keep lists of favourite things, fix errors calmly and even give the computer robot eyes.', makes: 'A photo flipper' },
  ]),
  learn_note: 'Every lesson comes with a short video, six worked examples to try, and a code editor where children run their own programs and see the results straight away.',

  steps_title: 'Up and coding in three steps',
  steps_intro: 'A grown-up sets things up once, which takes about five minutes. After that, your child can open the app and carry on by themselves, at their own pace, whenever they like.',
  steps_bubble: 'Hoo! Setting up takes just a few minutes. Watch our step-by-step installation tutorial [here]({install_video}).',
  steps_items: j([
    { title: 'Make a parent account', text: "It only takes your name, your email and a password. Your child doesn't need an account or an email address. You can add their first name too, so we can greet them." },
    { title: 'Install the app', text: 'Download Ada The Coder for {computers} from your account page and install it like any other program. After that, it works even without the internet.' },
    { title: 'Let them create', text: "Each lesson starts with a short video, then examples to click, run and change. When the code works there's a big celebration, and when something goes wrong, a friendly message shows how to fix it." },
  ]),

  parents_title: 'Made with parents in mind',
  parents_ages: 'Children aged 6 and 7 learn best with a grown-up sitting next to them for the first few lessons. Most 8 to 11 year olds can work through them on their own.',
  parents_tip: 'Hoo! When code breaks, I explain what happened and how to fix it.',
  parents_facts: j([
    { title: 'Real Python, not blocks.', text: 'Children type the same language professional programmers use, one small step at a time.' },
    { title: 'Friendly error messages.', text: 'When code breaks, Byte explains what went wrong in words a child understands.' },
    { title: 'Works offline.', text: 'After installing, the app works without the internet. It checks for new lessons when it can.' },
    { title: 'Healthy screen breaks.', text: 'After {break_minutes} minutes of active coding, the app pauses for "The Quick Reset": rest the eyes, stretch, breathe and drink some water. Only real use counts, so time away from the screen doesn\'t.' },
    { title: 'Nothing to manage.', text: "New lessons and updates are delivered to the app you've already installed." },
  ]),

  faq_title: 'Questions from parents',
  faq_items: j([
    { q: 'My child has never coded. Is that OK?', a: 'Yes. The first lesson starts with one line of code, and every lesson explains new words before using them.' },
    { q: 'Does my child need to be good at reading?', a: 'Lessons use short sentences and big text. Younger children who are still learning to read will enjoy it most with a grown-up reading alongside them.' },
    { q: 'How long does a lesson take?', a: 'Each lesson is short: a video and a handful of small examples. Most children can finish one in a single sitting, and they can always stop and pick up where they left off.' },
    { q: 'What if my child gets stuck?', a: 'Every lesson has six worked examples to try before writing their own code. When something goes wrong, Byte the owl explains what happened and how to fix it in simple words, and the lesson video can be watched again at any time with the See video button.' },
    { q: 'Which computers does it work on?', a: "Windows 10 or 11. {mac} iPads, iPhones and Chromebooks aren't supported yet." },
    { q: 'What information do you keep about my child?', a: "Only what you choose to tell us when signing up: an optional first name and age. Your child's code and progress stay on your computer. Read the [privacy page](/privacy) for details." },
    { q: 'Will my child stay on the screen too long?', a: 'The app looks after this for you. After {break_minutes} minutes of active use, it pauses the lesson and shows "The Quick Reset", a short break in four steps: look at something far away to rest the eyes, do a few star-jumps or stretches, take three slow balloon breaths, and drink some water.\n\nOnly real use counts: typing code, clicking, moving the mouse or watching a lesson video. If your child leaves the computer, the count pauses, and after 10 minutes away it starts again from zero, because that was already a break.' },
    { q: 'How do updates work?', a: 'New lessons and videos download into the app by themselves. When a new version of the app is ready, the app shows a message and a grown-up can download it from this website.' },
  ]),

  policy_privacy: PRIVACY,
  policy_terms: TERMS,
};
