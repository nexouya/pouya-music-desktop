/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Globe } from "lucide-react";
import { Track } from "@/types";
import { RecommendationEngine } from "@/RecommendationEngine";

interface ProfileModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  username: string;
  likedTracks: Track[];
  language: "en" | "fa";
  onSwitchLanguage?: () => void;
  l: any;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  isLoading,
  onClose,
  username,
  likedTracks,
  language,
  onSwitchLanguage,
  l,
}) => {
  if (!isOpen && !isLoading) return null;

  const profile = RecommendationEngine.getProfile();
  const totalPlays = Object.values(profile.playCounts).reduce(
    (a, b) => a + b,
    0
  );

  const topArtists = Object.entries(profile.tasteModel?.artistAffinity || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 2);

  const topGenres = Object.entries(profile.tasteModel?.genreAffinity || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 2);

  const hasStats =
    totalPlays > 0 || topArtists.length > 0 || topGenres.length > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isLoading) onClose();
          }}
          className="absolute inset-0 bg-black/45 dark:bg-black/55 backdrop-blur-xl cursor-pointer"
        />

        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl liquid-glass-modal z-10 p-6 text-slate-900 dark:text-white"
        >
          <div className="specular-rim-top" />
          {/* Subtle Ambient Accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full blur-3xl -z-10 pointer-events-none" />

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-400" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
                {language === "fa"
                  ? "در حال بارگذاری مشخصات کاربری..."
                  : "Securing workstation profile..."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Title Bar */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {l.profile}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" strokeWidth={1.75} />
                </button>
              </div>

              {/* Profile Header Card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06]">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center font-bold text-xl shadow-xs ring-1 ring-black/10 dark:ring-white/10">
                  {username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold tracking-tight truncate">
                    {username}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === "fa"
                      ? "کاربر ویژه پویا موزیک"
                      : "Verified Audio Pro User"}
                  </p>
                </div>
              </div>

              {/* Smart Listening Statistics */}
              <div className="flex flex-col gap-3">
                <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {language === "fa"
                    ? "آمار هوشمند سلیقه شما"
                    : "Playback Statistics"}
                </h5>

                {!hasStats ? (
                  <div className="text-center p-6 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {l.noStats}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                        {l.totalPlays}
                      </span>
                      <span className="text-xl font-bold text-cyan-500 dark:text-cyan-400">
                        {totalPlays}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                        {language === "fa" ? "آهنگ لایک شده" : "Liked Tracks"}
                      </span>
                      <span className="text-xl font-bold text-rose-500">
                        {likedTracks.length}
                      </span>
                    </div>

                    {topArtists.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] flex flex-col gap-1 col-span-2">
                        <span className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                          {l.topArtists}
                        </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {topArtists.map(([artist]) => (
                            <span
                              key={artist}
                              className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20"
                            >
                              {artist}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions Inside Profile */}
              <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-100 dark:border-white/[0.08]">
                {onSwitchLanguage && (
                  <button
                    onClick={onSwitchLanguage}
                    className="flex items-center justify-between w-full p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-100 dark:border-white/[0.06] transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" strokeWidth={1.75} />
                      {language === "fa" ? "زبان برنامه" : "App Language"}
                    </span>
                    <span className="text-xs font-bold text-cyan-500 dark:text-cyan-400">
                      {language === "en" ? "فارسی" : "English"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
