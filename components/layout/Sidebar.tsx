/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Disc, X } from "lucide-react";
import {
  LikedSongsIcon,
  DownloadsIcon,
  SmartAssistantIcon,
  DailyMixesIcon,
  EqualizerMixIcon,
  AudioQualityIcon,
  HomeIcon,
  SearchIcon,
  ExploreIcon,
} from "../icons/SidebarIcons";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  likedCount?: number;
  offlineCount?: number;
  language: "en" | "fa";
  l: any;
  isPlaying?: boolean;
}

export const Sidebar = React.memo<SidebarProps>(({
  activeTab,
  setActiveTab,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  likedCount = 0,
  offlineCount = 0,
  language,
  l,
  isPlaying = false,
}) => {
  const isRtl = language === "fa";

  const navPrimary = [
    {
      id: "home",
      label: l.home || (isRtl ? "صفحه اصلی" : "Home"),
      icon: HomeIcon,
    },
    {
      id: "search",
      label: l.search || (isRtl ? "جستجو" : "Search"),
      icon: SearchIcon,
    },
    {
      id: "explore",
      label: l.explore || (isRtl ? "کاوش" : "Explore"),
      icon: ExploreIcon,
    },
  ];

  const navLibrary = [
    {
      id: "library",
      label: l.likedSongs || (isRtl ? "آهنگ‌های پسندیده" : "Liked Songs"),
      icon: LikedSongsIcon,
      badge: likedCount > 0 ? `${likedCount}` : undefined,
    },
    {
      id: "offline",
      label: l.offlineBundles || (isRtl ? "دانلودها" : "Downloads"),
      icon: DownloadsIcon,
      badge: offlineCount > 0 ? `${offlineCount}` : undefined,
    },
  ];

  const navStudio = [
    {
      id: "ai",
      label: l.aiDJ || (isRtl ? "دستیار هوشمند" : "Smart Assistant"),
      icon: SmartAssistantIcon,
    },
    {
      id: "ai-playlist",
      label: l.neuralPlaylists || (isRtl ? "میکس‌های روزانه" : "Daily Mixes"),
      icon: DailyMixesIcon,
      tag: "NEW",
    },
    {
      id: "dj",
      label: l.djStudio || (isRtl ? "اکولایزر و میکس" : "Equalizer & Mix"),
      icon: EqualizerMixIcon,
    },
    {
      id: "lab",
      label: l.audioLabSection || (isRtl ? "کیفیت صدا" : "Audio Quality"),
      icon: AudioQualityIcon,
    },
  ];

  const renderNavButton = (
    item: {
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string; isActive?: boolean }>;
      badge?: string;
      tag?: string;
    },
    onSelect?: () => void
  ) => {
    const isActive = activeTab === item.id;
    const IconComponent = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => {
          setActiveTab(item.id);
          if (onSelect) onSelect();
        }}
        className={`group relative flex items-center justify-between w-full h-[48px] sm:h-[50px] px-2.5 sm:px-3 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] ${
          isRtl ? "hover:-translate-x-1" : "hover:translate-x-1"
        } ${
          isActive
            ? "bg-white/85 dark:bg-gradient-to-r dark:from-white/[0.09] dark:to-cyan-500/[0.08] text-slate-950 dark:text-white font-semibold shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_24px_rgba(6,182,212,0.22)] ring-1 ring-white/60 dark:ring-cyan-400/30"
            : "text-slate-600 dark:text-[#aeb8d2] hover:text-slate-950 dark:hover:text-[#edf1ff] hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
        }`}
      >
        {/* Specular top rim on active item */}
        {isActive && (
          <div className="absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent pointer-events-none shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
        )}

        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 z-10">
          {/* Precision Icon Box Housing */}
          <div className={`sidebar-iconbox ${isActive ? "is-active !border-cyan-500/60 dark:!border-cyan-400/60" : ""}`}>
            <IconComponent
              className="w-5 h-5 sm:w-[21px] sm:h-[21px] transition-transform duration-200 group-hover:scale-105"
              isActive={isActive}
            />
          </div>

          <span className="truncate whitespace-nowrap text-[13.5px] sm:text-[14px] font-semibold tracking-[-0.2px]">
            {item.label}
          </span>
        </div>

        {/* Trailing Status & Badges */}
        <div className="flex items-center gap-2 shrink-0 z-10">
          {item.badge && (
            <span className="sidebar-badge">
              {item.badge}
            </span>
          )}

          {item.tag && !item.badge && (
            <span className="sidebar-new-tag">
              {item.tag}
            </span>
          )}

          {isActive && !item.tag && !item.badge && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee,0_0_20px_#06b6d4]" />
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/45 dark:bg-black/55 backdrop-blur-xl z-[60] md:hidden cursor-pointer"
            />
            <motion.div
              initial={{ x: isRtl ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? "100%" : "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className={`fixed inset-y-0 ${
                isRtl ? "right-0 border-l" : "left-0 border-r"
              } w-72 liquid-glass-modal !rounded-none z-[70] md:hidden flex flex-col p-4 shadow-2xl`}
            >
              {/* Mobile Header */}
              <div className="flex items-center justify-between px-2 pb-4 pt-2 border-b border-slate-200/60 dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-[0_2px_10px_rgba(6,182,212,0.3)] ring-1 ring-white/20 shrink-0">
                    <Disc className="w-4 h-4 text-white animate-[spin_8s_linear_infinite]" strokeWidth={1.75} />
                  </div>
                  <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    {l.brand}
                  </h1>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="Close Navigation"
                  aria-label="Close Navigation"
                >
                  <X className="w-4.5 h-4.5" strokeWidth={1.75} />
                </button>
              </div>

              {/* Mobile Nav Content */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                <div className="space-y-1">
                  {navPrimary.map((item) =>
                    renderNavButton(item, () => setIsMobileMenuOpen(false))
                  )}
                </div>

                <div className="h-[1px] my-2 bg-gradient-to-r from-transparent via-slate-300 dark:via-[#252d45] to-transparent" />
                
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-[1.28px] text-slate-400 dark:text-[#687592]">
                    {isRtl ? "کتابخانه شما" : "COLLECTION"}
                  </div>
                  <div className="space-y-1 mt-1">
                    {navLibrary.map((item) =>
                      renderNavButton(item, () => setIsMobileMenuOpen(false))
                    )}
                  </div>
                </div>

                <div className="h-[1px] my-2 bg-gradient-to-r from-transparent via-slate-300 dark:via-[#252d45] to-transparent" />

                <div>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-[1.28px] text-slate-400 dark:text-[#687592]">
                    {isRtl ? "کشف و ابزارهای صوتی" : "CURATED DISCOVERY"}
                  </div>
                  <div className="space-y-1 mt-1">
                    {navStudio.map((item) =>
                      renderNavButton(item, () => setIsMobileMenuOpen(false))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR */}
      <aside className="w-68 lg:w-72 liquid-glass rounded-2xl flex-col hidden md:flex flex-shrink-0 p-3.5 relative overflow-hidden transition-all duration-300 select-none border border-slate-200/80 dark:border-white/[0.08] shadow-[0_30px_90px_rgba(0,0,0,0.52)]">
        {/* Optical Specular Edge Reflection */}
        <div className="specular-rim-top" />

        {/* Logo & Brand Identity */}
        <div className="flex items-center justify-between px-2 pb-4 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-[0_2px_10px_rgba(6,182,212,0.3)] ring-1 ring-white/20 shrink-0">
              <Disc className="w-4 h-4 text-white" strokeWidth={1.75} />
            </div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              {l.brand}
            </h1>
          </div>

          {isPlaying && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/25">
              <span className="w-0.5 h-2.5 bg-cyan-400 rounded-full animate-pulse" />
              <span className="w-0.5 h-4 bg-cyan-400 rounded-full animate-pulse delay-75" />
              <span className="w-0.5 h-2 bg-cyan-400 rounded-full animate-pulse delay-150" />
            </div>
          )}
        </div>

        {/* Primary Navigation */}
        <div className="flex flex-col gap-1 mb-3">
          {navPrimary.map((item) => renderNavButton(item))}
        </div>

        {/* Divider */}
        <div className="h-[1px] my-1 mx-2 bg-gradient-to-r from-transparent via-slate-300 dark:via-[#252d45] to-transparent" />

        {/* Library Section */}
        <div className="flex flex-col gap-1">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1.28px] text-slate-400 dark:text-[#687592]">
            {isRtl ? "کتابخانه صوتی" : "COLLECTION"}
          </div>
          <div className="space-y-0.5">
            {navLibrary.map((item) => renderNavButton(item))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] my-2 mx-2 bg-gradient-to-r from-transparent via-slate-300 dark:via-[#252d45] to-transparent" />

        {/* Curated Discovery Section */}
        <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1.28px] text-slate-400 dark:text-[#687592]">
            {isRtl ? "کشف و ابزارهای صوتی" : "CURATED DISCOVERY"}
          </div>
          <div className="space-y-0.5">
            {navStudio.map((item) => renderNavButton(item))}
          </div>
        </div>
      </aside>
    </>
  );
});
Sidebar.displayName = "Sidebar";

