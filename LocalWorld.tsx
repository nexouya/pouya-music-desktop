import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LocalMusicStore, LocalPlaylist } from "./LocalMusicStore";
import { Track } from "./types";
import { useAudioEngine } from "./AudioEngine";
import { apiUrl } from "./src/lib/api";
import {
  Folder,
  Music,
  Plus,
  Trash2,
  UploadCloud,
  Play,
  Pause,
  Search,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Clock,
  Shuffle,
  Copy,
  Edit3,
  HardDrive,
  FileAudio,
  CheckCircle2,
  ArrowUpDown,
  Volume2,
  Sparkles,
  SlidersHorizontal,
  X,
  Share2,
  Download,
} from "lucide-react";

interface LocalWorldProps {
  language: string;
  playTrack: (t: Track) => void;
  playPlaylist: (tracks: Track[], index: number) => void;
}

type SortField = "manual" | "title" | "artist" | "duration";
type SortOrder = "asc" | "desc";

// Helper to format seconds nicely mm:ss
function formatDuration(sec?: number): string {
  if (!sec || isNaN(sec)) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// Helper to format file sizes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const LocalWorld: React.FC<LocalWorldProps> = ({
  language,
  playTrack,
  playPlaylist,
}) => {
  const isFa = language === "fa";
  const { currentTrack, isPlaying, pause, resume } = useAudioEngine();

  // Core state
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<LocalPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [playlistCovers, setPlaylistCovers] = useState<Record<string, string>>({});
  const [storageStats, setStorageStats] = useState<{ totalPlaylists: number; totalTracks: number; approximateBytes: number }>({
    totalPlaylists: 0,
    totalTracks: 0,
    approximateBytes: 0,
  });

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");

  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; filename: string }>({
    current: 0,
    total: 0,
    filename: "",
  });
  const [isDragOver, setIsDragOver] = useState(false);

  // Sorting & Filtering
  const [sortField, setSortField] = useState<SortField>("manual");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Selection & contextual actions
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuTrackId(null);
        setPlaylistMenuOpen(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load all playlists and metadata
  const loadPlaylists = useCallback(async () => {
    try {
      await LocalMusicStore.refreshFromCore();
    } catch {
      /* web mode */
    }
    const loaded = LocalMusicStore.getPlaylists();
    setPlaylists(loaded);

    // Load covers
    const covers: Record<string, string> = {};
    for (const p of loaded) {
      if (p.coverUrl === "blob") {
        const cover = await LocalMusicStore.getPlaylistCover(p.id);
        if (cover) covers[p.id] = cover;
      }
    }
    setPlaylistCovers(covers);

    // Update storage stats
    const stats = await LocalMusicStore.getStorageStats();
    setStorageStats(stats);
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Open a playlist
  const openPlaylist = async (p: LocalPlaylist) => {
    setSelectedPlaylist(p);
    setSearchQuery("");
    setSortField("manual");
    const tracks = await LocalMusicStore.getTracksForPlaylist(p.id);
    setPlaylistTracks(tracks);
  };

  const closePlaylist = () => {
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
    setSearchQuery("");
    setIsEditingPlaylist(false);
  };

  // Create new playlist
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    const created = await LocalMusicStore.createPlaylist(trimmed, newPlaylistDesc.trim());
    setNewPlaylistName("");
    setNewPlaylistDesc("");
    setIsCreating(false);
    loadPlaylists();
    showToast(isFa ? `پلی‌لیست «${trimmed}» ساخته شد` : `Playlist "${trimmed}" created`);
    openPlaylist(created);
  };

  // Save playlist edits (name & description)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaylist) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    await LocalMusicStore.renamePlaylist(selectedPlaylist.id, trimmed, editDesc.trim());
    setSelectedPlaylist((prev) => (prev ? { ...prev, name: trimmed, description: editDesc.trim() } : null));
    setIsEditingPlaylist(false);
    loadPlaylists();
    showToast(isFa ? "تغییرات با موفقیت ذخیره شد" : "Playlist details updated");
  };

  // Duplicate playlist
  const handleDuplicatePlaylist = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPlaylistMenuOpen(null);
    const dup = await LocalMusicStore.duplicatePlaylist(id, isFa ? " (نسخه کپی)" : " (Copy)");
    if (dup) {
      loadPlaylists();
      showToast(isFa ? "نسخه کپی پلی‌لیست ایجاد شد" : "Playlist duplicated");
    }
  };

  // Delete playlist
  const handleDeletePlaylist = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPlaylistMenuOpen(null);
    const target = playlists.find((p) => p.id === id);
    const name = target?.name || "";
    if (
      confirm(
        isFa
          ? `آیا از حذف پلی‌لیست «${name}» اطمینان دارید؟ تمامی فایل‌های صوتی متصل آزاد خواهند شد.`
          : `Delete playlist "${name}"? Audio files unique to this playlist will be removed.`
      )
    ) {
      await LocalMusicStore.deletePlaylist(id);
      loadPlaylists();
      if (selectedPlaylist?.id === id) closePlaylist();
      showToast(isFa ? "پلی‌لیست حذف شد" : "Playlist deleted");
    }
  };

  // Process incoming files (via drag-and-drop or file selector)
  const processAudioFiles = async (files: FileList | File[]) => {
    if (!selectedPlaylist || files.length === 0) return;

    const audioFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (
        f.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|m4a|aac|flac|weba)$/i.test(f.name)
      ) {
        audioFiles.push(f);
      }
    }

    if (audioFiles.length === 0) {
      showToast(isFa ? "هیچ فایل صوتی معتبری پیدا نشد." : "No valid audio files found.");
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: audioFiles.length, filename: audioFiles[0].name });

    let jsmediatagsModule: any = null;
    try {
      jsmediatagsModule = (await import("jsmediatags")).default;
    } catch {
      // jsmediatags not available, fallback gracefully
    }

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      setUploadProgress({ current: i + 1, total: audioFiles.length, filename: file.name });

      try {
        let title = file.name.replace(/\.[^/.]+$/, "");
        let artist = isFa ? "خواننده نامشخص" : "Unknown Artist";
        let album = "";
        let coverBlob: Blob | undefined = undefined;

        // Try reading ID3 tags
        if (jsmediatagsModule) {
          try {
            const parsed = await new Promise<{ title?: string; artist?: string; album?: string; coverBlob?: Blob }>((resolve) => {
              jsmediatagsModule.read(file, {
                onSuccess: (tag: any) => {
                  const tags = tag.tags;
                  let picBlob: Blob | undefined = undefined;
                  if (tags.picture) {
                    const { data, format } = tags.picture;
                    const array = new Uint8Array(data);
                    picBlob = new Blob([array], { type: format });
                  }
                  resolve({
                    title: tags.title,
                    artist: tags.artist,
                    album: tags.album,
                    coverBlob: picBlob,
                  });
                },
                onError: () => resolve({}),
              });
            });

            if (parsed.title && parsed.title.trim()) title = parsed.title.trim();
            if (parsed.artist && parsed.artist.trim()) artist = parsed.artist.trim();
            if (parsed.album && parsed.album.trim()) album = parsed.album.trim();
            if (parsed.coverBlob) coverBlob = parsed.coverBlob;
          } catch {
            // Ignore tag read error
          }
        }

        // Measure duration via temporary HTMLAudioElement
        let duration = 0;
        try {
          const tempUrl = URL.createObjectURL(file);
          duration = await new Promise<number>((resolve) => {
            const a = new Audio();
            a.preload = "metadata";
            a.src = tempUrl;
            a.onloadedmetadata = () => {
              const d = Math.round(a.duration);
              URL.revokeObjectURL(tempUrl);
              resolve(d || 0);
            };
            a.onerror = () => {
              URL.revokeObjectURL(tempUrl);
              resolve(0);
            };
          });
        } catch {
          duration = 0;
        }

        const track: Track = {
          id: `local-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          artist,
          album: album || selectedPlaylist.name,
          url: "", // Populated upon load
          coverUrl: coverBlob
            ? ""
            : "https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&q=80&w=400&h=400",
          duration,
          isLocal: true,
          category: "Offline",
          source: "local",
        };

        await LocalMusicStore.addTrackToPlaylist(selectedPlaylist.id, track, file, coverBlob);
      } catch (err) {
        console.error("Error storing local track:", err);
      }
    }

    const refreshedTracks = await LocalMusicStore.getTracksForPlaylist(selectedPlaylist.id);
    setPlaylistTracks(refreshedTracks);
    loadPlaylists();
    setIsUploading(false);
    showToast(
      isFa
        ? `${audioFiles.length} آهنگ با موفقیت به پلی‌لیست اضافه شد`
        : `Successfully added ${audioFiles.length} tracks`
    );
  };

  const handleFilesAdded = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processAudioFiles(e.target.files);
      e.target.value = "";
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAudioFiles(e.dataTransfer.files);
    }
  };

  // Update playlist cover image
  const handleCoverAdded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylist) return;

    if (file.type.startsWith("image/")) {
      await LocalMusicStore.updatePlaylistCover(selectedPlaylist.id, file);
      loadPlaylists();
      showToast(isFa ? "کاور پلی‌لیست تغییر یافت" : "Playlist artwork updated");
    }
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  // Delete single track
  const handleDeleteTrack = async (trackId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuTrackId(null);
    if (!selectedPlaylist) return;
    await LocalMusicStore.deleteTrack(selectedPlaylist.id, trackId);
    const tracks = await LocalMusicStore.getTracksForPlaylist(selectedPlaylist.id);
    setPlaylistTracks(tracks);
    loadPlaylists();
    showToast(isFa ? "آهنگ از پلی‌لیست حذف شد" : "Track removed from playlist");
  };

  // Reorder tracks (move up / move down)
  const handleMoveTrack = async (index: number, direction: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPlaylist) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= playlistTracks.length) return;

    const reordered = [...playlistTracks];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    setPlaylistTracks(reordered);
    void LocalMusicStore.reorderTracks(
      selectedPlaylist.id,
      reordered.map((t) => t.id)
    );
  };

  // Filtered & sorted playlists
  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return playlists;
    const q = searchQuery.toLowerCase();
    return playlists.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
  }, [playlists, searchQuery]);

  // Filtered & sorted tracks
  const processedTracks = useMemo(() => {
    let result = [...playlistTracks];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album?.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortField !== "manual") {
      result.sort((a, b) => {
        let valA: any = "";
        let valB: any = "";
        if (sortField === "title") {
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
        } else if (sortField === "artist") {
          valA = a.artist.toLowerCase();
          valB = b.artist.toLowerCase();
        } else if (sortField === "duration") {
          valA = a.duration || 0;
          valB = b.duration || 0;
        }
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [playlistTracks, searchQuery, sortField, sortOrder]);

  // Playlist total duration
  const totalPlaylistDuration = useMemo(() => {
    return playlistTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  }, [playlistTracks]);

  // Playback helper: play or toggle pause
  const handleToggleTrack = (track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
      if (isPlaying) pause();
      else resume();
    } else {
      playPlaylist(processedTracks, index);
    }
  };

  // Play random shuffle
  const handleShufflePlay = () => {
    if (processedTracks.length === 0) return;
    const randomIdx = Math.floor(Math.random() * processedTracks.length);
    playPlaylist(processedTracks, randomIdx);
  };

  return (
    <div
      className={`w-full text-slate-900 dark:text-slate-100 flex flex-col min-h-full transition-colors ${
        isFa ? "font-sans" : ""
      }`}
      onDragOver={selectedPlaylist ? handleDragOver : undefined}
      onDragLeave={selectedPlaylist ? handleDragLeave : undefined}
      onDrop={selectedPlaylist ? handleDrop : undefined}
    >
      {/* Drag & Drop Visual Overlay */}
      <AnimatePresence>
        {isDragOver && selectedPlaylist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-cyan-500/20 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="p-8 rounded-3xl bg-white/90 dark:bg-slate-900/90 shadow-2xl border border-cyan-400 flex flex-col items-center gap-4">
              <UploadCloud className="w-16 h-16 text-cyan-500 animate-bounce" strokeWidth={1.5} />
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {isFa ? "فایل‌ها را اینجا رها کنید تا افزوده شوند" : "Drop audio files to add to playlist"}
              </p>
              <p className="text-sm text-slate-500">MP3, M4A, FLAC, WAV, OGG</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Notification Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-950 font-medium text-xs sm:text-sm shadow-xl backdrop-blur-md flex items-center gap-2 border border-white/10 dark:border-black/10"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW 1: PLAYLISTS HUB (WHEN NO PLAYLIST IS SELECTED) */}
      {!selectedPlaylist ? (
        <div className="p-4 sm:p-6 md:p-8 flex flex-col max-w-7xl mx-auto w-full">
          {/* Apple-styled Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200/80 dark:border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white shrink-0">
                <HardDrive className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {isFa ? "پلی‌لیست‌های آفلاین" : "Offline Playlists"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa
                    ? "آرشیو محلی دستگاه • بدون نیاز به اینترنت • سرعت اجرای آنی"
                    : "Pure local device audio • No internet required • Zero latency"}
                </p>
              </div>
            </div>

            {/* Top Bar Actions & Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
                <input
                  type="text"
                  placeholder={isFa ? "جستجو در پلی‌لیست‌ها..." : "Filter playlists..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  setNewPlaylistName("");
                  setNewPlaylistDesc("");
                  setIsCreating(true);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-white font-semibold text-sm flex items-center gap-2 shadow-md shadow-cyan-500/25 transition-all"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
                <span>{isFa ? "پلی‌لیست جدید" : "New Playlist"}</span>
              </button>
            </div>
          </div>

          {/* Quick Storage Meter Ribbon */}
          <div className="my-6 px-4 py-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-cyan-500" strokeWidth={1.75} />
                <span>
                  <strong>{storageStats.totalPlaylists}</strong> {isFa ? "پلی‌لیست" : "Playlists"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-indigo-500" strokeWidth={1.75} />
                <span>
                  <strong>{storageStats.totalTracks}</strong> {isFa ? "قطعه صوتی ذخیره شده" : "Stored Tracks"}
                </span>
              </div>
              {storageStats.approximateBytes > 0 && (
                <div className="hidden sm:flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
                  <span>
                    {isFa ? "حجم اشغال شده:" : "Indexed Storage:"}{" "}
                    <strong>{formatBytes(storageStats.approximateBytes)}</strong>
                  </span>
                </div>
              )}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {isFa ? "ذخیره‌سازی رمزگذاری‌شده در مرورگر" : "High-fidelity local IndexedDB store"}
            </span>
          </div>

          {/* Playlists Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 pb-32">
            {/* Create Card */}
            {!searchQuery && (
              <button
                onClick={() => {
                  setNewPlaylistName("");
                  setNewPlaylistDesc("");
                  setIsCreating(true);
                }}
                className="group flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-cyan-500 dark:hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20 transition-all duration-300 cursor-pointer min-h-[220px]"
              >
                <div className="w-12 h-12 rounded-full bg-slate-200/80 dark:bg-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300 text-slate-500 dark:text-slate-400 mb-3">
                  <Plus className="w-6 h-6" strokeWidth={2} />
                </div>
                <span className="font-bold text-sm text-slate-700 dark:text-slate-300 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                  {isFa ? "ایجاد پلی‌لیست" : "Create Playlist"}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  {isFa ? "شخصی‌سازی نام و کاور" : "Custom name & art"}
                </span>
              </button>
            )}

            {/* List of user playlists */}
            {filteredPlaylists.map((p) => {
              const cover = playlistCovers[p.id];
              return (
                <div
                  key={p.id}
                  onClick={() => openPlaylist(p)}
                  className="group relative rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 hover:shadow-xl dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                >
                  {/* Artwork Box */}
                  <div className="aspect-square w-full bg-slate-100 dark:bg-black/40 relative overflow-hidden flex items-center justify-center">
                    {cover ? (
                      <img
                        src={cover}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 group-hover:scale-105 transition-transform duration-500">
                        <Folder className="w-12 h-12 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />
                      </div>
                    )}

                    {/* Quick Play overlay button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Corner Context Menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaylistMenuOpen(playlistMenuOpen === p.id ? null : p.id);
                        }}
                        className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Popup menu for card */}
                    {playlistMenuOpen === p.id && (
                      <div
                        ref={menuRef}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-10 right-2 z-20 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-1.5 text-xs text-slate-700 dark:text-slate-200"
                      >
                        <button
                          onClick={() => {
                            setPlaylistMenuOpen(null);
                            openPlaylist(p);
                            setIsEditingPlaylist(true);
                            setEditName(p.name);
                            setEditDesc(p.description || "");
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-left"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isFa ? "ویرایش مشخصات" : "Edit details"}</span>
                        </button>
                        <button
                          onClick={(e) => handleDuplicatePlaylist(p.id, e)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-left"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{isFa ? "تکثیر (کپی)" : "Duplicate"}</span>
                        </button>
                        <div className="my-1 border-t border-slate-200 dark:border-white/10" />
                        <button
                          onClick={(e) => handleDeletePlaylist(p.id, e)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 text-left"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isFa ? "حذف پلی‌لیست" : "Delete"}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Playlist Metadata */}
                  <div className="p-3.5 flex flex-col justify-between flex-1">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {p.name}
                      </h3>
                      {p.description ? (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{p.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-400">
                      <span>
                        {p.trackIds.length} {isFa ? "آهنگ" : "tracks"}
                      </span>
                      <span className="text-[10px]">
                        {new Date(p.createdAt).toLocaleDateString(isFa ? "fa-IR" : "en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPlaylists.length === 0 && searchQuery && (
            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400">
              <Search className="w-12 h-12 mb-3 opacity-30" strokeWidth={1.5} />
              <p className="font-medium text-base">
                {isFa ? "پلی‌لیستی مطابق جستجوی شما یافت نشد." : "No playlists match your search."}
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs text-cyan-500 hover:underline"
              >
                {isFa ? "پاک کردن فیلتر" : "Clear filter"}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: PLAYLIST DETAIL VIEW (APPLE MUSIC STYLE) */
        <div className="p-4 sm:p-6 md:p-8 flex flex-col max-w-7xl mx-auto w-full pb-36">
          {/* Back button & Breadcrumb */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <button
              onClick={closePlaylist}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            >
              {isFa ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              <span>{isFa ? "همه پلی‌لیست‌ها" : "All Playlists"}</span>
            </button>

            {/* Storage quick status */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {playlistTracks.length} {isFa ? "قطعه" : "items"} • {formatDuration(totalPlaylistDuration)}
              </span>
            </div>
          </div>

          {/* Hero Banner with Album Art & Details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-8 border-b border-slate-200/80 dark:border-white/10">
            {/* Artwork with hover-upload overlay */}
            <div className="group relative w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-xl shrink-0 flex items-center justify-center">
              {playlistCovers[selectedPlaylist.id] ? (
                <img
                  src={playlistCovers[selectedPlaylist.id]}
                  alt={selectedPlaylist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Folder className="w-16 h-16 text-slate-400 dark:text-slate-600" strokeWidth={1.5} />
              )}
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-xs font-semibold backdrop-blur-xs transition-opacity cursor-pointer"
                title={isFa ? "تغییر تصویر کاور" : "Change Cover Art"}
              >
                <ImageIcon className="w-6 h-6" strokeWidth={1.75} />
                <span>{isFa ? "تغییر کاور" : "Change Art"}</span>
              </button>
            </div>

            {/* Title & Controls */}
            <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
              <span className="text-xs uppercase tracking-widest font-bold text-cyan-600 dark:text-cyan-400">
                {isFa ? "پلی‌لیست آفلاین" : "Offline Playlist"}
              </span>

              {!isEditingPlaylist ? (
                <>
                  <div className="flex items-center gap-3 mt-1 max-w-full">
                    <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight truncate">
                      {selectedPlaylist.name}
                    </h1>
                    <button
                      onClick={() => {
                        setEditName(selectedPlaylist.name);
                        setEditDesc(selectedPlaylist.description || "");
                        setIsEditingPlaylist(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 transition-colors"
                      title={isFa ? "ویرایش نام" : "Edit Name"}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                  {selectedPlaylist.description ? (
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                      {selectedPlaylist.description}
                    </p>
                  ) : null}
                </>
              ) : (
                <form onSubmit={handleSaveEdit} className="w-full max-w-md my-2 flex flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 border border-cyan-500 font-bold text-base focus:outline-none"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder={isFa ? "توضیحات اختیاری..." : "Optional description..."}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-xs focus:outline-none"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-cyan-500 text-white font-semibold text-xs"
                    >
                      {isFa ? "ذخیره" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPlaylist(false)}
                      className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-xs"
                    >
                      {isFa ? "انصراف" : "Cancel"}
                    </button>
                  </div>
                </form>
              )}

              {/* Action Buttons: Play All, Shuffle, Add Tracks */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-6">
                <button
                  onClick={() => processedTracks.length > 0 && playPlaylist(processedTracks, 0)}
                  disabled={processedTracks.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 disabled:opacity-40 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isFa ? "پخش همه" : "Play All"}</span>
                </button>

                <button
                  onClick={handleShufflePlay}
                  disabled={processedTracks.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 active:scale-95 disabled:opacity-40 font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>{isFa ? "پخش تصادفی" : "Shuffle"}</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  <span>
                    {isUploading
                      ? `${isFa ? "در حال واردسازی" : "Importing"} (${uploadProgress.current}/${uploadProgress.total})`
                      : isFa
                      ? "افزودن آهنگ"
                      : "Add Tracks"}
                  </span>
                </button>

                {/* Cover file picker hidden input */}
                <input
                  type="file"
                  accept="image/*"
                  ref={coverInputRef}
                  onChange={handleCoverAdded}
                  className="hidden"
                />

                {/* Audio files hidden input */}
                <input
                  type="file"
                  multiple
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
                  ref={fileInputRef}
                  onChange={handleFilesAdded}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Subheader: Track Filter & Sorting controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-b border-slate-200/60 dark:border-white/5">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={isFa ? "فیلتر آهنگ یا هنرمند..." : "Search in playlist..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{isFa ? "مرتب‌سازی:" : "Sort by:"}</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-transparent border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none cursor-pointer"
              >
                <option value="manual">{isFa ? "ترتیب پیش‌فرض" : "Custom Order"}</option>
                <option value="title">{isFa ? "نام قطعه" : "Title"}</option>
                <option value="artist">{isFa ? "نام خواننده" : "Artist"}</option>
                <option value="duration">{isFa ? "مدت زمان" : "Duration"}</option>
              </select>

              {sortField !== "manual" && (
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10"
                  title={isFa ? "تغییر جهت صعودی/نزولی" : "Toggle direction"}
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </button>
              )}
            </div>
          </div>

          {/* Track List Table Header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200/40 dark:border-white/5">
            <span className="col-span-1 text-center">#</span>
            <span className="col-span-7 sm:col-span-6">{isFa ? "عنوان" : "Title"}</span>
            <span className="hidden sm:block sm:col-span-3">{isFa ? "آلبوم" : "Album"}</span>
            <span className="col-span-4 sm:col-span-2 text-right flex items-center justify-end gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{isFa ? "زمان" : "Duration"}</span>
            </span>
          </div>

          {/* Track Rows */}
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/[0.03]">
            {processedTracks.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Music className="w-14 h-14 mb-3 opacity-20" strokeWidth={1.5} />
                <p className="font-semibold text-base">
                  {searchQuery
                    ? isFa
                      ? "هیچ آهنگی مطابق فیلتر شما پیدا نشد."
                      : "No tracks match your filter."
                    : isFa
                    ? "این پلی‌لیست هنوز قطعه‌ای ندارد."
                    : "No tracks in this playlist yet."}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                    {isFa
                      ? "فایل‌های صوتی خود را بکشید و در این صفحه رها کنید یا روی دکمه افزودن آهنگ بزنید."
                      : "Drag & drop audio files anywhere on this page, or click Add Tracks above."}
                  </p>
                )}
              </div>
            ) : (
              processedTracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const isTrackActive = isCurrent && isPlaying;

                return (
                  <div
                    key={track.id}
                    onClick={() => handleToggleTrack(track, idx)}
                    className={`group grid grid-cols-12 gap-3 items-center px-4 py-2.5 rounded-xl transition-colors cursor-pointer ${
                      isCurrent
                        ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                        : "hover:bg-slate-100/80 dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {/* Index / Play / Equalizer State */}
                    <div className="col-span-1 flex items-center justify-center">
                      {isTrackActive ? (
                        <div className="flex items-end gap-0.5 h-4">
                          <span className="w-1 bg-cyan-500 animate-bounce h-3 rounded-full" />
                          <span className="w-1 bg-cyan-500 animate-bounce h-4 rounded-full [animation-delay:0.15s]" />
                          <span className="w-1 bg-cyan-500 animate-bounce h-2 rounded-full [animation-delay:0.3s]" />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 group-hover:hidden font-mono">
                          {idx + 1}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTrack(track, idx);
                        }}
                        className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full text-slate-900 dark:text-white"
                      >
                        {isTrackActive ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>

                    {/* Title, Artist, Thumbnail */}
                    <div className="col-span-7 sm:col-span-6 flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 flex items-center justify-center relative">
                        {track.coverUrl ? (
                          <img
                            src={track.coverUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Music className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className={`font-semibold text-sm truncate ${
                            isCurrent ? "text-cyan-600 dark:text-cyan-400 font-bold" : ""
                          }`}
                        >
                          {track.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Album */}
                    <div className="hidden sm:block sm:col-span-3 text-xs text-slate-500 dark:text-slate-400 truncate">
                      {track.album || selectedPlaylist.name}
                    </div>

                    {/* Duration & Track Action Menu */}
                    <div className="col-span-4 sm:col-span-2 flex items-center justify-end gap-2 text-xs font-mono text-slate-500">
                      <span>{formatDuration(track.duration)}</span>

                      {/* Manual Reordering arrows (visible on hover if sort is manual) */}
                      {sortField === "manual" && !searchQuery && (
                        <div className="hidden group-hover:flex items-center gap-0.5 text-slate-400">
                          <button
                            onClick={(e) => handleMoveTrack(idx, "up", e)}
                            disabled={idx === 0}
                            className="p-1 hover:text-cyan-500 disabled:opacity-20"
                            title={isFa ? "انتقال به بالا" : "Move up"}
                          >
                            ▲
                          </button>
                          <button
                            onClick={(e) => handleMoveTrack(idx, "down", e)}
                            disabled={idx === playlistTracks.length - 1}
                            className="p-1 hover:text-cyan-500 disabled:opacity-20"
                            title={isFa ? "انتقال به پایین" : "Move down"}
                          >
                            ▼
                          </button>
                        </div>
                      )}

                      {/* Download button for track */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const a = document.createElement("a");
                          a.href = track.url.includes("/yt/")
                            ? apiUrl(`/yt/download/${track.id.replace(/^(yt-|youtube-)/, "")}?title=${encodeURIComponent(track.title)}`)
                            : apiUrl(track.url);
                          a.download = `${track.artist} - ${track.title}.mp3`.replace(/[/\\?%*:|"<>]/g, "");
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-400 hover:text-cyan-500 transition-all"
                        title={isFa ? "دانلود موزیک" : "Download track"}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteTrack(track.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition-all"
                        title={isFa ? "حذف از پلی‌لیست" : "Remove track"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE PLAYLIST */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold tracking-tight">
                  {isFa ? "ساخت پلی‌لیست جدید" : "Create New Playlist"}
                </h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isFa ? "نام پلی‌لیست" : "Playlist Name"} *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder={isFa ? "مثلاً: آهنگ‌های آرامش‌بخش، باشگاه..." : "e.g. Chill Beats, Workout..."}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isFa ? "توضیحات (اختیاری)" : "Description (optional)"}
                  </label>
                  <textarea
                    value={newPlaylistDesc}
                    onChange={(e) => setNewPlaylistDesc(e.target.value)}
                    rows={2}
                    placeholder={isFa ? "توضیح کوتاه درباره این مجموعه..." : "Brief description of this collection..."}
                    className="w-full px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  >
                    {isFa ? "انصراف" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={!newPlaylistName.trim()}
                    className="px-5 py-2 rounded-xl bg-cyan-500 text-white font-semibold text-xs sm:text-sm hover:bg-cyan-400 active:scale-95 disabled:opacity-40 transition-all"
                  >
                    {isFa ? "ایجاد پلی‌لیست" : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
