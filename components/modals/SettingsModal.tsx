/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings,
  X,
  Moon,
  Sun,
  Globe,
  Trash2,
  Radio,
  Layers,
  Disc3,
  Cpu,
} from "lucide-react";
import { StreamSourceType } from "../../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settingsTab: "general" | "audio" | "system";
  setSettingsTab: (tab: "general" | "audio" | "system") => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  language: "en" | "fa";
  setLanguage: (lang: "en" | "fa") => void;
  streamSource?: StreamSourceType;
  setStreamSource?: (source: StreamSourceType) => void;
  is8D: boolean;
  toggle8D: () => void;
  panSpeed: number;
  setPanSpeed: (val: number) => void;
  bassBoost: boolean;
  toggleBassBoost: () => void;
  playbackRate: number;
  setPlaybackRate: (val: number) => void;
  isAuthorized: boolean;
  setIsAuthorized: (val: boolean) => void;
  showToast: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settingsTab,
  setSettingsTab,
  theme,
  setTheme,
  language,
  setLanguage,
  streamSource = "both",
  setStreamSource,
  is8D,
  toggle8D,
  panSpeed,
  setPanSpeed,
  bassBoost,
  toggleBassBoost,
  playbackRate,
  setPlaybackRate,
  isAuthorized,
  setIsAuthorized,
  showToast,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/45 dark:bg-black/55 backdrop-blur-xl"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.45, bounce: 0.2 }}
          className="relative w-full max-w-lg liquid-glass-modal rounded-3xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-100 z-10"
        >
          <div className="specular-rim-top" />
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
            <div className="flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
              <h3 className="font-bold text-base md:text-lg">
                {language === "fa"
                  ? "تنظیمات پیشرفته سیستم"
                  : "Advanced System Settings"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-black/10 px-4 pt-2">
            <button
              onClick={() => setSettingsTab("general")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                settingsTab === "general"
                  ? "border-cyan-500 text-cyan-500 dark:text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              {language === "fa" ? "تنظیمات عمومی" : "General"}
            </button>
            <button
              onClick={() => setSettingsTab("audio")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                settingsTab === "audio"
                  ? "border-cyan-500 text-cyan-500 dark:text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              {language === "fa" ? "پردازش صوتی DSP" : "Audio DSP"}
            </button>
            <button
              onClick={() => setSettingsTab("system")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                settingsTab === "system"
                  ? "border-cyan-500 text-cyan-500 dark:text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              {language === "fa" ? "سیستم" : "System"}
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex flex-col gap-6 max-h-[50vh]">
            {settingsTab === "general" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-sm">
                    {language === "fa" ? "پوسته کاربری (تم)" : "App Appearance"}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === "fa"
                      ? "تم دلخواه خود را برای رابط کاربری انتخاب کنید."
                      : "Choose your preferred theme for the interface."}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                        theme === "dark"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-400 font-bold"
                          : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                      }`}
                    >
                      <Moon className="w-4 h-4" strokeWidth={1.75} />
                      {language === "fa" ? "حالت تاریک" : "Dark Mode"}
                    </button>
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                        theme === "light"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-500 font-bold"
                          : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                      }`}
                    >
                      <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
                      {language === "fa" ? "حالت روشن" : "Light Mode"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-sm">
                    {language === "fa" ? "زبان برنامه" : "App Language"}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === "fa"
                      ? "تغییر زبان رابط کاربری به انگلیسی یا فارسی."
                      : "Switch interface language between Persian and English."}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <button
                      onClick={() => setLanguage("fa")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                        language === "fa"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-400 font-bold"
                          : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                      }`}
                    >
                      <Globe className="w-4 h-4" strokeWidth={1.75} />
                      فارسی
                    </button>
                    <button
                      onClick={() => setLanguage("en")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                        language === "en"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-400 font-bold"
                          : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                      }`}
                    >
                      <Globe className="w-4 h-4" strokeWidth={1.75} />
                      English
                    </button>
                  </div>
                </div>

                {/* Streaming Source Preference */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-sm">
                      {language === "fa" ? "موتور استریم و تحویل محتوا" : "Streaming Delivery Engine"}
                    </label>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      {streamSource === "both"
                        ? (language === "fa" ? "کیفیت هوشمند" : "Adaptive Hi-Fi")
                        : streamSource === "spotify"
                        ? (language === "fa" ? "مستر استودیو" : "Studio Master")
                        : (language === "fa" ? "کاتالوگ گسترده" : "Extended Stream")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {language === "fa"
                      ? "پیکربندی هوشمند نحوه اتصال، بافرینگ و تحویل قطعات موسیقی با بالاترین کیفیت صوتی."
                      : "Configure how audio feeds and high-bitrate masters are delivered to your player."}
                  </p>
                  <div className="grid grid-cols-3 gap-2.5 mt-1.5">
                    {/* Both */}
                    <button
                      onClick={() => {
                        setStreamSource?.("both");
                        showToast(language === "fa" ? "موتور پخش: کیفیت هوشمند (تطبیقی)" : "Streaming Engine: Adaptive Hi-Fi");
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        streamSource === "both"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30"
                          : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Layers className="w-4 h-4" strokeWidth={1.75} />
                      <span>{language === "fa" ? "کیفیت هوشمند" : "Adaptive"}</span>
                      <span className="text-[10px] opacity-60 font-normal">
                        {language === "fa" ? "پیشنهادی" : "Recommended"}
                      </span>
                    </button>

                    {/* Spotify Mode -> Studio Master */}
                    <button
                      onClick={() => {
                        setStreamSource?.("spotify");
                        showToast(language === "fa" ? "موتور پخش: مستر استودیو" : "Streaming Engine: Studio Master");
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        streamSource === "spotify"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30"
                          : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Disc3 className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
                      <span>{language === "fa" ? "مستر استودیو" : "Studio"}</span>
                      <span className="text-[10px] opacity-60 font-normal">
                        {language === "fa" ? "Lossless" : "High Fidelity"}
                      </span>
                    </button>

                    {/* YouTube Mode -> Extended Stream */}
                    <button
                      onClick={() => {
                        setStreamSource?.("youtube");
                        showToast(language === "fa" ? "موتور پخش: کاتالوگ گسترده" : "Streaming Engine: Extended Stream");
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        streamSource === "youtube"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30"
                          : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Cpu className="w-4 h-4 text-cyan-500" strokeWidth={1.75} />
                      <span>{language === "fa" ? "کاتالوگ کامل" : "Extended"}</span>
                      <span className="text-[10px] opacity-60 font-normal">
                        {language === "fa" ? "آرشیو جهانی" : "Full Catalog"}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {settingsTab === "audio" && (
              <>
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-black/20">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-sm">
                        {language === "fa"
                          ? "افکت صدای هشت‌بعدی (8D Audio)"
                          : "8D Audio Spatializer"}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {language === "fa"
                          ? "چرخش هوشمند صدا دور سر با هندزفری"
                          : "Simulates rotating spatial panning (Requires headphones)"}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={is8D}
                        onChange={toggle8D}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>

                  {is8D && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-white/[0.06]"
                    >
                      <div className="flex justify-between text-xs font-semibold">
                        <span>
                          {language === "fa"
                            ? "سرعت چرخش سه بعدی:"
                            : "Rotation Speed:"}
                        </span>
                        <span className="text-cyan-400 font-mono">
                          {panSpeed}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={panSpeed}
                        onChange={(e) =>
                          setPanSpeed(parseFloat(e.target.value))
                        }
                        className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-black/20">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-sm">
                      {language === "fa"
                        ? "بیس عمیق و پرقدرت (Bass Boost)"
                        : "Heavy Bass Boost"}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === "fa"
                        ? "تقویت فرکانس‌های پایین برای قدرت بیشتر"
                        : "Amplifies ultra-low frequencies for heavy beats"}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bassBoost}
                      onChange={toggleBassBoost}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-black/20">
                  <div className="flex justify-between text-sm font-semibold">
                    <div className="flex flex-col gap-0.5">
                      <span>
                        {language === "fa"
                          ? "سرعت پخش اصلی"
                          : "Master Playback Speed"}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                        {language === "fa"
                          ? "تغییر سرعت بدون افت کیفیت صوتی"
                          : "Adjust music tempo without key change"}
                      </span>
                    </div>
                    <span className="text-cyan-400 font-mono self-start text-xs bg-cyan-500/10 px-2 py-0.5 rounded">
                      {playbackRate}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={playbackRate}
                    onChange={(e) =>
                      setPlaybackRate(parseFloat(e.target.value))
                    }
                    className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>0.5x (Slow)</span>
                    <button
                      onClick={() => setPlaybackRate(1.0)}
                      className="hover:text-cyan-400 font-semibold cursor-pointer"
                    >
                      1.0x (Normal)
                    </button>
                    <span>2.0x (Fast)</span>
                  </div>
                </div>
              </>
            )}

            {settingsTab === "system" && (
              <>
                <div className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-black/20">
                  <label className="font-semibold text-sm">
                    {language === "fa"
                      ? "دسترسی دی‌جی استودیو"
                      : "DJ Studio Authentication"}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {language === "fa"
                      ? "وضعیت قفل مجدد بخش دی‌جی جهت تست یا تغییر دسترسی."
                      : "Lock or reset DJ Studio access so you can re-authenticate."}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isAuthorized ? "bg-green-500" : "bg-red-500"
                        }`}
                      ></span>
                      {isAuthorized
                        ? language === "fa"
                          ? "فعال شده"
                          : "Authorized"
                        : language === "fa"
                        ? "قفل شده"
                        : "Locked"}
                    </span>
                    {isAuthorized && (
                      <button
                        onClick={() => {
                          setIsAuthorized(false);
                          localStorage.removeItem("dj_studio_auth");
                          showToast(
                            language === "fa"
                              ? "بخش دی‌جی با موفقیت قفل شد."
                              : "DJ Studio locked successfully."
                          );
                        }}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        {language === "fa" ? "قفل کردن مجدد" : "Revoke & Lock"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-xl border border-red-500/10 dark:border-red-500/20 bg-red-500/5">
                  <label className="font-semibold text-sm text-red-600 dark:text-red-400">
                    {language === "fa"
                      ? "بازنشانی کامل حافظه موقت"
                      : "Reset App & Clear Cache"}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {language === "fa"
                      ? "پاک کردن تمام اطلاعات ذخیره شده و خروج از حساب کاربری."
                      : "Deletes all downloaded offline tracks, settings, and logs out."}
                  </p>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          language === "fa"
                            ? "آیا از بازنشانی کامل برنامه اطمینان دارید؟ تمام موزیک‌های آفلاین پاک خواهند شد."
                            : "Are you sure you want to reset the app? All offline tracks will be lost."
                        )
                      ) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 self-start cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    {language === "fa"
                      ? "حذف کل اطلاعات برنامه"
                      : "Wipe All Data & Reload"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 text-white dark:bg-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-bold rounded-xl transition-all cursor-pointer"
            >
              {language === "fa" ? "اعمال و بستن" : "Apply & Close"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
