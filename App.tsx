import React, { useEffect, useState, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useAudioEngine, AudioEngineProvider } from "./AudioEngine";
import { LiveBackground } from "./LiveBackground";
import { ThreeVisualizer } from "./ThreeVisualizer";
import { RecommendationEngine } from "./RecommendationEngine";
import { Track, VisualizerMode, StreamSourceType } from "./types";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Search,
  Zap,
  Home,
  Library,
  Heart,
  ThumbsDown,
  Plus,
  Globe,
  Music,
  Sun,
  Moon,
  Settings,
  Download,
  Upload,
  Loader2,
  Info,
  X,
  MessageSquare,
  ListPlus,
  Send,
  Sliders,
  Lock,
  PictureInPicture2,
  Maximize2,
  Trash2,
  Share2,
  User,
  Compass,
  Menu,
  LogOut,
  Radio,
  Layers,
  Youtube,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { locales, Language } from "./locales";
import remarkGfm from "remark-gfm";

import ReactMarkdown from "react-markdown";

import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { PlayerFooter } from "./components/layout/PlayerFooter";
import { SettingsModal } from "./components/modals/SettingsModal";
import { ProfileModal } from "./components/modals/ProfileModal";
import { TrackDetailsModal } from "./components/modals/TrackDetailsModal";
import { LocalMusicStore } from "./LocalMusicStore";
import { isDesktop } from "./src/lib/api";
import { CoreBridge } from "./src/lib/coreBridge";
import {
  migrateWebPrefsOnce,
  syncNext,
  syncPlay,
  syncPrev,
  syncRepeat,
  syncShuffleToggle,
  syncVolume,
} from "./src/lib/playbackSync";

const LocalWorld = React.lazy(() => import("./LocalWorld").then(m => ({ default: m.LocalWorld })));

const DJStudio = React.lazy(() =>
  import("./DJStudio").then((m) => ({ default: m.DJStudio })),
);
const AudioLab = React.lazy(() =>
  import("./AudioLab").then((m) => ({ default: m.AudioLab })),
);

interface AuthOverlayProps {
  title: string;
  language: "fa" | "en";
  accessCode: string;
  setAccessCode: (code: string) => void;
  handleAuthorize: () => void;
}

const AuthOverlay: React.FC<AuthOverlayProps> = ({
  title,
  language,
  accessCode,
  setAccessCode,
  handleAuthorize,
}) => (
  <div className="absolute inset-0 z-50 backdrop-blur-md bg-white/60 dark:bg-black/80 flex flex-col items-center justify-center p-6 text-center rounded-2xl">
    <Lock className="w-10 h-10 text-purple-500 mb-4 animate-bounce" />
    <h4 className="font-bold text-slate-800 dark:text-white mb-2 tracking-tight">
      {title}
    </h4>
    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6 font-medium">
      {language === "fa"
        ? "برای استفاده از این بخش نیاز به کد دسترسی دارید."
        : "Access code required for this module."}
    </p>
    <div className="flex flex-col gap-3 w-full max-w-[240px]">
      <input
        type="password"
        placeholder="Enter Code..."
        value={accessCode}
        onChange={(e) => setAccessCode(e.target.value)}
        className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 text-center text-slate-900 dark:text-white font-medium"
        onKeyDown={(e) => e.key === "Enter" && handleAuthorize()}
      />
      <button
        onClick={handleAuthorize}
        className="bg-purple-600 text-white rounded-xl py-2.5 text-sm font-bold shadow-lg hover:bg-purple-500 transition-all ease-out cursor-pointer"
      >
        {language === "fa" ? "تایید و فعالسازی" : "Authorize Now"}
      </button>
    </div>
  </div>
);

