export type Language = 'en' | 'fa';

export interface LocaleData {
  dir: 'ltr' | 'rtl';
  brand: string;
  home: string;
  search: string;
  library: string;
  createPlaylist: string;
  likedSongs: string;
  popular: string;
  recentlyPlayed: string;
  searchPlaceholder: string;
  searching: string;
  noResults: string;
  play: string;
  pause: string;
  next: string;
  prev: string;
  shuffle: string;
  repeat: string;
  addToLibrary: string;
  settings: string;
  languageSelect: string;
  welcome: string;
  trySearching: string;
  themeSelect: string;
  lightMode: string;
  darkMode: string;
  createOfflinePlaylist: string;
  importPouyaMusic: string;
  bundleSuccess: string;
  bundleError: string;
  extractSuccess: string;
  extractError: string;
  creatingBundle: string;
  offlineBundles: string;
  trackInfo: string;
  album: string;
  artistTitle: string;
  trackTitle: string;
  aiCompanion: string;
  chatPlaceholder: string;
  send: string;
  streamLink: string;
  streamHelper: string;
  streamPlaceholder: string;
  aiPlaylistCreator: string;
  aiPlaylistPrompt: string;
  aiPlaylistPlaceholder: string;
  aiPlaylistGenerate: string;
  aiPlaylistGenerating: string;
  aiPlaylistSuggestions: string;
  login: string;
  signup: string;
  username: string;
  password: string;
  loginBtn: string;
  signupBtn: string;
  noAccount: string;
  hasAccount: string;
  explore: string;
  exploreDesc: string;
  profile: string;
  signOut: string;
  topGenres: string;
  topArtists: string;
  totalPlays: string;
  noStats: string;
  lab: string;
  upscale: string;
  aiDJ: string;
  neuralPlaylists: string;
  djStudio: string;
  audioLabSection: string;
  studioEngineGroup: string;
}

