/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from './AudioEngine';
import { 
  Sliders, Sparkles, Music, Activity, RotateCw, Radio, Zap, 
  Loader2, Volume2, VolumeX, Check, Play, Pause, ChevronRight,
  SlidersHorizontal, Terminal, Activity as PulseIcon, Compass, Waves,
  MessageSquare, Send, Cpu, Lock, Disc, Flame, Layers,
  FastForward, Rewind, Repeat, Gauge, Circle, SlidersVertical, Grid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DJStudioProps {
  language: 'en' | 'fa';
  isAuthorized: boolean;
  setIsAuthorized: React.Dispatch<React.SetStateAction<boolean>>;
}

// Single shared AudioContext for SFX to prevent reaching max context limit
let sharedAudioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
const getAudioContext = () => {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
      masterCompressor = sharedAudioCtx.createDynamicsCompressor();
      
      // Soft knee compression to prevent clipping
      masterCompressor.threshold.value = -12;
      masterCompressor.knee.value = 10;
      masterCompressor.ratio.value = 6;
      masterCompressor.attack.value = 0.003;
      masterCompressor.release.value = 0.25;
      
      masterCompressor.connect(sharedAudioCtx.destination);
    }
  }
  return { ctx: sharedAudioCtx, dest: masterCompressor || sharedAudioCtx?.destination };
};

// Instant Web Audio Synthesized Sound Effects for DJ Sampler Pads
const playDJSoundEffect = (type: 'airhorn' | 'subdrop' | 'scratch' | 'laser' | 'siren' | 'riser' | 'impact' | 'chime') => {
  try {
    const { ctx, dest } = getAudioContext();
    if (!ctx || !dest) return;
    const now = ctx.currentTime;

    if (type === 'airhorn') {
      const freqs = [370, 466, 554, 740];
      freqs.forEach(f => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.setValueAtTime(f * 1.02, now + 0.15);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.55);
      });
    } else if (type === 'subdrop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.85);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.9);
    } else if (type === 'scratch') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.28);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(3600, now + 0.14);
      filter.frequency.exponentialRampToValueAtTime(500, now + 0.28);
      filter.Q.value = 6;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
    } else if (type === 'laser') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.22);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'siren') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.linearRampToValueAtTime(1250, now + 0.18);
      osc.frequency.linearRampToValueAtTime(650, now + 0.36);
      osc.frequency.linearRampToValueAtTime(1250, now + 0.54);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.65);
    } else if (type === 'riser') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(2100, now + 1.1);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.95);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 1.15);
    } else if (type === 'impact') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (type === 'chime') {
      [880, 1108.73, 1318.51, 1760].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.05);

        gain.gain.setValueAtTime(0, now + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.55);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.55);
      });
    }
  } catch (e) {
    console.error("SFX Synth Error", e);
  }
};

// FL Studio Synthesized Drums
const playSynthesizedDrum = (type: 'kick' | 'snare' | 'hihat' | 'bass') => {
  try {
    const { ctx, dest } = getAudioContext();
    if (!ctx || !dest) return;
    const now = ctx.currentTime;

    if (type === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.16);
      gain.gain.setValueAtTime(0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'snare') {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
      osc.connect(oscGain);
      oscGain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.14);

      const bufferSize = Math.floor(ctx.sampleRate * 0.16);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1100;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(dest);
      noiseSource.start(now);
    } else if (type === 'hihat') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.05);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7500;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
    } else if (type === 'bass') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.28);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.error(e);
  }
};

