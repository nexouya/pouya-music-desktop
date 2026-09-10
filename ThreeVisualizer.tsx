/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useAudioEngine } from './AudioEngine';
import { VisualizerMode } from './types';

interface ThreeVisualizerProps {
  mode: VisualizerMode;
  theme?: 'dark' | 'light';
}

export const ThreeVisualizer: React.FC<ThreeVisualizerProps> = ({ mode, theme = 'dark' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { getAnalysis, isPlaying } = useAudioEngine();

  // Helper to generate a glowing particle texture dynamically
  const createPulseTexture = (): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Create radial gradient for a soft neon glow
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(0, 242, 254, 0.8)'); // Teal glow
    gradient.addColorStop(0.6, 'rgba(224, 0, 255, 0.2)');  // Deep Purple glow
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // SCENE & CAMERA
    const scene = new THREE.Scene();
    const isDark = theme === 'dark' || document.documentElement.classList.contains('dark');
    const fogColor = isDark ? 0x0a051d : 0xf8fafc;
    scene.fog = new THREE.FogExp2(fogColor, 0.015);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 12;

    // RENDERER WITH ANTI-ALIASING AND OPTIMIZED POWER PROFILE
    const renderer = new THREE.WebGLRenderer({ 
      antialias: window.innerWidth > 768, 
      alpha: true,
      powerPreference: "high-performance" 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    container.appendChild(renderer.domElement);

    // CORE VISUALIZER ELEMENTS
    let sphere: THREE.Mesh | null = null;
    let particles: THREE.Points | null = null;
    let particlePositions: Float32Array;
    let initialParticlePositions: Float32Array;
    let tunnelGrid: THREE.LineSegments | null = null;
    let waveLines: THREE.Line[] = [];

    const centerGroup = new THREE.Group();
    scene.add(centerGroup);

    // Dynamic neon glowing texture
    const particleTexture = createPulseTexture();

    // 1. MESH MODE INITIALIZATION (Glowing Cyber-beast core)
    const initMeshMode = () => {
      // Create a complex geodesic dual-wireframe sphere
      const geometry = new THREE.IcosahedronGeometry(3.5, 4);
      // Custom holographic wireframe shader material (or styled MeshStandardMaterial for ray-traced feel)
      const material = new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
      });
      sphere = new THREE.Mesh(geometry, material);
      centerGroup.add(sphere);

      // Add a secondary solid core mesh
      const coreGeo = new THREE.IcosahedronGeometry(2, 2);
      const coreMat = new THREE.MeshPhysicalMaterial({
        color: 0x9d4edd,
        emissive: 0x3c096c,
        roughness: 0.1,
        metalness: 0.9,
        flatShading: true,
        transparent: true,
        opacity: 0.7
      });
      const solidCore = new THREE.Mesh(coreGeo, coreMat);
      solidCore.name = "solidCore";
      sphere.add(solidCore);

      // Ambient Lights
      const pointLight1 = new THREE.PointLight(0x00f2fe, 15, 50);
      pointLight1.position.set(5, 5, 5);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0xe000ff, 15, 50);
      pointLight2.position.set(-5, -5, 5);
      scene.add(pointLight2);
    };

    // 2. PARTICLES MODE INITIALIZATION (Aesthetic Neural Cloud)
    const initParticlesMode = () => {
      const pCount = 1200;
      const geo = new THREE.BufferGeometry();
      particlePositions = new Float32Array(pCount * 3);
      initialParticlePositions = new Float32Array(pCount * 3);

      for (let i = 0; i < pCount; i++) {
        // Distribute points in a spherical shell with some noise
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const radius = 3.5 + Math.random() * 2.5;

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        particlePositions[i * 3] = x;
        particlePositions[i * 3 + 1] = y;
        particlePositions[i * 3 + 2] = z;

        initialParticlePositions[i * 3] = x;
        initialParticlePositions[i * 3 + 1] = y;
        initialParticlePositions[i * 3 + 2] = z;
      }

      geo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

      const particleMat = new THREE.PointsMaterial({
        size: 0.24,
        map: particleTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: 0xffffff
      });

      particles = new THREE.Points(geo, particleMat);
      centerGroup.add(particles);
    };

    // 3. TUNNEL MODE INITIALIZATION (Cyber Flight Tunnel)
    const initTunnelMode = () => {
      const tunnelGeo = new THREE.CylinderGeometry(4, 5, 40, 24, 20, true);
      const tunnelMat = new THREE.MeshBasicMaterial({
        color: 0xe000ff,
        wireframe: true,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending
      });
      tunnelGrid = new THREE.LineSegments(
        new THREE.WireframeGeometry(tunnelGeo),
        tunnelMat
      );
      tunnelGrid.rotation.x = Math.PI / 2;
      scene.add(tunnelGrid);
    };

    // 4. WAVE MODE INITIALIZATION (Oscillating holographic planes)
    const initWaveMode = () => {
      const waveCount = 5;
      const pointsPerLine = 60;
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        linewidth: 2
      });

      for (let w = 0; w < waveCount; w++) {
        const lineGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(pointsPerLine * 3);

        const zPos = w * 1.5 - (waveCount * 1.5) / 2;
        for (let i = 0; i < pointsPerLine; i++) {
          positions[i * 3] = (i - pointsPerLine / 2) * 0.4; // x
          positions[i * 3 + 1] = 0; // y
          positions[i * 3 + 2] = zPos; // z
        }
        lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const line = new THREE.Line(lineGeo, lineMaterial.clone());
        // Dynamic pastel purple to neon teal color gradient across lines
        (line.material as THREE.LineBasicMaterial).color.setHSL(0.5 + w * 0.08, 1.0, 0.5);
        scene.add(line);
        waveLines.push(line);
      }
    };

    // Run active modes init
    if (mode === 'mesh') initMeshMode();
    else if (mode === 'particles') initParticlesMode();
    else if (mode === 'tunnel') initTunnelMode();
    else if (mode === 'wave') initWaveMode();

    // ANIMATE REALTIME AUDIO SPECTRUM LOOP
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let lastRenderTime = 0;

    const render = (timestamp: number) => {
      if (timestamp - lastRenderTime < 33) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      lastRenderTime = timestamp;

      const analysis = getAnalysis();
      const time = clock.getElapsedTime();

      // Set interactive base rotation on mouse hover or automatic flow
      const automaticRotationSpeed = isPlaying ? 0.005 + analysis.volume * 0.02 : 0.003;
      centerGroup.rotation.y += automaticRotationSpeed;
      centerGroup.rotation.x += automaticRotationSpeed * 0.4;

      if (mode === 'mesh' && sphere) {
        // Wave deforms geometry vertices
        const core = sphere.getObjectByName("solidCore") as THREE.Mesh;
        
        // Dynamic core scale mapping the bass
        const bassScale = 1.0 + analysis.bass * 0.8;
        if (core) {
          core.scale.set(bassScale, bassScale, bassScale);
        }

        // Pulse outer wireframe
        const sphereScale = 1.0 + analysis.treble * 0.15 + analysis.bass * 0.1;
        sphere.scale.set(sphereScale, sphereScale, sphereScale);

        // Slow color hue shift
        const hue = (0.5 + analysis.volume * 0.2 + (time * 0.02) % 1.0) % 1.0;
        (sphere.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1.0, 0.5);

      } else if (mode === 'particles' && particles) {
        const posAttr = particles.geometry.attributes.position as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;

        // Multiply displacement based on bass
        const displacement = analysis.bass * 1.5;
        const color = (particles.material as THREE.PointsMaterial).color;
        // Flash neon pink on bass, otherwise glowing cyan
        if (analysis.bass > 0.6) {
          color.setHex(0xe000ff); // Cyber Purple
        } else {
          color.setHex(0x00f2fe); // Electric Cyan
        }

        // Oscillate particles outward dynamically matching bass & high-frequencies
        for (let i = 0; i < particlePositions.length / 3; i++) {
          const xIdx = i * 3;
          const yIdx = i * 3 + 1;
          const zIdx = i * 3 + 2;

          const ix = initialParticlePositions[xIdx];
          const iy = initialParticlePositions[yIdx];
          const iz = initialParticlePositions[zIdx];

          const waveTerm = Math.sin(time * 3 + i * 0.01) * 0.1;
          const amp = 1.0 + displacement * (0.1 + Math.sin(time + i) * 0.05) + waveTerm;

          positions[xIdx] = ix * amp;
          positions[yIdx] = iy * amp;
          positions[zIdx] = iz * amp;
        }
        posAttr.needsUpdate = true;

      } else if (mode === 'tunnel' && tunnelGrid) {
        // Move camera down the tunnel for an immersive flight effect!
        tunnelGrid.position.z += 0.08 + analysis.bass * 0.18;
        if (tunnelGrid.position.z > 20) {
          tunnelGrid.position.z = 0;
        }
        // Rotate tunnel to stimulate wormhole feel
        tunnelGrid.rotation.y += 0.002;
        
        // React grid opacity
        const gridMat = tunnelGrid.material as THREE.MeshBasicMaterial;
        gridMat.opacity = 0.12 + analysis.volume * 0.35;
        // Transition tunnel color
        gridMat.color.setHSL(0.75 + Math.sin(time * 0.2) * 0.1, 1.0, 0.5 + analysis.treble * 0.1);

      } else if (mode === 'wave' && waveLines.length > 0) {
        waveLines.forEach((line, lineIdx) => {
          const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
          const positions = posAttr.array as Float32Array;
          const pCount = positions.length / 3;

          const midHz = analysis.frequencyData;

          for (let i = 0; i < pCount; i++) {
            const index = Math.floor((i / pCount) * (midHz.length / 2));
            const amplitude = (midHz[index] / 255) * 2.8;

            // Apply smooth wave deforming along the line
            const offset = Math.sin(time * 4 - i * 0.15 + lineIdx) * 0.2 * analysis.treble;
            positions[i * 3 + 1] = amplitude * (1.2 - lineIdx * 0.2) + offset;
          }
          posAttr.needsUpdate = true;
        });
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // INTERACTIVE CONTAINER RESIZING
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      }
    });
    resizeObserver.observe(container);

    // CLEANUP
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
      particleTexture.dispose();
    };
  }, [mode, theme]);

  return (
    <div
      id="3d-visualizer"
      ref={containerRef}
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none"
      style={{ minHeight: '340px' }}
    >
      {/* Immersive overlay for deep spatial glassmorphism */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/30 z-[2]" />
    </div>
  );
};
