/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Loader2,
  ListMusic,
  Laptop2,
  Sparkles,
} from "lucide-react";
import { Track } from "@/types";

interface PlayerFooterProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;
  isShuffle: boolean;
  setIsShuffle: (val: boolean) => void;
  isRepeat: boolean;
  setIsRepeat: (val: boolean) => void;
  is8D: boolean;
  toggle8D: () => void;
  togglePiP: () => void;
  isMiniPlayer: boolean;
  pipWindow: Window | null;
  isMuted: boolean;
  volume: number;
  setVolume: (val: number) => void;
  handleMuteToggle: () => void;
  handleLikeTrack: (track: Track) => void;
  handleShareTrack: (track: Track) => void;
  handleDownloadTrack?: (track: Track) => void;
  handlePlayPrev: (force?: boolean) => void;
  handlePlayNext: (force?: boolean) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  likedTracks: Track[];
  language: "en" | "fa";
}

export const PlayerFooter = React.memo<PlayerFooterProps>(({
  currentTrack,
  isPlaying,
  isLoading,
  duration,
  isShuffle,
  setIsShuffle,
  isRepeat,
  setIsRepeat,
  is8D,
  toggle8D,
  togglePiP,
  isMiniPlayer,
  pipWindow,
  isMuted,
  volume,
  setVolume,
  handleMuteToggle,
  handleLikeTrack,
  handlePlayPrev,
  handlePlayNext,
  pause,
  resume,
  seek,
  likedTracks,
  language,
}) => {
  const isLiked = currentTrack
    ? likedTracks.some((t) => t.id === currentTrack.id)
    : false;

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <footer className="w-full liquid-glass-dock h-auto md:h-20 flex flex-col md:flex-row px-3 sm:px-4 md:px-6 items-center justify-between z-50 relative border-t border-slate-200/80 dark:border-white/[0.08] py-2.5 md:py-0 gap-2 md:gap-0 shadow-2xl select-none">
      {/* ========================================================================= */}
      {/* ZONE 1 (LEFT): Track Info, Album Thumbnail, & Quick Like                 */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between w-full md:w-[30%] min-w-0 h-full">
        <div className="flex items-center min-w-0 flex-1 my-auto gap-2.5 sm:gap-3">
          {currentTrack ? (
            <>
              {/* Cover Art with subtle glow & play overlay */}
              <div
                className={`relative w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer group shadow-md ring-1 transition-all duration-300 ${
                  isPlaying
                    ? "ring-cyan-500/50 shadow-[0_4px_14px_rgba(6,182,212,0.25)]"
                    : "ring-white/20 dark:ring-white/10 hover:scale-[1.03]"
                }`}
                onClick={() => (isPlaying ? pause() : resume())}
                title={isPlaying ? "Pause" : "Play"}
              >
                <img
                  src={currentTrack.coverUrl}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                />

                {/* Play/Pause Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 flex opacity-0 group-hover:opacity-100 items-center justify-center transition-opacity duration-200 backdrop-blur-xs">
                  {isPlaying ? (
                    <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-current" strokeWidth={1.75} />
                  ) : (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 text-white ml-0.5 fill-current" strokeWidth={1.75} />
                  )}
                </div>

                {/* Footer Live Equalizer Bars */}
                {isPlaying && (
                  <div className="absolute bottom-1 right-1 flex items-end gap-0.5 bg-black/70 px-1 py-0.5 rounded backdrop-blur-xs pointer-events-none group-hover:opacity-0 transition-opacity duration-200">
                    <span className="w-0.5 bg-cyan-400 rounded-full animate-eq-1" />
                    <span className="w-0.5 bg-blue-400 rounded-full animate-eq-2" />
                    <span className="w-0.5 bg-violet-400 rounded-full animate-eq-3" />
                  </div>
                )}
              </div>

              {/* Title & Artist with accessible contrast */}
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-white leading-tight">
                  {currentTrack.title}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {currentTrack.artist}
                </div>
              </div>

              {/* Quick Like Icon (responsive 36-40px Apple-style hit-target) */}
              <button
                onClick={() => handleLikeTrack(currentTrack)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 ${
                  isLiked
                    ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/15"
                    : "text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.08]"
                }`}
                title={isLiked ? "Unlike" : "Like"}
                aria-label={isLiked ? "Unlike" : "Like"}
              >
                <Heart
                  className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-active:scale-90"
                  strokeWidth={1.75}
                  fill={isLiked ? "currentColor" : "none"}
                />
              </button>
            </>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 italic">
              {language === "fa" ? "آهنگی انتخاب نشده است" : "No track selected"}
            </div>
          )}
        </div>

        {/* Mobile Mini Playback Controls with Apple-standard Touch Targets */}
        <div className="md:hidden flex items-center gap-1.5 ml-2 shrink-0">
          <button
            onClick={() => handlePlayPrev(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-90 transition-all cursor-pointer"
            aria-label="Previous Track"
          >
            <SkipBack className="w-4.5 h-4.5 fill-current" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => (isPlaying ? pause() : resume())}
            disabled={!currentTrack}
            className="w-10 h-10 flex items-center justify-center rounded-full text-white bg-gradient-to-tr from-cyan-400 via-blue-600 to-indigo-600 shadow-[0_0_18px_rgba(6,182,212,0.65),0_0_32px_rgba(99,102,241,0.3)] ring-1 ring-white/40 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4.5 h-4.5 fill-current" strokeWidth={1.75} />
            ) : (
              <Play className="w-4.5 h-4.5 ml-0.5 fill-current" strokeWidth={1.75} />
            )}
          </button>
          <button
            onClick={() => handlePlayNext(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-90 transition-all cursor-pointer"
            aria-label="Next Track"
          >
            <SkipForward className="w-4.5 h-4.5 fill-current" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ZONE 2 (CENTER): Transport Controls & Full-Width Scrubber                 */}
      {/* ========================================================================= */}
      <div className="flex flex-col items-center justify-center w-full md:max-w-[44%] h-full py-1">
        {/* Clean Transport Controls with Responsive Touch Targets and Optical Icons */}
        <div className="hidden md:flex items-center gap-2 lg:gap-2.5 mb-1">
          <button
            onClick={() => setIsShuffle(!isShuffle)}
            className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
              isShuffle
                ? "text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 dark:bg-cyan-400/10 font-bold"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.08]"
            }`}
            title="Shuffle"
            aria-label="Shuffle"
          >
            <Shuffle className="w-4 h-4 lg:w-4.5 lg:h-4.5" strokeWidth={1.75} />
          </button>

          <button
            onClick={() => handlePlayPrev(true)}
            className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.08] transition-all cursor-pointer active:scale-90"
            title="Previous"
            aria-label="Previous Track"
          >
            <SkipBack className="w-4 h-4 lg:w-4.5 lg:h-4.5 fill-current" strokeWidth={1.75} />
          </button>

          {/* Primary High-Contrast Play/Pause Button */}
          <button
            onClick={() => (isPlaying ? pause() : resume())}
            disabled={!currentTrack}
            className="w-10 h-10 lg:w-11 lg:h-11 flex items-center justify-center rounded-full text-white bg-gradient-to-tr from-cyan-400 via-blue-600 to-indigo-600 shadow-[0_0_22px_rgba(6,182,212,0.65),0_0_42px_rgba(99,102,241,0.35)] ring-1 ring-white/40 transition-all hover:scale-105 hover:shadow-[0_0_28px_rgba(6,182,212,0.85)] active:scale-95 disabled:opacity-50 cursor-pointer mx-1"
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin text-current" strokeWidth={1.75} />
            ) : isPlaying ? (
              <Pause className="w-4.5 h-4.5 lg:w-5 lg:h-5 fill-current" strokeWidth={1.75} />
            ) : (
              <Play className="w-4.5 h-4.5 lg:w-5 lg:h-5 fill-current ml-0.5" strokeWidth={1.75} />
            )}
          </button>

          <button
            onClick={() => handlePlayNext(true)}
            className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.08] transition-all cursor-pointer active:scale-90"
            title="Next"
            aria-label="Next Track"
          >
            <SkipForward className="w-4 h-4 lg:w-4.5 lg:h-4.5 fill-current" strokeWidth={1.75} />
          </button>

          <button
            onClick={() => setIsRepeat(!isRepeat)}
            className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
              isRepeat
                ? "text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 dark:bg-cyan-400/10 font-bold"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.08]"
            }`}
            title="Repeat"
            aria-label="Repeat"
          >
            <Repeat className="w-4 h-4 lg:w-4.5 lg:h-4.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Full-Width Track Progress Scrubber */}
        <div
          dir="ltr"
          className="flex items-center w-full max-w-[540px] gap-2 sm:gap-2.5 text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 px-1 sm:px-2 md:px-0 select-none"
        >
          <span className="w-8 sm:w-9 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 font-medium">
            <span className="sync-time">0:00</span>
          </span>
          <div className="flex-1 group/slider flex items-center h-4 relative cursor-pointer">
            <div className="absolute inset-x-0 h-1 bg-slate-200/80 dark:bg-white/10 rounded-full overflow-hidden pointer-events-none group-hover/slider:h-2 transition-[height] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] border border-slate-300/40 dark:border-white/10">
              <div
                className="sync-width h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 rounded-full shadow-[0_0_16px_rgba(6,182,212,0.9),0_0_28px_rgba(6,182,212,0.5)]"
                style={{ width: "0%" }}
              />
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              defaultValue="0"
              onChange={(e) => seek(Number(e.target.value))}
              className="sync-val absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="Seek track position"
            />
            <div
              className="sync-left absolute w-3.5 h-3.5 bg-white border-2 border-cyan-400 rounded-full shadow-[0_0_14px_rgba(6,182,212,1),0_0_24px_rgba(6,182,212,0.6)] pointer-events-none transform -translate-x-1/2 scale-75 opacity-0 group-hover/slider:scale-100 group-hover/slider:opacity-100 transition-all duration-200 ease-out"
              style={{ left: "0%" }}
            />
          </div>
          <span className="w-8 sm:w-9 text-left font-mono tabular-nums text-slate-500 dark:text-slate-400 font-medium">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ZONE 3 (RIGHT): Volume, Device/PiP, Audio Quality, Queue                 */}
      {/* ========================================================================= */}
      <div className="hidden md:flex items-center justify-end w-[30%] min-w-[210px] gap-2 lg:gap-2.5 text-slate-500 dark:text-slate-400 pe-2">
        {/* Audio Quality Badge (Spatial Audio / Hi-Res Lossless) */}
        <button
          onClick={toggle8D}
          className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full text-[10px] lg:text-[11px] font-mono tracking-wider transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer border ${
            is8D
              ? "bg-cyan-500/15 dark:bg-cyan-400/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/40 dark:border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-bold"
              : "bg-slate-200/50 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border-slate-300/40 dark:border-white/[0.08] hover:border-slate-400 font-medium"
          }`}
          title={
            language === "fa"
              ? "صدای فراگیر استودیویی و پردازش اسپاتشال"
              : "Toggle Spatial Audio DSP"
          }
          aria-label="Toggle Spatial Audio DSP"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              is8D ? "bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,1)]" : "bg-slate-400"
            }`}
          />
          <span>{is8D ? "SPATIAL" : "LOSSLESS"}</span>
        </button>

        {/* Device / Casting / Mini-player Selector */}
        <button
          onClick={togglePiP}
          className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
            isMiniPlayer || pipWindow
              ? "text-cyan-500 dark:text-cyan-400 bg-cyan-500/10"
              : "text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.08]"
          }`}
          title={
            language === "fa"
              ? "مینی‌پلیر شناور خارج از صفحه"
              : "Floating Mini Player / AirPlay"
          }
          aria-label="Floating Mini Player / AirPlay"
        >
          <PictureInPicture2 className="w-4 h-4 lg:w-4.5 lg:h-4.5" strokeWidth={1.75} />
        </button>

        {/* Volume Controls */}
        <div dir="ltr" className="flex items-center gap-1.5 lg:gap-2 group w-24 lg:w-28 pe-1">
          <button
            onClick={handleMuteToggle}
            className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer active:scale-95"
            title={isMuted ? "Unmute" : "Mute"}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 lg:w-4.5 lg:h-4.5" strokeWidth={1.75} />
            ) : (
              <Volume2 className="w-4 h-4 lg:w-4.5 lg:h-4.5" strokeWidth={1.75} />
            )}
          </button>
          <div className="flex-1 flex items-center h-3 relative px-0.5">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (val > 0) handleMuteToggle();
              }}
              className="w-full h-1 bg-slate-200/80 dark:bg-white/15 rounded-full accent-cyan-500 cursor-pointer transition-[height] duration-150 group-hover:h-1.5"
              aria-label="Adjust volume"
            />
          </div>
        </div>
      </div>
    </footer>
  );
});
PlayerFooter.displayName = "PlayerFooter";

