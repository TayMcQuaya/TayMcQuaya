// Everything on the home page comes from this file.
// Add a project: copy one entry, change the fields, done.
//
// type:   game | app | tool | site | learn
// tier:   'front' shows as a big row under "Selected work", anything else goes on the wall
// state:  'live' | 'dev' (in development) | 'client'
// hide:   true keeps the entry in this file but off the page. Delete the word to show it again.
// check:  a note for you, never shown on the page (things to confirm before going live)

const gh = (repo) => `https://github.com/TayMcQuaya/${repo}`;

export const SITE = {
  repos: 94,           // your number, 10 Nov 2026
  since: 2024,
};

// The pixel artwork that the cubes rebuild in the Pixel art section: one cube per pixel.
// grid = how many real pixels the drawing has across; crop = the part to use, in those pixels [left, top, right, bottom].
export const VOXEL_ART = { src: 'images/art18.png', grid: 64, crop: [20, 16, 40, 49] };

// Repos that are not on the page but still count in "Where the days went". Anything not listed counts as a tool.
export const REPO_TYPES = {
  'taymcquaya.com': 'site', 'Comic-M': 'app', 'Comic-M-Backend': 'app', 'Panelhaus-Lofie': 'app',
  MyGame2D: 'game', GameTest: 'game', 'AL-Fit-Landing': 'site', 'Shaping-Luck-Landing': 'site',
};

export const NOW = {
  lead: {
    id: 'panel-haus',
    name: 'Panel Haus',
    role: 'Co-founder',
    text: 'My main work. A comic studio that runs in the browser: write the beat, pick a layout, place your characters, letter it, export it as a page, a book or a video clip.',
    image: 'assets/tex/panel-haus.jpg',
    link: { label: 'Open panel.haus', href: 'https://panel.haus/' },
    check: 'You said earlier to keep Panel Haus off the site. Delete this block if that still holds.',
  },
  dev: [
    { id: 'shuden', name: 'Shūden', type: 'game', poster: 'assets/tex/shuden.jpg', text: 'First-person horror maze in a Japanese train station. Story mode, a level editor, 30 achievements and three endings.' },
    { id: 'girls-rumble', name: 'Girls Rumble', type: 'game', poster: 'assets/tex/girls-rumble.jpg', text: '3D fighting game in the browser. Play against the CPU or a friend on the same keyboard.' },
    { id: 'blackpine', name: 'Blackpine Trail', type: 'game', poster: 'assets/tex/blackpine.jpg', text: 'Grid-crawler horror in pixel art. A forest at night, then a school.' },
  ],
};

