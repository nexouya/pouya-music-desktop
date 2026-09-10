/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { useAudioEngine } from './AudioEngine';

interface LiveBackgroundProps {
  theme: 'dark' | 'light';
}

// Shared global state for synchronized ambient space across components
let globalAngle = 0;
let lastSharedTime = performance.now();

export const LiveBackground: React.FC<LiveBackgroundProps> = ({ theme }) => {
  const { getAnalysis, isPlaying } = useAudioEngine();

  const containerRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);
  const orb4Ref = useRef<HTMLDivElement>(null);
  const orb5Ref = useRef<HTMLDivElement>(null);

  // Parallax coordinates tracked smoothly with LERP
  const mouseTargetX = useRef<number>(0);
  const mouseTargetY = useRef<number>(0);
  const mouseCurrentX = useRef<number>(0);
  const mouseCurrentY = useRef<number>(0);

  // LERP variables for silky audio scaling
  const currentBass = useRef<number>(0);
  const currentMid = useRef<number>(0);
  const currentTreble = useRef<number>(0);
  const currentVolume = useRef<number>(0);

  // Mouse parallax listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize from -1 to 1
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      mouseTargetX.current = nx * 18; // px tilt range
      mouseTargetY.current = ny * 18;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Set initial colors once to avoid paint thrashing inside requestAnimationFrame
  useEffect(() => {
    if (theme === 'dark') {
      // Spatial Spectrum: Electric Cyan Neon, Quantum Ultraviolet, Laser Magenta, Cyber Ocean Cobalt & Starlight Amber
      if (orb1Ref.current) {
        orb1Ref.current.style.background = 'radial-gradient(circle, rgba(6, 182, 212, 0.85) 0%, rgba(14, 165, 233, 0.50) 40%, rgba(3, 105, 161, 0.18) 75%, transparent 100%)';
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.background = 'radial-gradient(circle, rgba(168, 85, 247, 0.80) 0%, rgba(139, 92, 246, 0.45) 45%, rgba(99, 102, 241, 0.16) 75%, transparent 100%)';
      }
      if (orb3Ref.current) {
        orb3Ref.current.style.background = 'radial-gradient(circle, rgba(244, 63, 94, 0.75) 0%, rgba(236, 72, 153, 0.40) 45%, rgba(217, 70, 239, 0.14) 75%, transparent 100%)';
      }
      if (orb4Ref.current) {
        orb4Ref.current.style.background = 'radial-gradient(circle, rgba(37, 99, 235, 0.75) 0%, rgba(20, 184, 166, 0.38) 45%, rgba(15, 23, 42, 0.20) 80%, transparent 100%)';
      }
      if (orb5Ref.current) {
        orb5Ref.current.style.background = 'radial-gradient(circle, rgba(245, 158, 11, 0.55) 0%, rgba(251, 191, 36, 0.25) 45%, transparent 75%)';
      }
    } else {
      if (orb1Ref.current) {
        orb1Ref.current.style.background = 'radial-gradient(circle, rgba(191, 219, 254, 0.8) 0%, rgba(219, 234, 254, 0.35) 70%, transparent 100%)';
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.background = 'radial-gradient(circle, rgba(224, 231, 255, 0.7) 0%, rgba(238, 242, 255, 0.3) 70%, transparent 100%)';
      }
      if (orb3Ref.current) {
        orb3Ref.current.style.background = 'radial-gradient(circle, rgba(186, 230, 253, 0.75) 0%, rgba(224, 242, 254, 0.3) 70%, transparent 100%)';
      }
      if (orb4Ref.current) {
        orb4Ref.current.style.background = 'radial-gradient(circle, rgba(233, 213, 255, 0.6) 0%, rgba(243, 232, 255, 0.25) 70%, transparent 100%)';
      }
      if (orb5Ref.current) {
        orb5Ref.current.style.background = 'radial-gradient(circle, rgba(254, 243, 199, 0.6) 0%, rgba(253, 230, 138, 0.2) 70%, transparent 100%)';
      }
    }
  }, [theme]);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const animate = (timeNow: number) => {
      const dt = Math.min((timeNow - lastTime) / 1000, 0.1);
      lastTime = timeNow;

      const analysis = getAnalysis();
      const LERP_AUDIO = Math.min(1, dt * 14); // Frame-rate independent lerp
      
      currentBass.current += ((analysis.bass || 0) - currentBass.current) * LERP_AUDIO;
      currentMid.current += ((analysis.mid || 0) - currentMid.current) * LERP_AUDIO;
      currentTreble.current += ((analysis.treble || 0) - currentTreble.current) * LERP_AUDIO;
      currentVolume.current += ((analysis.volume || 0) - currentVolume.current) * LERP_AUDIO;

      // Mouse parallax smooth interpolation
      mouseCurrentX.current += (mouseTargetX.current - mouseCurrentX.current) * (dt * 5);
      mouseCurrentY.current += (mouseTargetY.current - mouseCurrentY.current) * (dt * 5);

      const bass = currentBass.current;
      const mid = currentMid.current;
      const treble = currentTreble.current;
      const volume = currentVolume.current;

      const speedFactor = isPlaying ? (0.4 + volume * 1.8) : 0.2;
      globalAngle += dt * speedFactor;

      const angle = globalAngle;
      const px = mouseCurrentX.current;
      const py = mouseCurrentY.current;

      const scaleBass = 1.0 + Math.min(bass * 1.4, 0.95);
      const scaleMid = 1.0 + Math.min(mid * 1.1, 0.75);
      const scaleTreble = 1.0 + Math.min(treble * 1.3, 0.85);
      const scaleVolume = 1.0 + Math.min(volume * 1.2, 0.85);

      // --- Orb 1: Bass-Driven Pulsing (Electric Cyan) ---
      if (orb1Ref.current) {
        const xNow = (Math.sin(angle) * 14 + px * 0.8).toFixed(2);
        const yNow = (Math.cos(angle * 0.8) * 14 + py * 0.8).toFixed(2);
        const opacity = (theme === 'dark' ? (0.58 + bass * 0.42) : (0.32 + bass * 0.22)).toFixed(3);
        orb1Ref.current.style.transform = `translate3d(${xNow}vw, ${yNow}vh, 0) scale(${scaleBass.toFixed(3)})`;
        orb1Ref.current.style.opacity = opacity;
      }

      // --- Orb 2: Ultraviolet Mid Frequencies ---
      if (orb2Ref.current) {
        const xNow = (Math.cos(angle * 1.1) * 16 - px * 1.1).toFixed(2);
        const yNow = (Math.sin(angle * 0.7) * 16 - py * 1.1).toFixed(2);
        const opacity = (theme === 'dark' ? (0.54 + mid * 0.44) : (0.26 + mid * 0.20)).toFixed(3);
        orb2Ref.current.style.transform = `translate3d(${xNow}vw, ${yNow}vh, 0) scale(${scaleMid.toFixed(3)})`;
        orb2Ref.current.style.opacity = opacity;
      }

      // --- Orb 3: High Treble Drifting (Hyper Magenta) ---
      if (orb3Ref.current) {
        const xNow = (Math.sin(angle * 0.6) * 18 + px * 1.3).toFixed(2);
        const yNow = (Math.cos(angle * 1.2) * 14 - py * 0.9).toFixed(2);
        const opacity = (theme === 'dark' ? (0.50 + treble * 0.48) : (0.24 + treble * 0.22)).toFixed(3);
        orb3Ref.current.style.transform = `translate3d(${xNow}vw, ${yNow}vh, 0) scale(${scaleTreble.toFixed(3)})`;
        orb3Ref.current.style.opacity = opacity;
      }

      // --- Orb 4: Volume Ambient Glow (Ocean Teal & Cyber Blue) ---
      if (orb4Ref.current) {
        const xNow = (Math.cos(angle * 0.4) * 14 - px * 0.6).toFixed(2);
        const yNow = (Math.sin(angle * 0.5) * 18 + py * 0.7).toFixed(2);
        const opacity = (theme === 'dark' ? (0.48 + volume * 0.46) : (0.22 + volume * 0.20)).toFixed(3);
        orb4Ref.current.style.transform = `translate3d(${xNow}vw, ${yNow}vh, 0) scale(${scaleVolume.toFixed(3)})`;
        orb4Ref.current.style.opacity = opacity;
      }

      // --- Orb 5: Core Harmonic Prism (Warm Amber / Solar Starlight) ---
      if (orb5Ref.current) {
        const xNow = (Math.sin(angle * 0.9) * 10 + px * 0.4).toFixed(2);
        const yNow = (Math.cos(angle * 0.5) * 12 + py * 0.4).toFixed(2);
        const opacity = (theme === 'dark' ? (0.40 + volume * 0.40) : (0.18 + volume * 0.16)).toFixed(3);
        const scaleHarmonic = (1.0 + mid * 0.5).toFixed(3);
        orb5Ref.current.style.transform = `translate3d(${xNow}vw, ${yNow}vh, 0) scale(${scaleHarmonic})`;
        orb5Ref.current.style.opacity = opacity;
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, theme]);

  return (
    <div 
      className="absolute -inset-16 z-0 overflow-hidden pointer-events-none select-none"
      style={{ contain: 'strict', contentVisibility: 'auto' }}
    >
      {/* Container holding beautifully morphing chromatic bodies with deep optical blur */}
      <div 
        ref={containerRef}
        className="w-full h-full relative blur-[90px] sm:blur-[115px] md:blur-[140px] opacity-90 dark:opacity-95 transform-gpu"
        style={{ transform: 'translate3d(0, 0, 0)', willChange: 'transform' }}
      >
        {/* Orb 1 - Electric Cyan */}
        <div 
          ref={orb1Ref}
          className="absolute top-[15%] left-[18%] w-[44vw] h-[44vw] rounded-full opacity-80"
          style={{ willChange: 'transform, opacity', transform: 'translate3d(0, 0, 0)' }}
        />

        {/* Orb 2 - Quantum Violet */}
        <div 
          ref={orb2Ref}
          className="absolute top-[8%] right-[12%] w-[40vw] h-[40vw] rounded-full opacity-70"
          style={{ willChange: 'transform, opacity', transform: 'translate3d(0, 0, 0)' }}
        />

        {/* Orb 3 - Hyper Magenta */}
        <div 
          ref={orb3Ref}
          className="absolute bottom-[8%] left-[8%] w-[50vw] h-[50vw] rounded-full opacity-80"
          style={{ willChange: 'transform, opacity', transform: 'translate3d(0, 0, 0)' }}
        />

        {/* Orb 4 - Deep Ocean Cobalt */}
        <div 
          ref={orb4Ref}
          className="absolute bottom-[12%] right-[16%] w-[38vw] h-[38vw] rounded-full opacity-70"
          style={{ willChange: 'transform, opacity', transform: 'translate3d(0, 0, 0)' }}
        />

        {/* Orb 5 - Core Amber Starlight */}
        <div 
          ref={orb5Ref}
          className="absolute top-[35%] left-[38%] w-[32vw] h-[32vw] rounded-full opacity-40"
          style={{ willChange: 'transform, opacity', transform: 'translate3d(0, 0, 0)' }}
        />
      </div>

      {/* Tactile Micro-Grain & Optical Refraction Film */}
      <div className="absolute inset-0 glass-grain opacity-40 mix-blend-overlay pointer-events-none" />

      {/* Soft Ambient Radial Light Falloff - keeps liquid glass luminous and colorful */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_35%]_from-transparent_via-black/10_to-black/35 dark:bg-radial-[circle_at_50%_35%]_from-transparent_via-black/25_to-[#020308]/85 pointer-events-none" />
    </div>
  );
};
