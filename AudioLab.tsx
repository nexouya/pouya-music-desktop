import React, { useState, useRef } from "react";
import { Upload, Sliders, Music, Zap, FileAudio, CheckCircle, AlertCircle, Play, Pause, Download, Volume2, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AudioLabProps {
  language: "en" | "fa";
}

const PRESETS = {
  standard: {
    en: { name: "Standard", desc: "Light processing for daily use (44.1kHz)" },
    fa: { name: "استاندارد", desc: "پردازش سبک برای استفاده روزمره (44.1kHz)" }
  },
  studio: {
    en: { name: "Studio", desc: "Professional high-quality output (48kHz)" },
    fa: { name: "استودیو", desc: "خروجی حرفه‌ای با کیفیت بالا (48kHz)" }
  },
  restoration: {
    en: { name: "Restoration", desc: "Restore old or damaged audio files" },
    fa: { name: "بازیابی", desc: "بازسازی فایل‌های قدیمی و آسیب‌دیده" }
  }
};

const FORMATS = ["wav", "flac", "mp3", "aac", "ogg"];

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export function AudioLab({ language }: AudioLabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<"standard" | "studio" | "restoration">("standard");
  const [outFormat, setOutFormat] = useState<string>("wav");
  const [enhancements, setEnhancements] = useState({
    noiseReduction: false,
    clarity: false,
    eq: false,
    compressor: false,
    stereo: false
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Audio preview refs
  const originalAudioRef = useRef<HTMLAudioElement>(null);
  const processedAudioRef = useRef<HTMLAudioElement>(null);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingProcessed, setIsPlayingProcessed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.size > 50 * 1024 * 1024) {
        setError(language === "fa" ? "حجم فایل نباید بیشتر از ۵۰ مگابایت باشد." : "File size must be under 50MB.");
        return;
      }
      setFile(selected);
      setResult(null);
      setError(null);
      setProgress(0);
    }
  };

  const toggleEnhancement = (key: keyof typeof enhancements) => {
    setEnhancements(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const cancelProcessing = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setIsProcessing(false);
    setProgress(0);
    setError(language === "fa" ? "عملیات لغو شد." : "Operation cancelled.");
  };

  const processAudio = () => {
    if (!file) return;

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("preset", preset);
    formData.append("format", outFormat);
    formData.append("enhancements", JSON.stringify(enhancements));

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/audiolab/process");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 45; // Upload takes 45%
        setProgress(Math.round(percentComplete));
      }
    };

    xhr.onload = () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setIsProcessing(false);
      xhrRef.current = null;

      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setProgress(100);
          setResult(data);
        } catch (e) {
          setError(language === "fa" ? "خطا در پردازش پاسخ سرور." : "Error processing server response.");
        }
      } else {
        setError(language === "fa" ? "خطا در پردازش فایل. فرمت نامعتبر یا سرور شلوغ است." : "Error processing file. Invalid format or server busy.");
      }
    };

    xhr.onerror = () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setIsProcessing(false);
      xhrRef.current = null;
      setError(language === "fa" ? "خطای شبکه هنگام ارتباط با سرور." : "Network error communicating with server.");
    };

    xhr.send(formData);

    // Smooth progress representation for DSP rendering stage
    progressTimerRef.current = window.setInterval(() => {
      setProgress(p => {
        if (p >= 95) return 95;
        return p + 1;
      });
    }, 300);
  };

  const toggleOriginalAudio = () => {
    if (originalAudioRef.current) {
      if (isPlayingOriginal) {
        originalAudioRef.current.pause();
      } else {
        if (processedAudioRef.current) processedAudioRef.current.pause();
        setIsPlayingProcessed(false);
        originalAudioRef.current.play();
      }
      setIsPlayingOriginal(!isPlayingOriginal);
    }
  };

  const toggleProcessedAudio = () => {
    if (processedAudioRef.current) {
      if (isPlayingProcessed) {
        processedAudioRef.current.pause();
      } else {
        if (originalAudioRef.current) originalAudioRef.current.pause();
        setIsPlayingOriginal(false);
        processedAudioRef.current.play();
      }
      setIsPlayingProcessed(!isPlayingProcessed);
    }
  };

  const l = {
    title: language === "fa" ? "بهبود دهنده صدا" : "Audio Enhancer",
    subtitle: language === "fa" ? "بهینه‌سازی وضوح و تبدیل فرمت فایل‌های صوتی" : "Audio enhancement and format conversion",
    uploadTitle: language === "fa" ? "انتخاب فایل صوتی" : "Select Audio File",
    uploadDesc: language === "fa" ? "فرمت‌های پشتیبانی شده: WAV, MP3, M4A, FLAC, OGG" : "Supported formats: WAV, MP3, M4A, FLAC, OGG",
    maxSize: language === "fa" ? "حداکثر حجم: ۵۰ مگابایت" : "Max size: 50MB",
    fileInfo: language === "fa" ? "اطلاعات فایل ورودی" : "Input File Info",
    size: language === "fa" ? "حجم" : "Size",
    type: language === "fa" ? "فرمت" : "Format",
    presets: language === "fa" ? "پروفایل پردازش" : "Processing Profile",
    enhancements: language === "fa" ? "بهبود دهنده‌ها" : "Enhancements",
    outFormat: language === "fa" ? "فرمت خروجی" : "Output Format",
    start: language === "fa" ? "شروع پردازش" : "Start Processing",
    processing: language === "fa" ? "در حال پردازش..." : "Processing...",
    cancel: language === "fa" ? "لغو" : "Cancel",
    success: language === "fa" ? "پردازش با موفقیت انجام شد" : "Processing completed successfully",
    compare: language === "fa" ? "مقایسه قبل و بعد" : "A/B Comparison",
    original: language === "fa" ? "فایل اصلی" : "Original File",
    processed: language === "fa" ? "فایل پردازش شده" : "Processed File",
    download: language === "fa" ? "دانلود فایل خروجی" : "Download Output File",
    stats: language === "fa" ? "مشخصات فنی خروجی" : "Output Technical Specs",
    sampleRate: language === "fa" ? "نرخ نمونه‌برداری" : "Sample Rate",
    bitrate: language === "fa" ? "بیت‌ریت" : "Bitrate",
    finalSize: language === "fa" ? "حجم نهایی" : "Final Size",
    
    enhData: {
      noiseReduction: language === "fa" ? "کاهش نویز (Noise Reduction)" : "Noise Reduction",
      clarity: language === "fa" ? "بهبود وضوح (Clarity)" : "Clarity Enhancement",
      eq: language === "fa" ? "اکولایزر داینامیک (Dynamic EQ)" : "Dynamic EQ",
      compressor: language === "fa" ? "کمپرسور (Compressor)" : "Compressor",
      stereo: language === "fa" ? "گسترش استریو (Stereo Widening)" : "Stereo Widening"
    }
  };

  return (
    <div className="flex-1 w-full h-full p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl mb-4">
            <Sliders className="w-8 h-8 text-purple-600 dark:text-purple-400" strokeWidth={1.75} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{l.title}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">{l.subtitle}</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={1.75} />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Upload & Settings */}
          <div className="flex flex-col gap-6">
            
            {/* Upload Area */}
            <div className="liquid-glass-card rounded-3xl p-6 shadow-sm">
              {!file ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300/70 dark:border-white/15 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-cyan-500/80 dark:hover:border-cyan-400/80 hover:bg-cyan-500/5 transition-all ease-out group"
                >
                  <input 
                    type="file" 
                    accept="audio/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                  />
                  <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-2xl mb-4 group-hover:scale-110 transition-transform shadow-sm">
                    <Upload className="w-8 h-8 text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{l.uploadTitle}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">{l.uploadDesc}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">{l.maxSize}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between bg-slate-50/80 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/50 dark:border-white/10">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="p-3 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 rounded-xl shrink-0">
                        <FileAudio className="w-6 h-6" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{file.name}</p>
                        <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                          <span>{formatBytes(file.size)}</span>
                          <span>•</span>
                          <span>{file.type || 'audio/unknown'}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setFile(null); setResult(null); }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                      title={language === "fa" ? "حذف فایل" : "Remove file"}
                    >
                      <X className="w-5 h-5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Processing Settings */}
            <div className={`liquid-glass-card rounded-3xl p-6 shadow-sm transition-opacity ease-out duration-500 ${!file || isProcessing ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 tracking-tight">{l.presets}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map(p => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={`flex flex-col items-start p-3.5 rounded-2xl border text-left rtl:text-right transition-all ease-out cursor-pointer ${
                      preset === p 
                        ? 'border-cyan-400 bg-cyan-500/10 text-cyan-900 dark:text-cyan-200 shadow-sm ring-1 ring-cyan-400/50' 
                        : 'border-slate-200/70 dark:border-white/10 hover:border-cyan-400/40 bg-white/40 dark:bg-white/[0.03]'
                    }`}
                  >
                    <span className={`text-sm font-bold mb-1 ${preset === p ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-800 dark:text-slate-200'}`}>
                      {PRESETS[p][language].name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {PRESETS[p][language].desc}
                    </span>
                  </button>
                ))}
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 tracking-tight">{l.enhancements}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {(Object.keys(enhancements) as Array<keyof typeof enhancements>).map(key => (
                  <label key={key} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors">
                    <input 
                      type="checkbox" 
                      checked={enhancements[key]} 
                      onChange={() => toggleEnhancement(key)}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{l.enhData[key]}</span>
                  </label>
                ))}
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 tracking-tight">{l.outFormat}</h3>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(f => (
                  <button
                    key={f}
                    onClick={() => setOutFormat(f)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ease-out cursor-pointer ${
                      outFormat === f 
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md scale-105' 
                        : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Processing & Results */}
          <div className="flex flex-col gap-6">
            
            {/* Action Card */}
            <div className="liquid-glass-card rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[200px] relative overflow-hidden">
              
              {!isProcessing && !result && (
                <div className="flex flex-col items-center text-center w-full">
                  <Music className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" strokeWidth={1.75} />
                  <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm font-medium">{language === "fa" ? "تنظیمات دلخواه را انتخاب کرده و موتور بهبود کیفیت را اجرا کنید." : "Configure parameters and begin processing."}</p>
                  <button 
                    onClick={processAudio}
                    disabled={!file}
                    className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                  >
                    {l.start}
                  </button>
                </div>
              )}

              {isProcessing && (
                <div className="flex flex-col items-center text-center w-full z-10">
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" strokeWidth={1.75} />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{l.processing}</h3>
                  <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2.5 mb-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2.5 rounded-full transition-all ease-out duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                  <p className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300 mb-6">{progress}%</p>
                  
                  <button 
                    onClick={cancelProcessing}
                    className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {l.cancel}
                  </button>
                </div>
              )}

              {result && !isProcessing && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full">
                  <div className="w-16 h-16 bg-emerald-500/15 text-emerald-500 rounded-full flex items-center justify-center mb-4 ring-1 ring-emerald-500/30">
                    <CheckCircle className="w-8 h-8" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{l.success}</h3>
                  
                  <a 
                    href={result.url}
                    download
                    className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg cursor-pointer"
                  >
                    <Download className="w-5 h-5" strokeWidth={1.75} />
                    {l.download}
                  </a>
                </motion.div>
              )}
            </div>

            {/* Results Details */}
            {result && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="liquid-glass-card rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 tracking-tight">{l.compare}</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-2xl border border-slate-200/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] flex flex-col items-center text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{l.original}</span>
                    <button 
                      onClick={toggleOriginalAudio}
                      className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:text-cyan-500 transition-colors cursor-pointer mb-3"
                    >
                      {isPlayingOriginal ? <Pause className="w-5 h-5" strokeWidth={1.75} /> : <Play className="w-5 h-5 ml-0.5" strokeWidth={1.75} />}
                    </button>
                    {file && <audio ref={originalAudioRef} src={URL.createObjectURL(file)} onEnded={() => setIsPlayingOriginal(false)} />}
                    <span className="text-xs font-mono text-slate-500">{formatBytes(result.stats.originalSize)}</span>
                  </div>
                  
                  <div className="p-4 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-1 bg-cyan-500 text-white rounded-bl-xl">
                      <Zap className="w-3 h-3" strokeWidth={1.75} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-2">{l.processed}</span>
                    <button 
                      onClick={toggleProcessedAudio}
                      className="w-12 h-12 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-cyan-400 hover:scale-105 transition-all mb-3 cursor-pointer"
                    >
                      {isPlayingProcessed ? <Pause className="w-5 h-5" strokeWidth={1.75} /> : <Play className="w-5 h-5 ml-0.5" strokeWidth={1.75} />}
                    </button>
                    <audio ref={processedAudioRef} src={result.streamUrl || result.url} onEnded={() => setIsPlayingProcessed(false)} />
                    <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">{formatBytes(result.stats.finalSize)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200/50 dark:border-white/10 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{l.stats}</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
                    <div className="text-slate-500 dark:text-slate-400">{l.sampleRate}:</div>
                    <div className="text-slate-900 dark:text-slate-100 font-bold text-right rtl:text-left">{result.stats.sampleRate} Hz</div>
                    
                    <div className="text-slate-500 dark:text-slate-400">{l.bitrate}:</div>
                    <div className="text-slate-900 dark:text-slate-100 font-bold text-right rtl:text-left">{result.stats.bitrate}</div>
                    
                    <div className="text-slate-500 dark:text-slate-400">{l.outFormat}:</div>
                    <div className="text-slate-900 dark:text-slate-100 font-bold uppercase text-right rtl:text-left">{result.stats.format}</div>
                  </div>
                </div>
              </motion.div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