export const PROJECTS = [
  // ---------- Selected work ----------
  { id: 'shaping-luck', poster: 'assets/tex/shaping-luck.jpg', name: 'Shaping Luck', type: 'app', year: 2026, tier: 'front', state: 'client', repo: 'Shaping-Luck',
    text: 'Quick 1-on-1 video networking. You join a lobby, get matched with another member for a 4-minute video chat, then rate it and keep in touch. I built the app, plus the landing page with waitlist and Stripe checkout.',
    tags: ['Video', 'Stripe', 'Client work'],
    links: [{ label: 'Open the app', href: 'https://app.shapingluck.com/' }],
    check: 'Client work. No names on the page yet. Add them once the people behind it agree.' },

  { id: 'hopline', name: 'HopLine', type: 'game', year: 2026, tier: 'front', state: 'live', repo: 'HopLine',
    text: 'Hop a voxel critter across roads, rivers and train tracks. Four biomes, unlockable characters, a day and night cycle, and three chiptune tracks generated in code. The whole game is one HTML file, built for the Orynth game cup.',
    tags: ['Three.js', 'One file', 'Game jam'],
    video: 'assets/vid/hopline.mp4', poster: 'assets/tex/hopline.jpg',
    links: [{ label: 'Play', href: 'https://hopline.xyz/', play: true }, { label: 'Code', href: gh('HopLine') }] },

  { id: 'claude-den', poster: 'assets/tex/claude-den.jpg', name: 'Claude Den', type: 'app', year: 2026, tier: 'front', state: 'live', repo: 'Claude-Den',
    text: 'A desktop app that turns Claude Code into a little worker in a 3D office. When Claude reads a file or runs a command, the avatar walks to the right desk and gets on with it.',
    tags: ['Electron', 'Three.js', 'Desktop'],
    links: [{ label: 'Code', href: gh('Claude-Den') }] },

  { id: 'coach-al', poster: 'assets/tex/coach-al.jpg', name: "Coach Al's Wellness Studio", type: 'app', year: 2026, tier: 'front', state: 'client', repo: 'AL_Fitness_Hub',
    text: 'A wellness app for iOS, Android and the web, built for a coaching client. It starts with an assessment, then tracks daily check-ins and streaks. One React Native codebase, three platforms.',
    tags: ['React Native', 'Expo', 'Client work'],
    links: [{ label: 'Visit burntout.app', href: 'https://burntout.app/' }],
    check: 'Client work. Confirm the client is fine with being shown.' },

  { id: 'floppytromp', name: 'Floppy Tromp', type: 'game', year: 2024, tier: 'front', state: 'live', repo: 'FloppyTromp',
    text: 'Election season satire built in Unity. Hand drew every character, shipped in a week with Web3 wallet gating baked in. Gates are open now, free for everyone to play.',
    tags: ['Unity', 'Pixel art', 'Web3'],
    video: 'assets/vid/floppytromp.mp4', poster: 'assets/tex/floppytromp.jpg',
    links: [{ label: 'Play', href: 'https://taymcquaya.github.io/FloppyTromp/', play: true }, { label: 'Watch on YouTube', href: 'https://www.youtube.com/watch?v=2KdoXTuNmQY' }] },

  { id: 'whatsnote', name: 'WhatsNote', type: 'app', year: 2026, tier: 'front', state: 'live', repo: 'WhatsNote',
    text: 'Got tired of abusing WhatsApp groups for to do lists, so I built my own. Each chat is a project, each message is a task. Portable .exe, no install, no account, no internet needed.',
    tags: ['Electron', 'Windows', 'Productivity'],
    video: 'assets/vid/whatsnote.mp4', poster: 'assets/tex/whatsnote.jpg',
    links: [{ label: 'Download', href: 'https://github.com/TayMcQuaya/WhatsNote/releases' }, { label: 'Code', href: gh('WhatsNote') }] },

  { id: 'javascript-journey', name: 'JavaScript Journey', type: 'learn', year: 2025, tier: 'front', state: 'live', repo: 'Javascript-Journey',
    text: 'Built for beginners who want to learn JavaScript without paying for another course. 10 modules, 47 lessons, and the code runs right in the page. Completely free.',
    tags: ['JavaScript', 'Course', 'Free'],
    video: 'assets/vid/javascript.mp4', poster: 'assets/tex/javascript.jpg',
    links: [{ label: 'Open the course', href: 'https://taymcquaya.github.io/Javascript-Journey/' }] },

  { id: 'zombieshooter', name: 'Zombieshooter 3D', type: 'game', year: 2025, tier: 'front', state: 'live', repo: 'Zombieshooter3D',
    text: 'A browser based 3D zombie shooter. Point, click, survive. Built for speed, runs right in your tab, no install needed.',
    tags: ['Three.js', 'Shooter', 'Browser'],
    video: 'assets/vid/zombieshooter.mp4', poster: 'assets/tex/zombieshooter.jpg',
    links: [{ label: 'Play', href: 'https://taymcquaya.github.io/Zombieshooter3D/', play: true }] },

  // ---------- Games ----------
  { id: 'road-fighter', name: 'Road Fighter', type: 'game', year: 2026, repo: 'Road-Racer',
    text: "A tribute to Konami's 1984 arcade racer, written in plain JavaScript on a canvas.",
    video: 'assets/vid/roadfighter.mp4', poster: 'assets/tex/roadfighter.jpg',
    links: [{ label: 'Code', href: gh('Road-Racer') }] },
  { id: 'pixel-overworld', hide: true, name: 'Pixel Overworld', type: 'game', year: 2026,
    text: 'A Pokémon-style overworld that plays inside a Game Boy drawn in CSS. One HTML file.', links: [] },
  { id: 'kagero', hide: true, name: 'Kagerō', type: 'game', year: 2026, state: 'dev',
    text: 'One-room prototype of an anime horror puzzle game in the look of an old PC-98.', links: [] },
  { id: 'lunar-walk', hide: true, name: 'Lunar Surface Walk', type: 'game', year: 2026,
    text: 'A first-person walk on the moon with real lunar gravity and a jetpack.', links: [] },
  { id: 'descent', name: 'Descent', type: 'game', year: 2026, repo: 'Hellnight-Website',
    text: "A 3D horror website built with Three.js. Pure showcase, just for fun. Step into the dark, find what's hidden, and try not to lose your nerve.",
    video: 'assets/vid/decent.mp4', poster: 'assets/tex/decent.jpg',
    links: [{ label: 'Code', href: gh('Hellnight-Website') }] },
  { id: 'mad-scientist', hide: true, name: '2D Mad Scientist', type: 'game', year: 2024, repo: 'UnityExoGame',
    text: 'A Unity game from 2024 that runs in the browser.', links: [{ label: 'Code', href: gh('UnityExoGame') }] },
  { id: 'fun-speak', hide: true, name: 'Fun Speak', type: 'game', year: 2025, repo: 'Fun-Speak',
    text: 'A Unity build for the browser.', links: [{ label: 'Code', href: gh('Fun-Speak') }] },
  { id: 'color-match', hide: true, name: 'Color Match', type: 'game', year: 2024, repo: 'Color-Match-HTML-Game',
    text: 'A small colour game in HTML, with a Telegram version.', links: [{ label: 'Code', href: gh('Color-Match-HTML-Game') }] },
  { id: 'country-alphabet', hide: true, name: 'Country Alphabet Challenge', type: 'game', year: 2025, repo: 'Country-Alphabet-Challenge',
    text: 'A quiz game for the browser.', links: [{ label: 'Code', href: gh('Country-Alphabet-Challenge') }] },

  // ---------- Learning ----------
  { id: 'ippo', poster: 'assets/tex/ippo.jpg', name: 'Ippo Japanese', type: 'learn', year: 2026,
    text: 'A phone web app for learning Japanese in short sessions: 30 lessons and review cards that bring back the words you forget.', links: [] },
  { id: 'csharp-pocket', poster: 'assets/tex/csharp-pocket.jpg', name: 'C# Pocket Course', type: 'learn', year: 2026,
    text: 'A 46-lesson beginner C# course for the phone, with review cards.', links: [] },

  // ---------- Apps ----------
  { id: 'openopen', name: 'OpenOPen', type: 'app', year: 2024, repo: 'OpenOPen',
    text: 'A fully functional text editor built from scratch in my early vibe coding days, a personal stress test to see how far I could push the limits. Works just fine.',
    video: 'assets/vid/openopen.mp4', poster: 'assets/tex/openopen.jpg',
    links: [{ label: 'Download', href: 'https://github.com/TayMcQuaya/OpenOPen/tree/executable' }] },
  { id: 'transscript', name: 'Transscript', type: 'app', year: 2026, repo: 'Transscript',
    text: 'A Windows app that turns video or audio into text with Whisper.', links: [{ label: 'Code', href: gh('Transscript') }] },
  { id: 'telegram-bridge', name: 'Claude Telegram Bridge', type: 'app', year: 2025, repo: 'Claude-Telegram-Bridge',
    text: 'Control Claude Code from your phone through Telegram.', links: [{ label: 'Code', href: gh('Claude-Telegram-Bridge') }] },

  // ---------- Tools ----------
  { id: 'pic2gif', poster: 'assets/tex/pic2gif.jpg', name: 'Pic2GIF', type: 'tool', year: 2025, repo: 'pic2gif-converter',
    text: 'Turns a set of images into an animated GIF, right in the browser.',
    links: [{ label: 'Open', href: 'https://taymcquaya.github.io/pic2gif-converter/' }] },
  { id: 'image-scaler', hide: true, name: 'Image Scaler', type: 'tool', year: 2025, repo: 'Image-Upscaler',
    text: 'Upscales images in the browser.', links: [{ label: 'Code', href: gh('Image-Upscaler') }] },
  { id: 'hardware-test', poster: 'assets/tex/hardware-test.jpg', name: 'Computer Hardware Test', type: 'tool', year: 2025, repo: 'Computer-Hardware-Test',
    text: "A web page that tests a computer's basic hardware.",
    links: [{ label: 'Open', href: 'https://taymcquaya.github.io/Computer-Hardware-Test/' }] },
  { id: 'animation-library', poster: 'assets/tex/animation-library.jpg', name: 'Animation Library', type: 'tool', year: 2024, repo: 'AnimationLibrary',
    text: 'A CSS animation library with a demo page.',
    links: [{ label: 'Open', href: 'https://taymcquaya.github.io/AnimationLibrary/' }] },
  { id: 'cipherlock', name: 'CipherLock', type: 'tool', year: 2025, repo: 'CipherLock',
    text: 'AES-256 file encryption with a password, as a Windows .exe.', links: [{ label: 'Code', href: gh('CipherLock') }] },
  { id: 'clipboard-manager', hide: true, name: 'Clipboard Manager', type: 'tool', year: 2025, repo: 'Clipboard-Manager',
    text: 'Clipboard history for Windows.', links: [{ label: 'Code', href: gh('Clipboard-Manager') }] },
  { id: 'pdf-merger', hide: true, name: 'PDF Merger', type: 'tool', year: 2025, repo: 'PDF-Merger',
    text: 'Drag and drop PDF merger with a dark interface.', links: [{ label: 'Code', href: gh('PDF-Merger') }] },
  { id: 'desktop-organizer', hide: true, name: 'Desktop Organizer', type: 'tool', year: 2024, repo: 'Desktop-Cleaner',
    text: 'Sorts the files on your desktop into folders by type.', links: [{ label: 'Code', href: gh('Desktop-Cleaner') }] },
  { id: 'gdrive-uploader', hide: true, name: 'Drive Folder Uploader', type: 'tool', year: 2024, repo: 'G-Drive-Uploader',
    text: 'Right-click a folder to upload it to Google Drive.', links: [{ label: 'Code', href: gh('G-Drive-Uploader') }] },
  { id: 'tv-static', hide: true, name: 'TV Static', type: 'tool', year: 2024, repo: 'TV-Static',
    text: 'A retro TV static effect for the web.', links: [{ label: 'Code', href: gh('TV-Static') }] },
  { id: 'wallet-integration', name: 'Solana Wallet Kit', type: 'tool', year: 2025, repo: 'wallet-integration',
    text: 'Guide and code for wallet connect, balances and token swaps on Solana.', links: [{ label: 'Code', href: gh('wallet-integration') }] },
  { id: 'google-signin', hide: true, name: 'Google Sign-in Template', type: 'tool', year: 2025, repo: 'Auth-LogIn',
    text: 'A login template in Next.js and Firebase.', links: [{ label: 'Code', href: gh('Auth-LogIn') }] },

  // ---------- Sites ----------
  { id: 'tradebychat', poster: 'assets/tex/tradebychat.jpg', name: 'Trade by Chat', type: 'site', year: 2025, repo: 'TGBOT-Website',
    text: 'Waitlist site with its own backend for a Telegram trading bot.', links: [{ label: 'Code', href: gh('TGBOT-Website') }] },
  { id: 'firecats', poster: 'assets/tex/firecats.jpg', name: 'FireCats AI', type: 'site', year: 2024, repo: 'FireCats-Website',
    text: 'A Web3 site with an AI assistant and an NFT gallery.', links: [{ label: 'Code', href: gh('FireCats-Website') }] },
  { id: 'bali-bliss', poster: 'assets/tex/bali-bliss.jpg', name: 'Bali Bliss Travels', type: 'site', year: 2025, repo: 'BaliBlissTravels',
    text: 'A travel agency site with booking.', links: [{ label: 'Code', href: gh('BaliBlissTravels') }] },
  { id: 'dr-omon', hide: true, name: 'Dr. Omon', type: 'site', year: 2024, repo: 'Dr.Omon-Website',
    text: 'A multi-page site with research, team and donation pages.', links: [{ label: 'Code', href: gh('Dr.Omon-Website') }] },
  { id: 'exoworks', hide: true, name: 'ExoWorks', type: 'site', year: 2025, repo: 'Exo-Works',
    text: 'A one-page site.', links: [{ label: 'Code', href: gh('Exo-Works') }] },
  { id: 'banksy', hide: true, name: 'Banksy', type: 'site', year: 2024, repo: 'banksy-website',
    text: 'A one-page site.', links: [{ label: 'Code', href: gh('banksy-website') }] },
  { id: 'team-murica', hide: true, name: 'Team Murica', type: 'site', year: 2025, repo: 'WebsiteTest',
    text: 'A one-page site.', links: [{ label: 'Code', href: gh('WebsiteTest') }] },
];

export const ART = [
  'art1.png', 'art2.png', 'art3.png', 'art4.png', 'art5.gif', 'art6.gif', 'art7.gif', 'art8.gif', 'art09.gif',
  'art10.gif', 'art11.gif', 'art12.png', 'art13.png', 'art14.gif', 'art15.gif', 'art16.gif', 'art17.png',
  'art18.png', 'art19.png', 'art20.png', 'art21.png', 'art22.gif', 'art23.gif', 'art24.gif', 'art25.png', 'art26.Png',
];