// FL Studio Melodic Scale Synth Note Synthesizer
const playMelodicNote = (freq: number, synthType: 'saw' | 'pluck' | 'square' | 'sine' = 'saw') => {
  try {
    const { ctx, dest } = getAudioContext();
    if (!ctx || !dest) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.frequency.setValueAtTime(freq, now);

    if (synthType === 'pluck') {
      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(220, now + 0.32);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    } else if (synthType === 'square') {
      osc.type = 'square';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    } else if (synthType === 'sine') {
      osc.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    } else {
      // Saw Lead
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3800, now);
      filter.frequency.exponentialRampToValueAtTime(650, now + 0.4);
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {
    console.error(e);
  }
};

// Root Note Base Frequencies (C4 Octave)
const ROOT_NOTE_FREQS: Record<string, number> = {
  'C': 261.63,
  'D': 293.66,
  'E': 329.63,
  'F': 349.23,
  'G': 392.00,
  'A': 440.00,
  'B': 493.88
};

// FL Scale Presets
const SCALE_PRESETS: Record<string, { nameFa: string; nameEn: string; semitones: number[] }> = {
  'phonk_phrygian': {
    nameFa: '🔥 فونک فریژین (Phonk Dark Phrygian)',
    nameEn: '🔥 Phonk Dark Phrygian',
    semitones: [0, 1, 3, 5, 7, 8, 10, 12]
  },
  'minor_pentatonic': {
    nameFa: '🎸 مینور پنتاتونیک (Blues & HipHop)',
    nameEn: '🎸 Minor Pentatonic (Blues & HipHop)',
    semitones: [0, 3, 5, 7, 10, 12, 15, 17]
  },
  'persian_oriental': {
    nameFa: '🌙 شرقی / ایرانی (Persian Oriental)',
    nameEn: '🌙 Persian Oriental Scale',
    semitones: [0, 1, 4, 5, 7, 8, 11, 12]
  },
  'harmonic_minor': {
    nameFa: '🎼 هارمونیک مینور (Neoclassical EDM)',
    nameEn: '🎼 Harmonic Minor (Neoclassical EDM)',
    semitones: [0, 2, 3, 5, 7, 8, 11, 12]
  },
  'japanese_insen': {
    nameFa: '🏮 ژاپنی این‌سن (Ambient Cyberpunk)',
    nameEn: '🏮 Japanese In-Sen (Ambient Cyberpunk)',
    semitones: [0, 1, 5, 7, 10, 12, 13, 17]
  },
  'major_scale': {
    nameFa: '✨ ماژور شاد (Major Pop & Chill)',
    nameEn: '✨ Major Pop & Chill',
    semitones: [0, 2, 4, 5, 7, 9, 11, 12]
  }
};

export const DJStudio: React.FC<DJStudioProps> = ({ language, isAuthorized, setIsAuthorized }) => {
  const {
    currentTrack,
    isPlaying,
    pause,
    resume,
    seek,
    duration,
    getAnalysis,
    // EXPOSED DJ SYSTEM
    bassGain,
    midGain,
    trebleGain,
    setBassGain,
    setMidGain,
    setTrebleGain,
    filterType,
    filterCutoff,
    filterQ,
    setFilterParams,
    echoLevel,
    echoDelayTime,
    setEchoParams,
    playbackRate,
    setPlaybackRate,
    is8D,
    toggle8D,
    panSpeed,
    setPanSpeed
  } = useAudioEngine();

  // Translations
  const t = {
    manualTuning: language === 'fa' ? 'تنظیم زنده فرکانس‌ها' : 'Manual Tuning Console',
    aiTuning: language === 'fa' ? 'تنظیم هوشمند اکولایزر' : 'Smart Sound Tuning',
    aiPlaceholder: language === 'fa' ? 'مثلاً: افزایش بیس، ریتم آرام‌تر و اکوی سبک...' : 'e.g., warmer low end, slower tempo, subtle delay...',
    eqBass: language === 'fa' ? 'ساب بیس (Low)' : 'Low (Bass)',
    eqMid: language === 'fa' ? 'مید رنج (Mid)' : 'Mid (Vocals)',
    eqTreble: language === 'fa' ? 'تریبل (High)' : 'High (Treble)',
    filter: language === 'fa' ? 'فیلتر فرکانسی' : 'Frequency Filter',
    cutoff: language === 'fa' ? 'فرکانس برش (Cutoff)' : 'Filter Cutoff',
    delayEcho: language === 'fa' ? 'افکت اکو (Echo Delay)' : 'Delay / Echo',
    spatial3D: language === 'fa' ? 'صدای ۸بعدی چرخشی' : '8D Spatial Panner',
    activeTrackIndicator: language === 'fa' ? 'طیف‌سنج زنده سیگنال (FFT)' : 'Live Spectrum Analyzer (FFT)',
    autopilotTitle: language === 'fa' ? 'میکس خودکار (Auto Master)' : 'Auto Mix Master',
    autopilotDesc: language === 'fa' ? 'هماهنگ‌سازی خودکار و داینامیک فرکانس‌ها متناسب با ریتم قطعه' : 'Dynamic automated frequency sweeping and rhythm matching',
    autopilotSelectMode: language === 'fa' ? 'پروفایل صوتی' : 'Sound Profile',
    modeFull: language === 'fa' ? 'میکس خودکار کامل' : 'Full Dynamic Mix',
    modeClub: language === 'fa' ? 'تقویت کوبش کلاب' : 'Club Beat Booster',
    modeVocal: language === 'fa' ? 'وضوح و فضای وکال' : 'Vocal Spotlight',
    modePhonk: language === 'fa' ? 'بیس سایدچین فونک' : 'Phonk Heavy Bass',
    modeCosmic: language === 'fa' ? 'طنین استریو فضایی' : 'Spatial Stereo Swell',
    modeVinyl: language === 'fa' ? 'گرمای وینیل کلاسیک' : 'Classic Vinyl Warmth',
  };

  // Active Tab View: 'turntable' | 'fl_sequencer' | 'fl_synth_scale' | 'hardware' | 'sampler' | 'autopilot' | 'ai_chat'
  const [activeTab, setActiveTab] = useState<'turntable' | 'fl_sequencer' | 'fl_synth_scale' | 'hardware' | 'sampler' | 'autopilot' | 'ai_chat'>('turntable');

  // Deck State Simulation
  const [activeCue, setActiveCue] = useState<number | null>(null);
  const [activeLoop, setActiveLoop] = useState<string | null>(null);
  const [lastPadTriggered, setLastPadTriggered] = useState<string | null>(null);

  // FL Studio Sequencer State
  const [isSequencerPlaying, setIsSequencerPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isExtractingBeat, setIsExtractingBeat] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<number>(0);

  const extractBeatFromTrack = () => {
    if (!currentTrack) return;
    setIsExtractingBeat(true);
    setExtractProgress(0);

    // Simulate an advanced AI analysis pass (parsing the buffer, FFT analysis, isolating kicks/snares)
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Use the current estimated BPM to seed a cool rhythm algorithm
        const bpm = estimatedBpmRef.current;
        const newPattern = {
          kick: Array(16).fill(false),
          snare: Array(16).fill(false),
          hihat: Array(16).fill(false),
          bass: Array(16).fill(false)
        };

        // Algorithmic Advanced Beat Generation based on track's frequency heuristics
        if (bpm > 140) {
          // DnB / Phonk style
          [0, 10, 13].forEach(i => newPattern.kick[i] = true);
          [4, 12].forEach(i => newPattern.snare[i] = true);
          for(let i=0; i<16; i+=2) newPattern.hihat[i] = true;
          [2, 3, 11, 14, 15].forEach(i => newPattern.hihat[i] = true); // syncopated hats
          [0, 3, 8, 14].forEach(i => newPattern.bass[i] = true);
        } else if (bpm > 115) {
          // House / EDM
          [0, 4, 8, 12].forEach(i => newPattern.kick[i] = true);
          [4, 12].forEach(i => newPattern.snare[i] = true);
          for(let i=2; i<16; i+=4) newPattern.hihat[i] = true;
          [3, 7, 10].forEach(i => newPattern.bass[i] = true);
          // Syncopated EDM kick
          if (realtimeMeter.bass > 0.5) newPattern.kick[15] = true;
        } else {
          // Hip Hop / Trap
          [0, 8, 9].forEach(i => newPattern.kick[i] = true);
          [4, 12].forEach(i => newPattern.snare[i] = true);
          for(let i=0; i<16; i+=2) newPattern.hihat[i] = true;
          [2, 10, 14].forEach(i => newPattern.bass[i] = true);
        }

        // Add some random "found" elements based on the real-time meter to make it unique per analysis
        if (realtimeMeter.bass > 0.4) newPattern.kick[14] = true;
        if (realtimeMeter.treble > 0.4) newPattern.hihat[7] = true;
        if (realtimeMeter.mid > 0.5) newPattern.snare[15] = true;
        
        // Sometimes drop a bass note if track is heavy
        if (realtimeMeter.bass > 0.6) newPattern.bass[6] = true;

        setSequencerPattern(newPattern);
        setTimeout(() => setIsExtractingBeat(false), 500);
      }
      setExtractProgress(progress);
    }, 150);
  };

  const [sequencerPattern, setSequencerPattern] = useState<{
    kick: boolean[];
    snare: boolean[];
    hihat: boolean[];
    bass: boolean[];
  }>({
    kick:  [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    hihat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
    bass:  [true, false, false, true, false, false, true, false, true, false, false, true, false, false, true, false]
  });
  const sequencerPatternRef = useRef(sequencerPattern);
  const estimatedBpmRef = useRef(124.0);
  useEffect(() => { sequencerPatternRef.current = sequencerPattern; }, [sequencerPattern]);

  // FL Scale Synth States
  const [selectedKey, setSelectedKey] = useState<string>('C');
  const [selectedScale, setSelectedScale] = useState<string>('phonk_phrygian');
  const [selectedSynthSound, setSelectedSynthSound] = useState<'saw' | 'pluck' | 'square' | 'sine'>('saw');

  // Chat message interface
  interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
    tuningDetails?: {
      bassGain: number;
      midGain: number;
      trebleGain: number;
      filterType: 'none' | 'lowpass' | 'highpass';
      filterCutoff: number;
      filterQ: number;
      echoLevel: number;
      echoDelayTime: number;
      playbackRate: number;
      is8D?: boolean;
      panSpeed?: number;
    };
  }

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dj_studio_chat');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // AI Prompt & History States
  const [aiPrompt, setAiPrompt] = useState('');
  const [isTuning, setIsTuning] = useState(false);
  const [isHistorySearching, setIsHistorySearching] = useState(false);
  const [historyResults, setHistoryResults] = useState<any[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');

  // Real-time Canvas & Meters
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [estimatedBpm, setEstimatedBpm] = useState<number>(124.0);
  const [crossfaderValue, setCrossfaderValue] = useState<number>(0.5);
  const lastBeatTimeRef = useRef<number>(0);
  const prevBeatTimeRef = useRef<number>(0);

  // Multi-second drops
  const [activeDropType, setActiveDropType] = useState<'none' | 'muffle_buildup' | 'tape_stop' | 'sub_shockwave' | 'highpass_riser'>('none');

  // Live Meters
  const [realtimeMeter, setRealtimeMeter] = useState({ bass: 0, mid: 0, treble: 0 });

  // Autopilot Engine
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [autopilotMode, setAutopilotMode] = useState<'club_boost' | 'vocal_stadium' | 'filter_drops' | 'cosmic_wave' | 'full_autonomous' | 'deep_phonk_distortion' | 'ambient_ether_space' | 'cyberpunk_industrial_assault' | 'chill_lofi_vinyl' | 'synthesizer_wave_glide'>('full_autonomous');

  // Preserved baseline values
  const baselineValuesRef = useRef({
    bass: 0,
    mid: 0,
    treble: 0,
    filterType: 'none' as 'none' | 'lowpass' | 'highpass',
    filterCutoff: 12000,
    filterQ: 1.0,
    echoLevel: 0.0,
    echoDelay: 0.3,
    rate: 1.0,
    panSpeed: 5,
    is8D: false
  });

  // Local Storage Chat Persistence
  useEffect(() => {
    localStorage.setItem('dj_studio_chat', JSON.stringify(chatHistory));
  }, [chatHistory]);

  const handleAuthorize = () => {
    if (accessCode.toUpperCase() === 'MICHAELJACKSON' || accessCode.trim().length > 0) {
      setIsAuthorized(true);
      localStorage.setItem('dj_studio_auth', 'true');
      setAccessCode('');
      setAuthError(null);
    } else {
      setAuthError(language === 'fa' ? 'کد ورود معتبر نیست!' : 'Invalid access code!');
    }
  };

  const AuthOverlay = ({ title }: { title: string }) => (
    <div className="absolute inset-0 z-50 backdrop-blur-md bg-white/70 dark:bg-black/85 flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-purple-500/20 shadow-2xl">
      <div className="p-3.5 rounded-full bg-purple-500/10 text-purple-400 mb-3 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
        <Lock className="w-8 h-8 animate-bounce" strokeWidth={1.75} />
      </div>
      <h4 className="font-extrabold text-base text-slate-800 dark:text-white mb-1">{title}</h4>
      <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 max-w-xs">
        {language === 'fa' ? 'برای استفاده از بخش پیشرفته دی‌جی هوشمند کلیک کنید.' : 'Click quick activate or enter code to unlock pro studio.'}
      </p>
      {authError && (
        <p className="text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg mb-3">
          {authError}
        </p>
      )}
      <div className="flex flex-col gap-2.5 w-full max-w-[250px]">
        <button 
          onClick={() => {
            setIsAuthorized(true);
            localStorage.setItem('dj_studio_auth', 'true');
          }}
          className="bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white rounded-xl py-3 text-xs font-black shadow-lg hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 animate-spin-slow" strokeWidth={1.75} />
          {language === 'fa' ? 'ورود مستقیم و فعالسازی سریع 🚀' : 'Quick Unlock Studio Pro'}
        </button>
        <div className="flex items-center gap-2 my-1">
          <div className="h-[1px] bg-slate-200 dark:bg-white/10 flex-1"></div>
          <span className="text-[10px] text-slate-400 uppercase font-mono">{language === 'fa' ? 'یا با کد' : 'OR CODE'}</span>
          <div className="h-[1px] bg-slate-200 dark:bg-white/10 flex-1"></div>
        </div>
        <div className="flex gap-1.5">
          <input 
            type="password" 
            placeholder="Code (MICHAELJACKSON)"
            value={accessCode}
            onChange={(e) => {
              setAccessCode(e.target.value);
              setAuthError(null);
            }}
            className="flex-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500 text-slate-900 dark:text-white text-center"
            onKeyDown={(e) => e.key === 'Enter' && handleAuthorize()}
          />
          <button 
            onClick={handleAuthorize}
            className="bg-purple-600 text-white rounded-lg px-3 py-2 text-xs font-bold hover:bg-purple-500 transition-all cursor-pointer"
          >
            {language === 'fa' ? 'تایید' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );

  // Chat Welcome Initialization
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([
        {
          id: 'welcome_init',
          sender: 'ai',
          text: language === 'fa' 
            ? 'درود! 🎧 به استودیوی حرفه‌ای دی‌جی هوشمند خوش آمدید. با من چت کنید تا فرکانس‌ها، فیلترها و افکت‌ها را شخصی‌سازی کنم:\n\n• "فرکانس ساب‌بیس رو کوبنده کن با سرعت ۱.۱۵ و افکت فونک"\n• "فضای آرام لوفای با فیلتر لوپاس گرم و اکوی ملایم ایجاد کن"\n• "صدای ۸بعدی فضایی چرخشی با وضوح بالای تریبل فعال کن"'
            : 'Welcome! 🎧 I am your AI sound architect. Chat with me to command the acoustic field:\n\n• "Boost the sub-bass to max with heavy sidechain and 1.15x tempo"\n• "Design a nostalgic lofi space with warm lowpass sweeps"\n• "Saturate the highs and enable rapid 8D spatial orbit"',
          timestamp: new Date().toLocaleTimeString(language === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [language]);

  // Scroll to chat bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTuning]);

  // Auto-Sync Baseline
  useEffect(() => {
    if (!isAutopilot && activeDropType === 'none') {
      baselineValuesRef.current = {
        bass: bassGain,
        mid: midGain,
        treble: trebleGain,
        filterType: filterType,
        filterCutoff: filterCutoff,
        filterQ: filterQ,
        echoLevel: echoLevel,
        echoDelay: echoDelayTime,
        rate: playbackRate,
        panSpeed: panSpeed,
        is8D: is8D
      };
    }
  }, [isAutopilot, activeDropType, bassGain, midGain, trebleGain, filterType, filterCutoff, filterQ, echoLevel, echoDelayTime, playbackRate, panSpeed, is8D]);

  // High-frequency loop for visualizers, audio drops, and autopilot
  useEffect(() => {
    let animId: number;

    const runCoreDJEvaluations = () => {
      const now = Date.now();
      const analysis = getAnalysis();

      if (analysis) {
        const rawBass = analysis.bass || 0;
        const rawMid = analysis.mid || 0;
        const rawTreb = analysis.treble || 0;

        const normBass = Math.min(1.0, rawBass / 255);
        const normMid = Math.min(1.0, rawMid / 255);
        const normTreb = Math.min(1.0, rawTreb / 255);

        setRealtimeMeter({
          bass: Math.round(normBass * 100),
          mid: Math.round(normMid * 100),
          treble: Math.round(normTreb * 100)
        });

        // Beat detection & BPM estimation
        if (normBass > 0.65 && now - lastBeatTimeRef.current > 280) {
          lastBeatTimeRef.current = now;
          if (prevBeatTimeRef.current) {
            const interval = now - prevBeatTimeRef.current;
            if (interval > 300 && interval < 1500) {
              const bpm = Math.round(60000 / interval);
              setEstimatedBpm(prev => {
                const newBpm = Math.round(prev * 0.7 + bpm * 0.3);
                estimatedBpmRef.current = newBpm;
                return newBpm;
              });
            }
          }
          prevBeatTimeRef.current = now;
        }

        // Draw Canvas Spectrogram
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const rect = canvas.getBoundingClientRect();
            if (canvas.width !== rect.width) canvas.width = rect.width;
            if (canvas.height !== rect.height) canvas.height = rect.height;
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            const numBars = 32;
            const barWidth = (w / numBars) - 2;

            for (let i = 0; i < numBars; i++) {
              let val = 0;
              if (i < 10) val = normBass * (0.6 + Math.sin(i + now * 0.005) * 0.4);
              else if (i < 22) val = normMid * (0.6 + Math.cos(i + now * 0.005) * 0.4);
              else val = normTreb * (0.6 + Math.sin(i * 0.5) * 0.4);

              const barHeight = val * h * 0.85;
              const x = i * (barWidth + 2);
              const y = h - barHeight;

              const grad = ctx.createLinearGradient(0, h, 0, 0);
              grad.addColorStop(0, '#06b6d4');
              grad.addColorStop(0.5, '#a855f7');
              grad.addColorStop(1, '#ec4899');

              ctx.fillStyle = grad;
              ctx.fillRect(x, y, barWidth, barHeight);
            }
          }
        }
      }

      animId = requestAnimationFrame(runCoreDJEvaluations);
    };

    animId = requestAnimationFrame(runCoreDJEvaluations);
    return () => cancelAnimationFrame(animId);
  }, []); // Removed getAnalysis from deps to prevent infinite loops of rAF cancellations

  // FL Studio Beat Sequencer Loop
  useEffect(() => {
    if (!isSequencerPlaying) return;

    let timeoutId: number;

    const playNextStep = () => {
      setCurrentStep(prevStep => {
        const nextStep = (prevStep + 1) % 16;
        const pattern = sequencerPatternRef.current;
        
        // Trigger active tracks for next step
        if (pattern.kick[nextStep]) playSynthesizedDrum('kick');
        if (pattern.snare[nextStep]) playSynthesizedDrum('snare');
        if (pattern.hihat[nextStep]) playSynthesizedDrum('hihat');
        if (pattern.bass[nextStep]) playSynthesizedDrum('bass');

        return nextStep;
      });

      // Calculate step interval in ms from BPM dynamically
      const currentBpm = estimatedBpmRef.current;
      const stepIntervalMs = Math.max(80, Math.min(500, (60000 / currentBpm) / 4));
      
      timeoutId = window.setTimeout(playNextStep, stepIntervalMs);
    };

    // Start loop
    timeoutId = window.setTimeout(playNextStep, 0);

    return () => clearTimeout(timeoutId);
  }, [isSequencerPlaying]);

  // Preset Applicator
  const applyPreset = (preset: 'phonk' | 'club' | 'lofi' | 'cosmic' | 'normal') => {
    switch (preset) {
      case 'phonk':
        setBassGain(11);
        setMidGain(-4);
        setTrebleGain(8);
        setFilterParams('none', 12000, 1.0);
        setEchoParams(0.08, 0.2);
        setPlaybackRate(1.15);
        if (!is8D) toggle8D();
        setPanSpeed(8);
        break;
      case 'club':
        setBassGain(7.5);
        setMidGain(-2);
        setTrebleGain(5);
        setFilterParams('none', 12000, 1.0);
        setEchoParams(0.12, 0.3);
        setPlaybackRate(1.08);
        break;
      case 'lofi':
        setBassGain(3);
        setMidGain(1);
        setTrebleGain(-6);
        setFilterParams('lowpass', 1500, 1.1);
        setEchoParams(0.25, 0.4);
        setPlaybackRate(0.88);
        break;
      case 'cosmic':
        setBassGain(2);
        setMidGain(0);
        setTrebleGain(6);
        setFilterParams('none', 12000, 1.0);
        setEchoParams(0.6, 0.6);
        setPlaybackRate(0.95);
        if (!is8D) toggle8D();
        setPanSpeed(8);
        break;
      case 'normal':
        setBassGain(0);
        setMidGain(0);
        setTrebleGain(0);
        setFilterParams('none', 12000, 1.0);
        setEchoParams(0.0, 0.3);
        setPlaybackRate(1.0);
        if (is8D) toggle8D();
        break;
    }
  };

  // FL Soundgoodizer Presets
  const applySoundgoodizer = (mode: 'A' | 'B' | 'C' | 'D') => {
    switch (mode) {
      case 'A': // Warm Punch & Sub
        setBassGain(8);
        setMidGain(1);
        setTrebleGain(4);
        setFilterParams('none', 14000, 1);
        setEchoParams(0.05, 0.2);
        break;
      case 'B': // Crystal High-End Air
        setBassGain(3);
        setMidGain(-1);
        setTrebleGain(8);
        setFilterParams('none', 16000, 1);
        setEchoParams(0.1, 0.3);
        break;
      case 'C': // Pumping Club Maximizer
        setBassGain(10);
        setMidGain(-3);
        setTrebleGain(6);
        setFilterParams('none', 12000, 1.2);
        if (!is8D) toggle8D();
        setPanSpeed(7);
        break;
      case 'D': // Vintage Tape Warmth
        setBassGain(4);
        setMidGain(2);
        setTrebleGain(-5);
        setFilterParams('lowpass', 2200, 1.1);
        setEchoParams(0.2, 0.4);
        setPlaybackRate(0.92);
        break;
    }
  };

  // AI Prompt Flow
  const runTuningFlow = async (text: string) => {
    const promptText = text.trim();
    if (!promptText) return;

    const timestamp = new Date().toLocaleTimeString(language === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    setChatHistory(prev => [...prev, { id: 'user_' + Date.now(), sender: 'user', text: promptText, timestamp }]);
    setAiPrompt('');
    setIsTuning(true);

    try {
      const response = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/eq-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: promptText })
      });

      const resData = await response.json();
      if (resData.status === 'success' && resData.tuning) {
        const tun = resData.tuning;
        setBassGain(tun.bassGain);
        setMidGain(tun.midGain);
        setTrebleGain(tun.trebleGain);
        setFilterParams(tun.filterType, tun.filterCutoff, tun.filterQ);
        setEchoParams(tun.echoLevel, tun.echoDelayTime);
        setPlaybackRate(tun.playbackRate);
        if (tun.is8D !== undefined && tun.is8D !== is8D) toggle8D();
        if (tun.panSpeed) setPanSpeed(tun.panSpeed);

        const explanationText = tun.explanation || (language === 'fa' ? "تنظیمات صوتی با موفقیت اعمال شدند." : "Acoustic parameters successfully updated.");
        setChatHistory(prev => [...prev, {
          id: 'ai_' + Date.now(),
          sender: 'ai',
          text: explanationText,
          timestamp: new Date().toLocaleTimeString(language === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
          tuningDetails: tun
        }]);
      }
    } catch (e) {
      console.error("AI Tuning Error", e);
    } finally {
      setIsTuning(false);
    }
  };

  const handleAiTuneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTuningFlow(aiPrompt);
  };

  // Music History Search
  const searchArchive = async (query: string) => {
    if (!query.trim()) return;
    setIsHistorySearching(true);
    try {
      const resp = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/music-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ era: query, genre: '', focus: 'rare unknown recordings' })
      });
      const data = await resp.json();
      if (data.status === 'success') {
        setHistoryResults(data.data.discoveries || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsHistorySearching(false);
    }
  };

  // Toggle Step in FL Sequencer
  const toggleSequencerStep = (track: 'kick' | 'snare' | 'hihat' | 'bass', stepIndex: number) => {
    setSequencerPattern(prev => {
      const copy = [...prev[track]];
      copy[stepIndex] = !copy[stepIndex];
      return { ...prev, [track]: copy };
    });
  };

  // Apply FL Sequencer Beat Preset
  const applySequencerPreset = (preset: 'phonk' | 'house' | 'trap' | 'lofi' | 'clear') => {
    if (preset === 'phonk') {
      setSequencerPattern({
        kick:  [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hihat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
        bass:  [true, false, false, true, false, false, true, false, true, false, false, true, false, false, true, false]
      });
    } else if (preset === 'house') {
      setSequencerPattern({
        kick:  [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hihat: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
        bass:  [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]
      });
    } else if (preset === 'trap') {
      setSequencerPattern({
        kick:  [true, false, false, false, false, false, true, false, false, true, false, false, false, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hihat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
        bass:  [true, false, false, false, false, false, true, false, false, true, false, false, false, false, false, false]
      });
    } else if (preset === 'lofi') {
      setSequencerPattern({
        kick:  [true, false, false, false, false, false, false, true, false, false, true, false, false, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hihat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
        bass:  [true, false, false, false, false, false, false, true, false, false, true, false, false, false, false, false]
      });
    } else if (preset === 'clear') {
      setSequencerPattern({
        kick:  Array(16).fill(false),
        snare: Array(16).fill(false),
        hihat: Array(16).fill(false),
        bass:  Array(16).fill(false)
      });
    }
  };

  return (
    <div className={`w-full max-w-7xl mx-auto pb-32 p-3 sm:p-6 ${language === 'fa' ? 'rtl' : 'ltr'} bg-slate-900/40 dark:bg-black/40 min-h-screen text-slate-100`}>
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 p-4 rounded-2xl bg-slate-800/80 dark:bg-neutral-900/90 border border-slate-700/60 dark:border-cyan-500/20 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-3 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center justify-center">
            <Disc className={`w-7 h-7 ${isPlaying ? 'animate-spin-slow' : ''}`} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                {language === 'fa' ? 'کنسول استودیویی مسترینگ' : 'Studio Mastering Console'}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">
                  MASTER DECK
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2">
              {currentTrack ? (
                <span className="text-cyan-400 font-semibold truncate max-w-[200px] sm:max-w-[300px]">
                  {currentTrack.title} — {currentTrack.artist}
                </span>
              ) : (
                <span>{language === 'fa' ? 'آماده بارگذاری ترک' : 'Ready to load master track'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Live Audio Status Stats */}
        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-700/50 pt-3 md:pt-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-cyan-500/20 text-xs font-mono">
            <Gauge className="w-4 h-4 text-cyan-400 animate-pulse" strokeWidth={1.75} />
            <div>
              <div className="text-[9px] text-slate-400 uppercase">{language === 'fa' ? 'سرعت ریتم' : 'TEMPO'}</div>
              <div className="font-bold text-cyan-400">{estimatedBpm} <span className="text-[9px]">BPM</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-purple-500/20 text-xs font-mono">
            <SlidersVertical className="w-4 h-4 text-purple-400" strokeWidth={1.75} />
            <div>
              <div className="text-[9px] text-slate-400 uppercase">{language === 'fa' ? 'گام صوتی' : 'PITCH'}</div>
              <div className="font-bold text-purple-300">{playbackRate.toFixed(2)}x</div>
            </div>
          </div>

          <button 
            onClick={() => applyPreset('normal')}
            className="px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer border border-white/10 hover:border-white/20 active:scale-95"
          >
            {language === 'fa' ? 'بازنشانی فیدرها' : 'Reset Deck'}
          </button>
        </div>
      </div>

      {/* TOP TABS NAVIGATION */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        {[
          { id: 'turntable', icon: Disc, label: language === 'fa' ? 'دک و میکسر' : 'Deck & Mixer' },
          { id: 'fl_sequencer', icon: Layers, label: language === 'fa' ? 'سکوئنسر ریتم' : 'Step Sequencer' },
          { id: 'fl_synth_scale', icon: Music, label: language === 'fa' ? 'سینتی سایزر' : 'Scale Synth' },
          { id: 'hardware', icon: Sliders, label: language === 'fa' ? 'افکت‌ها و DSP' : 'Audio FX & DSP' },
          { id: 'sampler', icon: Flame, label: language === 'fa' ? 'پد‌های سمپلر' : 'Sampler Pads' },
          { id: 'autopilot', icon: Cpu, label: language === 'fa' ? 'میکس خودکار' : 'Auto Master' },
          { id: 'ai_chat', icon: MessageSquare, label: language === 'fa' ? 'مشاور صوتی' : 'Audio Assistant' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer border ${
              activeTab === tab.id 
                ? 'bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-[1.02]' 
                : 'bg-slate-800/50 dark:bg-neutral-900/50 text-slate-400 border-slate-700/40 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} strokeWidth={1.75} />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: DUAL DECK & MIXER */}
      {activeTab === 'turntable' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* DECK A (LEFT TURNTABLE) */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700/70 shadow-2xl relative overflow-hidden flex flex-col items-center gap-5">
              <div className="w-full flex justify-between items-center border-b border-slate-700/60 pb-3">
                <span className="font-mono text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  DECK A // MASTER
                </span>
                <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20">
                  {isPlaying ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>

              {/* MODERN DIGITAL TOUCH JOG-WHEEL (REPLACING VINYL/GRAMOPHONE) */}
              <div className="relative my-2 group flex items-center justify-center">
                {/* Precision Outer Strobe Ring */}
                <div className={`w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-slate-900/95 border-2 border-slate-700/80 shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${
                  isPlaying ? 'ring-2 ring-cyan-500/50 shadow-[0_0_35px_rgba(6,182,212,0.35)]' : ''
                }`}>
                  {/* Digital Angular Tick Marks */}
                  <div className="absolute inset-2 rounded-full border border-dashed border-cyan-500/30 opacity-70 pointer-events-none animate-[spin_30s_linear_infinite]" />
                  <div className="absolute inset-5 rounded-full border border-slate-700/60 pointer-events-none" />

                  {/* Centered High-Resolution Display Beating to Track */}
                  <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center ring-1 ring-white/20 transition-all duration-300 ${
                    isPlaying ? 'animate-cover-heartbeat scale-105' : 'scale-100'
                  }`}>
                    {currentTrack?.coverUrl ? (
                      <img src={currentTrack.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <Disc className="w-10 h-10 text-cyan-400 animate-pulse" strokeWidth={1.75} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none" />
                  </div>
                </div>

                {/* Digital Pitch Strobe Badge */}
                <div className="absolute -bottom-2 px-3 py-0.5 rounded-full bg-slate-950/90 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300 shadow-md">
                  {isPlaying ? 'ACTIVE SYNC' : 'STANDBY'}
                </div>
              </div>

              {/* Pitch Bend & Tempo Controls */}
              <div className="w-full flex items-center justify-between gap-3 bg-black/30 p-3 rounded-xl border border-slate-700/40">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setPlaybackRate(Math.max(0.5, playbackRate - 0.05))}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    NUDGE -
                  </button>
                  <button 
                    onClick={() => setPlaybackRate(Math.min(2.0, playbackRate + 0.05))}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    NUDGE +
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => applyPreset('phonk')}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold hover:bg-red-500/30 cursor-pointer"
                  >
                    🔥 PHONK
                  </button>
                  <button 
                    onClick={() => setPlaybackRate(1.0)}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold hover:bg-cyan-500/30 cursor-pointer"
                  >
                    SYNC 1.0x
                  </button>
                </div>
              </div>

              {/* Cue Pads */}
              <div className="w-full grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(cue => (
                  <button
                    key={cue}
                    onClick={() => {
                      setActiveCue(cue);
                      if (duration) seek((duration / 4) * (cue - 1));
                    }}
                    className={`py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                      activeCue === cue 
                        ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_10px_#22d3ee]' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    CUE {cue}
                  </button>
                ))}
              </div>

            </div>

            {/* MASTER MIXER (CENTER) */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between items-center gap-6 shadow-2xl">
              <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
                MIXER // CENTR
              </span>

              {/* Channel Level Meters */}
              <div className="flex justify-center items-end gap-3 h-40 w-full px-4">
                <div className="w-4 bg-slate-800 rounded-full overflow-hidden flex flex-col justify-end h-full">
                  <div 
                    className="w-full bg-gradient-to-t from-cyan-500 via-purple-500 to-pink-500 rounded-full transition-all duration-100"
                    style={{ height: `${realtimeMeter.bass}%` }}
                  ></div>
                </div>
                <div className="w-4 bg-slate-800 rounded-full overflow-hidden flex flex-col justify-end h-full">
                  <div 
                    className="w-full bg-gradient-to-t from-cyan-500 via-purple-500 to-pink-500 rounded-full transition-all duration-100"
                    style={{ height: `${realtimeMeter.mid}%` }}
                  ></div>
                </div>
              </div>

              {/* Main Play/Pause Big Button */}
              <button
                onClick={() => isPlaying ? pause() : resume()}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-95 ${
                  isPlaying 
                    ? 'bg-gradient-to-tr from-amber-500 to-red-600 shadow-[0_0_25px_rgba(245,158,11,0.5)]' 
                    : 'bg-gradient-to-tr from-cyan-500 to-purple-600 shadow-[0_0_25px_rgba(6,182,212,0.6)] animate-pulse'
                }`}
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" strokeWidth={1.75} /> : <Play className="w-8 h-8 fill-current ml-1" strokeWidth={1.75} />}
              </button>

              {/* Crossfader */}
              <div className="w-full flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
                  <span>DECK A</span>
                  <span>CROSSFADER</span>
                  <span>DECK B</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={crossfaderValue}
                  onChange={(e) => setCrossfaderValue(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

            </div>

            {/* DECK B (RIGHT VIRTUAL TURNTABLE) */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700/70 shadow-2xl relative overflow-hidden flex flex-col items-center gap-5">
              <div className="w-full flex justify-between items-center border-b border-slate-700/60 pb-3">
                <span className="font-mono text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse"></span>
                  DECK B // AUX DECK
                </span>
                <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">
                  READY
                </span>
              </div>

              {/* MODERN DIGITAL TOUCH JOG-WHEEL (DECK B) */}
              <div className="relative my-2 group flex items-center justify-center">
                <div className={`w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-slate-900/95 border-2 border-slate-700/80 shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${
                  isPlaying ? 'ring-2 ring-purple-500/50 shadow-[0_0_35px_rgba(168,85,247,0.35)]' : ''
                }`}>
                  <div className="absolute inset-2 rounded-full border border-dashed border-purple-500/30 opacity-70 pointer-events-none animate-[spin_35s_linear_infinite]" />
                  <div className="absolute inset-5 rounded-full border border-slate-700/60 pointer-events-none" />

                  <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center bg-gradient-to-tr from-purple-900/60 to-pink-900/60 ring-1 ring-white/20 transition-all duration-300 ${
                    isPlaying ? 'animate-cover-heartbeat scale-105' : 'scale-100'
                  }`}>
                    <Flame className="w-10 h-10 text-purple-300 animate-pulse" strokeWidth={1.75} />
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none" />
                  </div>
                </div>

                <div className="absolute -bottom-2 px-3 py-0.5 rounded-full bg-slate-950/90 border border-purple-500/40 text-[10px] font-mono font-bold text-purple-300 shadow-md">
                  AUX LINKED
                </div>
              </div>

              {/* Loop Pads */}
              <div className="w-full grid grid-cols-4 gap-2">
                {['1/2', '1', '2', '4'].map(loop => (
                  <button
                    key={loop}
                    onClick={() => setActiveLoop(loop)}
                    className={`py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                      activeLoop === loop 
                        ? 'bg-purple-500 text-white border-purple-300 shadow-[0_0_10px_#a855f7]' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    LOOP {loop}
                  </button>
                ))}
              </div>

            </div>

          </div>
        </motion.div>
      )}

      {/* NEW TAB 2: FL STUDIO 16-STEP BEAT SEQUENCER */}
      {activeTab === 'fl_sequencer' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400 animate-pulse" strokeWidth={1.75} />
                {language === 'fa' ? 'استپ سکوئنسر ریتم ۱۶ مرحله‌ای FL Studio' : 'FL Studio 16-Step Beat Sequencer'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'fa' ? 'ریتم‌های دلخواه بسازید یا با یک کلیک الگوهای آمادگی فونک، هاوس و ترپ را فعال کنید!' : 'Build custom rhythm patterns or apply instant 1-click genre beat presets!'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSequencerPlaying(!isSequencerPlaying)}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                  isSequencerPlaying 
                    ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-amber-500/20' 
                    : 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-cyan-500/30 animate-pulse'
                }`}
              >
                {isSequencerPlaying ? <Pause className="w-4 h-4 fill-current" strokeWidth={1.75} /> : <Play className="w-4 h-4 fill-current" strokeWidth={1.75} />}
                {isSequencerPlaying ? (language === 'fa' ? 'توقف سکوئنسر' : 'Pause Loop') : (language === 'fa' ? 'پخش آنلاین ریتم' : 'Start Beat')}
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 font-mono uppercase mr-2">{language === 'fa' ? 'الگوهای آماده:' : 'Presets:'}</span>
            {[
              { id: 'phonk', label: language === 'fa' ? '🔥 فونک دریفت (Phonk Drift)' : '🔥 Phonk Drift' },
              { id: 'house', label: language === 'fa' ? '🎧 هاوس کلاب (House Pulse)' : '🎧 House Pulse' },
              { id: 'trap', label: language === 'fa' ? '💥 ترپ بانس (Trap Bounce)' : '💥 Trap Bounce' },
              { id: 'lofi', label: language === 'fa' ? '☕ لوفای چیل (Lofi Cozy)' : '☕ Lofi Cozy' },
              { id: 'clear', label: language === 'fa' ? '🧹 پاکسازی الگو' : '🧹 Clear Pattern' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => applySequencerPreset(preset.id as any)}
                className="px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-all cursor-pointer border border-white/10"
              >
                {preset.label}
              </button>
            ))}
            
            <button
              onClick={extractBeatFromTrack}
              disabled={isExtractingBeat || !currentTrack}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 ${
                isExtractingBeat 
                  ? 'bg-slate-800 text-slate-400 border-slate-700' 
                  : 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
              }`}
            >
              <Cpu className={`w-3.5 h-3.5 ${isExtractingBeat ? 'animate-spin' : 'animate-pulse'}`} strokeWidth={1.75} />
              {language === 'fa' ? '🧠 تحلیل و استخراج ریتم با هوش مصنوعی' : '🧠 AI Analyze & Extract Beat'}
            </button>
          </div>

          {/* 16-Step Grid for 4 Instruments */}
          <div className="flex flex-col gap-4 bg-black/40 p-4 rounded-xl border border-slate-700/60 overflow-x-auto relative">
            {isExtractingBeat && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 rounded-xl flex flex-col items-center justify-center p-6 border border-cyan-500/30">
                <Cpu className="w-10 h-10 text-cyan-400 animate-bounce mb-3" strokeWidth={1.75} />
                <div className="text-cyan-400 font-bold mb-4 font-mono text-sm uppercase tracking-widest text-center">
                  {language === 'fa' ? 'در حال تحلیل فرکانس‌های موزیک و استخراج ریتم...' : 'Analyzing track frequencies & extracting beat...'}
                </div>
                <div className="w-full max-w-sm h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-150 ease-out" style={{ width: `${extractProgress}%` }} />
                </div>
              </div>
            )}
            {[
              { id: 'kick', label: 'KICK 🥁', color: 'bg-cyan-500', glow: 'shadow-[0_0_10px_#06b6d4]' },
              { id: 'snare', label: 'SNARE 🥁', color: 'bg-purple-500', glow: 'shadow-[0_0_10px_#a855f7]' },
              { id: 'hihat', label: 'HI-HAT 🎩', color: 'bg-pink-500', glow: 'shadow-[0_0_10px_#ec4899]' },
              { id: 'bass', label: '808 BASS 🔊', color: 'bg-amber-500', glow: 'shadow-[0_0_10px_#f59e0b]' },
            ].map(track => (
              <div key={track.id} className="flex items-center gap-3 min-w-[650px]">
                <div className="w-24 shrink-0 text-xs font-mono font-black text-slate-300 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${track.color}`}></span>
                  {track.label}
                </div>

                <div className="grid grid-cols-16 gap-1.5 flex-1">
                  {sequencerPattern[track.id as 'kick' | 'snare' | 'hihat' | 'bass'].map((active, stepIdx) => {
                    const isStepActiveNow = isSequencerPlaying && currentStep === stepIdx;
                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleSequencerStep(track.id as any, stepIdx)}
                        className={`h-10 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer border flex items-center justify-center ${
                          active 
                            ? `${track.color} text-black border-white ${track.glow}` 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-500 border-slate-700'
                        } ${isStepActiveNow ? 'ring-2 ring-white scale-105' : ''}`}
                      >
                        {stepIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* NEW TAB 3: FL STUDIO MELODIC SCALE SYNTH PADS */}
      {activeTab === 'fl_synth_scale' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Music className="w-5 h-5 text-purple-400 animate-pulse" strokeWidth={1.75} />
                {language === 'fa' ? 'پد سینتی‌سایزر و اسکیل اتوماتیک FL Studio' : 'FL Studio Scale Snapper & Melodic Synth'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'fa' ? 'گام و اسکیل موسیقی را انتخاب کنید تا تمام نت‌ها روی اسکیل دلخواه شما کوک و هماهنگ شوند!' : 'Select your root key and musical scale to snap all playable synth pads!'}
              </p>
            </div>
          </div>

          {/* Root Key & Scale Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Root Key */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-slate-700/50 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300 font-mono uppercase">{language === 'fa' ? 'کلید اصلی (Root Key):' : 'Root Key:'}</label>
              <div className="flex gap-1.5">
                {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(k => (
                  <button
                    key={k}
                    onClick={() => setSelectedKey(k)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                      selectedKey === k 
                        ? 'bg-cyan-500 text-black border-cyan-300 shadow-md' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale Preset */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-slate-700/50 flex flex-col gap-2 sm:col-span-2">
              <label className="text-xs font-bold text-slate-300 font-mono uppercase">{language === 'fa' ? 'اسکیل موسیقی (Scale Preset):' : 'Scale Preset:'}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(SCALE_PRESETS).map(([scaleKey, scaleData]) => (
                  <button
                    key={scaleKey}
                    onClick={() => setSelectedScale(scaleKey)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border truncate text-start ${
                      selectedScale === scaleKey 
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {language === 'fa' ? scaleData.nameFa : scaleData.nameEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Synth Sound Engine Selection */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 font-mono uppercase">{language === 'fa' ? 'نوع صدای سینتی‌سایزر:' : 'Synth Timbre:'}</span>
            {[
              { id: 'saw', label: 'Phonk Lead (Saw) 🪚' },
              { id: 'pluck', label: 'Pluck Synth 🎸' },
              { id: 'square', label: '8-Bit Retro 🕹️' },
              { id: 'sine', label: 'Warm Sine Pad 🌊' }
            ].map(snd => (
              <button
                key={snd.id}
                onClick={() => setSelectedSynthSound(snd.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedSynthSound === snd.id 
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-cyan-300' 
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {snd.label}
              </button>
            ))}
          </div>

          {/* Playable 8-Note Scale Pads */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {SCALE_PRESETS[selectedScale]?.semitones.map((semitoneOffset, idx) => {
              const baseFreq = ROOT_NOTE_FREQS[selectedKey] || 261.63;
              const noteFreq = baseFreq * Math.pow(2, semitoneOffset / 12);

              return (
                <button
                  key={idx}
                  onClick={() => playMelodicNote(noteFreq, selectedSynthSound)}
                  className="h-32 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-purple-500/40 hover:border-cyan-400 p-3 flex flex-col justify-between items-start text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-full flex justify-between items-center text-[10px] font-mono text-purple-400">
                    <span>DEGREE {idx + 1}</span>
                    <Sparkles className="w-3.5 h-3.5 group-hover:text-cyan-400" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-lg font-black text-white">{selectedKey} +{semitoneOffset}st</div>
                    <div className="text-[10px] font-mono text-slate-400">{Math.round(noteFreq)} Hz</div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* TAB 4: HARDWARE EQ, SOUNDGOODIZER & MASTER FX */}
      {activeTab === 'hardware' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* FL STUDIO SOUNDGOODIZER & 3-BAND PRECISION EQ */}
          <div className="p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
                {language === 'fa' ? 'ماژول FL Soundgoodizer & اکولایزر' : 'FL Soundgoodizer & Precision EQ'}
              </h3>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                PRO MAXIMIZER
              </span>
            </div>

            {/* FL Soundgoodizer 1-Click Modes */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-amber-500/20 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-amber-300 font-mono uppercase">{language === 'fa' ? 'حالت‌های آماده FL Soundgoodizer:' : 'FL Soundgoodizer Presets:'}</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'A', name: 'Mode A: Sub Punch 🥊' },
                  { id: 'B', name: 'Mode B: Crystal Air 💎' },
                  { id: 'C', name: 'Mode C: Club Maximizer 🔊' },
                  { id: 'D', name: 'Mode D: Lofi Tape Warmth 📼' },
                ].map(sg => (
                  <button
                    key={sg.id}
                    onClick={() => applySoundgoodizer(sg.id as any)}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-200 text-xs font-bold text-start transition-all cursor-pointer shadow-sm"
                  >
                    {sg.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {/* Bass */}
              <div className="p-3.5 rounded-xl bg-black/30 border border-slate-700/50 flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>{t.eqBass}</span>
                  <span className="font-mono text-cyan-400">{bassGain > 0 ? `+${bassGain}` : bassGain} dB</span>
                </div>
                <input 
                  type="range" min="-12" max="12" step="0.5" value={bassGain} 
                  onChange={(e) => setBassGain(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Mid */}
              <div className="p-3.5 rounded-xl bg-black/30 border border-slate-700/50 flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>{t.eqMid}</span>
                  <span className="font-mono text-purple-400">{midGain > 0 ? `+${midGain}` : midGain} dB</span>
                </div>
                <input 
                  type="range" min="-12" max="12" step="0.5" value={midGain} 
                  onChange={(e) => setMidGain(parseFloat(e.target.value))}
                  className="w-full accent-purple-400 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Treble */}
              <div className="p-3.5 rounded-xl bg-black/30 border border-slate-700/50 flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>{t.eqTreble}</span>
                  <span className="font-mono text-pink-400">{trebleGain > 0 ? `+${trebleGain}` : trebleGain} dB</span>
                </div>
                <input 
                  type="range" min="-12" max="12" step="0.5" value={trebleGain} 
                  onChange={(e) => setTrebleGain(parseFloat(e.target.value))}
                  className="w-full accent-pink-400 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* MASTER FX & FILTER RACK */}
          <div className="p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Waves className="w-4 h-4 text-purple-400" strokeWidth={1.75} />
                {t.filter} & {t.delayEcho}
              </h3>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                MASTER FX
              </span>
            </div>

            {/* Filter Controls */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-slate-700/50 flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-300">{t.filter}</span>
              <div className="grid grid-cols-3 gap-2">
                {(['none', 'lowpass', 'highpass'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterParams(type, filterCutoff, filterQ)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      filterType === type 
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)]' 
                        : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    {type === 'none' ? 'Bypass' : type === 'lowpass' ? 'Lowpass' : 'Highpass'}
                  </button>
                ))}
              </div>

              {filterType !== 'none' && (
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-300">
                    <span>{t.cutoff}</span>
                    <span className="font-mono text-cyan-400">{filterCutoff} Hz</span>
                  </div>
                  <input 
                    type="range" min="100" max="16000" step="100" value={filterCutoff} 
                    onChange={(e) => setFilterParams(filterType, parseInt(e.target.value), filterQ)}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Echo Delay Controls */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-slate-700/50 flex flex-col gap-3">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>{t.delayEcho}</span>
                <span className="font-mono text-pink-400">{Math.round(echoLevel * 100)}%</span>
              </div>
              <input 
                type="range" min="0.0" max="0.8" step="0.05" value={echoLevel} 
                onChange={(e) => setEchoParams(parseFloat(e.target.value), echoDelayTime)}
                className="w-full accent-pink-400 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* 8D Binaural Spatial Audio */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-slate-700/50 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className={`w-4 h-4 ${is8D ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} strokeWidth={1.75} />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{t.spatial3D}</span>
                    <span className="text-[10px] text-slate-400">
                      {is8D 
                        ? (language === 'fa' ? 'چرخش بای‌نورال فعال با فیلتر جذب پشت سر' : 'Binaural 360° orbit with head-shadow filtering') 
                        : (language === 'fa' ? 'برای تجربه صدای ۳ بعدی دور سر روشن کنید' : 'Enable 360° circular binaural spatial field')}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={toggle8D}
                  className={`w-12 h-6 rounded-full p-1 transition-all cursor-pointer flex items-center ${
                    is8D ? 'bg-cyan-500 justify-end shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                </button>
              </div>

              {is8D && (
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/40">
                  <div className="flex justify-between text-xs font-bold text-slate-300">
                    <span>{language === 'fa' ? 'سرعت گردش در فضا' : 'Orbit Rotation Speed'}</span>
                    <span className="font-mono text-cyan-400">{panSpeed}x</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" step="1" value={panSpeed} 
                    onChange={(e) => setPanSpeed(parseInt(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>

          </div>

        </motion.div>
      )}

      {/* TAB 5: DJ SAMPLER SFX PADS */}
      {activeTab === 'sampler' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400 animate-bounce" strokeWidth={1.75} />
                {language === 'fa' ? 'پد‌های جلوه‌های صوتی زنده دی‌جی' : 'Instant Web Audio Sampler Pads'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'fa' ? 'برای اجرای افکت صوتی زنده روی دکمه‌ها کلیک کنید' : 'Tap pads for instant real-time synthesized DJ sound effects!'}
              </p>
            </div>
            {lastPadTriggered && (
              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
                TRIGGERED: {lastPadTriggered.toUpperCase()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { id: 'airhorn', name: 'Airhorn 🎺', color: 'from-amber-500 to-red-600', border: 'border-amber-400' },
              { id: 'subdrop', name: '808 Sub Drop 💥', color: 'from-cyan-500 to-blue-600', border: 'border-cyan-400' },
              { id: 'scratch', name: 'Vinyl Scratch 🎚️', color: 'from-purple-500 to-indigo-600', border: 'border-purple-400' },
              { id: 'laser', name: 'Laser Blaster 🔫', color: 'from-pink-500 to-rose-600', border: 'border-pink-400' },
              { id: 'siren', name: 'Siren Alarm 🚨', color: 'from-red-600 to-orange-500', border: 'border-red-500' },
              { id: 'riser', name: 'Riser Sweep 📈', color: 'from-emerald-500 to-teal-600', border: 'border-emerald-400' },
              { id: 'impact', name: 'Impact Punch 🥁', color: 'from-violet-600 to-purple-800', border: 'border-violet-400' },
              { id: 'chime', name: 'Shimmer Chime ✨', color: 'from-sky-400 to-indigo-500', border: 'border-sky-300' },
            ].map(pad => (
              <button
                key={pad.id}
                onClick={() => {
                  playDJSoundEffect(pad.id as any);
                  setLastPadTriggered(pad.name);
                }}
                className={`h-28 rounded-2xl bg-gradient-to-tr ${pad.color} p-4 flex flex-col justify-between items-start text-white font-black shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 ${pad.border} group relative overflow-hidden`}
              >
                <div className="w-full flex justify-between items-center">
                  <span className="text-xs font-mono opacity-80">PAD SFX</span>
                  <Zap className="w-4 h-4 opacity-70 group-hover:opacity-100 animate-pulse" strokeWidth={1.75} />
                </div>
                <span className="text-sm sm:text-base font-extrabold">{pad.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* TAB 6: AI AUTOPILOT & ANALYZER */}
      {activeTab === 'autopilot' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Canvas Spectrogram */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <PulseIcon className="w-4 h-4 text-cyan-400" strokeWidth={1.75} />
                {t.activeTrackIndicator}
              </h3>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                FFT SPECTROGRAM
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black shadow-inner">
              <canvas ref={canvasRef} width={500} height={180} className="w-full h-[180px] block" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-black/40 border border-slate-700 text-center">
                <span className="text-[10px] text-slate-400 font-mono">BASS</span>
                <div className="text-base font-mono font-bold text-cyan-400 mt-1">{realtimeMeter.bass}%</div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-slate-700 text-center">
                <span className="text-[10px] text-slate-400 font-mono">MID</span>
                <div className="text-base font-mono font-bold text-purple-400 mt-1">{realtimeMeter.mid}%</div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-slate-700 text-center">
                <span className="text-[10px] text-slate-400 font-mono">TREBLE</span>
                <div className="text-base font-mono font-bold text-pink-400 mt-1">{realtimeMeter.treble}%</div>
              </div>
            </div>
          </div>

          {/* Autopilot Controls */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-5 relative">
            {!isAuthorized && <AuthOverlay title={language === 'fa' ? 'ورود به بخش میکس خودکار' : 'Unlock Auto Master'} />}

            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" strokeWidth={1.75} />
                {t.autopilotTitle}
              </h3>
              <button
                onClick={() => setIsAutopilot(!isAutopilot)}
                className={`w-12 h-6 rounded-full p-1 transition-all cursor-pointer flex items-center ${
                  isAutopilot ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
              </button>
            </div>

            <p className="text-xs text-slate-400">{t.autopilotDesc}</p>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">{t.autopilotSelectMode}</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'full_autonomous', label: t.modeFull, icon: Sparkles },
                  { id: 'club_boost', label: t.modeClub, icon: Sliders },
                  { id: 'vocal_stadium', label: t.modeVocal, icon: Radio },
                  { id: 'deep_phonk_distortion', label: t.modePhonk, icon: Zap },
                  { id: 'cosmic_wave', label: t.modeCosmic, icon: RotateCw },
                  { id: 'chill_lofi_vinyl', label: t.modeVinyl, icon: Music },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setAutopilotMode(item.id as any)}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                      autopilotMode === item.id 
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md' 
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

        </motion.div>
      )}

      {/* TAB 7: AI CHAT & UNIVERSAL ARCHIVE */}
      {activeTab === 'ai_chat' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Chat Window */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-4 relative">
            {!isAuthorized && <AuthOverlay title={language === 'fa' ? 'ورود به بخش مشاور صوتی' : 'Unlock Audio Assistant'} />}

            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" strokeWidth={1.75} />
                {t.aiTuning}
              </h3>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                DSP EQ TUNER
              </span>
            </div>

            <div className="flex flex-col gap-3 max-h-[350px] min-h-[220px] overflow-y-auto p-3 bg-black/40 rounded-xl border border-slate-700/60 scrollbar-thin">
              {chatHistory.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.75} />
                    </div>
                  )}
                  <div className={`p-3 rounded-2xl text-xs max-w-[80%] leading-relaxed ${
                    msg.sender === 'user' ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-slate-900 text-slate-200 border border-slate-700 rounded-tl-none'
                  }`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                language === 'fa' ? 'حالت فونک پرو با بیس کوبنده 🔥' : 'Phonk Pro Mode with heavy bass 🔥',
                language === 'fa' ? 'فضای لوفای آرام و گرم ☕' : 'Warm Cozy Lofi space ☕',
                language === 'fa' ? 'صدای ۸بعدی چرخشی 🌌' : 'Rotating 8D spatial orbit 🌌',
              ].map((sug, i) => (
                <button 
                  key={i} 
                  onClick={() => runTuningFlow(sug)}
                  className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold hover:bg-cyan-500/20 shrink-0 cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>

            {/* Prompt Form */}
            <form onSubmit={handleAiTuneSubmit} className="flex gap-2">
              <input 
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t.aiPlaceholder}
                className="flex-1 text-xs py-3 px-4 bg-black/40 border border-slate-700 rounded-xl focus:border-cyan-400 outline-none text-white"
              />
              <button 
                type="submit" disabled={isTuning || !aiPrompt.trim()}
                className="px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </form>
          </div>

          {/* Universal Archive Explorer */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl flex flex-col gap-4 relative">
            {!isAuthorized && <AuthOverlay title={language === 'fa' ? 'بازگشایی آرشیو جهانی' : 'Unlock Music Archive'} />}

            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" strokeWidth={1.75} />
                {language === 'fa' ? 'کاوشگر آرشیو جهانی موسیقی' : 'Universal Music History Archive'}
              </h3>
            </div>

            <div className="flex gap-2">
              <input 
                type="text"
                value={historyQuery}
                placeholder={language === 'fa' ? 'دوره یا سبک (مثلا: جاز دهه ۴۰...)' : 'Era or Genre (e.g. 1940s Jazz...)'}
                onChange={(e) => setHistoryQuery(e.target.value)}
                className="flex-1 text-xs py-2.5 px-3 bg-black/40 border border-slate-700 rounded-lg outline-none focus:border-purple-400 text-white"
              />
              <button 
                onClick={() => searchArchive(historyQuery)}
                disabled={isHistorySearching}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {isHistorySearching ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} /> : <ChevronRight className="w-4 h-4" strokeWidth={1.75} />}
              </button>
            </div>

            {historyResults.length > 0 && (
              <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
                {historyResults.map((item, i) => (
                  <div key={i} className="p-3 rounded-xl bg-black/30 border border-slate-700/60 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-bold text-white">
                      <span>{item.title}</span>
                      <span className="text-purple-400 font-mono">{item.year}</span>
                    </div>
                    <span className="text-purple-300 font-semibold">{item.artist}</span>
                    <p className="text-[10px] text-slate-400 line-clamp-2">{item.significance}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </motion.div>
      )}

    </div>
  );
};
