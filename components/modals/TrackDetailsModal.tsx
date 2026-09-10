/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Play, Pause, Heart, Share2, Download, Bot } from "lucide-react";
import { Track } from "@/types";

interface TrackDetailsModalProps {
  track: Track | null;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onPause: () => void;
  onResume: () => void;
  onLikeTrack: (track: Track) => void;
  onShareTrack: (track: Track) => void;
  onDownloadTrack?: (track: Track) => void;
  isLiked: boolean;
  onAskAi: (track: Track) => void;
  language: "en" | "fa";
  l: any;
}

export const TrackDetailsModal: React.FC<TrackDetailsModalProps> = ({
  track,
  onClose,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onPause,
  onResume,
  onLikeTrack,
  onShareTrack,
  onDownloadTrack,
  isLiked,
  onAskAi,
  language,
  l,
}) => {
  if (!track) return null;

  const isCurrentActive = currentTrack?.id === track.id;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/45 dark:bg-black/55 backdrop-blur-xl cursor-pointer"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.92, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 20, opacity: 0 }}
          transition={{ type: "spring", duration: 0.45, bounce: 0.2 }}
          className="liquid-glass-modal rounded-3xl p-6 max-w-md w-full relative z-10 overflow-hidden text-slate-900 dark:text-white"
        >
          <div className="specular-rim-top" />
          <button
            className="absolute top-4 end-4 p-2 bg-slate-100/80 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-full transition-colors text-slate-800 dark:text-white z-10 cursor-pointer border border-white/15 shadow-sm"
            onClick={onClose}
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>

          {/* Cover Art */}
          <div className="w-full aspect-square md:h-72 rounded-2xl mb-6 shadow-md border border-slate-200 dark:border-white/10 overflow-hidden relative group">
            <img
              src={track.coverUrl}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              alt={track.title}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 items-center justify-center">
              <button
                onClick={() => {
                  if (isCurrentActive) {
                    isPlaying ? onPause() : onResume();
                  } else {
                    onPlayTrack(track);
                  }
                }}
                className="w-16 h-16 bg-white dark:bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
              >
                {isCurrentActive && isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" strokeWidth={1.75} />
                ) : (
                  <Play className="w-7 h-7 ml-0.5 fill-current" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          {/* Track Info */}
          <div className="space-y-4 text-slate-800 dark:text-slate-200">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex-1 pr-4 min-w-0">
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight mb-1 truncate">
                  {track.title}
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-400 font-medium truncate">
                  {track.artist}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => onLikeTrack(track)}
                  className={`p-2.5 rounded-full bg-slate-100 dark:bg-white/5 transition-colors cursor-pointer ${
                    isLiked ? "text-rose-500" : "text-slate-500 hover:text-rose-500"
                  }`}
                  title={isLiked ? "Unlike" : "Like"}
                >
                  <Heart
                    className="w-5 h-5"
                    strokeWidth={1.75}
                    fill={isLiked ? "currentColor" : "none"}
                  />
                </button>
                <button
                  onClick={() => onShareTrack(track)}
                  className="p-2.5 rounded-full bg-slate-100 dark:bg-white/5 transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  title="Share"
                >
                  <Share2 className="w-5 h-5" strokeWidth={1.75} />
                </button>
                {onDownloadTrack && (
                  <button
                    onClick={() => onDownloadTrack(track)}
                    className="p-2.5 rounded-full bg-slate-100 dark:bg-white/5 transition-colors text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 cursor-pointer"
                    title={language === "fa" ? "دانلود موزیک" : "Download track"}
                  >
                    <Download className="w-5 h-5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>

            {track.album && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                  {l.album}
                </p>
                <p className="font-medium text-base text-slate-800 dark:text-slate-200 truncate">
                  {track.album}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => onAskAi(track)}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <Bot className="w-4 h-4" strokeWidth={1.75} />
                <span>
                  {language === "fa"
                    ? "تحلیل با هوش مصنوعی"
                    : "Analyze with AI"}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-white/10 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
                  {track.category || "Music"}
                </span>
                {track.isLocal && (
                  <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-500/30">
                    Offline
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