export const locales: Record<Language, LocaleData> = {
  en: {
    dir: 'ltr',
    brand: 'POUYA MUSIC',
    home: 'Home',
    search: 'Search',
    library: 'Your Library',
    createPlaylist: 'Create Playlist',
    likedSongs: 'Liked Songs',
    popular: 'Popular Now',
    recentlyPlayed: 'Recently Played',
    searchPlaceholder: 'Search artists, songs, albums, or paste audio URL...',
    searching: 'Searching library...',
    noResults: 'No results found',
    play: 'Play',
    pause: 'Pause',
    next: 'Next',
    prev: 'Previous',
    shuffle: 'Shuffle',
    repeat: 'Repeat',
    addToLibrary: 'Add to Library',
    settings: 'Settings',
    languageSelect: 'Language',
    themeSelect: 'Theme',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    welcome: 'Welcome back',
    trySearching: 'Search for artists, songs, or podcasts to get started.',
    createOfflinePlaylist: 'Offline Playlist Bundle',
    importPouyaMusic: 'Import .pouyamusic',
    bundleSuccess: 'Successfully bundled playlist!',
    bundleError: 'Error creating bundle',
    extractSuccess: 'Successfully imported playlist!',
    extractError: 'Error reading .pouyamusic file',
    creatingBundle: 'Creating bundle...',
    offlineBundles: 'Downloads',
    trackInfo: 'Track Details',
    album: 'Album',
    artistTitle: 'Artist',
    trackTitle: 'Title',
    aiCompanion: 'Smart Assistant',
    chatPlaceholder: 'Ask about this track, artist background, or acoustic details...',
    send: 'Send',
    streamLink: 'Stream Direct Link',
    streamHelper: 'Paste an audio URL and press Enter. It will be added to your playlist and played instantly.',
    streamPlaceholder: 'https://example.com/audio.mp3',
    aiPlaylistCreator: 'Daily Mixes',
    aiPlaylistPrompt: 'Select a mood or genre for your personalized mix',
    aiPlaylistPlaceholder: 'e.g., Chill ambient textures with deep bass for nighttime focus...',
    aiPlaylistGenerate: 'Generate Mix',
    aiPlaylistGenerating: 'Curating tracks for your mix...',
    aiPlaylistSuggestions: 'Curated Presets',
    login: 'Login',
    signup: 'Sign Up',
    username: 'Username',
    password: 'Password',
    loginBtn: 'Sign In',
    signupBtn: 'Create Account',
    noAccount: 'Need an account? Sign up',
    hasAccount: 'Already have an account? Sign In',
    explore: 'Explore',
    exploreDesc: 'A continuous stream of tracks based on your listening habits',
    profile: 'Profile',
    signOut: 'Sign Out',
    topGenres: 'Top Genres',
    topArtists: 'Top Artists',
    totalPlays: 'Total Plays',
    noStats: 'Listen to more tracks to generate personal stats!',
    lab: 'Spatial Audio & DSP',
    upscale: 'Hi-Res Lossless Audio',
    aiDJ: 'Smart Assistant',
    neuralPlaylists: 'Daily Mixes',
    djStudio: 'Equalizer & Mix',
    audioLabSection: 'Audio Quality',
    studioEngineGroup: 'Curated Discovery',
  },
  fa: {
    dir: 'rtl',
    brand: 'پویا موزیک',
    home: 'خانه',
    search: 'جستجو',
    library: 'کتابخانه شما',
    createPlaylist: 'ساخت پلی‌لیست',
    likedSongs: 'آهنگ‌های پسندیده',
    popular: 'محبوب‌ترین‌ها',
    recentlyPlayed: 'پخش‌های اخیر',
    searchPlaceholder: 'جستجوی آهنگ، هنرمند، آلبوم یا نشانی فایل صوتی...',
    searching: 'در حال جستجو در آرشیو...',
    noResults: 'نتیجه‌ای یافت نشد',
    play: 'پخش',
    pause: 'توقف',
    next: 'بعدی',
    prev: 'قبلی',
    shuffle: 'پخش تصادفی',
    repeat: 'تکرار',
    addToLibrary: 'افزودن به کتابخانه',
    settings: 'تنظیمات',
    languageSelect: 'زبان',
    themeSelect: 'پوسته',
    lightMode: 'روشن',
    darkMode: 'تیره',
    welcome: 'خوش آمدید',
    trySearching: 'برای شروع، نام هنرمند، قطعه یا آلبوم را جستجو کنید.',
    createOfflinePlaylist: 'پلی‌لیست آفلاین',
    importPouyaMusic: 'وارد کردن فایل .pouyamusic',
    bundleSuccess: 'پلی‌لیست با موفقیت ساخته شد!',
    bundleError: 'خطا در ساخت پلی‌لیست',
    extractSuccess: 'پلی‌لیست با موفقیت استخراج شد!',
    extractError: 'خطا در خواندن فایل',
    creatingBundle: 'در حال ذخیره‌سازی بسته...',
    offlineBundles: 'دانلودها',
    trackInfo: 'شناسنامه و مشخصات',
    album: 'آلبوم',
    artistTitle: 'هنرمند',
    trackTitle: 'عنوان اثر',
    aiCompanion: 'دستیار هوشمند',
    chatPlaceholder: 'درباره این قطعه، ساختار یا سبک موسیقی سوال بپرسید...',
    send: 'ارسال',
    streamLink: 'پخش مستقیم پیوند صوتی',
    streamHelper: 'یک آدرس اینترنتی فایل صوتی وارد کنید تا فوراً به جریان پخش افزوده شود.',
    streamPlaceholder: 'https://example.com/audio.mp3',
    aiPlaylistCreator: 'میکس‌های روزانه',
    aiPlaylistPrompt: 'حال‌وهوا، حس یا سبک مورد نظر را انتخاب کنید',
    aiPlaylistPlaceholder: 'مثلاً: موسیقی امبینت و آرامش‌بخش برای تمرکز...',
    aiPlaylistGenerate: 'ساخت میکس روزانه',
    aiPlaylistGenerating: 'در حال گردآوری و هماهنگ‌سازی قطعات...',
    aiPlaylistSuggestions: 'پیشنهادهای ویژه',
    login: 'ورود',
    signup: 'ثبت‌نام',
    username: 'نام کاربری',
    password: 'رمز عبور',
    loginBtn: 'ورود به حساب کاربری',
    signupBtn: 'ساخت حساب کاربری',
    noAccount: 'حساب کاربری ندارید؟ ثبت‌نام کنید',
    hasAccount: 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید',
    explore: 'کشف موسیقی',
    exploreDesc: 'پیشنهادهای پیوسته متناسب با سلیقه شنیداری شما',
    profile: 'پروفایل',
    signOut: 'خروج از حساب',
    topGenres: 'سبک‌های پرشنونده',
    topArtists: 'هنرمندان محبوب',
    totalPlays: 'مجموع دفعات پخش',
    noStats: 'با گوش دادن به قطعات بیشتر، آمار سلیقه شنیداری شما تکمیل می‌شود.',
    lab: 'صدای فراگیر (Spatial Audio)',
    upscale: 'کیفیت استودیویی Lossless',
    aiDJ: 'دستیار هوشمند',
    neuralPlaylists: 'میکس‌های روزانه',
    djStudio: 'اکولایزر و میکس',
    audioLabSection: 'کیفیت صدا',
    studioEngineGroup: 'بخش‌های برگزیده',
  }
};
