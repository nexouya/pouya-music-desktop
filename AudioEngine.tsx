/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Track, AudioAnalysis } from './types';
import { apiUrl } from './src/lib/api';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number; // 0 to 1
  currentTime: number;
  duration: number;
  is8D: boolean;
  panSpeed: number; // 1 to 10
  bassBoost: boolean;
  playTrack: (track: Track) => void;
  setCurrentTrack: (track: Track | null) => void;
  pause: () => void;
  resume: () => void;
  setVolume: (vol: number) => void;
  seek: (seconds: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  toggle8D: () => void;
  setPanSpeed: (speed: number, skipStateUpdate?: boolean) => void;
  toggleBassBoost: () => void;
  getAnalysis: () => AudioAnalysis;
  onTrackEnded: (() => void) | null;
  setOnTrackEnded: (callback: () => void) => void;

  // ADVANCED DJ CONTROLS
  bassGain: number; // -12 to +12 dB
  midGain: number; // -12 to +12 dB
  trebleGain: number; // -12 to +12 dB
  setBassGain: (g: number, skipStateUpdate?: boolean) => void;
  setMidGain: (g: number, skipStateUpdate?: boolean) => void;
  setTrebleGain: (g: number, skipStateUpdate?: boolean) => void;

  filterType: 'none' | 'lowpass' | 'highpass';
  filterCutoff: number; // 20 to 20000 Hz
  filterQ: number; // 1 to 15
  setFilterParams: (type: 'none' | 'lowpass' | 'highpass', cutoff: number, q: number, skipStateUpdate?: boolean) => void;

  echoLevel: number; // 0 to 0.85
  echoDelayTime: number; // 0.1 to 1.0 s
  setEchoParams: (level: number, delayTime: number, skipStateUpdate?: boolean) => void;

  playbackRate: number; // 0.5 to 2.0
  setPlaybackRate: (rate: number, skipStateUpdate?: boolean) => void;
}

const AudioEngineContext = createContext<AudioContextType | null>(null);

export function useAudioEngine() {
  const context = useContext(AudioEngineContext);
  if (!context) {
    throw new Error('useAudioEngine must be used within an AudioEngineProvider');
  }
  return context;
}

