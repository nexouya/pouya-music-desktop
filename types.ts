/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StreamSourceType = 'both' | 'spotify' | 'youtube';

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string; // Dynamic stream URL or Local Blob URL
  duration?: number; // in seconds
  coverUrl: string;
  isLocal?: boolean;
  category?: string;
  album?: string;
  coverFilename?: string;
  recommendationReason?: string;
  confidenceScore?: number;
  explorationTag?: "Familiar" | "Adjacent" | "Discovery";
  source?: 'spotify' | 'youtube' | 'local';
}

export interface FSNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  trackId?: string; // If it's a file, links to a Track
}

export type VisualizerMode = 'particles' | 'mesh' | 'tunnel' | 'wave';

export interface AudioAnalysis {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  frequencyData: Uint8Array;
}