function AppContent() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    volume,
    currentTime,
    duration,
    playTrack: enginePlayTrack,
    setCurrentTrack,
    pause,
    resume,
    setVolume,
    seek,
    setOnTrackEnded,
    getAnalysis,
    is8D,
    toggle8D,
    panSpeed,
    setPanSpeed,
    bassBoost,
    toggleBassBoost,
    playbackRate,
    setPlaybackRate,
    audioRef
  } = useAudioEngine();

  const dragControls = useDragControls();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [language, setLanguage] = useState<Language>(() => {
    const cached = localStorage.getItem("spotify_clone_lang");
    return (cached as Language) || "fa";
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "audio" | "system">("general");
  const [streamSource, setStreamSourceState] = useState<StreamSourceType>(() => {
    const saved = localStorage.getItem("pouya_stream_source");
    if (saved === "spotify" || saved === "youtube" || saved === "both") {
      return saved;
    }
    return "both";
  });

  const setStreamSource = (source: StreamSourceType) => {
    setStreamSourceState(source);
    localStorage.setItem("pouya_stream_source", source);
  };

  // Strict Stream Source Guard: If user chooses "youtube", reject Spotify/iTunes; if "spotify", reject YouTube
  const playTrack = (track: Track) => {
    // Local offline files are always permitted
    if (track.isLocal) {
      if (isDesktop()) {
        const queue = activePlaylistRef.current.length
          ? activePlaylistRef.current
          : [track];
        const idx = Math.max(0, queue.findIndex((t) => t.id === track.id));
        void syncPlay(track, queue, idx, streamSource);
      }
      enginePlayTrack(track);
      return;
    }

    const isYT = track.source === "youtube" || track.id.startsWith("yt-") || track.url.includes("/yt/");
    const isSpotify = track.source === "spotify" || track.id.startsWith("itunes-") || track.url.includes("apple.com") || track.url.includes("mzstatic");

    if (streamSource === "youtube" && !isYT && isSpotify) {
      console.warn("Strict Stream Source Guard: Refusing track", track.title);
      showToast(
        language === "fa"
          ? "پخش نشد: حالت تحویل محتوا با فرمت این قطعه سازگار نیست."
          : "Playback unavailable under the current stream engine mode."
      );
      return;
    }

    if (streamSource === "spotify" && !isSpotify && isYT) {
      console.warn("Strict Stream Source Guard: Refusing track", track.title);
      showToast(
        language === "fa"
          ? "پخش نشد: حالت تحویل محتوا با فرمت این قطعه سازگار نیست."
          : "Playback unavailable under the current stream engine mode."
      );
      return;
    }

    // Pass strict query param for YouTube URLs so the backend never falls back to Apple/iTunes
    let trackToPlay = track;
    if (streamSource === "youtube" && isYT && track.url.includes("/yt/play/") && !track.url.includes("strict=true")) {
      const separator = track.url.includes("?") ? "&" : "?";
      trackToPlay = {
        ...track,
        url: `${track.url}${separator}strict=true`,
      };
    }

    if (isDesktop()) {
      const queue = activePlaylistRef.current.length
        ? activePlaylistRef.current
        : [trackToPlay];
      const idx = Math.max(
        0,
        queue.findIndex((t) => t.id === trackToPlay.id),
      );
      void syncPlay(trackToPlay, queue, idx, streamSource);
    }

    enginePlayTrack(trackToPlay);
  };
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (
      (localStorage.getItem("spotify_clone_theme") as "dark" | "light") ||
      "dark"
    );
  });

  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dj_studio_auth") === "true";
    }
    return false;
  });
  const [accessCode, setAccessCode] = useState("");

  const handleAuthorize = () => {
    if (accessCode.toUpperCase() === "MICHAELJACKSON") {
      setIsAuthorized(true);
      localStorage.setItem("dj_studio_auth", "true");
      setAccessCode("");
    } else {
      showToast(language === "fa" ? "کد اشتباه است!" : "Invalid code!");
    }
  };

  const l = locales[language];

  // Dynamically configure document content rules LTR or RTL
  useEffect(() => {
    document.documentElement.setAttribute("dir", l.dir);
    document.documentElement.lang = language;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("spotify_clone_lang", language);
    localStorage.setItem("spotify_clone_theme", theme);
  }, [language, theme, l.dir]);

  const [activeTab, setActiveTab] = useState<
    "home" | "search" | "library" | "offline" | "ai" | "dj" | "ai-playlist" | "explore" | "lab"
  >("home");
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [exploreTracks, setExploreTracks] = useState<Track[]>([]);
  const [exploreOffset, setExploreOffset] = useState<number>(0);
  const [isExploreLoading, setIsExploreLoading] = useState<boolean>(false);
  const exploreEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsTabLoading(true);
    const timer = setTimeout(() => setIsTabLoading(false), 450);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const [curatedTracks, setCuratedTracks] = useState<Track[]>([]);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);

  // AI Playlist States
  const [aiPlaylistPrompt, setAiPlaylistPrompt] = useState("");
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);
  const [generatedPlaylistData, setGeneratedPlaylistData] = useState<{
    name: string;
    tracks: any[];
  } | null>(null);

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [prevVolume, setPrevVolume] = useState<number>(0.8);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>("particles");
  const [isMiniPlayer, setIsMiniPlayer] = useState<boolean>(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipSize, setPipSize] = useState({ width: 320, height: 440 });

  const togglePiP = async () => {
    if (pipWindow) {
      pipWindow.close();
      return;
    }

    // @ts-ignore
    if ("documentPictureInPicture" in window) {
      try {
        // @ts-ignore
        const pip = await window.documentPictureInPicture.requestWindow({
          width: 320,
          height: 440,
        });

        // Copy styles and fonts extremely robustly and safely by deep cloning
        [...document.querySelectorAll("link, style")].forEach((el) => {
          try {
            const clone = el.cloneNode(true);
            pip.document.head.appendChild(clone);
          } catch (e) {
            // Safe fallback
          }
        });

        pip.document.body.style.margin = "0";
        pip.document.body.style.overflow = "hidden";
        pip.document.body.style.backgroundColor = "#020617"; // slate-950
        pip.document.documentElement.classList.add("dark");

        const handleResize = () => {
          setPipSize({ width: pip.innerWidth, height: pip.innerHeight });
        };
        handleResize();
        pip.addEventListener("resize", handleResize);

        pip.addEventListener("pagehide", () => {
          setPipWindow(null);
          pip.removeEventListener("resize", handleResize);
        });

        setPipWindow(pip);
      } catch (err) {
        console.error("PiP failed", err);
        showToast(
          language === "fa"
            ? 'لطفاً برنامه را در "تب جدید" باز کنید تا تصویر-در-تصویر کار کند.'
            : "Please open the app in a new tab for Picture-in-Picture to work.",
        );
        // Fallback to inside player
        setIsMiniPlayer(true);
      }
    } else {
      showToast(
        language === "fa"
          ? "مرورگر شما از پنجره شناور سراسری پشتیبانی نمی‌کند، نسخه داخل برنامه فعال شد."
          : "Document PiP is not supported by your browser, falling back to in-app float.",
      );
      setIsMiniPlayer(true);
    }
  };

  // Online music search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  // AI Chat state
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<
    { role: "user" | "model"; text: string }[]
  >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("spotify_clone_chat");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isBundling, setIsBundling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pouyaInputRef = useRef<HTMLInputElement>(null);

  const [localWorldTracks, setLocalWorldTracks] = useState<Track[]>([]);
  const activePlaylistRef = useRef<Track[]>([]);

  const handlePlayLocalPlaylist = (tracks: Track[], index: number) => {
    setLocalWorldTracks(tracks);
    activePlaylistRef.current = tracks;
    playTrack(tracks[index]);
  };

  const [selectedTrackMeta, setSelectedTrackMeta] = useState<Track | null>(
    null,
  );

  // Initialization
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const tracks = await RecommendationEngine.getRecommendations(streamSource);
        if (tracks.length > 0) {
          setCuratedTracks(tracks);
        }
      } catch (e) {
        console.error("Failed to fetch recommendations", e);
      }
    };

    if (activeTab === "home") {
      fetchRecommendations();
    }

    // Set up an interval to refresh recommendations every 2 minutes for dynamic updates
    const interval = setInterval(
      () => {
        fetchRecommendations();
      },
      2 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [activeTab, streamSource]);

  useEffect(() => {
    // Check pre-saved liked tracks
    const savedLiked = localStorage.getItem("spotify_clone_liked");
    if (savedLiked) {
      try {
        setLikedTracks(JSON.parse(savedLiked));
      } catch (e) {}
    }

    // Initialize local playlists track count for sidebar badge
    try {
      const localPlaylists = LocalMusicStore.getPlaylists();
      const uniqueIds = new Set(localPlaylists.flatMap((p) => p.trackIds));
      if (uniqueIds.size > 0 && localWorldTracks.length === 0) {
        setLocalWorldTracks(new Array(uniqueIds.size).fill(null) as any);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (activeTab === "explore") {
      // If exploreTracks is empty or contains tracks not matching the current strict source, reload
      const needsReload =
        exploreTracks.length === 0 ||
        (streamSource === "youtube" && exploreTracks.some((t) => t.source !== "youtube")) ||
        (streamSource === "spotify" && exploreTracks.some((t) => t.source !== "spotify"));

      if (needsReload) {
        const loadInitialExplore = async () => {
          setIsExploreLoading(true);
          try {
            const initialTracks = await RecommendationEngine.getInfiniteRecommendations(0, 10, [], streamSource);
            setExploreTracks(initialTracks);
            setExploreOffset(10);
          } catch (e) {
            console.error("Error loading explore tracks", e);
          } finally {
            setIsExploreLoading(false);
          }
        };
        loadInitialExplore();
      }
    }
  }, [activeTab, exploreTracks.length, streamSource]);

  // Handle incoming share links via URL query params
  useEffect(() => {
    const processSharedLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const trackId = params.get("track");
      const customUrl = params.get("url");

      if (customUrl) {
        const title = params.get("title") || "Shared Stream";
        const artist = params.get("artist") || "Web Link";
        const coverUrl =
          params.get("cover") ||
          "https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&q=80&w=400&h=400";

        const track: Track = {
          id: `custom-url-${Date.now()}`,
          title: decodeURIComponent(title),
          artist: decodeURIComponent(artist),
          url: decodeURIComponent(customUrl),
          coverUrl: decodeURIComponent(coverUrl),
          isLocal: false,
        };
        setSelectedTrackMeta(track);
        // Clean URL to prevent re-processing
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
        return;
      }

      if (trackId && trackId.startsWith("yt-")) {
        const idStr = trackId.replace("yt-", "");
        const track: Track = {
          id: trackId,
          title: "Shared YouTube Track",
          artist: "YouTube Stream",
          url: `/yt/play/${idStr}`,
          duration: 0,
          coverUrl: `https://i.ytimg.com/vi/${idStr}/hqdefault.jpg`,
          isLocal: false,
          category: "YouTube",
        };
        setSelectedTrackMeta(track);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (trackId && trackId.startsWith("itunes-")) {
        const idStr = trackId.replace("itunes-", "");
        try {
          const response = await fetch(
            `/api/proxy/itunes/lookup?id=${idStr}`,
          );
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const item = data.results[0];
            const track: Track = {
              id: trackId,
              title: item.trackName || "Unknown",
              artist: item.artistName || "Unknown Details",
              url: item.previewUrl,
              duration: 30,
              coverUrl: item.artworkUrl100?.replace("100x100bb", "600x600bb"),
              isLocal: false,
              category: item.primaryGenreName,
            };
            setSelectedTrackMeta(track);
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
          }
        } catch (e) {
          console.error("Failed to load shared iTunes track", e);
        }
      }
    };

    processSharedLink();
  }, [setSelectedTrackMeta]);

  // Register track plays with RecommendationEngine
  useEffect(() => {
    if (currentTrack && isPlaying) {
      const timer = setTimeout(() => {
        RecommendationEngine.registerPlay(currentTrack);
      }, 5000); // Register after 5 seconds of playing
      return () => clearTimeout(timer);
    }
  }, [currentTrack, isPlaying]);

  // Set "Chicago" by Michael Jackson as default track if nothing is playing and no share link was present
  useEffect(() => {
    if (!currentTrack && curatedTracks.length > 0) {
      // Find Chicago by Michael Jackson or first MJ track
      const chicago =
        curatedTracks.find(
          (t) =>
            t.title.toLowerCase().includes("chicago") &&
            t.artist.toLowerCase().includes("michael jackson"),
        ) ||
        curatedTracks.find((t) =>
          t.title.toLowerCase().includes("chicago"),
        ) ||
        curatedTracks[0];

      if (chicago) {
        setCurrentTrack(chicago);
      }
    }
  }, [curatedTracks, currentTrack, setCurrentTrack]);

  const handleLikeTrack = (track: Track) => {
    const exists = likedTracks.find((t) => t.id === track.id);
    let nextLiked: Track[];
    if (exists) {
      nextLiked = likedTracks.filter((t) => t.id !== track.id);
    } else {
      nextLiked = [...likedTracks, track];
    }
    setLikedTracks(nextLiked);
    localStorage.setItem(
      "spotify_clone_liked",
      JSON.stringify(nextLiked.filter((t) => !t.isLocal)),
    );
    if (isDesktop()) {
      void CoreBridge.setLiked(nextLiked).catch((e) =>
        console.warn("liked sync failed", e),
      );
    }
    // Register like with recommendation engine
    RecommendationEngine.registerLike(track, !exists);
  };

  const handleDislikeTrack = (track: Track) => {
    if (currentTrack && currentTrack.id === track.id) {
      handlePlayNext(true);
    }
    RecommendationEngine.registerLike(track, false);
    RecommendationEngine.registerSkip(track);
    setExploreTracks((prev) => prev.filter((t) => t.id !== track.id));
    const msg =
      language === "fa"
        ? `موزیک نپسندیده شد 🚫 از فید شما حذف و الگوریتم بروزرسانی شد.`
        : `Disliked 🚫 Removed from feed. Neural model updated!`;
    showToast(msg);
  };

  const exploreStateRef = useRef({ offset: exploreOffset, tracks: exploreTracks });
  useEffect(() => {
    exploreStateRef.current = { offset: exploreOffset, tracks: exploreTracks };
  }, [exploreOffset, exploreTracks]);

  const loadMoreExploreTracks = async () => {
    if (isExploreLoadingRef.current) return;
    setIsExploreLoading(true);
    try {
      const { offset, tracks } = exploreStateRef.current;
      // Only exclude the most recent 30 tracks to prevent starvation
      const currentIds = tracks.slice(-30).map((t) => t.id);
      let nextTracks = await RecommendationEngine.getInfiniteRecommendations(offset, 10, currentIds, streamSource);
      
      // If we completely run out, loop the offset back to 0
      if (nextTracks.length === 0 && offset > 0) {
        nextTracks = await RecommendationEngine.getInfiniteRecommendations(0, 10, [], streamSource);
        setExploreOffset(10);
      } else {
        setExploreOffset(prev => prev + 10);
      }
      
      if (nextTracks.length > 0) {
        setExploreTracks(prev => {
          // Prevent exact duplicates in the array
          const newTracks = nextTracks.filter(n => !prev.some(p => p.id === n.id));
          return [...prev, ...newTracks];
        });
      }
    } catch (e) {
      console.error("Error loading more explore tracks", e);
    } finally {
      setIsExploreLoading(false);
    }
  };

  const isExploreLoadingRef = useRef(isExploreLoading);
  useEffect(() => {
    isExploreLoadingRef.current = isExploreLoading;
  }, [isExploreLoading]);

  // Auto Infinite Scroll Observer for Explore view
  useEffect(() => {
    if (activeTab !== "explore" || isTabLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isExploreLoadingRef.current) {
          loadMoreExploreTracks();
        }
      },
      { threshold: 0.05, rootMargin: "300px" }
    );

    const currentTarget = exploreEndRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [activeTab, isTabLoading]);

  const handleAddToPlaylist = (track: Track) => {
    if (generatedPlaylistData) {
      if (generatedPlaylistData.tracks.some(t => t.id === track.id)) {
        showToast(language === "fa" ? "موزیک قبلاً در پلی‌لیست هوشمند وجود دارد" : "Track already in AI Playlist");
        return;
      }
      const updatedTracks = [...generatedPlaylistData.tracks, track];
      setGeneratedPlaylistData({
        ...generatedPlaylistData,
        tracks: updatedTracks
      });
      showToast(language === "fa" ? "به پلی‌لیست هوشمند اضافه شد" : "Added to AI Playlist");
    } else {
      setGeneratedPlaylistData({
        name: language === "fa" ? "پلی‌لیست من" : "My Explore Playlist",
        tracks: [track]
      });
      showToast(language === "fa" ? "پلی‌لیست ساخته و موزیک اضافه شد" : "AI Playlist created & track added");
    }
  };

  const handleShareTrack = async (track: Track) => {
    if (track.isLocal) {
      showToast(
        language === "fa"
          ? "امکان اشتراک‌گذاری فایل‌های محلی وجود ندارد."
          : "Cannot share local files.",
      );
      return;
    }

    let shareUrl = window.location.origin + window.location.pathname + "?";
    if (track.id.startsWith("itunes-") || track.id.startsWith("curated-")) {
      shareUrl += "track=" + encodeURIComponent(track.id);
    } else if (track.id.startsWith("custom-url-")) {
      shareUrl +=
        "url=" +
        encodeURIComponent(track.url) +
        "&title=" +
        encodeURIComponent(track.title) +
        "&artist=" +
        encodeURIComponent(track.artist) +
        "&cover=" +
        encodeURIComponent(track.coverUrl);
    } else {
      // Base fallback
      shareUrl += "track=" + encodeURIComponent(track.id);
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(
        language === "fa"
          ? "لینک آهنگ در کلیپ‌بورد کپی شد."
          : "Track link copied to clipboard.",
      );
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  const handleDownloadTrack = async (track: Track) => {
    if (!track) return;
    showToast(
      language === "fa"
        ? `آماده‌سازی دانلود «${track.title}» با کیفیت اورجینال...`
        : `Preparing high-quality download for "${track.title}"...`
    );

    try {
      let downloadUrl = "";
      const isYT = track.url && (track.url.includes("/yt/play/") || track.url.includes("/yt/stream/"));
      const isYTId = track.id && (track.id.startsWith("yt-") || track.id.startsWith("youtube-") || /^[A-Za-z0-9_-]{11}$/.test(track.id));

      if (isYT) {
        // Extract video ID from URL
        const match = track.url.match(/\/(?:play|stream)\/([A-Za-z0-9_-]{11})/);
        if (match && match[1]) {
          downloadUrl = `/yt/download/${match[1]}?title=${encodeURIComponent(track.title)}`;
        }
      } else if (isYTId) {
        const cleanId = track.id.replace(/^(yt-|youtube-)/, "");
        if (/^[A-Za-z0-9_-]{11}$/.test(cleanId)) {
          downloadUrl = `/yt/download/${cleanId}?title=${encodeURIComponent(track.title)}`;
        }
      }

      if (!downloadUrl) {
        // Fallback for direct audio URLs or local files
        downloadUrl = track.url;
      }

      // Trigger native browser download with smooth anchor click
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${track.artist} - ${track.title}.mp3`.replace(/[/\\?%*:|"<>]/g, "");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast(
        language === "fa"
          ? `دانلود «${track.title}» آغاز شد`
          : `Download started for "${track.title}"`
      );
    } catch (err: any) {
      console.error("Download error:", err);
      showToast(
        language === "fa"
          ? `خطا در دریافت فایل دانلود: ${err.message || "نامشخص"}`
          : `Download error: ${err.message || "Unknown"}`
      );
    }
  };

  const handleGeneratePlaylist = async () => {
    if (!aiPlaylistPrompt.trim() || isGeneratingPlaylist) return;
    setIsGeneratingPlaylist(true);
    setGeneratedPlaylistData(null);
    try {
      const res = await fetch("/api/playlist-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPlaylistPrompt }),
      });
      const data = await res.json();
      if (data.status === "success" && data.playlist) {
        // Resolve tracks with iTunes
        const resolvedTracks = [];
        for (const item of data.playlist.tracks) {
          const query = encodeURIComponent(`${item.title} ${item.artist}`);
          try {
            const itunesRes = await fetch(
              `/api/proxy/itunes/search?term=${query}&entity=song&limit=1`,
            );
            const itunesData = await itunesRes.json();
            if (itunesData.results && itunesData.results.length > 0) {
              const song = itunesData.results[0];
              if (song.previewUrl) {
                resolvedTracks.push({
                  id: `itunes-${song.trackId}`,
                  title: song.trackName,
                  artist: song.artistName,
                  url: song.previewUrl,
                  duration: 30, // Preview length
                  coverUrl: song.artworkUrl100?.replace(
                    "100x100bb",
                    "600x600bb",
                  ),
                  isLocal: false,
                  category: song.primaryGenreName,
                  description: item.description,
                });
              }
            }
          } catch {
            // Fallback on error
          }
        }
        if (resolvedTracks.length > 0) {
          setGeneratedPlaylistData({
            name: data.playlist.playlistName || "AI Playlist",
            tracks: resolvedTracks,
          });
        } else {
          showToast(
            language === "fa"
              ? "آهنگ معتبری یافت نشد، لطفا دوباره تلاش کنید."
              : "No playable tracks found, please try again.",
          );
        }
      }
    } catch (e) {
      console.error("Failed to generate playlist", e);
    }
    setIsGeneratingPlaylist(false);
  };

    const handleOnlineSearch = async (e?: React.KeyboardEvent) => {
    if (e && e.key !== "Enter") return;
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
      if (
        searchQuery.trim().startsWith("http://") ||
        searchQuery.trim().startsWith("https://")
      ) {
        const urlStr = searchQuery.trim();
        let title = "Custom Stream";
        try {
          const urlObj = new URL(urlStr);
          title = urlObj.pathname.split("/").pop() || "Custom Stream";
        } catch (e) {}

        setSearchResults([
          {
            id: `custom-url-${Date.now()}`,
            title: decodeURIComponent(title),
            artist: "Web Stream",
            url: urlStr,
            coverUrl:
              "https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&q=80&w=400&h=400",
          },
        ]);
        setIsSearching(false);
        return;
      }

      let allTracks: Track[] = [];

      try {
        const fetchPromises: Promise<Response>[] = [];
        const isSpotifyEnabled = streamSource === "both" || streamSource === "spotify";
        const isYoutubeEnabled = streamSource === "both" || streamSource === "youtube";

        let itunesPromise: Promise<Response> | null = null;
        let ytPromise: Promise<Response> | null = null;

        if (isSpotifyEnabled) {
          itunesPromise = fetch(`/api/proxy/itunes/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=15`);
        }
        if (isYoutubeEnabled) {
          ytPromise = fetch(`/yt/api/search?q=${encodeURIComponent(searchQuery)}`);
        }

        const [itunesRes, ytRes] = await Promise.allSettled([
          itunesPromise || Promise.reject(new Error("Spotify search disabled")),
          ytPromise || Promise.reject(new Error("YouTube search disabled"))
        ]);

        let ytTracks: Track[] = [];
        let itunesTracks: Track[] = [];

        if (ytRes.status === 'fulfilled' && ytRes.value.ok) {
          const data = await ytRes.value.json();
          if (data.songs) {
            ytTracks = data.songs.map((item: any) => ({
              id: `yt-${item.videoId}`,
              title: item.title || "Unknown Title",
              artist: item.artist || "YouTube",
              url: `/yt/play/${item.videoId}`,
              duration: item.duration || 0,
              coverUrl: item.thumbnail || "https://images.unsplash.com/photo-1614113489855-66422ad300a4?w=600&q=80",
              isLocal: false,
              category: "YouTube",
              source: "youtube" as const,
            }));
          }
        }

        if (itunesRes.status === 'fulfilled' && itunesRes.value.ok) {
          const data = await itunesRes.value.json();
          if (data.results) {
            itunesTracks = data.results
              .map((item: any) => ({
                id: `itunes-${item.trackId}`,
                title: item.trackName || "Unknown Title",
                artist: item.artistName || "Unknown Artist",
                url: item.previewUrl,
                duration: 30, // iTunes preview duration is always ~30s
                coverUrl:
                  item.artworkUrl100?.replace(/100x100bb(\.[a-z]+)?/i, "1200x1200bb.jpg") ||
                  "https://images.unsplash.com/photo-1614113489855-66422ad300a4?w=600&q=80",
                isLocal: false,
                category: item.primaryGenreName,
                source: "spotify" as const,
              }))
              .filter((t: Track) => t.url);
          }
        }

        if (streamSource === "spotify") {
          allTracks = itunesTracks;
        } else if (streamSource === "youtube") {
          allTracks = ytTracks;
        } else {
          // Both: Interleave tracks gracefully
          const interleaved = [];
          const maxLen = Math.max(ytTracks.length, itunesTracks.length);
          for (let j = 0; j < maxLen; j++) {
            if (j < itunesTracks.length) interleaved.push(itunesTracks[j]);
            if (j < ytTracks.length) interleaved.push(ytTracks[j]);
          }
          allTracks = interleaved;
        }
      } catch (err) {
        console.error("Search failed", err);
      }

      setSearchResults(allTracks);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const scrollToChatBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "ai") {
      scrollToChatBottom();
    }
  }, [chatHistory, activeTab]);

  useEffect(() => {
    localStorage.setItem("spotify_clone_chat", JSON.stringify(chatHistory));
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isChatting) return;

    const userMsg = chatMessage.trim();
    setChatMessage("");
    setChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsChatting(true);

    let liveStats = null;
    if (getAnalysis) {
      try {
        const analysis = getAnalysis();
        liveStats = {
          bass: analysis.bass,
          mid: analysis.mid,
          treble: analysis.treble,
          volume: analysis.volume,
        };
      } catch (err) {
        console.error("Error retrieving dynamic audio stats:", err);
      }
    }

    try {
      const response = await fetch(
        (import.meta.env.VITE_API_BASE_URL || "") + "/api/chat-stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMsg,
            currentTrack,
            likedTracks,
            chatHistory,
            liveStats,
          }),
        },
      );

      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setChatHistory((prev) => [...prev, { role: "model", text: "" }]);

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "data: [DONE]") continue;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));
              if (data.type === "chunk" && data.text) {
                setChatHistory((prev) => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  newArr[lastIdx] = {
                    ...newArr[lastIdx],
                    text: newArr[lastIdx].text + data.text,
                  };
                  return newArr;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.error(e);
      setChatHistory((prev) => {
        const newArr = [...prev];
        const lastIdx = newArr.length - 1;
        if (newArr[lastIdx].role === "model" && newArr[lastIdx].text === "") {
          newArr.pop(); // Remove the empty bubble first before appending error
        }
        return [
          ...newArr,
          { role: "model", text: "Error connecting to the neural network." },
        ];
      });
    } finally {
      setIsChatting(false);
      setChatHistory((prev) => {
        const newArr = [...prev];
        const lastIdx = newArr.length - 1;
        if (
          lastIdx >= 0 &&
          newArr[lastIdx].role === "model" &&
          !newArr[lastIdx].text.trim()
        ) {
          newArr[lastIdx].text =
            language === "fa"
              ? "⚠️ سرور پاسخی نداد. لطفاً دوباره تلاش کنید."
              : "⚠️ Server returned no response. Please try again.";
        }
        return newArr;
      });
    }
  };

  // Playback traversal
  const activePlaylist = React.useMemo(() => {
    if (currentTrack) {
      if (
        activeTab === "ai-playlist" &&
        generatedPlaylistData?.tracks.some((t) => t.id === currentTrack.id)
      )
        return generatedPlaylistData.tracks;
      if (
        activeTab === "explore" &&
        exploreTracks.some((t) => t.id === currentTrack.id)
      )
        return exploreTracks;
      if (
        activeTab === "search" &&
        searchResults.some((t) => t.id === currentTrack.id)
      )
        return searchResults;
      if (
        activeTab === "library" &&
        likedTracks.some((t) => t.id === currentTrack.id)
      )
        return likedTracks;
      if (
        activeTab === "offline" &&
        localWorldTracks.some((t) => t.id === currentTrack.id)
      )
        return localWorldTracks;
      if (
        activeTab === "home" &&
        curatedTracks.some((t) => t.id === currentTrack.id)
      )
        return curatedTracks;

      // Fallbacks if not matching current tab
      if (exploreTracks.some((t) => t.id === currentTrack.id))
        return exploreTracks;
      if (generatedPlaylistData?.tracks.some((t) => t.id === currentTrack.id))
        return generatedPlaylistData.tracks;
      if (searchResults.some((t) => t.id === currentTrack.id))
        return searchResults;
      if (localWorldTracks.some((t) => t.id === currentTrack.id))
        return localWorldTracks;
      if (curatedTracks.some((t) => t.id === currentTrack.id))
        return curatedTracks;
      if (likedTracks.some((t) => t.id === currentTrack.id)) return likedTracks;
    }
    return activeTab === "ai-playlist" && generatedPlaylistData?.tracks
      ? generatedPlaylistData.tracks
      : activeTab === "explore" && exploreTracks.length > 0
        ? exploreTracks
        : activeTab === "search" && searchResults.length > 0
          ? searchResults
          : activeTab === "library"
            ? likedTracks
            : curatedTracks;
  }, [
    currentTrack,
    generatedPlaylistData,
    searchResults,
    curatedTracks,
    likedTracks,
    activeTab,
    exploreTracks,
    localWorldTracks
  ]);

  const skipInitialSync = useRef(true);
  useEffect(() => {
    activePlaylistRef.current = activePlaylist;
  }, [activePlaylist]);

  useEffect(() => {
    if (!isDesktop()) return;
    void migrateWebPrefsOnce();
    void LocalMusicStore.refreshFromCore().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isDesktop() || skipInitialSync.current) return;
    void syncShuffleToggle();
  }, [isShuffle]);

  useEffect(() => {
    if (!isDesktop() || skipInitialSync.current) return;
    void syncRepeat(isRepeat ? "all" : "off");
  }, [isRepeat]);

  useEffect(() => {
    if (!isDesktop() || skipInitialSync.current) return;
    void syncVolume(volume);
  }, [volume]);

  useEffect(() => {
    // Allow one paint so initial state does not flip Rust core defaults.
    const t = window.setTimeout(() => {
      skipInitialSync.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const handlePlayNext = async (isManualSkip: boolean = false) => {
    if (activePlaylist.length === 0) return;
    if (isManualSkip && currentTrack) {
      RecommendationEngine.registerSkip(currentTrack);
    }

    // Desktop: Rust core is the single writer for next-track selection.
    if (isDesktop()) {
      const snap = await syncNext(!isManualSkip);
      if (snap?.currentTrack) {
        if (!isManualSkip && isRepeat && currentTrack && snap.currentTrack.id === currentTrack.id) {
          playTrack(currentTrack);
          return;
        }
        playTrack(snap.currentTrack);
        return;
      }
      if (snap && !snap.currentTrack) {
        return;
      }
    }

    if (!isManualSkip && isRepeat && currentTrack) {
      playTrack(currentTrack);
      return;
    }

    let nextTrack: Track;
    if (isShuffle) {
      const idx = Math.floor(Math.random() * activePlaylist.length);
      nextTrack = activePlaylist[idx];
    } else {
      const currentIdx = activePlaylist.findIndex(
        (t) => t.id === currentTrack?.id,
      );
      if (currentIdx === -1 || currentIdx === activePlaylist.length - 1) {
        nextTrack = activePlaylist[0];
      } else {
        nextTrack = activePlaylist[currentIdx + 1];
      }
    }
    playTrack(nextTrack);
  };

  const handlePlayPrev = async (isManualSkip: boolean = false) => {
    if (activePlaylist.length === 0 || !currentTrack) return;
    if (isManualSkip && currentTrack) {
      RecommendationEngine.registerSkip(currentTrack);
    }

    if (isDesktop()) {
      const snap = await syncPrev();
      if (snap?.currentTrack) {
        playTrack(snap.currentTrack);
        return;
      }
    }

    const currentIdx = activePlaylist.findIndex(
      (t) => t.id === currentTrack.id,
    );
    let prevTrack: Track;
    if (currentIdx <= 0) {
      prevTrack = activePlaylist[activePlaylist.length - 1];
    } else {
      prevTrack = activePlaylist[currentIdx - 1];
    }
    playTrack(prevTrack);
  };

  useEffect(() => {
    setOnTrackEnded(() => {
      void handlePlayNext(false);
    });
  }, [activePlaylist, currentTrack, isShuffle, isRepeat]);

  // Desktop & OS MediaSession (Lock screen, TouchBar, Keyboard media keys)
  useEffect(() => {
    if (typeof window !== "undefined" && "mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || "Unknown Title",
        artist: currentTrack.artist || "Pouya Music",
        album: currentTrack.category || "Pouya Music",
        artwork: [
          {
            src: currentTrack.coverUrl || "https://images.unsplash.com/photo-1614113489855-66422ad300a4?w=600&q=80",
            sizes: "512x512",
            type: "image/jpeg"
          }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => {
        resume();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        pause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        handlePlayPrev(true);
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        handlePlayNext(true);
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined && audioRef?.current) {
          seek(details.seekTime);
        }
      });
    }
  }, [currentTrack, isPlaying, activePlaylist]);

  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };


  // Ultra-smooth 120fps progress bar direct DOM sync with zero layout thrash
  useEffect(() => {
    let frameId: number;
    let lastTime = -1;

    // Use live HTMLCollections (instant O(1) lookups, zero GC churn)
    const timeEls = document.getElementsByClassName("sync-time");
    const barEls = document.getElementsByClassName("sync-width");
    const thumbEls = document.getElementsByClassName("sync-left");
    const inputEls = document.getElementsByClassName("sync-val");

    const updateProgress = () => {
      const audio = audioRef?.current;
      if (audio) {
        const time = audio.currentTime;
        if (Math.abs(time - lastTime) > 0.025 || !audio.paused) {
          lastTime = time;
          const dur = duration || 1;
          const pct = Math.min(100, Math.max(0, (time / dur) * 100));
          const formatted = formatTime(time);

          for (let i = 0; i < timeEls.length; i++) {
            if (timeEls[i].textContent !== formatted) {
              timeEls[i].textContent = formatted;
            }
          }

          const pctStr = `${pct}%`;
          for (let i = 0; i < barEls.length; i++) {
            (barEls[i] as HTMLElement).style.width = pctStr;
          }

          for (let i = 0; i < thumbEls.length; i++) {
            (thumbEls[i] as HTMLElement).style.left = pctStr;
          }

          const timeStr = time.toString();
          for (let i = 0; i < inputEls.length; i++) {
            const el = inputEls[i] as HTMLInputElement;
            if (document.activeElement !== el && el.value !== timeStr) {
              el.value = timeStr;
            }
          }
        }
      }
      if (isPlaying) {
        frameId = requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
    if (isPlaying) {
      frameId = requestAnimationFrame(updateProgress);
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [audioRef, duration, isPlaying]);

  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs) || timeInSecs < 0) return "0:00";
    const minutes = Math.floor(timeInSecs / 60);
    const seconds = Math.floor(timeInSecs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleCreateOfflinePlaylist = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsBundling(true);
    try {
      const JSZip = (await import("jszip")).default;
      const jsmediatags = (await import("jsmediatags")).default;
      const zip = new JSZip();
      const tracksMeta: any[] = [];

      let iter = 0;
      const fileArray = Array.from(files) as File[];
      for (const file of fileArray) {
        if (!file.type.startsWith("audio/")) continue;

        const trackId = `offline-${Date.now()}-${iter++}`;
        const fileName = `${trackId}-${file.name}`;

        // Parse ID3 tags
        let title = file.name.replace(/\.[^/.]+$/, "");
        let artist = "Local Track";
        let album = "";
        let coverFilename: string | undefined = undefined;

        try {
          const tag: any = await new Promise((resolve) => {
            jsmediatags.read(file, {
              onSuccess: resolve,
              onError: () => resolve(null),
            });
          });

          if (tag && tag.tags) {
            if (tag.tags.title) title = tag.tags.title;
            if (tag.tags.artist) artist = tag.tags.artist;
            if (tag.tags.album) album = tag.tags.album;

            if (tag.tags.picture) {
              const { data, format } = tag.tags.picture;
              const u8 = new Uint8Array(data);
              const ext = format === "image/png" ? "png" : "jpg";
              coverFilename = `cover-${trackId}.${ext}`;
              zip.file(coverFilename, u8);
            }
          }
        } catch (e) {
          console.warn("Failed to read tags", e);
        }

        // Add file to zip
        zip.file(fileName, file);

        // Add metadata
        tracksMeta.push({
          id: trackId,
          title,
          artist,
          album,
          filename: fileName,
          duration: 0, // Assume 0 as we can't easily parse duration here
          coverFilename,
          coverUrl:
            "https://images.unsplash.com/photo-1614113489855-66422ad300a4?w=600&q=80",
          isLocal: true,
          category: "Offline",
        });
      }

      if (tracksMeta.length === 0) {
        setIsBundling(false);
        return;
      }

      zip.file("playlist.json", JSON.stringify({ tracks: tracksMeta }));

      const content = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my_playlist.pouyamusic`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(l.bundleSuccess);
    } catch (err) {
      console.error(err);
      showToast(l.bundleError);
    } finally {
      setIsBundling(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImportPouyaMusic = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const playlistMetaFile = zip.file("playlist.json");
      if (!playlistMetaFile) throw new Error("No playlist.json");

      const metaContent = await playlistMetaFile.async("string");
      const meta = JSON.parse(metaContent);

      const loadedTracks: Track[] = [];
      for (const t of meta.tracks) {
        const audioFile = zip.file(t.filename);
        if (audioFile) {
          const blob = await audioFile.async("blob");
          const url = URL.createObjectURL(blob);

          let coverUrl = t.coverUrl;
          if (t.coverFilename) {
            const coverFile = zip.file(t.coverFilename);
            if (coverFile) {
              const coverBlob = await coverFile.async("blob");
              coverUrl = URL.createObjectURL(coverBlob);
            }
          }

          loadedTracks.push({
            ...t,
            url,
            coverUrl,
          });
        }
      }

      if (loadedTracks.length > 0) {
        const newLiked = [
          ...likedTracks,
          ...loadedTracks.filter(
            (t) => !likedTracks.find((l) => l.id === t.id),
          ),
        ];
        setLikedTracks(newLiked);
        localStorage.setItem(
          "spotify_clone_liked",
          JSON.stringify(newLiked.filter((t) => !t.isLocal)),
        );
        showToast(l.extractSuccess);
        setActiveTab("library");
      }
    } catch (err) {
      console.error(err);
      showToast(l.extractError);
    } finally {
      if (pouyaInputRef.current) pouyaInputRef.current.value = "";
    }
  };

  // Common UI components
  const TrackList = ({
    tracks,
    emptyMsg,
  }: {
    tracks: Track[];
    emptyMsg: string;
  }) => {
    if (tracks.length === 0) {
      return (
        <div className="text-slate-500 font-medium py-10 text-center">
          {emptyMsg}
        </div>
      );
    }

    const handleTrackSelect = (track: Track) => {
      const isCurrent = currentTrack?.id === track.id;
      if (isCurrent) {
        if (isPlaying) pause();
        else resume();
      } else {
        playTrack(track);
      }
    };

    return (
      <div className="flex flex-col gap-1.5 w-full max-w-full mb-8 md:mb-12 px-1 py-1">
        {tracks.map((track, idx) => {
          const isCurrent = currentTrack?.id === track.id;
          const isLiked = likedTracks.some((t) => t.id === track.id);
          const isMenuOpen = openMenuTrackId === track.id;

          return (
            <div
              key={`${track.id}-${idx}`}
              onClick={() => handleTrackSelect(track)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleTrackSelect(track);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Play ${track.title} by ${track.artist}`}
              className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl group transition-all duration-200 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 relative ${
                isCurrent
                  ? "liquid-glass-card !bg-white/95 dark:!bg-white/[0.08] !border-cyan-500/40 dark:!border-cyan-400/40 shadow-sm"
                  : "hover:bg-slate-100/80 dark:hover:bg-white/[0.04] border border-transparent hover:border-slate-200/50 dark:hover:border-white/[0.06]"
              }`}
            >
              {/* Left Zone: Track Number / Play-on-hover, Cover Thumbnail, Title, Artist */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Track Number / Playing indicator */}
                <div className="w-5 text-center flex-shrink-0 text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                  {isCurrent && isPlaying ? (
                    <div className="flex items-end justify-center gap-0.5 h-3">
                      <span className="w-0.5 h-3 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-pulse" />
                      <span className="w-0.5 h-2 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-pulse delay-75" />
                      <span className="w-0.5 h-2.5 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-pulse delay-150" />
                    </div>
                  ) : (
                    <span className="group-hover:hidden">{idx + 1}</span>
                  )}
                  <span className="hidden group-hover:inline-block">
                    {isCurrent && isPlaying ? (
                      <Pause className="w-3.5 h-3.5 mx-auto text-cyan-600 dark:text-cyan-400 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 mx-auto text-slate-700 dark:text-slate-300 fill-current" />
                    )}
                  </span>
                </div>

                {/* Compact Album Thumbnail */}
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 rounded-lg sm:rounded-xl overflow-hidden bg-slate-200 dark:slate-800 ring-1 ring-black/5 dark:ring-white/10 shadow-xs">
                  <img
                    src={track.coverUrl}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    alt=""
                    loading="lazy"
                  />
                  {isCurrent && isLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" strokeWidth={1.75} />
                    </div>
                  )}
                </div>

                {/* Title & Artist */}
                <div className="min-w-0 pe-3">
                  <h4
                    className={`text-xs sm:text-sm font-semibold truncate ${
                      isCurrent
                        ? "text-cyan-600 dark:text-cyan-300 font-bold"
                        : "text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {track.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5 font-medium">
                    {track.artist}
                  </p>
                </div>
              </div>

              {/* Middle/Right Zone: Album Name, Duration, Heart Toggle, 3-dot Overflow */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0 text-slate-600 dark:text-slate-400 relative">
                {track.category && (
                  <span className="text-xs hidden md:block truncate max-w-[120px] font-medium text-slate-600 dark:text-slate-400">
                    {track.category}
                  </span>
                )}

                <span className="text-xs w-9 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 font-medium">
                  {formatTime(track.duration || 0)}
                </span>

                {/* Single Heart Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleLikeTrack(track);
                  }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                    isLiked
                      ? "text-rose-500 bg-rose-500/10"
                      : "text-slate-400 hover:text-rose-500 hover:bg-slate-200/50 dark:hover:bg-white/[0.08]"
                  }`}
                  title={isLiked ? "Unlike" : "Like"}
                  aria-label={isLiked ? "Unlike" : "Like"}
                >
                  <Heart
                    className="w-4 h-4 sm:w-4.5 sm:h-4.5"
                    strokeWidth={1.75}
                    fill={isLiked ? "currentColor" : "none"}
                  />
                </button>

                {/* Single 3-Dot Overflow Menu Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenMenuTrackId(isMenuOpen ? null : track.id);
                    }}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                      isMenuOpen
                        ? "text-slate-900 dark:text-white bg-slate-200/70 dark:bg-white/10"
                        : "text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.08]"
                    }`}
                    title="More options"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.75} />
                  </button>

                  {/* Clean Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1.5 w-48 rounded-xl liquid-glass-modal p-1.5 z-30 shadow-xl border border-slate-200/80 dark:border-white/10 flex flex-col gap-0.5 text-xs font-medium"
                    >
                      <button
                        onClick={() => {
                          setSelectedTrackMeta(track);
                          setOpenMenuTrackId(null);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 text-left transition-colors cursor-pointer"
                      >
                        <Info className="w-4 h-4" strokeWidth={1.75} />
                        <span>{l.trackInfo}</span>
                      </button>

                      <button
                        onClick={() => {
                          handleShareTrack(track);
                          setOpenMenuTrackId(null);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 text-left transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" strokeWidth={1.75} />
                        <span>{language === "fa" ? "اشتراک‌گذاری" : "Share"}</span>
                      </button>

                      <button
                        onClick={() => {
                          handleDownloadTrack(track);
                          setOpenMenuTrackId(null);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 text-left transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" strokeWidth={1.75} />
                        <span>{language === "fa" ? "دانلود قطعه" : "Download"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const TabSkeleton = () => (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-pulse">
      <div className="h-10 bg-slate-200 dark:bg-white/5 rounded-xl w-48 mb-4"></div>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-full h-16 md:h-20 bg-slate-200 dark:bg-white/5 rounded-xl flex items-center p-3 gap-4"
          >
            <div className="w-10 h-10 md:w-14 md:h-14 bg-slate-300 dark:bg-white/10 rounded-lg shrink-0"></div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-4 bg-slate-300 dark:bg-white/10 rounded w-1/3"></div>
              <div className="h-3 bg-slate-300 dark:bg-white/10 rounded w-1/4"></div>
            </div>
            <div className="w-8 h-8 bg-slate-300 dark:bg-white/10 rounded-full shrink-0"></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-transparent overflow-hidden font-sans relative">
      {/* TOAST SYSTEM */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 30, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-0 inset-x-0 z-[9999] flex justify-center pointer-events-none"
          >
            <div className="bg-slate-900/90 dark:bg-cyan-950/90 text-white dark:text-cyan-50 px-6 py-3 rounded-full shadow-[0_10px_30px_rgba(6,182,212,0.3)] backdrop-blur-md border border-cyan-500/30 font-medium text-sm md:text-base flex items-center gap-3">
              <Share2 className="w-4 h-4 text-cyan-400" strokeWidth={1.75} />
              {toastMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MUSIC REACTIVE LIVE BACKGROUND */}
      <LiveBackground theme={theme} />

      {/* MAIN DUAL-PANEL LAYOUT */}
      <div className="flex flex-1 overflow-hidden p-0 sm:p-2 md:p-4 gap-0 sm:gap-4 z-10 relative">
        {/* MODULAR NAV SIDEBAR */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => setActiveTab(tab as any)}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          likedCount={likedTracks.length}
          offlineCount={localWorldTracks.length}
          language={language}
          l={l}
          isPlaying={isPlaying}
        />

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 liquid-glass rounded-none sm:rounded-3xl overflow-y-auto overflow-x-hidden relative flex flex-col z-10 border-x-0 sm:border transition-all ease-out duration-300">
          {/* MODULAR HEADER */}
          <Header
            activeTab={activeTab}
            isPlaying={isPlaying}
            currentTrackTitle={currentTrack?.title}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenSettings={() => {
              setSettingsTab("general");
              setIsSettingsOpen(true);
            }}
            onOpenProfile={() => {
              setIsProfileLoading(true);
              setTimeout(() => {
                setIsProfileLoading(false);
                setIsProfileOpen(true);
              }, 350);
            }}
            username="Pouya Pro"
            language={language}
            l={l}
          />

          <div className="p-4 sm:p-6 pb-44 md:pb-48">
            <AnimatePresence mode="wait">
              {isTabLoading && (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                >
                  <TabSkeleton />
                </motion.div>
              )}

              {!isTabLoading && activeTab === "home" && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                >
                  {/* Hero Section / Now Playing */}
                  {currentTrack && (() => {
                    const isCurrentLiked = likedTracks.some((t) => t.id === currentTrack.id);
                    return (
                      <div className={`relative overflow-hidden mb-6 sm:mb-8 w-full rounded-3xl sm:rounded-[2rem] liquid-glass-hero p-5 sm:p-7 md:p-8 flex flex-col md:flex-row items-center md:items-center gap-6 sm:gap-8 lg:gap-10 transition-all duration-300 isolate border border-slate-200/80 dark:border-white/[0.08] ${
                        isPlaying ? "shadow-[0_20px_60px_-15px_rgba(6,182,212,0.25)]" : "shadow-lg"
                      }`}>
                        {/* Dynamic Ambient Background Extracted from Album Art */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 rounded-3xl sm:rounded-[2rem]">
                          <img
                            src={currentTrack.coverUrl}
                            alt=""
                            className="w-full h-full object-cover blur-3xl scale-150 opacity-30 dark:opacity-35 transform transition-all duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-white/95 via-white/85 to-white/60 dark:from-[#090a0f]/95 dark:via-[#090a0f]/85 dark:to-[#090a0f]/55" />
                        </div>

                        {/* Album Cover Chassis */}
                        <div className="relative flex-shrink-0 flex items-center justify-center my-auto">
                          <div
                            className={`group relative w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 lg:w-60 lg:h-60 aspect-square rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer ring-1 ring-white/30 dark:ring-white/15 transition-all duration-300 select-none z-10 shadow-2xl ${
                              isPlaying ? "scale-[1.02]" : "hover:scale-[1.01]"
                            }`}
                            onClick={() => (isPlaying ? pause() : resume())}
                          >
                            <img
                              src={currentTrack.coverUrl}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              alt={currentTrack.title}
                              referrerPolicy="no-referrer"
                            />

                            {/* Optical Specular Sheen */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-transparent pointer-events-none" />

                            {/* Hover Play/Pause Overlay */}
                            <div className="absolute inset-0 bg-black/40 flex opacity-0 group-hover:opacity-100 active:opacity-100 items-center justify-center transition-opacity duration-200 backdrop-blur-xs">
                              <div className="w-12 h-12 rounded-full liquid-glass-pill !bg-black/60 !border-white/30 flex items-center justify-center text-white shadow-2xl">
                                {isPlaying ? (
                                  <Pause className="w-6 h-6 fill-current" strokeWidth={1.75} />
                                ) : (
                                  <Play className="w-6 h-6 fill-current ml-0.5" strokeWidth={1.75} />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Track Details & Executive Controls */}
                        <div className="flex flex-col justify-center items-center md:items-start text-center md:text-left rtl:md:text-right flex-1 min-w-0 z-10 py-1 gap-2 sm:gap-3">
                          {/* Header Badge */}
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass-pill text-[11px] font-mono font-semibold shadow-xs">
                            <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,1)]" : "bg-slate-400"}`} />
                            <span className="text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                              {isPlaying ? (language === "fa" ? "در حال پخش" : "Now Playing") : (language === "fa" ? "موسیقی منتخب" : "Featured Track")}
                            </span>
                          </div>

                          {/* Display Title with Subtle Scrim / Shadow for Maximum Readability */}
                          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black tracking-tight text-slate-950 dark:text-white truncate w-full leading-tight drop-shadow-sm font-display">
                            {currentTrack.title}
                          </h2>

                          {/* Clean Typographic Metadata (NO pill overload!) */}
                          <div className="flex items-center gap-2 text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
                            <span className="hover:underline cursor-pointer">{currentTrack.artist}</span>
                            <span className="text-slate-400 dark:text-slate-500">•</span>
                            <span className="text-slate-500 dark:text-slate-400 font-normal text-xs sm:text-sm">
                              {currentTrack.category || (language === "fa" ? "موسیقی اختصاصی" : "Single")}
                            </span>
                            {isPlaying && (
                              <div className="hidden sm:flex items-end gap-0.5 h-3 ml-2">
                                <span className="w-0.5 h-3 bg-cyan-400 rounded-full animate-eq-1" />
                                <span className="w-0.5 h-2 bg-blue-400 rounded-full animate-eq-2" />
                                <span className="w-0.5 h-2.5 bg-violet-400 rounded-full animate-eq-3" />
                              </div>
                            )}
                          </div>

                          {/* Controls Row: Prominent Primary Play/Pause Button + Secondary Actions */}
                          <div className="flex items-center gap-2.5 sm:gap-3.5 mt-2 sm:mt-4 w-full justify-center md:justify-start">
                            {/* Prominent Circular Play Button */}
                            <button
                              onClick={() => (isPlaying ? pause() : resume())}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-[0_6px_20px_rgba(6,182,212,0.4)] ring-1 ring-white/30 active:scale-95 transition-all cursor-pointer shrink-0"
                              title={isPlaying ? "Pause" : "Play"}
                              aria-label={isPlaying ? "Pause" : "Play"}
                            >
                              {isPlaying ? (
                                <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" strokeWidth={1.75} />
                              ) : (
                                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" strokeWidth={1.75} />
                              )}
                            </button>

                            {/* Secondary Like Action */}
                            <button
                              onClick={() => handleLikeTrack(currentTrack)}
                              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
                                isCurrentLiked
                                  ? "bg-rose-500/15 text-rose-500 border-rose-500/30 shadow-xs"
                                  : "liquid-glass-pill text-slate-700 dark:text-slate-200 hover:text-rose-500 hover:bg-slate-200/50 dark:hover:bg-white/10"
                              }`}
                              title={isCurrentLiked ? "Liked" : "Like"}
                              aria-label={isCurrentLiked ? "Liked" : "Like"}
                            >
                              <Heart className="w-4.5 h-4.5 sm:w-5 sm:h-5" strokeWidth={1.75} fill={isCurrentLiked ? "currentColor" : "none"} />
                            </button>

                            {/* Secondary Share Action */}
                            <button
                              onClick={() => handleShareTrack(currentTrack)}
                              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl liquid-glass-pill flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
                              title="Share"
                              aria-label="Share"
                            >
                              <Share2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" strokeWidth={1.75} />
                            </button>

                            {/* Secondary Info / Overflow Action */}
                            <button
                              onClick={() => setSelectedTrackMeta(currentTrack)}
                              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl liquid-glass-pill flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
                              title={l.trackInfo}
                              aria-label={l.trackInfo}
                            >
                              <Info className="w-4.5 h-4.5 sm:w-5 sm:h-5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
                    {l.popular}
                  </h2>
                  <TrackList
                    tracks={curatedTracks}
                    emptyMsg="No trending tracks found at the moment."
                  />
                </motion.div>
              )}

              {!isTabLoading && activeTab === "explore" && (
                <motion.div
                  key="explore"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="flex flex-col items-center max-w-2xl mx-auto py-4"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {l.explore}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {l.exploreDesc}
                    </p>
                  </div>

                  {/* 3D Audio-Reactive Visualizer Canvas */}
                  <div className="w-full max-w-[540px] mb-8 rounded-2xl overflow-hidden glass-panel border border-slate-200/80 dark:border-white/[0.08] p-3 sm:p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-blue-500 animate-pulse" : "bg-slate-400"}`}></div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          {language === "fa" ? "ویژوالایزر سه‌بعدی زنده" : "3D Live Visualizer"}
                        </span>
                        {isPlaying && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                            LIVE
                          </span>
                        )}
                      </div>
                      {/* Mode switcher buttons */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.06] p-1 rounded-xl border border-slate-200/60 dark:border-white/[0.08]">
                        {(['particles', 'mesh', 'tunnel', 'wave'] as VisualizerMode[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setVisualizerMode(m)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium uppercase tracking-wide transition-colors ${
                              visualizerMode === m
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="w-full h-56 sm:h-72 rounded-xl overflow-hidden relative bg-black/60 border border-slate-200/40 dark:border-white/10">
                      <ThreeVisualizer mode={visualizerMode} theme={theme} />
                      <div className="absolute bottom-2.5 right-2.5 pointer-events-none bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-white/10">
                        INTERACTIVE 3D
                      </div>
                    </div>
                  </div>

                  {/* Vertical Post styled column */}
                  <div className="flex flex-col gap-6 w-full max-w-[460px] px-2">
                    {exploreTracks.map((track) => {
                      const isLiked = likedTracks.some((t) => t.id === track.id);
                      const isCurrent = currentTrack?.id === track.id;
                      const isTrackPlaying = isCurrent && isPlaying;

                      return (
                        <motion.div
                          key={track.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true, margin: "-100px" }}
                          transition={{ duration: 0.3 }}
                          onMouseEnter={() => {
                            RecommendationEngine.registerMicroInteraction(track, "hover");
                          }}
                          className={`relative overflow-hidden rounded-2xl liquid-glass-card ${
                            isTrackPlaying
                              ? "!border-cyan-400/50 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.7),0_0_28px_0_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/30"
                              : "hover:!border-cyan-400/30"
                          } transition-all duration-300`}
                        >
                          <div className="specular-rim-top" />
                          {/* Album cover / Poster precisely sized 1:1 Instagram style */}
                          <div
                            className="relative aspect-square w-full overflow-hidden cursor-pointer group"
                            onClick={() => {
                              if (isCurrent) {
                                isPlaying ? pause() : resume();
                              } else {
                                playTrack(track);
                              }
                            }}
                          >
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />

                            {/* Clean overlay */}
                            <div className="absolute inset-0 bg-black/35 flex opacity-0 group-hover:opacity-100 active:opacity-100 items-center justify-center transition-opacity duration-200">
                              <div className="w-14 h-14 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg scale-95 group-hover:scale-100 transition-transform duration-150">
                                {isTrackPlaying ? (
                                  <Pause className="w-6 h-6 fill-current" strokeWidth={1.75} />
                                ) : (
                                  <Play className="w-6 h-6 ml-0.5 fill-current" strokeWidth={1.75} />
                                )}
                              </div>
                            </div>

                            {/* Genre badge */}
                            <div className="absolute top-3.5 right-3.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white shadow-xs">
                              {track.category || "Pop"}
                            </div>

                            {/* Playing Live Wave bars */}
                            {isTrackPlaying && (
                              <div className="absolute bottom-3.5 left-3.5 flex gap-1 bg-black/60 px-2 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">
                                <div className="w-0.5 h-3 bg-white rounded-full animate-pulse"></div>
                                <div className="w-0.5 h-4 bg-white rounded-full animate-pulse delay-75"></div>
                                <div className="w-0.5 h-2 bg-white rounded-full animate-pulse delay-150"></div>
                                <div className="w-0.5 h-4 bg-white rounded-full animate-pulse delay-200"></div>
                              </div>
                            )}
                          </div>

                          {/* Info section below cover */}
                          <div className="p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start gap-4">
                              <div className="min-w-0">
                                <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                                  {track.title}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                  {track.artist}
                                </p>
                              </div>

                              <button
                                onClick={() => {
                                  if (isCurrent) {
                                    isPlaying ? pause() : resume();
                                  } else {
                                    playTrack(track);
                                  }
                                }}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                                  isTrackPlaying
                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white"
                                }`}
                              >
                                {isTrackPlaying ? <Pause className="w-4 h-4 fill-current" strokeWidth={1.75} /> : <Play className="w-4 h-4 ml-0.5 fill-current" strokeWidth={1.75} />}
                              </button>
                            </div>

                            {/* Recommendation Note */}
                            <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06]">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  track.explorationTag === "Familiar"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : track.explorationTag === "Adjacent"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                }`}>
                                  {track.explorationTag || "Discovery"}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">MATCH:</span>
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                    {track.confidenceScore || 75}%
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                                "{(language === "fa")
                                  ? (track.explorationTag === "Familiar"
                                      ? `همسو با سلیقه شما: ${track.recommendationReason}`
                                      : track.explorationTag === "Adjacent"
                                        ? `پیشنهاد نزدیک به سلیقه: ${track.recommendationReason}`
                                        : `کشف جدید و متفاوت: ${track.recommendationReason}`)
                                  : track.recommendationReason || "Suggested based on your late-night mood vibe"
                                }"
                              </p>
                            </div>

                            {/* Action Row */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                              {/* Like / Dislike Group */}
                              <div className="flex items-center gap-1.5">
                                {/* Like option */}
                                <button
                                  onClick={() => handleLikeTrack(track)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ease-out duration-500 ${
                                    isLiked
                                      ? "bg-pink-500/10 text-pink-500 border border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.2)]"
                                      : "bg-slate-100 dark:bg-white/5 hover:bg-pink-500/10 hover:text-pink-400 dark:hover:text-pink-400 text-slate-600 dark:text-slate-400 border border-transparent"
                                  }`}
                                >
                                  <Heart className="w-3.5 h-3.5" strokeWidth={1.75} fill={isLiked ? "currentColor" : "none"} />
                                  <span>{isLiked ? (language === "fa" ? "لایک شد" : "Liked") : (language === "fa" ? "لایک" : "Like")}</span>
                                </button>

                                {/* Dislike option */}
                                <button
                                  onClick={() => handleDislikeTrack(track)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-red-500/10 hover:text-red-400 dark:hover:text-red-400 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold transition-all ease-out duration-500 border border-transparent"
                                  title={language === "fa" ? "دیس‌لایک (مخالف سلیقه)" : "Dislike (Not for me)"}
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" strokeWidth={1.75} />
                                  <span>{language === "fa" ? "دیس‌لایک" : "Dislike"}</span>
                                </button>
                              </div>

                              {/* Add / Share Group */}
                              <div className="flex items-center gap-1.5">
                                {/* Add to playlist option */}
                                <button
                                  onClick={() => handleAddToPlaylist(track)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-cyan-500/10 hover:text-cyan-400 dark:hover:text-cyan-400 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold transition-all ease-out duration-500 border border-transparent"
                                >
                                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                                  <span>{language === "fa" ? "افزودن" : "Add"}</span>
                                </button>

                                {/* Share option */}
                                <button
                                  onClick={() => handleShareTrack(track)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-purple-500/10 hover:text-purple-400 dark:hover:text-purple-400 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold transition-all ease-out duration-500 border border-transparent"
                                >
                                  <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                                  <span>{language === "fa" ? "اشتراک" : "Share"}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Loader/Trigger indicator */}
                    <div ref={exploreEndRef} className="flex flex-col items-center justify-center py-8">
                      {isExploreLoading ? (
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" strokeWidth={1.75} />
                          <span className="text-xs font-semibold animate-pulse">
                            {language === "fa" ? "در حال لود هوشمند موزیک‌های جدید..." : "Neural recommendation engine fetching new waves..."}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 animate-pulse font-medium">
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-500/50" strokeWidth={1.75} />
                          <span>{language === "fa" ? "برای کشف بیشتر اسکرول کنید..." : "Scroll down to auto-load more tracks..."}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {!isTabLoading && activeTab === "search" && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="flex flex-col min-h-[60vh] relative"
                >
                  {/* Dynamic Search Box Container */}
                  <div
                    className="w-full max-w-4xl mx-auto z-20 sticky top-4 transition-all ease-out duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                    style={{
                      transform: searchQuery
                        ? "translateY(0) scale(1)"
                        : "translateY(25vh) scale(1.05)",
                    }}
                  >
                    <div className={`relative group perspective-1000 overflow-hidden ${searchQuery ? "rounded-full" : "rounded-3xl"}`}>
                      <div className="specular-rim-top" />
                      <Search
                        className={`absolute z-10 text-slate-500 dark:text-slate-400 transition-all ease-out duration-500 group-focus-within:text-cyan-500 ${searchQuery ? "w-5 h-5 start-5 top-1/2 -translate-y-1/2 group-focus-within:scale-110" : "w-8 h-8 start-8 top-1/2 -translate-y-1/2 group-focus-within:scale-110"}`}
                        strokeWidth={1.75}
                      />
                      <input
                        type="text"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleOnlineSearch}
                        placeholder={l.searchPlaceholder}
                        className={`w-full liquid-glass-input text-slate-900 dark:text-white font-semibold transition-all duration-300 outline-none placeholder-slate-400 dark:placeholder-slate-500 ${searchQuery ? "rounded-full py-3.5 ps-14 pe-28 text-base md:text-lg" : "rounded-3xl py-5 ps-20 pe-8 text-xl md:text-2xl"}`}
                      />
                      {searchQuery && (
                        <div className="absolute end-3 sm:end-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-2 z-10">
                          <button
                            onClick={() => {
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            title="Clear search"
                            aria-label="Clear search"
                          >
                            <X className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => handleOnlineSearch()}
                            className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-xs shadow-md hover:shadow-cyan-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            aria-label="Execute search"
                          >
                            <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>{language === "fa" ? "جستجو" : "Search"}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick Streaming Source Switcher in Search View */}
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 me-1">
                        {language === "fa" ? "منبع جستجو:" : "Search Source:"}
                      </span>
                      <button
                        onClick={() => {
                          setStreamSource("both");
                          if (searchQuery.trim()) setTimeout(() => handleOnlineSearch(), 50);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                          streamSource === "both"
                            ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-transparent"
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>{language === "fa" ? "ترکیبی (هر دو)" : "Hybrid (Both)"}</span>
                      </button>

                      <button
                        onClick={() => {
                          setStreamSource("spotify");
                          if (searchQuery.trim()) setTimeout(() => handleOnlineSearch(), 50);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                          streamSource === "spotify"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-transparent"
                        }`}
                      >
                        <Radio className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} />
                        <span>Spotify</span>
                      </button>

                      <button
                        onClick={() => {
                          setStreamSource("youtube");
                          if (searchQuery.trim()) setTimeout(() => handleOnlineSearch(), 50);
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          streamSource === "youtube"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]"
                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-transparent"
                        }`}
                      >
                        <Youtube className="w-3 h-3 text-rose-500" />
                        <span>YouTube</span>
                      </button>
                    </div>
                  </div>

                  {/* Results Area */}
                  <div
                    className={`transition-all ease-out duration-700 w-full flex-1 mt-8 ${searchQuery ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none absolute"}`}
                  >
                    {searchQuery && isSearching ? (
                      <div className="flex items-center justify-center py-20 text-slate-600 dark:text-slate-400 font-medium">
                        <div className="w-8 h-8 border-[3px] border-slate-400/30 border-t-cyan-500 rounded-full animate-spin mr-4"></div>
                        <span className="text-lg">{l.searching}</span>
                      </div>
                    ) : searchQuery && searchResults.length > 0 ? (
                      <div className="pb-10">
                        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
                          Top Results
                        </h2>
                        <TrackList
                          tracks={searchResults}
                          emptyMsg={l.noResults}
                        />
                      </div>
                    ) : searchQuery &&
                      !isSearching &&
                      searchResults.length === 0 ? (
                      <div className="py-20 text-center flex flex-col items-center justify-center text-slate-600 dark:text-slate-400">
                        <Search className="w-16 h-16 mb-6 opacity-30" strokeWidth={1.75} />
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                          {l.noResults}
                        </h3>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}

              {!isTabLoading && activeTab === "library" && (
                <motion.div
                  key="library"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-32 h-32 rounded-md bg-gradient-to-br from-blue-500 dark:from-blue-700 via-indigo-500 dark:via-indigo-600 to-red-500 dark:to-red-600 flex items-center justify-center shadow-lg">
                      <Heart className="w-12 h-12 text-white" strokeWidth={1.75} fill="white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-widest text-slate-800 dark:text-white mb-1">
                        Playlist
                      </p>
                      <h2 className="text-4xl sm:text-5xl font-extrabold mb-3 tracking-tight text-slate-900 dark:text-white">
                        {l.likedSongs}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {likedTracks.length} tracks
                      </p>
                    </div>
                  </div>
                  <TrackList
                    tracks={likedTracks}
                    emptyMsg="You haven't liked any songs yet."
                  />
                </motion.div>
              )}

              {!isTabLoading && activeTab === "offline" && (
                <motion.div
                  key="offline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="flex flex-col h-full w-full relative overflow-y-auto"
                >
                  <React.Suspense fallback={
                    <div className="flex items-center justify-center w-full h-full min-h-[300px]">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-cyan-500 font-bold animate-pulse">{language === "en" ? "Loading..." : "در حال پردازش..."}</p>
                      </div>
                    </div>
                  }>
                    <LocalWorld 
                      language={language}
                      playTrack={playTrack}
                      playPlaylist={handlePlayLocalPlaylist}
                    />
                  </React.Suspense>
                </motion.div>
              )}

              {!isTabLoading && activeTab === "ai" && (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="flex flex-col h-full bg-white/50 dark:bg-[#070710]/40 backdrop-blur-xl rounded-2xl overflow-hidden relative shadow-[inset_0_0_30px_rgba(139,92,246,0.1)] border border-transparent dark:border-purple-500/20"
                >
                  {!isAuthorized && (
                    <AuthOverlay
                      title={
                        language === "fa"
                          ? "ورود به بخش گفتگو و راهنما"
                          : "Access Music Assistant"
                      }
                      language={language}
                      accessCode={accessCode}
                      setAccessCode={setAccessCode}
                      handleAuthorize={handleAuthorize}
                    />
                  )}
                  {/* Chat header */}
                  <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white">
                        <MessageSquare className="w-4 h-4" strokeWidth={1.75} />
                      </div>
                      <h3 className="font-bold text-slate-800 dark:text-white">
                        {l.aiCompanion}
                      </h3>
                    </div>
                    {isAuthorized && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setChatHistory([])}
                          className="text-[10px] font-bold text-slate-400 hover:text-cyan-500 transition-colors ease-out flex items-center gap-1 uppercase bg-white/5 px-2 py-1 rounded border border-white/5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                          {language === "fa" ? "چت جدید" : "New Chat"}
                        </button>
                        <button
                          onClick={() => {
                            setIsAuthorized(false);
                            localStorage.removeItem("dj_studio_auth");
                          }}
                          className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors ease-out flex items-center gap-1 uppercase bg-white/5 px-2 py-1 rounded border border-white/5 cursor-pointer"
                        >
                          <Lock className="w-3 h-3" strokeWidth={1.75} />
                          {language === "fa" ? "خروج" : "Lock"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Chat history */}
                  <div
                    dir="ltr"
                    className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 space-y-6 pb-64 scroll-smooth"
                  >
                    {chatHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-600 dark:text-slate-300 mt-12">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200/60 dark:border-white/10 mb-5 shadow-xs">
                          <MessageSquare className="w-6 h-6 text-slate-800 dark:text-white" strokeWidth={1.75} />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-1.5">
                          {language === "fa" ? "گفتگو و راهنمای موسیقی" : "Music Assistant"}
                        </h2>
                        <p className="text-center max-w-md text-xs text-slate-500 dark:text-slate-400">
                          {language === "fa" ? "هر سوالی درباره آهنگ‌ها، آهنگسازان، ساختار و پیشنهادهای موسیقی دارید بپرسید." : "Ask about tracks, musical structure, artists, or recommendations."}
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-3xl mx-auto w-full space-y-5">
                        {chatHistory.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex w-full gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            {msg.role === "model" && (
                              <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white/15 text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </div>
                            )}
                            <div
                              dir={language === "fa" ? "rtl" : "ltr"}
                              className={`max-w-[85%] sm:max-w-[80%] ${msg.role === "user" ? `bg-gradient-to-br from-slate-200 to-slate-100 dark:from-purple-900/60 dark:to-[#1a1025] border dark:border-purple-500/30 dark:shadow-[0_0_15px_rgba(139,92,246,0.15)] text-slate-900 dark:text-white px-4 py-3 rounded-2xl rounded-tr-sm` : `bg-transparent text-slate-800 dark:text-slate-200 pt-1`}`}
                            >
                              <div
                                className={`whitespace-pre-wrap text-[15px] sm:text-base leading-relaxed markdown-body text-justify`}
                              >
                                <Suspense
                                  fallback={
                                    <div className="animate-pulse flex items-center">
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-cyan-500" strokeWidth={1.75} />
                                      Loading text...
                                    </div>
                                  }
                                >
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      code({
                                        node,
                                        className,
                                        children,
                                        ...props
                                      }: any) {
                                        const match = /language-(\w+)/.exec(
                                          className || "",
                                        );
                                        const isInline = !match;
                                        return isInline ? (
                                          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-md font-medium border border-blue-500/20 shadow-sm mx-1 align-baseline mt-0.5 mb-0.5 text-xs">
                                            <Music className="w-3 h-3 text-blue-500 dark:text-blue-400" strokeWidth={1.75} />
                                            <code
                                              className={className}
                                              {...props}
                                            >
                                              {children}
                                            </code>
                                          </span>
                                        ) : (
                                          <code
                                            className={className}
                                            {...props}
                                          >
                                            {children}
                                          </code>
                                        );
                                      },
                                    }}
                                  >
                                    {msg.text}
                                  </ReactMarkdown>
                                </Suspense>
                              </div>
                            </div>
                          </div>
                        ))}
                        {isChatting && (
                          <div className="flex w-full gap-3 justify-start max-w-3xl mx-auto">
                            <div className="w-8 h-8 rounded-full bg-cyan-600 dark:bg-white flex items-center justify-center shrink-0">
                              <MessageSquare className="w-4 h-4 text-white dark:text-black" strokeWidth={1.75} />
                            </div>
                            <div className="text-slate-800 dark:text-slate-200 pt-3 flex gap-1.5 items-center">
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce shadow-sm [animation-delay:0.2s]"></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce shadow-sm [animation-delay:0.4s]"></div>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Chat input - Absolute to bottom of the TAB container */}
                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-white via-white to-transparent dark:from-black dark:via-black/90 pt-12 z-10 w-full rounded-b-2xl">
                    <div className="max-w-3xl mx-auto w-full" dir="ltr">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
                        }}
                        className="relative flex items-center bg-slate-100 dark:bg-black/80 dark:backdrop-blur-xl border border-transparent dark:border-white/10 rounded-3xl p-1.5 focus-within:bg-slate-200/50 dark:focus-within:bg-black dark:focus-within:border-cyan-500/50 dark:focus-within:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all ease-out duration-500"
                      >
                        <input
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder={
                            language === "fa"
                              ? "نوشتن پیام..."
                              : "Type a message..."
                          }
                          disabled={isChatting}
                          className="flex-1 bg-transparent px-3 py-2 sm:py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none disabled:opacity-50 placeholder-slate-500 dark:placeholder-slate-400 font-medium font-sans"
                          dir={language === "fa" ? "rtl" : "ltr"}
                        />
                        <button
                          type="submit"
                          disabled={isChatting || !chatMessage.trim()}
                          className={`bg-black dark:bg-cyan-400 text-white dark:text-black hover:opacity-80 dark:hover:shadow-[0_0_15px_rgba(6,182,212,0.8)] rounded-full w-8 h-8 sm:w-9 sm:h-9 mx-1 flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-all ease-out active:scale-95`}
                        >
                          <Send className={`w-3.5 h-3.5 ml-0.5`} strokeWidth={1.75} />
                        </button>
                      </form>
                      <p className="text-center text-[11px] text-slate-500 dark:text-slate-500 mt-3 hidden sm:block">
                        {language === "fa" ? "پاسخ‌ها جنبه راهنمایی دارند." : "Responses are generated for guidance."}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {!isTabLoading && activeTab === "ai-playlist" && (
                <motion.div
                  key="ai-playlist"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[60vh] max-w-4xl mx-auto"
                >
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(99,102,241,0.5)] border border-white/20">
                      <ListPlus className="w-9 h-9 text-white" strokeWidth={1.75} />
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500">
                      {l.aiPlaylistCreator}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">
                      {l.aiPlaylistGenerating.replace("...", "")}
                    </p>
                  </div>

                  <div className="w-full relative group max-w-2xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity ease-out duration-500"></div>
                    <div className="relative bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-4 md:p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_40px_rgba(0,0,0,0.1)]">
                      <textarea
                        value={aiPlaylistPrompt}
                        onChange={(e) => setAiPlaylistPrompt(e.target.value)}
                        placeholder={l.aiPlaylistPlaceholder}
                        className="w-full bg-transparent border-none resize-none outline-none text-slate-800 dark:text-white text-lg md:text-xl placeholder-slate-400 dark:placeholder-slate-500 min-h-[100px]"
                      />

                      <div className="flex flex-wrap gap-2 mt-4 mb-4">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1 w-full">
                          {l.aiPlaylistSuggestions}
                        </span>
                        {(language === "fa"
                          ? [
                              "کدنویسی آخر شب",
                              "ورزش پرانرژی",
                              "موسیقی بی‌کلام پیانو",
                              "آرامش زیر بارون",
                            ]
                          : [
                              "Late night coding",
                              "Gym workout beast mode",
                              "Rainy day jazz",
                              "Epic cinematic drive",
                            ]
                        ).map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setAiPlaylistPrompt(suggestion)}
                            className="px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800/60 transition-colors ease-out border border-indigo-200/50 dark:border-indigo-500/20"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleGeneratePlaylist}
                          disabled={
                            isGeneratingPlaylist || !aiPlaylistPrompt.trim()
                          }
                          className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all ease-out duration-500 flex items-center justify-center min-w-[200px] ${isGeneratingPlaylist || !aiPlaylistPrompt.trim() ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed" : "bg-gradient-to-r from-indigo-600 to-cyan-500 hover:scale-105 active:scale-95 shadow-[0_10px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_10px_30px_rgba(99,102,241,0.5)] border border-white/20"}`}
                        >
                          {isGeneratingPlaylist ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin mr-2" strokeWidth={1.75} />{" "}
                              {l.aiPlaylistGenerating}
                            </>
                          ) : (
                            <>
                              <Search className="w-5 h-5 mr-2" strokeWidth={1.75} />{" "}
                              {l.aiPlaylistGenerate}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {generatedPlaylistData && (
                    <motion.div
                      className="w-full mt-12 bg-white/60 dark:bg-black/30 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                          <Music className="w-6 h-6 text-cyan-500" strokeWidth={1.75} />
                          {generatedPlaylistData.name}
                        </h3>
                        <button
                          onClick={() => {
                            const currentLikedIds = new Set(
                              likedTracks.map((t) => t.id),
                            );
                            const newTracks =
                              generatedPlaylistData.tracks.filter(
                                (t) => !currentLikedIds.has(t.id),
                              );
                            if (newTracks.length > 0) {
                              const nextLiked = [...newTracks, ...likedTracks];
                              setLikedTracks(nextLiked);
                              localStorage.setItem(
                                "spotify_clone_liked",
                                JSON.stringify(
                                  nextLiked.filter((t) => !t.isLocal),
                                ),
                              );
                              showToast(
                                language === "fa"
                                  ? "تمام آهنگ‌ها به کتابخانه اضافه شدند."
                                  : "All tracks added to library.",
                              );
                            } else {
                              showToast(
                                language === "fa"
                                  ? "این آهنگ‌ها از قبل در کتابخانه هستند."
                                  : "Tracks already in library.",
                              );
                            }
                          }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-xl font-medium text-sm transition-colors ease-out flex items-center gap-2 border border-slate-200 dark:border-white/10"
                        >
                          <Plus className="w-4 h-4" strokeWidth={1.75} />
                          {language === "fa"
                            ? "افزودن همه به کتابخانه"
                            : "Add All to Library"}
                        </button>
                      </div>
                      <div className="space-y-4">
                        {generatedPlaylistData.tracks.map((track, i) => (
                          <motion.div
                            key={track.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex flex-col sm:flex-row items-start sm:items-center p-4 bg-white/40 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 group hover:shadow-xl transition-all"
                          >
                            <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 mb-3 sm:mb-0 sm:mr-4 relative">
                              <img
                                src={track.coverUrl}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform ease-out duration-500"
                              />
                              <div className="absolute inset-0 bg-black/40 flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ease-out items-center justify-center backdrop-blur-sm">
                                <button
                                  onClick={() => {
                                    const nextLiked = [
                                      track,
                                      ...likedTracks.filter(
                                        (t) => t.id !== track.id,
                                      ),
                                    ];
                                    setLikedTracks(nextLiked);
                                    localStorage.setItem(
                                      "spotify_clone_liked",
                                      JSON.stringify(
                                        nextLiked.filter((t) => !t.isLocal),
                                      ),
                                    );
                                    playTrack(track);
                                  }}
                                  className="w-10 h-10 bg-cyan-500 text-white rounded-full flex items-center justify-center hover:bg-cyan-400 hover:scale-110 transition-transform"
                                >
                                  <Play className="w-4 h-4 ml-1 fill-current" strokeWidth={1.75} />
                                </button>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-slate-900 dark:text-white text-lg truncate">
                                  {track.title}
                                </h4>
                                <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-white/10 rounded-full text-slate-500 dark:text-slate-300">
                                  {track.artist}
                                </span>
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400 italic line-clamp-2">
                                {track.description}
                              </p>
                            </div>
                            <div className="flex gap-2 mt-3 sm:mt-0 lg:ml-4 shrink-0">
                              <button
                                onClick={() => {
                                  const isLiked = likedTracks.some(
                                    (t) => t.id === track.id,
                                  );
                                  let nextLiked;
                                  if (isLiked) {
                                    nextLiked = likedTracks.filter(
                                      (t) => t.id !== track.id,
                                    );
                                  } else {
                                    nextLiked = [track, ...likedTracks];
                                  }
                                  setLikedTracks(nextLiked);
                                  localStorage.setItem(
                                    "spotify_clone_liked",
                                    JSON.stringify(
                                      nextLiked.filter((t) => !t.isLocal),
                                    ),
                                  );
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                              >
                                <Heart
                                  className="w-5 h-5 text-pink-500"
                                  strokeWidth={1.75}
                                  fill={
                                    likedTracks.some((t) => t.id === track.id)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {!isTabLoading && activeTab === "lab" && (
                <motion.div
                  key="lab"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="flex flex-col h-full w-full relative"
                >
                  <Suspense
                    fallback={
                      <div className="flex-1 flex items-center justify-center min-h-[400px]">
                        <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                      </div>
                    }
                  >
                    <AudioLab language={language} />
                  </Suspense>
                </motion.div>
              )}

              {!isTabLoading && activeTab === "dj" && (
                <motion.div
                  key="dj"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="flex flex-col h-full bg-white/50 dark:bg-[#070710]/40 backdrop-blur-xl rounded-2xl overflow-y-auto overflow-x-hidden relative border border-transparent dark:border-cyan-500/20"
                >
                  <Suspense
                    fallback={
                      <div className="flex-1 flex items-center justify-center min-h-[400px]">
                        <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                      </div>
                    }
                  >
                    <DJStudio
                      language={language}
                      isAuthorized={isAuthorized}
                      setIsAuthorized={setIsAuthorized}
                    />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* MODULAR PLAYER FOOTER */}
      <PlayerFooter
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        isLoading={isLoading}
        duration={duration}
        isShuffle={isShuffle}
        setIsShuffle={setIsShuffle}
        isRepeat={isRepeat}
        setIsRepeat={setIsRepeat}
        is8D={is8D}
        toggle8D={toggle8D}
        togglePiP={togglePiP}
        isMiniPlayer={isMiniPlayer}
        pipWindow={pipWindow}
        isMuted={isMuted}
        volume={volume}
        setVolume={setVolume}
        handleMuteToggle={handleMuteToggle}
        handleLikeTrack={handleLikeTrack}
        handleShareTrack={handleShareTrack}
        handleDownloadTrack={handleDownloadTrack}
        handlePlayPrev={handlePlayPrev}
        handlePlayNext={handlePlayNext}
        pause={pause}
        resume={resume}
        seek={seek}
        likedTracks={likedTracks}
        language={language}
      />

      {/* FLOATING REACT MINI PLAYER */}
      <AnimatePresence>
        {isMiniPlayer && currentTrack && (
          <motion.div
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileDrag={{ scale: 1.05, cursor: "grabbing" }}
            style={{ resize: "both" }}
            className="hidden md:flex fixed bottom-24 end-6 z-[100] w-[250px] min-w-[210px] min-h-[310px] h-auto rounded-3xl overflow-hidden flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)] dark:shadow-[0_0_35px_rgba(6,182,212,0.35)] border border-white/20 select-none"
          >
            {/* Dynamic background behind mini player that mimics the global background */}
            <div className="absolute inset-0 z-0 bg-slate-900/90 backdrop-blur-lg pointer-events-none"></div>

            {/* Top Bar - Drag Handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="w-full h-9 flex items-center justify-between px-3 bg-white/5 dark:bg-black/40 border-b border-white/10 cursor-grab active:cursor-grabbing z-10 relative"
            >
              <div className="flex gap-1.5 items-center">
                <div
                  className="w-2.5 h-2.5 rounded-full bg-red-400 hover:bg-red-500 cursor-pointer shadow-sm transition-colors"
                  onClick={() => setIsMiniPlayer(false)}
                ></div>
                <div
                  className="w-2.5 h-2.5 rounded-full bg-amber-400 hover:bg-amber-500 cursor-pointer shadow-sm transition-colors"
                  onClick={() => setIsMiniPlayer(false)}
                ></div>
                <div
                  className="w-2.5 h-2.5 rounded-full bg-green-400 hover:bg-green-500 cursor-pointer shadow-sm transition-colors"
                  onClick={() => setIsMiniPlayer(false)}
                ></div>
              </div>
              <span className="text-[9px] font-mono tracking-widest text-slate-400/90 font-bold">
                NEON MINI
              </span>
              <button
                onClick={() => setIsMiniPlayer(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Content Core */}
            <div className="p-4 flex flex-1 flex-col items-center justify-center relative z-10 h-full w-full gap-3">
              {/* Apple-style Cover Image with Silky Beat Glow */}
              <div className="relative my-0.5 mx-auto shrink-0">
                <div
                  className={`relative w-24 h-24 rounded-2xl overflow-hidden shadow-[0_14px_30px_rgba(0,0,0,0.55)] ring-1 ring-white/25 transition-all ease-out duration-500 ${
                    isPlaying ? "animate-cover-heartbeat ring-cyan-400/50 shadow-[0_0_24px_rgba(6,182,212,0.4)]" : "scale-100"
                  }`}
                >
                  <img
                    src={currentTrack.coverUrl}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    alt="Cover"
                  />
                  {/* Subtle specular sheen */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                </div>
                {isLoading && (
                  <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" strokeWidth={1.75} />
                  </div>
                )}
              </div>

              {/* Title & Artist */}
              <div className="text-center w-full min-w-0 px-2 tracking-tight">
                <h4 className="font-bold text-white text-base truncate mb-0.5">
                  {currentTrack.title}
                </h4>
                <p className="text-xs font-semibold text-cyan-200/90 truncate">
                  {currentTrack.artist}
                </p>
              </div>

              {/* Controls */}
              <div className="w-full px-1 flex flex-col mt-auto gap-3">
                {/* Progress UI with Custom slider precision */}
                <div className="flex flex-col gap-1 w-full relative z-20">
                  <div className="flex justify-between text-[9px] font-mono font-bold text-white/80 px-0.5">
                    <span><span className="sync-time">0:00</span></span>
                    <span>{formatTime(duration || 100)}</span>
                  </div>
                  <div className="relative w-full flex items-center h-4 group/slider">
                    {/* Background Track */}
                    <div className="absolute inset-x-0 h-1.5 bg-white/20 rounded-full overflow-hidden pointer-events-none">
                      <div
                        className="sync-width h-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" style={{ width: "0%" }}
                      ></div>
                    </div>
                    {/* Real transparent input over it with a visible custom slider thumb */}
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      defaultValue={0}
                      onChange={(e) => seek(parseFloat(e.target.value))}
                      className="sync-val absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {/* Floating precise thumb indicator */}
                    <div
                      className="sync-left absolute w-3.5 h-3.5 bg-white rounded-full border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] pointer-events-none transform -translate-x-1/2 scale-75 opacity-0 group-hover/slider:scale-100 group-hover/slider:opacity-100 transition-all duration-200 ease-out"
                      style={{
                        left: "0%",
                      }}
                    ></div>
                  </div>
                </div>

                {/* Playback Buttons with extra controls */}
                <div className="flex justify-between items-center gap-2 pt-1">
                  <div className="flex items-center gap-2 px-0.5">
                    <button
                      onClick={() => setIsShuffle(!isShuffle)}
                      className={`transition-colors ease-out p-1 rounded hover:bg-white/5 ${isShuffle ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "text-slate-400 hover:text-white"}`}
                    >
                      <Shuffle className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => setIsRepeat(!isRepeat)}
                      className={`transition-colors ease-out p-1 rounded hover:bg-white/5 ${isRepeat ? "text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" : "text-slate-400 hover:text-white"}`}
                    >
                      <Repeat className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handlePlayPrev(true)}
                      className="text-white/80 hover:text-white hover:scale-110 active:scale-90 transition-all"
                    >
                      <SkipBack className="w-4 h-4 fill-current" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => (isPlaying ? pause() : resume())}
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-white shadow-xl transition-all ease-out duration-500 hover:scale-[1.12] active:scale-95 ${isPlaying ? "bg-gradient-to-br from-cyan-400 to-purple-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]" : "bg-white/10 border border-white/20 backdrop-blur-md hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]"}`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" strokeWidth={1.75} />
                      ) : isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" strokeWidth={1.75} />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" strokeWidth={1.75} />
                      )}
                    </button>
                    <button
                      onClick={() => handlePlayNext(true)}
                      className="text-white/80 hover:text-white hover:scale-110 active:scale-90 transition-all"
                    >
                      <SkipForward className="w-4 h-4 fill-current" strokeWidth={1.75} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleShareTrack(currentTrack)}
                      className="transition-all ease-out p-1 rounded hover:bg-white/5 text-slate-300 hover:text-cyan-400"
                      title="Share"
                    >
                      <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`transition-all ease-out p-1 rounded hover:bg-white/5 ${isMuted || volume === 0 ? "text-red-400" : "text-slate-300 hover:text-cyan-400"}`}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-3.5 h-3.5" strokeWidth={1.75} />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING PIP MINI PLAYER PORTAL */}
      {pipWindow &&
        currentTrack &&
        createPortal(
          <div className="w-full h-[100vh] flex flex-col font-sans relative overflow-hidden antialiased bg-slate-950 group dark select-none">
            {/* Pip Background matching main app exactly */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0b101f] to-[#120921] z-0 pointer-events-none"></div>
            <div className="absolute inset-0 bg-black/30 pointer-events-none z-0"></div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 w-full h-full gap-3">
              {/* Cover Image with Silky Apple Beat Glow */}
              {pipSize.height >= 290 && (
                <div className="relative my-1 mx-auto shrink-0 transition-opacity ease-out duration-500">
                  <div
                    className={`relative w-24 h-24 rounded-2xl overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.6)] ring-1 ring-white/20 transition-all ease-out duration-500 ${
                      isPlaying ? "animate-cover-heartbeat ring-cyan-400/50 shadow-[0_0_24px_rgba(6,182,212,0.4)]" : "scale-100"
                    }`}
                  >
                    <img
                      src={currentTrack.coverUrl}
                      className="w-full h-full object-cover"
                      alt="Cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Title & Artist */}
              <div className="text-center w-full min-w-0 px-2 tracking-tight">
                <h4 className="font-bold text-white text-base truncate mb-0.5">
                  {currentTrack.title}
                </h4>
                <p className="text-xs font-semibold text-cyan-200/90 truncate">
                  {currentTrack.artist}
                </p>
              </div>

              {/* Controls */}
              <div className="w-full px-2 flex flex-col mt-auto gap-3">
                {/* Progress UI with perfect slider feedback */}
                <div className="flex flex-col gap-1 w-full relative z-20">
                  <div className="flex justify-between text-[9px] font-mono font-bold text-white/90 px-0.5">
                    <span><span className="sync-time">0:00</span></span>
                    <span>{formatTime(duration || 100)}</span>
                  </div>
                  <div className="relative w-full flex items-center h-4 group/slider">
                    {/* Background Track */}
                    <div className="absolute inset-x-0 h-1.5 bg-white/20 rounded-full overflow-hidden pointer-events-none">
                      <div
                        className="sync-width h-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" style={{ width: "0%" }}
                      ></div>
                    </div>
                    {/* Real transparent input */}
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      defaultValue={0}
                      onChange={(e) => seek(parseFloat(e.target.value))}
                      className="sync-val absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {/* Floating precise thumb indicator */}
                    <div
                      className="sync-left absolute w-3.5 h-3.5 bg-white rounded-full border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] pointer-events-none transform -translate-x-1/2 scale-75 opacity-0 group-hover/slider:scale-100 group-hover/slider:opacity-100 transition-all duration-200 ease-out"
                      style={{
                        left: "0%",
                      }}
                    ></div>
                  </div>
                </div>

                {/* Playback Buttons */}
                <div className="flex justify-between items-center gap-2 pt-1 pb-1">
                  <button
                    onClick={() => setIsShuffle(!isShuffle)}
                    className={`transition-colors ease-out p-1 rounded hover:bg-white/5 ${isShuffle ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "text-slate-400 hover:text-white"}`}
                  >
                    <Shuffle className="w-4 h-4" strokeWidth={1.75} />
                  </button>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handlePlayPrev(true)}
                      className="text-white/85 hover:text-white transition-all ease-out hover:scale-110 active:scale-95"
                    >
                      <SkipBack className="w-4.5 h-4.5 fill-current" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => (isPlaying ? pause() : resume())}
                      className={`w-10 h-10 flex items-center justify-center rounded-full text-white shadow-xl transition-all ease-out duration-500 hover:scale-[1.12] active:scale-95 ${isPlaying ? "bg-gradient-to-br from-cyan-400 to-purple-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" : "bg-white/10 border border-white/25 backdrop-blur-md hover:shadow-[0_0_12px_rgba(255,255,255,0.25)]"}`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" strokeWidth={1.75} />
                      ) : isPlaying ? (
                        <Pause className="w-4.5 h-4.5 fill-current" strokeWidth={1.75} />
                      ) : (
                        <Play className="w-4.5 h-4.5 fill-current ml-0.5" strokeWidth={1.75} />
                      )}
                    </button>
                    <button
                      onClick={() => handlePlayNext(true)}
                      className="text-white/85 hover:text-white transition-all ease-out hover:scale-110 active:scale-95"
                    >
                      <SkipForward className="w-4.5 h-4.5 fill-current" strokeWidth={1.75} />
                    </button>
                  </div>

                  <button
                    onClick={() => setIsRepeat(!isRepeat)}
                    className={`transition-colors ease-out p-1 rounded hover:bg-white/5 ${isRepeat ? "text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" : "text-slate-400 hover:text-white"}`}
                  >
                    <Repeat className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          </div>,
          pipWindow.document.body,
        )}

      {/* MODULAR TRACK DETAILS MODAL */}
      <TrackDetailsModal
        track={selectedTrackMeta}
        onClose={() => setSelectedTrackMeta(null)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayTrack={playTrack}
        onPause={pause}
        onResume={resume}
        onLikeTrack={handleLikeTrack}
        onShareTrack={handleShareTrack}
        onDownloadTrack={handleDownloadTrack}
        isLiked={likedTracks.some((t) => t.id === selectedTrackMeta?.id)}
        onAskAi={(track) => {
          setActiveTab("ai");
          setChatMessage(
            `لطفا در مورد آهنگ "${track.title}" اثر "${track.artist}" اطلاعات بده`
          );
          setSelectedTrackMeta(null);
        }}
        language={language}
        l={l}
      />

      {/* MODULAR ADVANCED SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
        streamSource={streamSource}
        setStreamSource={setStreamSource}
        is8D={is8D}
        toggle8D={toggle8D}
        panSpeed={panSpeed}
        setPanSpeed={setPanSpeed}
        bassBoost={bassBoost}
        toggleBassBoost={toggleBassBoost}
        playbackRate={playbackRate}
        setPlaybackRate={setPlaybackRate}
        isAuthorized={isAuthorized}
        setIsAuthorized={setIsAuthorized}
        showToast={showToast}
      />

      {/* MODULAR PROFILE MODAL */}
      <ProfileModal
        isOpen={isProfileOpen}
        isLoading={isProfileLoading}
        onClose={() => setIsProfileOpen(false)}
        username="Pouya Pro"
        likedTracks={likedTracks}
        language={language}
        onSwitchLanguage={() => {
          setLanguage((prev) => (prev === "en" ? "fa" : "en"));
        }}
        l={l}
      />
    </div>
  );
}

export default function App() {
  return (
    <AudioEngineProvider>
      <AppContent />
    </AudioEngineProvider>
  );
}