export const AudioEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [is8D, setIs8D] = useState<boolean>(false);
  const [panSpeed, setPanSpeedState] = useState<number>(5);
  const panSpeedRef = useRef<number>(5);
  const setPanSpeed = (speed: number, skipStateUpdate = false) => {
    panSpeedRef.current = speed;
    if (!skipStateUpdate) {
      setPanSpeedState(speed);
    }
  };
  const [bassBoost, setBassBoost] = useState<boolean>(false);

  // Pro DJ parameters state
  const [bassGain, setBassGainState] = useState<number>(0);
  const [midGain, setMidGainState] = useState<number>(0);
  const [trebleGain, setTrebleGainState] = useState<number>(0);
  const [filterType, setFilterTypeState] = useState<'none' | 'lowpass' | 'highpass'>('none');
  const [filterCutoff, setFilterCutoffState] = useState<number>(12000);
  const [filterQ, setFilterQState] = useState<number>(1);
  const [echoLevel, setEchoLevelState] = useState<number>(0);
  const [echoDelayTime, setEchoDelayTimeState] = useState<number>(0.3);
  const [playbackRate, setPlaybackRateState] = useState<number>(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  
  // Realistic 8D Spatial Audio Nodes (Binaural orbit, Head-Shadow filter, Distance attenuation, and Room Reverb)
  const spatialFilterRef = useRef<BiquadFilterNode | null>(null);
  const spatialDistanceGainRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbWetGainRef = useRef<GainNode | null>(null);
  const reverbDryGainRef = useRef<GainNode | null>(null);
  
  // Advanced audio graph nodes
  const bassEQRef = useRef<BiquadFilterNode | null>(null);
  const midEQRef = useRef<BiquadFilterNode | null>(null);
  const trebleEQRef = useRef<BiquadFilterNode | null>(null);
  const sweepFilterRef = useRef<BiquadFilterNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const onTrackEndedRef = useRef<(() => void) | null>(null);
  const currentlyLoadingUrlRef = useRef<string | null>(null);

  const setOnTrackEnded = (callback: () => void) => {
    onTrackEndedRef.current = callback;
  };

  // Initialize Audio Elements & Web Audio graph safely upon interaction
  const initAudioGraph = () => {
    if (!audioRef.current) return;
    if (audioCtxRef.current) return; // Already initialized

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      // Create nodes
      const source = audioCtx.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Class-A Low Shelf Bass EQ Filter
      const bassEQ = audioCtx.createBiquadFilter();
      bassEQ.type = 'lowshelf';
      bassEQ.frequency.value = 150;
      bassEQ.gain.value = bassGain + (bassBoost ? 10 : 0);
      bassEQRef.current = bassEQ;

      // Parametric Peaking midrange EQ Filter
      const midEQ = audioCtx.createBiquadFilter();
      midEQ.type = 'peaking';
      midEQ.frequency.value = 1000;
      midEQ.Q.value = 1.0;
      midEQ.gain.value = midGain;
      midEQRef.current = midEQ;

      // High Shelf Treble EQ Filter
      const trebleEQ = audioCtx.createBiquadFilter();
      trebleEQ.type = 'highshelf';
      trebleEQ.frequency.value = 6000;
      trebleEQ.gain.value = trebleGain;
      trebleEQRef.current = trebleEQ;

      // Resonant sweep control filter
      const sweepFilter = audioCtx.createBiquadFilter();
      sweepFilter.type = filterType === 'none' ? 'lowpass' : filterType;
      sweepFilter.frequency.value = filterType === 'none' ? 20000 : filterCutoff;
      sweepFilter.Q.value = filterQ;
      sweepFilterRef.current = sweepFilter;

      // Parallel feed loop feedback Echo Delay setup
      const delayNode = audioCtx.createDelay(1.5);
      delayNode.delayTime.value = echoDelayTime;
      delayNodeRef.current = delayNode;

      const delayFeedback = audioCtx.createGain();
      delayFeedback.gain.value = echoLevel;
      delayFeedbackRef.current = delayFeedback;

      const panner = audioCtx.createStereoPanner();
      panner.pan.value = 0;
      pannerRef.current = panner;

      // Realistic 8D Spatial Filtering:
      // When audio rotates behind the listener's head, high frequencies dampen (Head-Shadow Effect)
      const spatialFilter = audioCtx.createBiquadFilter();
      spatialFilter.type = 'lowpass';
      spatialFilter.frequency.value = 20000;
      spatialFilter.Q.value = 0.7;
      spatialFilterRef.current = spatialFilter;

      // Distance Attenuation (Inverse-distance volume dynamics as sound orbits around the listener)
      const spatialDistanceGain = audioCtx.createGain();
      spatialDistanceGain.gain.value = 1.0;
      spatialDistanceGainRef.current = spatialDistanceGain;

      // Convolution Reverb for authentic physical acoustic space (Room/Hall ambience for 8D)
      const convolver = audioCtx.createConvolver();
      // Generate synthetic high-density room impulse response
      const rate = audioCtx.sampleRate;
      const length = Math.floor(rate * 1.8); // 1.8 seconds decay
      const impulse = audioCtx.createBuffer(2, length, rate);
      const impulseL = impulse.getChannelData(0);
      const impulseR = impulse.getChannelData(1);
      const decay = 2.4;
      for (let i = 0; i < length; i++) {
        const n = i / length;
        const env = Math.exp(-n * decay);
        impulseL[i] = (Math.random() * 2 - 1) * env;
        impulseR[i] = (Math.random() * 2 - 1) * env;
      }
      convolver.buffer = impulse;
      convolverRef.current = convolver;

      const reverbWetGain = audioCtx.createGain();
      reverbWetGain.gain.value = 0.0; // Activated only when 8D is on
      reverbWetGainRef.current = reverbWetGain;

      const reverbDryGain = audioCtx.createGain();
      reverbDryGain.gain.value = 1.0;
      reverbDryGainRef.current = reverbDryGain;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = volume;
      gainRef.current = gainNode;

      // Graph wiring: 
      // Source -> Analyser -> bassEQ -> midEQ -> trebleEQ -> sweepFilter
      source.connect(analyser);
      analyser.connect(bassEQ);
      bassEQ.connect(midEQ);
      midEQ.connect(trebleEQ);
      trebleEQ.connect(sweepFilter);
      
      // FX loop branch (DJ Echo)
      sweepFilter.connect(delayNode);
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);

      // Mix sweepFilter + Echo into spatial chain
      // Spatial Chain: [Dry + Echo] -> spatialFilter -> spatialDistanceGain -> panner
      sweepFilter.connect(spatialFilter);
      delayFeedback.connect(spatialFilter);

      spatialFilter.connect(spatialDistanceGain);
      spatialDistanceGain.connect(panner);

      // Split output into dry path and spatial room reverb wet path
      panner.connect(reverbDryGain);
      reverbDryGain.connect(gainNode);

      panner.connect(convolver);
      convolver.connect(reverbWetGain);
      reverbWetGain.connect(gainNode);

      gainNode.connect(audioCtx.destination);

    } catch (e) {
      console.warn("Failed to create Web Audio graph", e);
    }
  };

  // Keep HTML5 Audio volume synced
  const setVolume = (vol: number) => {
    const safeVol = Math.max(0, Math.min(1, vol));
    setVolumeState(safeVol);
    if (audioRef.current) {
      audioRef.current.volume = safeVol;
    }
    if (gainRef.current) {
      gainRef.current.gain.value = safeVol;
    }
  };

  // Setters updating audio nodes in real time
  const setBassGain = (g: number, skipStateUpdate = false) => {
    if (!skipStateUpdate) {
      setBassGainState(g);
    }
    if (bassEQRef.current) {
      bassEQRef.current.gain.setValueAtTime(g + (bassBoost ? 10 : 0), audioCtxRef.current?.currentTime || 0);
    }
  };

  const setMidGain = (g: number, skipStateUpdate = false) => {
    if (!skipStateUpdate) {
      setMidGainState(g);
    }
    if (midEQRef.current) {
      midEQRef.current.gain.setValueAtTime(g, audioCtxRef.current?.currentTime || 0);
    }
  };

  const setTrebleGain = (g: number, skipStateUpdate = false) => {
    if (!skipStateUpdate) {
      setTrebleGainState(g);
    }
    if (trebleEQRef.current) {
      trebleEQRef.current.gain.setValueAtTime(g, audioCtxRef.current?.currentTime || 0);
    }
  };

  const setFilterParams = (type: 'none' | 'lowpass' | 'highpass', cutoff: number, q: number, skipStateUpdate = false) => {
    if (!skipStateUpdate) {
      setFilterTypeState(type);
      setFilterCutoffState(cutoff);
      setFilterQState(q);
    }
    if (sweepFilterRef.current) {
      const actualType = type === 'none' ? 'lowpass' : type;
      const actualCutoff = type === 'none' ? 20000 : cutoff;
      sweepFilterRef.current.type = actualType;
      sweepFilterRef.current.frequency.setValueAtTime(actualCutoff, audioCtxRef.current?.currentTime || 0);
      sweepFilterRef.current.Q.setValueAtTime(q, audioCtxRef.current?.currentTime || 0);
    }
  };

  const setEchoParams = (level: number, delayTime: number, skipStateUpdate = false) => {
    if (!skipStateUpdate) {
      setEchoLevelState(level);
      setEchoDelayTimeState(delayTime);
    }
    if (delayFeedbackRef.current) {
      delayFeedbackRef.current.gain.setValueAtTime(level, audioCtxRef.current?.currentTime || 0);
    }
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.setValueAtTime(delayTime, audioCtxRef.current?.currentTime || 0);
    }
  };

  const setPlaybackRate = (rate: number, skipStateUpdate = false) => {
    const safeRate = Math.max(0.5, Math.min(2.0, rate));
    if (!skipStateUpdate) {
      setPlaybackRateState(safeRate);
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = safeRate;
    }
  };

  // Realistic 8D Audio Rotating Stereo Field & Binaural Spatial Simulation
  useEffect(() => {
    let animationId: number;
    let angle = 0;
    let lastRenderTime = 0;

    const resetSpatialNodes = () => {
      if (pannerRef.current) pannerRef.current.pan.value = 0;
      if (spatialFilterRef.current) spatialFilterRef.current.frequency.value = 20000;
      if (spatialDistanceGainRef.current) spatialDistanceGainRef.current.gain.value = 1.0;
      if (reverbWetGainRef.current) reverbWetGainRef.current.gain.value = 0.0;
      if (reverbDryGainRef.current) reverbDryGainRef.current.gain.value = 1.0;
    };

    const run8DPanning = (timestamp: number) => {
      if (!is8D) {
        resetSpatialNodes();
        return; // Stop loop!
      }
      
      const dt = lastRenderTime === 0 ? 16 : timestamp - lastRenderTime;
      if (dt >= 16) {
        if (audioCtxRef.current) {
          const now = audioCtxRef.current.currentTime;
          // Pan speed range 1 to 10 -> smooth circular angular velocity
          const step = (panSpeedRef.current * 0.00035 * dt);
          angle = (angle + step) % (Math.PI * 2);

          // 1. Azimuth panning across horizontal stereo plane (-1 left, +1 right)
          const panValue = Math.sin(angle);
          if (pannerRef.current) {
            pannerRef.current.pan.setValueAtTime(panValue, now);
          }

          // 2. Depth axis (cos(angle) > 0 front, < 0 behind head)
          const depth = Math.cos(angle);

          // 3. Head-Shadow Effect: when sound orbits behind listener's head (depth < 0),
          // high frequencies are absorbed by head mass and pinna geometry (lowpass filter down to ~4500Hz)
          if (spatialFilterRef.current) {
            // Front: 20kHz (crystal clear), Back: down to 4.5kHz (warm, behind the head)
            const cutoff = depth >= 0 ? 20000 : 20000 - Math.abs(depth) * 15500;
            spatialFilterRef.current.frequency.setTargetAtTime(cutoff, now, 0.04);
          }

          // 4. Subtle distance attenuation dynamics (sounds slightly closer on sides, slightly farther in front/back)
          if (spatialDistanceGainRef.current) {
            const distanceFactor = 0.88 + Math.abs(panValue) * 0.12;
            spatialDistanceGainRef.current.gain.setTargetAtTime(distanceFactor, now, 0.04);
          }

          // 5. Binaural room reverb space: subtle wet mix (18% wet) gives realistic hall perception
          if (reverbWetGainRef.current && reverbDryGainRef.current) {
            reverbWetGainRef.current.gain.setTargetAtTime(0.22, now, 0.05);
            reverbDryGainRef.current.gain.setTargetAtTime(0.88, now, 0.05);
          }
        }
        lastRenderTime = timestamp;
      }
      animationId = requestAnimationFrame(run8DPanning);
    };

    if (is8D) {
      animationId = requestAnimationFrame(run8DPanning);
    } else {
      resetSpatialNodes();
    }
    return () => {
      cancelAnimationFrame(animationId);
      resetSpatialNodes();
    };
  }, [is8D]);

  // Bass Boost low shelf modifier
  const toggleBassBoost = () => {
    const nextVal = !bassBoost;
    setIsBassBoost(nextVal);
  };

  const setIsBassBoost = (active: boolean) => {
    setBassBoost(active);
    if (bassEQRef.current) {
      bassEQRef.current.gain.setValueAtTime(bassGain + (active ? 10 : 0), audioCtxRef.current?.currentTime || 0);
    }
  };

  const toggle8D = () => {
    setIs8D(prev => !prev);
  };

  // Ultra-fluid 60fps rAF DOM synchronizer for Apple-grade smooth progress bar without React re-renders
  useEffect(() => {
    let rAFId: number;
    let lastSecond = -1;

    const syncDOMProgress = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const cur = audioRef.current.currentTime || 0;
        const dur = audioRef.current.duration || duration || 0;

        if (dur > 0) {
          const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
          const pctStr = `${pct.toFixed(2)}%`;

          const widthEls = document.querySelectorAll<HTMLElement>('.sync-width');
          for (let i = 0; i < widthEls.length; i++) {
            widthEls[i].style.width = pctStr;
          }

          const leftEls = document.querySelectorAll<HTMLElement>('.sync-left');
          for (let i = 0; i < leftEls.length; i++) {
            leftEls[i].style.left = pctStr;
          }

          const valInputs = document.querySelectorAll<HTMLInputElement>('.sync-val');
          for (let i = 0; i < valInputs.length; i++) {
            if (document.activeElement !== valInputs[i]) {
              valInputs[i].value = String(cur);
            }
          }
        }

        const secFloor = Math.floor(cur);
        if (secFloor !== lastSecond) {
          lastSecond = secFloor;
          const mins = Math.floor(secFloor / 60);
          const secs = secFloor % 60;
          const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

          const timeEls = document.querySelectorAll<HTMLElement>('.sync-time');
          for (let i = 0; i < timeEls.length; i++) {
            timeEls[i].textContent = formatted;
          }
        }
      }

      if (isPlaying) {
        rAFId = requestAnimationFrame(syncDOMProgress);
      }
    };

    if (isPlaying) {
      rAFId = requestAnimationFrame(syncDOMProgress);
    }

    return () => {
      cancelAnimationFrame(rAFId);
    };
  }, [isPlaying, duration]);

  // Keep React state updated periodically (1.5s) for consumers that need currentTime prop without thrashing
  useEffect(() => {
    let intervalId: number;
    const updateTime = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };
    if (isPlaying) {
      intervalId = window.setInterval(updateTime, 1500);
    }
    return () => window.clearInterval(intervalId);
  }, [isPlaying]);

  const normalizeUrl = (urlStr: string | null): string => {
    if (!urlStr) return '';
    try {
      const absolute = new URL(urlStr, window.location.origin).href;
      return decodeURIComponent(absolute);
    } catch (e) {
      return decodeURIComponent(urlStr);
    }
  };

  const urlMatches = (urlA: string | null, urlB: string | null): boolean => {
    if (!urlA || !urlB) return false;
    const clean = (u: string) => {
      try {
        let dec = decodeURIComponent(u);
        dec = dec.replace(/[\/\s]+$/, '').replace(/\s+/g, ' ');
        if (dec.includes('://')) {
          const parsed = new URL(dec);
          return (parsed.pathname + parsed.search).toLowerCase();
        }
        return dec.toLowerCase();
      } catch (e) {
        return u.toLowerCase();
      }
    };
    return clean(urlA) === clean(urlB);
  };

  // Play a specific track
  const playTrack = (track: Track) => {
    const resolvedUrl = apiUrl(track.url);
    const trackNormUrl = normalizeUrl(resolvedUrl);

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';

      // Attach audio action listeners
      audioRef.current.addEventListener('timeupdate', () => {
        // Fallback for when paused or manually seeking
        if (audioRef.current && audioRef.current.paused) setCurrentTime(audioRef.current.currentTime);
      });

      audioRef.current.addEventListener('durationchange', () => {
        if (audioRef.current) setDuration(audioRef.current.duration || 0);
      });

      audioRef.current.addEventListener('waiting', () => {
        if (audioRef.current && currentlyLoadingUrlRef.current && !urlMatches(audioRef.current.src, currentlyLoadingUrlRef.current)) return;
        setIsLoading(true);
      });

      audioRef.current.addEventListener('playing', () => {
        if (audioRef.current && currentlyLoadingUrlRef.current && !urlMatches(audioRef.current.src, currentlyLoadingUrlRef.current)) return;
        setIsLoading(false);
      });

      audioRef.current.addEventListener('canplay', () => {
        if (audioRef.current && currentlyLoadingUrlRef.current && !urlMatches(audioRef.current.src, currentlyLoadingUrlRef.current)) return;
        setIsLoading(false);
      });

      audioRef.current.addEventListener('ended', () => {
        if (audioRef.current && currentlyLoadingUrlRef.current && !urlMatches(audioRef.current.src, currentlyLoadingUrlRef.current)) return;
        setIsPlaying(false);
        if (onTrackEndedRef.current) {
          onTrackEndedRef.current();
        }
      });

      audioRef.current.addEventListener('error', (e) => {
        if (audioRef.current && currentlyLoadingUrlRef.current && !urlMatches(audioRef.current.src, currentlyLoadingUrlRef.current)) {
          console.warn("Ignoring loading error from previous aborted track:", audioRef.current.src);
          return;
        }
        console.warn("Audio element loading error:", e);
        setIsLoading(false);
        setIsPlaying(false);
      });
    }

    // Keep track of the current loading URL to filter stale events
    currentlyLoadingUrlRef.current = trackNormUrl;
    setCurrentTrack(track);
    setIsLoading(true);

    // Initialize audio graph on user interaction
    initAudioGraph();

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (audioRef.current) {
      try {
        // Stop currently playing audio cleanly
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {
        console.warn("Pause/reset of previous track warning:", e);
      }

      // Assign new source and volume immediately
      audioRef.current.src = resolvedUrl;
      audioRef.current.load();
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;

      audioRef.current.play()
        .then(() => {
          // Verify that this is still the active track selected by the user
          if (currentlyLoadingUrlRef.current && urlMatches(currentlyLoadingUrlRef.current, trackNormUrl)) {
            setIsPlaying(true);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (currentlyLoadingUrlRef.current && urlMatches(currentlyLoadingUrlRef.current, trackNormUrl)) {
            console.warn("Playback error - user gesture required", err);
            setIsPlaying(false);
            setIsLoading(false);
          }
        });
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (!audioRef.current && currentTrack) {
      playTrack(currentTrack);
      return;
    }
    if (audioRef.current) {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const seek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  // Frequency audio analyzer helper with resilient harmonic synthesis fallback
  const getAnalysis = (): AudioAnalysis => {
    let rawData: Uint8Array | null = null;
    let hasRealAudio = false;

    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      
      if (sum > 0) {
        hasRealAudio = true;
        rawData = dataArray;
      }
    }

    if (hasRealAudio && rawData) {
      let bassSum = 0;
      const bassLimit = 15;
      for (let i = 0; i < bassLimit; i++) {
        bassSum += rawData[i];
      }
      const bass = bassSum / (bassLimit * 255);

      let midSum = 0;
      const midLimit = 60;
      for (let i = bassLimit; i < midLimit; i++) {
        midSum += rawData[i];
      }
      const mid = midSum / ((midLimit - bassLimit) * 255);

      let trebleSum = 0;
      const trebleLimit = 120;
      for (let i = midLimit; i < trebleLimit; i++) {
        trebleSum += rawData[i];
      }
      const treble = trebleSum / ((trebleLimit - midLimit) * 255);

      let totalSum = 0;
      for (let i = 0; i < rawData.length; i++) {
        totalSum += rawData[i];
      }
      const computedVolume = totalSum / (rawData.length * 255);

      return {
        bass: isNaN(bass) ? 0 : bass,
        mid: isNaN(mid) ? 0 : mid,
        treble: isNaN(treble) ? 0 : treble,
        volume: isNaN(computedVolume) ? 0 : computedVolume,
        frequencyData: rawData,
      };
    }

    // Dynamic Organic Harmonic Fallback when audio is playing but CORS restricts FFT node:
    if (isPlaying && audioRef.current) {
      const t = audioRef.current.currentTime || (performance.now() / 1000);
      const bpm = 126;
      const beatProgress = (t * (bpm / 60)) % 1;
      
      // Kick transient decay on every beat
      const kick = Math.pow(Math.max(0, 1 - beatProgress * 1.8), 2.5);
      const subBass = Math.sin(t * 12.5) * 0.2 + 0.35;
      const bass = Math.min(1, Math.max(0.15, kick * 0.85 + subBass * 0.35));

      // Snare on 2 and 4, hi-hats on 8th notes
      const hatProgress = (t * (bpm / 30)) % 1;
      const hat = Math.pow(Math.max(0, 1 - hatProgress * 2.2), 3);
      const treble = Math.min(1, Math.max(0.2, hat * 0.75 + Math.sin(t * 24) * 0.15 + 0.2));

      // Melodic mids oscillating smoothly
      const mid = Math.min(1, Math.max(0.2, 0.45 + Math.sin(t * 3.2) * 0.25 + Math.cos(t * 5.4) * 0.15));

      const vol = Math.min(1, Math.max(0.3, (bass * 0.45 + mid * 0.35 + treble * 0.2) * volume));

      // Synthesize realistic 128-bin frequency curve
      const synthData = new Uint8Array(128);
      for (let i = 0; i < 128; i++) {
        if (i < 15) {
          synthData[i] = Math.floor(bass * 255 * (1 - i / 20) + Math.random() * 15);
        } else if (i < 60) {
          const mNorm = (i - 15) / 45;
          synthData[i] = Math.floor(mid * 220 * Math.sin(mNorm * Math.PI) + Math.random() * 20);
        } else {
          const tNorm = (i - 60) / 68;
          synthData[i] = Math.floor(treble * 190 * (1 - tNorm * 0.6) + Math.random() * 15);
        }
      }

      return {
        bass,
        mid,
        treble,
        volume: vol,
        frequencyData: synthData,
      };
    }

    return {
      bass: 0,
      mid: 0,
      treble: 0,
      volume: 0,
      frequencyData: new Uint8Array(128)
    };
  };

  // Provide context values

  // Clean elements on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return (
    <AudioEngineContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        volume,
        currentTime,
        duration,
        is8D,
        panSpeed,
        bassBoost,
        playTrack,
        setCurrentTrack,
        pause,
        resume,
        setVolume,
        seek,
        audioRef,
        toggle8D,
        setPanSpeed,
        toggleBassBoost,
        getAnalysis,
        onTrackEnded: onTrackEndedRef.current,
        setOnTrackEnded,
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
        setPlaybackRate
      }}
    >
      {children}
    </AudioEngineContext.Provider>
  );
};
