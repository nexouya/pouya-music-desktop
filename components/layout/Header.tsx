/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Menu, Settings, User, Disc, Minus, Square, X } from "lucide-react";

interface HeaderProps {
  activeTab: string;
  isPlaying: boolean;
  currentTrackTitle?: string;
  onOpenMobileMenu: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  username: string;
  language: "en" | "fa";
  l: any;
}

export const Header = React.memo<HeaderProps>(({
  activeTab,
  isPlaying,
  currentTrackTitle,
  onOpenMobileMenu,
  onOpenSettings,
  onOpenProfile,
  username,
  language,
  l,
}) => {
  const isRtl = language === "fa";
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.isDesktop) {
      setIsDesktop(true);
    }
  }, []);

  const handleMinimize = () => (window as any).electronAPI?.minimize?.();
  const handleMaximize = () => (window as any).electronAPI?.maximize?.();
  const handleClose = () => (window as any).electronAPI?.close?.();

  const getSectionTitle = () => {
    switch (activeTab) {
      case "home":
        return l.home;
      case "explore":
        return l.explore;
      case "search":
        return l.search;
      case "library":
        return l.likedSongs || (isRtl ? "آهنگ‌های پسندیده" : "Liked Songs");
      case "offline":
        return l.offlineBundles || (isRtl ? "دانلودها" : "Downloads");
      case "ai":
        return l.aiDJ || (isRtl ? "دستیار هوشمند" : "Smart Assistant");
      case "ai-playlist":
        return l.neuralPlaylists || (isRtl ? "میکس‌های روزانه" : "Daily Mixes");
      case "dj":
        return l.djStudio || (isRtl ? "اکولایزر و میکس" : "Equalizer & Mix");
      case "lab":
        return l.audioLabSection || (isRtl ? "کیفیت صدا" : "Audio Quality");
      default:
        return activeTab;
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/70 dark:bg-[#070b16]/70 backdrop-blur-3xl px-4 md:px-6 py-3 flex items-center justify-between border-b border-white/60 dark:border-white/10 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.65),0_0_32px_-4px_rgba(6,182,212,0.18)] relative transition-all duration-300 select-none">
      {/* Specular Top Light Rim */}
      <div className="specular-rim-top" />

      {/* Left / Start: Mobile Menu + Clean Section Indicator */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={onOpenMobileMenu}
            className="w-10 h-10 rounded-xl liquid-glass-pill flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs shrink-0"
            title="Open Menu"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-[0_2px_12px_rgba(6,182,212,0.35)] ring-1 ring-white/20 shrink-0">
            <Disc className="w-4 h-4 text-white animate-[spin_8s_linear_infinite]" strokeWidth={1.75} />
          </div>
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
            {l.brand}
          </h1>
        </div>

        {/* Section Heading & Live Playback Status */}
        <div className="hidden md:flex items-center gap-3">
          <h2 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            {getSectionTitle()}
          </h2>

          {/* Live Audio Activity Wave with Liquid Glass Pill */}
          {isPlaying && (
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full liquid-glass-pill text-slate-700 dark:text-slate-200 shadow-xs border border-cyan-500/20 dark:border-cyan-400/30 dark:shadow-[0_0_12px_rgba(6,182,212,0.2)]"
              title={currentTrackTitle ? `Now playing: ${currentTrackTitle}` : "Live playback active"}
            >
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 h-2 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-pulse shadow-[0_0_6px_#22d3ee]" />
                <span className="w-0.5 h-3 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-pulse delay-75 shadow-[0_0_6px_#22d3ee]" />
                <span className="w-0.5 h-1.5 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-pulse delay-150 shadow-[0_0_6px_#22d3ee]" />
                <span className="w-0.5 h-2.5 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-pulse delay-200 shadow-[0_0_6px_#22d3ee]" />
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
                {currentTrackTitle || (isRtl ? "در حال پخش" : "Playing")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right / End: Settings & Profile Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <button
          onClick={onOpenSettings}
          className="group flex items-center gap-2 liquid-glass-pill hover:bg-white/95 dark:hover:bg-white/[0.12] rounded-xl p-1.5 sm:px-3 sm:py-2 transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
          title={language === "en" ? "Settings" : "تنظیمات"}
          aria-label={language === "en" ? "Settings" : "تنظیمات"}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-200/50 dark:bg-white/[0.06] border border-slate-300/40 dark:border-white/[0.12] flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 group-hover:border-cyan-500/40 dark:group-hover:border-cyan-400/50 dark:group-hover:shadow-[0_0_14px_rgba(6,182,212,0.35)] transition-all shadow-2xs">
            <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.75} />
          </div>
          <span className="hidden md:inline text-xs font-semibold text-slate-700 dark:text-slate-200">
            {language === "fa" ? "تنظیمات" : "Settings"}
          </span>
        </button>

        <button
          onClick={onOpenProfile}
          className="group flex items-center gap-2 liquid-glass-pill hover:bg-white/95 dark:hover:bg-white/[0.12] rounded-xl p-1.5 sm:px-3 sm:py-2 transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
          title="User Profile"
          aria-label="User Profile"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-200/50 dark:bg-white/[0.06] border border-slate-300/40 dark:border-white/[0.12] flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 group-hover:border-cyan-500/40 dark:group-hover:border-cyan-400/50 dark:group-hover:shadow-[0_0_14px_rgba(6,182,212,0.35)] transition-all shadow-2xs">
            <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.75} />
          </div>
          <span className="hidden sm:inline text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[100px] truncate font-sans">
            {username}
          </span>
        </button>

        {/* Desktop Native Window Action Controls */}
        {isDesktop && (
          <div className="flex items-center gap-1.5 ms-1 ps-2 border-s border-slate-200/60 dark:border-white/10">
            <button
              onClick={handleMinimize}
              className="w-3 h-3 rounded-full bg-amber-400 hover:brightness-110 active:scale-90 transition-all cursor-pointer shadow-2xs"
              title="Minimize"
            />
            <button
              onClick={handleMaximize}
              className="w-3 h-3 rounded-full bg-emerald-400 hover:brightness-110 active:scale-90 transition-all cursor-pointer shadow-2xs"
              title="Maximize"
            />
            <button
              onClick={handleClose}
              className="w-3 h-3 rounded-full bg-rose-500 hover:brightness-110 active:scale-90 transition-all cursor-pointer shadow-2xs"
              title="Close"
            />
          </div>
        )}
      </div>
    </header>
  );
});
Header.displayName = "Header";
