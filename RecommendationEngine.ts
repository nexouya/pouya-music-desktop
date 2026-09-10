import { Track, StreamSourceType } from "./types";

export interface UserTasteModel {
  genreAffinity: Record<string, number>;
  artistAffinity: Record<string, number>;
  energyPreference: number;      // 0.0 to 1.0 (Low-key / Chill to Ultra-high energy)
  tempoPreference: number;       // 60 to 180 BPM
  valencePreference: number;     // 0.0 to 1.0 (Dark/Melancholic to Happy/Positive)
  noveltyAcceptance: number;     // 0.0 to 1.0 (How open to completely new stuff)
  recentArtistPlays: string[];   // Recent artists list for diversity pressure
  recentGenrePlays: string[];    // Recent genres list for diversity pressure
  recentTrackIds: string[];      // For deduplication across sessions / fatigue prevention
  skippedTrackIds: string[];     // Tracks user explicitly skipped
  likedTrackIds: string[];       // Tracks user liked
  sessionEnergyTrend: number[];  // Track energy of last 5 played tracks to detect live mood shift
}

export interface UserProfile {
  username: string;
  tasteModel: UserTasteModel;
  playCounts: Record<string, number>;
  skipCounts: Record<string, number>;
  completionRates: Record<string, number>; // trackId -> completion (0 to 1)
  totalListenTimeSeconds: number;
}

// Model representing additional dynamic signals for ranking
export interface TrackCandidate extends Track {
  estimatedTempo: number;
  estimatedEnergy: number;
  estimatedValence: number;
  popularity: number; // 0 to 100
  releaseYear: number;
  isNew: boolean;
  qualityScore: number; // calculated from artwork presence, audio length etc.
}

export class RecommendationEngine {
  private static STORAGE_KEY = "pouya_music_profile_advanced_v4";

  // Get or initialize user profile with dynamic default taste vectors
  static getProfile(): UserProfile {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.tasteModel && parsed.tasteModel.genreAffinity) {
          // Initialize newer fields if missing
          if (!parsed.tasteModel.recentTrackIds) parsed.tasteModel.recentTrackIds = [];
          if (!parsed.tasteModel.skippedTrackIds) parsed.tasteModel.skippedTrackIds = [];
          if (!parsed.tasteModel.likedTrackIds) parsed.tasteModel.likedTrackIds = [];
          if (!parsed.tasteModel.sessionEnergyTrend) parsed.tasteModel.sessionEnergyTrend = [];
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error reading profile", e);
    }

    // Default pristine profile primed for Michael Jackson
    return {
      username: localStorage.getItem("pouya_music_username") || "Guest Finder",
      tasteModel: {
        genreAffinity: { "Pop": 10, "Dance": 8, "R&B/Soul": 8, "Funk": 7, "Rock": 6 },
        artistAffinity: { "Michael Jackson": 20 },
        energyPreference: 0.75,
        tempoPreference: 118,
        valencePreference: 0.7,
        noveltyAcceptance: 0.2,
        recentArtistPlays: ["Michael Jackson"],
        recentGenrePlays: ["Pop", "Dance", "R&B/Soul"],
        recentTrackIds: [],
        skippedTrackIds: [],
        likedTrackIds: [],
        sessionEnergyTrend: [0.75],
      },
      playCounts: {},
      skipCounts: {},
      completionRates: {},
      totalListenTimeSeconds: 0,
    };
  }

  static saveProfile(profile: UserProfile) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(profile));
  }

  static async getRecommendations(streamSource: StreamSourceType = "both"): Promise<Track[]> {
    return this.getInfiniteRecommendations(0, 10, [], streamSource);
  }

  // Adaptive Feedback System - dynamically adjusts the taste model on every listener interaction
  static registerPlay(track: Track) {
    const profile = this.getProfile();
    const model = profile.tasteModel;

    profile.playCounts[track.id] = (profile.playCounts[track.id] || 0) + 1;

    // Track played track ID to prevent immediate repetition
    model.recentTrackIds = [track.id, ...model.recentTrackIds.filter(id => id !== track.id)].slice(0, 50);

    // Update affinities with positive feedback
    if (track.artist) {
      model.artistAffinity[track.artist] = (model.artistAffinity[track.artist] || 0) + 1.2;
      model.recentArtistPlays = [track.artist, ...model.recentArtistPlays.filter(a => a !== track.artist)].slice(0, 15);
    }
    if (track.category) {
      model.genreAffinity[track.category] = (model.genreAffinity[track.category] || 0) + 1.0;
      model.recentGenrePlays = [track.category, ...model.recentGenrePlays.filter(g => g !== track.category)].slice(0, 12);
    }

    // Adapt energy and valence preference curve based on played tracks' estimated attributes
    const candidate = this.enrichTrackMetadata(track);
    model.energyPreference = model.energyPreference * 0.85 + candidate.estimatedEnergy * 0.15;
    model.valencePreference = model.valencePreference * 0.85 + candidate.estimatedValence * 0.15;
    model.tempoPreference = model.tempoPreference * 0.88 + candidate.estimatedTempo * 0.12;

    // Track live energy mood shifts
    model.sessionEnergyTrend = [candidate.estimatedEnergy, ...model.sessionEnergyTrend].slice(0, 5);

    // Slowly reduce novelty acceptance on continuous familiarity matches, and vice versa
    model.noveltyAcceptance = Math.max(0.1, Math.min(0.9, model.noveltyAcceptance * 0.98 + 0.01));

    this.saveProfile(profile);
  }

  static registerSkip(track: Track) {
    const profile = this.getProfile();
    const model = profile.tasteModel;

    profile.skipCounts[track.id] = (profile.skipCounts[track.id] || 0) + 1;
    model.skippedTrackIds = [track.id, ...model.skippedTrackIds.filter(id => id !== track.id)].slice(0, 50);

    if (track.artist && model.artistAffinity[track.artist]) {
      model.artistAffinity[track.artist] = Math.max(0, model.artistAffinity[track.artist] - 1.5);
    }
    if (track.category && model.genreAffinity[track.category]) {
      model.genreAffinity[track.category] = Math.max(0, model.genreAffinity[track.category] - 1.0);
    }

    // Skips cause novelty acceptance to shift to find something fresh
    model.noveltyAcceptance = Math.min(0.95, model.noveltyAcceptance + 0.04);

    // Live session mood adjustment: If they skip, slightly shift preference away from current track's energy
    const candidate = this.enrichTrackMetadata(track);
    const difference = model.energyPreference - candidate.estimatedEnergy;
    // push preference away from what they skipped
    model.energyPreference = Math.max(0.0, Math.min(1.0, model.energyPreference + difference * 0.1));

    this.saveProfile(profile);
  }

  static registerLike(track: Track, isLiked: boolean) {
    const profile = this.getProfile();
    const model = profile.tasteModel;

    const multiplier = isLiked ? 4.0 : -3.5;

    if (isLiked) {
      model.likedTrackIds = [track.id, ...model.likedTrackIds.filter(id => id !== track.id)].slice(0, 100);
    } else {
      model.likedTrackIds = model.likedTrackIds.filter(id => id !== track.id);
    }

    if (track.artist) {
      model.artistAffinity[track.artist] = Math.max(0, (model.artistAffinity[track.artist] || 0) + multiplier);
    }
    if (track.category) {
      model.genreAffinity[track.category] = Math.max(0, (model.genreAffinity[track.category] || 0) + multiplier * 0.8);
    }

    // Likes boost novelty acceptance for discovery matches
    if (isLiked) {
      const isArtistKnown = (model.artistAffinity[track.artist || ""] || 0) > 3;
      if (!isArtistKnown) {
        model.noveltyAcceptance = Math.min(0.95, model.noveltyAcceptance + 0.1);
      }
    }

    this.saveProfile(profile);
  }

  static registerMicroInteraction(track: Track, action: "hover" | "pause" | "longScrollStop" | "rewind") {
    const profile = this.getProfile();
    const model = profile.tasteModel;

    let reward = 0.15;
    if (action === "pause") reward = 0.5;
    if (action === "longScrollStop") reward = 0.35;
    if (action === "rewind") reward = 0.8; // User replayed or scrubbed back - extreme positive signal!

    if (track.artist) {
      model.artistAffinity[track.artist] = (model.artistAffinity[track.artist] || 0) + reward;
    }
    if (track.category) {
      model.genreAffinity[track.category] = (model.genreAffinity[track.category] || 0) + reward * 0.8;
    }

    this.saveProfile(profile);
  }

  // Enrich track with deterministic meta-properties based on names, genres, and IDs
  private static enrichTrackMetadata(track: Track): TrackCandidate {
    const cat = (track.category || "").toLowerCase();
    const title = (track.title || "").toLowerCase();
    const artist = (track.artist || "").toLowerCase();

    // Use track ID hash for deterministic fallback characteristics
    let hash = 0;
    const str = track.id + track.title;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pseudoRand = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // 1. Est. Tempo (BPM)
    let estimatedTempo = 115;
    if (cat.includes("dance") || cat.includes("house") || cat.includes("techno") || cat.includes("electronic") || cat.includes("edm")) {
      estimatedTempo = 120 + Math.floor(pseudoRand(hash) * 15); // 120 - 135
    } else if (cat.includes("rock") || cat.includes("metal") || cat.includes("punk")) {
      estimatedTempo = 130 + Math.floor(pseudoRand(hash + 1) * 30); // 130 - 160
    } else if (cat.includes("chill") || cat.includes("ambient") || cat.includes("lofi") || cat.includes("classical")) {
      estimatedTempo = 70 + Math.floor(pseudoRand(hash + 2) * 20); // 70 - 90
    } else if (cat.includes("rap") || cat.includes("hip") || cat.includes("r&b")) {
      estimatedTempo = 85 + Math.floor(pseudoRand(hash + 3) * 25); // 85 - 110
    } else {
      estimatedTempo = 100 + Math.floor(pseudoRand(hash + 4) * 25); // 100 - 125
    }

    // 2. Est. Energy
    let estimatedEnergy = 0.5;
    if (cat.includes("dance") || cat.includes("house") || cat.includes("techno") || cat.includes("edm") || cat.includes("rock") || cat.includes("metal")) {
      estimatedEnergy = 0.75 + pseudoRand(hash + 5) * 0.22;
    } else if (cat.includes("chill") || cat.includes("ambient") || cat.includes("lofi") || cat.includes("classical") || cat.includes("sleep")) {
      estimatedEnergy = 0.1 + pseudoRand(hash + 6) * 0.2;
    } else {
      estimatedEnergy = 0.4 + pseudoRand(hash + 7) * 0.3;
    }

    // 3. Est. Valence
    let estimatedValence = 0.5;
    if (title.includes("sad") || title.includes("acoustic") || title.includes("slow") || title.includes("relax") || title.includes("dark")) {
      estimatedValence = 0.15 + pseudoRand(hash + 8) * 0.25;
    } else if (title.includes("love") || title.includes("happy") || title.includes("remix") || title.includes("party") || title.includes("summer")) {
      estimatedValence = 0.65 + pseudoRand(hash + 9) * 0.32;
    } else {
      estimatedValence = 0.35 + pseudoRand(hash + 10) * 0.4;
    }

    // 4. Popularity (0-100) & Release Year
    const popularity = Math.floor(45 + pseudoRand(hash + 11) * 53); // 45 to 98
    const releaseYear = 2010 + Math.floor(pseudoRand(hash + 12) * 17); // 2010 to 2026
    const isNew = releaseYear >= 2024;

    // Quality assessment (covers present, clear title etc.)
    const qualityScore = track.coverUrl && !track.coverUrl.includes("placeholder") ? 95 : 75;

    return {
      ...track,
      estimatedTempo,
      estimatedEnergy,
      estimatedValence,
      popularity,
      releaseYear,
      isNew,
      qualityScore
    };
  }

  // ==========================================
  // MASTER PIPELINE
  // ==========================================
  static async getInfiniteRecommendations(
    offset: number,
    limit: number,
    excludeIds: string[] = [],
    streamSource: StreamSourceType = "both"
  ): Promise<Track[]> {
    const profile = this.getProfile();
    const model = profile.tasteModel;

    try {
      // ------------------------------------------
      // STAGE 1: Candidate Retrieval
      // ------------------------------------------
      const rawCandidates = await this.retrieveStage1Candidates(offset, model, profile, streamSource);

      // ------------------------------------------
      // STAGE 2: Quality Filtering & Strict Source Enforcement
      // ------------------------------------------
      const filteredCandidates = this.executeStage2Filtering(rawCandidates, excludeIds, model, streamSource);

      // ------------------------------------------
      // STAGE 3: Deep Ranking & Probabilistic Scoring
      // ------------------------------------------
      const rankedCandidates = this.executeStage3DeepRanking(filteredCandidates, model, profile);

      // ------------------------------------------
      // STAGE 4: Diversity Optimization (DPP / MMR style)
      // ------------------------------------------
      const diversifiedCandidates = this.executeStage4Diversity(rankedCandidates);

      // ------------------------------------------
      // STAGE 5: Exploration Ratio Allocation (65 / 20 / 10 / 5)
      // ------------------------------------------
      const finalizedBatch = this.executeStage5ExplorationRatio(diversifiedCandidates, limit);

      // Ensure that we at least return up to the requested limit
      return finalizedBatch;
    } catch (e) {
      console.error("Advanced multi-stage pipeline failure, launching recovery fallback:", e);
      // Fallback baseline primed with Michael Jackson classics
      const fallbackList = streamSource === "youtube"
        ? await this.fetchFromYouTube("Michael Jackson", limit + 5)
        : await this.fetchFromITunes("Michael Jackson", limit + 5, offset);
      return fallbackList.slice(0, limit).map((t, idx) => {
        const enriched = this.enrichTrackMetadata(t);
        return {
          ...enriched,
          confidenceScore: 98 - idx,
          explorationTag: "Familiar",
          recommendationReason: "Legendary masterpiece by the King of Pop"
        };
      });
    }
  }

  // ------------------------------------------
  // STAGE 1: MULTI-SOURCE RETRIEVAL
  // ------------------------------------------
  private static async retrieveStage1Candidates(
    offset: number,
    model: UserTasteModel,
    profile: UserProfile,
    streamSource: StreamSourceType = "both"
  ): Promise<TrackCandidate[]> {
    const fetchPromises: Promise<Track[]>[] = [];

    // Prioritized Michael Jackson albums and eras
    const mjQueries = [
      "Michael Jackson Xscape",
      "Michael Jackson Chicago",
      "Michael Jackson Thriller",
      "Michael Jackson Bad",
      "Michael Jackson Dangerous",
      "Michael Jackson Off The Wall",
      "Michael Jackson Number Ones",
      "Michael Jackson Invincible",
      "Michael Jackson Essential",
      "Michael Jackson History",
      "Michael Jackson King of Pop"
    ];

    if (streamSource === "both" || streamSource === "spotify") {
      // Main Spotify / iTunes queries
      mjQueries.forEach((q, idx) => {
        fetchPromises.push(this.fetchFromITunes(q, 15, Math.floor(offset / 2) * 2 + (idx % 3)));
      });
    }

    if (streamSource === "both" || streamSource === "youtube") {
      // YouTube Music queries
      const ytSubset = mjQueries.slice(offset % 4, (offset % 4) + 4);
      ytSubset.forEach((q) => {
        fetchPromises.push(this.fetchFromYouTube(q, 8));
      });
    }

    // Resolve all retrieval sources parallelly
    const batches = await Promise.all(fetchPromises);
    const pooled: TrackCandidate[] = [];
    const seen = new Set<string>();

    batches.forEach(batch => {
      batch.forEach(t => {
        // Enforce Michael Jackson artist match
        const isMJ = (t.artist || "").toLowerCase().includes("michael jackson");
        if (isMJ && !seen.has(t.id)) {
          seen.add(t.id);
          pooled.push(this.enrichTrackMetadata(t));
        }
      });
    });

    return pooled;
  }

  // ------------------------------------------
  // STAGE 2: QUALITY FILTERING & SANITIZATION
  // ------------------------------------------
  private static executeStage2Filtering(
    candidates: TrackCandidate[],
    excludeIds: string[],
    model: UserTasteModel,
    streamSource: StreamSourceType = "both"
  ): TrackCandidate[] {
    const filtered: TrackCandidate[] = [];
    const seenNormalizedTitles = new Set<string>();

    // Combine manual excluded ids, recent plays fatigue prevention, and extreme skipped tracks
    const allExclusions = new Set<string>([
      ...excludeIds,
      ...model.recentTrackIds.slice(0, 10), // Small window for MJ replayability
    ]);

    candidates.forEach(track => {
      // 0. Strict Source Enforcement: if "youtube", reject any non-youtube track. If "spotify", reject any non-spotify track.
      if (streamSource === "youtube" && track.source !== "youtube") return;
      if (streamSource === "spotify" && track.source !== "spotify") return;

      // 1. Remove hard excluded track IDs if explicit
      if (excludeIds.includes(track.id)) return;

      // 2. Remove near-duplicates (identical title + artist lowercase normalized check)
      const cleanTitle = track.title.toLowerCase().replace(/[\(\[\-].*/, "").trim();
      if (seenNormalizedTitles.has(cleanTitle)) return;

      // 3. Keep high quality tracks only (Must have active playable preview stream and artwork)
      if (!track.url || !track.coverUrl) return;

      // 4. Ensure it is strictly Michael Jackson
      if (!track.artist.toLowerCase().includes("michael jackson")) return;

      seenNormalizedTitles.add(cleanTitle);
      filtered.push(track);
    });

    return filtered;
  }

  // ------------------------------------------
  // STAGE 3: PROBABILISTIC DEEP RANKING MODEL
  // ------------------------------------------
  private static executeStage3DeepRanking(
    candidates: TrackCandidate[],
    model: UserTasteModel,
    profile: UserProfile
  ): (TrackCandidate & {
    pListen: number;
    pFinish: number;
    pReplay: number;
    pLike: number;
    pPlaylistAdd: number;
    pShare: number;
    pSkip: number;
    pSatisfaction: number;
  })[] {
    const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

    return candidates.map(track => {
      const artist = track.artist || "";
      const genre = track.category || "";

      // Gather baseline user interaction telemetry
      const artistAffinity = model.artistAffinity[artist] || 0;
      const genreAffinity = model.genreAffinity[genre] || 0;

      const trackPlays = profile.playCounts[track.id] || 0;
      const trackSkips = profile.skipCounts[track.id] || 0;

      // Temporal context / Mood matching
      const energyDiff = Math.abs(track.estimatedEnergy - model.energyPreference);
      const valenceDiff = Math.abs(track.estimatedValence - model.valencePreference);
      const tempoDiff = Math.abs(track.estimatedTempo - model.tempoPreference) / 100;

      // Freshness & Trend Multipliers
      const trendBoost = track.popularity / 100 * 0.4;
      const agePenalty = (2026 - track.releaseYear) * 0.05; // older tracks have a slight penalty unless matching taste

      // Time of Day Mood Booster
      const hour = new Date().getHours();
      let timeMatchModifier = 0;
      if (hour >= 22 || hour < 5) {
        // Late night: prefer low-energy, dark/melancholic ambient/lofi/chillout
        if (track.estimatedEnergy < 0.4) timeMatchModifier += 0.6;
        if (track.estimatedValence < 0.5) timeMatchModifier += 0.3;
      } else if (hour >= 6 && hour < 11) {
        // Morning: prefer upbeat acoustic/positive high-tempo energetic tracks
        if (track.estimatedEnergy > 0.5) timeMatchModifier += 0.4;
        if (track.estimatedValence > 0.6) timeMatchModifier += 0.5;
      }

      // Predict separate behaviors:
      // 1. Probability of Listening (pListen) - based on artist/genre affinity + click draw
      const zListen = (artistAffinity * 1.5) + (genreAffinity * 0.8) + timeMatchModifier + trendBoost - 1.0;
      const pListen = sigmoid(zListen);

      // 2. Probability of Finishing (pFinish) - based on energy/tempo matches + track quality
      const zFinish = 1.5 - (energyDiff * 3.0) - (tempoDiff * 2.0) + (track.qualityScore / 100) - (trackSkips * 1.2);
      const pFinish = sigmoid(zFinish);

      // 3. Probability of Replay (pReplay) - high emotional resonance (strong valence match & top affinities)
      const zReplay = (artistAffinity * 2.0) + (genreAffinity * 1.0) - (valenceDiff * 2.5) - 2.5;
      const pReplay = sigmoid(zReplay);

      // 4. Probability of Like (pLike) - taste match & positive feeling
      const zLike = (artistAffinity * 1.8) + (genreAffinity * 1.2) - (valenceDiff * 1.5) - 2.0;
      const pLike = sigmoid(zLike);

      // 5. Probability of Playlist Add (pPlaylistAdd) - lasting value
      const zPlaylistAdd = (artistAffinity * 1.1) + (genreAffinity * 0.9) - 2.2;
      const pPlaylistAdd = sigmoid(zPlaylistAdd);

      // 6. Probability of Share (pShare) - high popularity + high energy
      const zShare = (track.popularity / 100 * 2.0) + (track.estimatedEnergy * 1.0) - 2.5;
      const pShare = sigmoid(zShare);

      // 7. Probability of Skip (pSkip) - mood mismatch + fatigue + direct previous skip signal
      const zSkip = (energyDiff * 3.5) + (tempoDiff * 3.0) + (trackSkips * 2.0) - (artistAffinity * 1.2) - (genreAffinity * 0.8) + (trackPlays * 0.4) - 0.5;
      const pSkip = sigmoid(zSkip);

      // 8. Probability of Long-Term Satisfaction & Dynamic Unified Score
      // Multi-gated satisfaction model balancing skip penalties and various positive actions
      const pSatisfaction = (
        (pListen * 0.15) +
        (pFinish * 0.25) +
        (pReplay * 0.20) +
        (pLike * 0.15) +
        (pPlaylistAdd * 0.15) +
        (pShare * 0.10)
      ) * (1.0 - (pSkip * 0.75));

      return {
        ...track,
        pListen,
        pFinish,
        pReplay,
        pLike,
        pPlaylistAdd,
        pShare,
        pSkip,
        pSatisfaction
      };
    });
  }

  // ------------------------------------------
  // STAGE 4: DIVERSITY OPTIMIZATION (DPP / MMR)
  // ------------------------------------------
  private static executeStage4Diversity(
    ranked: ReturnType<typeof RecommendationEngine.executeStage3DeepRanking>
  ): ReturnType<typeof RecommendationEngine.executeStage3DeepRanking> {
    // Implement an iterative selection algorithm with dynamic penalty vectors to avoid repetitive clusters
    const selected: typeof ranked = [];
    const remaining = [...ranked].sort((a, b) => b.pSatisfaction - a.pSatisfaction);

    // Limit pool to top 60 to optimize processing time
    const candidatePool = remaining.slice(0, 60);

    const artistCount: Record<string, number> = {};
    const genreCount: Record<string, number> = {};
    let lastTempo = 0;
    let lastEnergy = 0.5;

    while (selected.length < candidatePool.length) {
      let bestItemIdx = -1;
      let highestPenalizedSatisfaction = -Infinity;

      for (let i = 0; i < candidatePool.length; i++) {
        const item = candidatePool[i];
        if (selected.includes(item)) continue;

        // Apply progressive diversity penalties
        let penalty = 0;

        // Artist repetition penalty
        const artCount = artistCount[item.artist] || 0;
        if (artCount > 0) penalty += 0.35 * artCount;

        // Genre repetition penalty
        const genCount = genreCount[item.category || ""] || 0;
        if (genCount > 0) penalty += 0.18 * genCount;

        // Tempo flow similarity penalty (avoids BPM stagnation, promotes dynamic curves)
        if (lastTempo > 0) {
          const tempoDiff = Math.abs(item.estimatedTempo - lastTempo);
          if (tempoDiff < 8) penalty += 0.08; // small penalty if BPM is nearly identical
        }

        // Energy flow penalty
        const energyDiff = Math.abs(item.estimatedEnergy - lastEnergy);
        if (energyDiff < 0.1) penalty += 0.05;

        const dynamicSatisfaction = item.pSatisfaction - penalty;
        if (dynamicSatisfaction > highestPenalizedSatisfaction) {
          highestPenalizedSatisfaction = dynamicSatisfaction;
          bestItemIdx = i;
        }
      }

      if (bestItemIdx === -1) break;

      const chosen = candidatePool[bestItemIdx];
      selected.push(chosen);

      // Record selection attributes
      artistCount[chosen.artist] = (artistCount[chosen.artist] || 0) + 1;
      genreCount[chosen.category || ""] = (genreCount[chosen.category || ""] || 0) + 1;
      lastTempo = chosen.estimatedTempo;
      lastEnergy = chosen.estimatedEnergy;
    }

    return selected;
  }

  // ------------------------------------------
  // STAGE 5: EXPLORATION RATIOS & CLASSIFICATION
  // ------------------------------------------
  private static executeStage5ExplorationRatio(
    diversified: ReturnType<typeof RecommendationEngine.executeStage4Diversity>,
    limit: number
  ): Track[] {
    // Ratio allocations: 65% Familiar, 20% Adjacent, 10% Discovery, 5% Wildcards
    const countFamiliar = Math.max(1, Math.round(limit * 0.65));
    const countAdjacent = Math.max(1, Math.round(limit * 0.20));
    const countDiscovery = Math.max(1, Math.round(limit * 0.10));
    const countWildcard = Math.max(1, limit - countFamiliar - countAdjacent - countDiscovery);

    const bucketFamiliar: Track[] = [];
    const bucketAdjacent: Track[] = [];
    const bucketDiscovery: Track[] = [];
    const bucketWildcard: Track[] = [];

    diversified.forEach(item => {
      const scorePercentage = Math.min(99, Math.max(38, Math.round(item.pSatisfaction * 100)));

      let tag: "Familiar" | "Adjacent" | "Discovery";
      let reason = "";

      // Dynamic rule classification based on behavioral probabilities
      if (item.pListen > 0.6 && item.pSatisfaction > 0.55) {
        tag = "Familiar";
        if (item.pReplay > 0.45) {
          reason = `A favorite pick reflecting your strong love for ${item.artist}`;
        } else if (item.pLike > 0.4) {
          reason = `Tuned precisely to your core ${item.category || "favorite"} style`;
        } else {
          reason = `Aligned beautifully with your daily listening pattern`;
        }
        bucketFamiliar.push({
          ...item,
          confidenceScore: scorePercentage,
          explorationTag: tag,
          recommendationReason: reason
        });
      } else if (item.pListen > 0.35 && item.pSatisfaction > 0.4) {
        tag = "Adjacent";
        reason = `Expands your boundary into similar ${item.category || "music"} textures`;
        bucketAdjacent.push({
          ...item,
          confidenceScore: scorePercentage,
          explorationTag: tag,
          recommendationReason: reason
        });
      } else {
        // High wildcard check
        const isWild = item.pListen < 0.2 && item.pShare > 0.4;
        tag = "Discovery";
        if (isWild) {
          reason = `A serendipitous wild card to spark fresh inspiration`;
          bucketWildcard.push({
            ...item,
            confidenceScore: scorePercentage,
            explorationTag: tag,
            recommendationReason: reason
          });
        } else {
          reason = `Freshly discovered gem based on your late-night rhythm`;
          bucketDiscovery.push({
            ...item,
            confidenceScore: scorePercentage,
            explorationTag: tag,
            recommendationReason: reason
          });
        }
      }
    });

    const finalMerged: Track[] = [];

    // Fulfill targets strictly to avoid bias
    const grab = (source: Track[], targetCount: number) => {
      let added = 0;
      for (let i = 0; i < source.length && added < targetCount; i++) {
        finalMerged.push(source[i]);
        added++;
      }
    };

    grab(bucketFamiliar, countFamiliar);
    grab(bucketAdjacent, countAdjacent);
    grab(bucketDiscovery, countDiscovery);
    grab(bucketWildcard, countWildcard);

    // If we fell short of limit, fill in remaining items from any pool sorted by confidence score
    let fillerIndex = 0;
    const allScored = [
      ...bucketFamiliar,
      ...bucketAdjacent,
      ...bucketDiscovery,
      ...bucketWildcard
    ].sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));

    while (finalMerged.length < limit && fillerIndex < allScored.length) {
      const potential = allScored[fillerIndex];
      if (!finalMerged.some(t => t.id === potential.id)) {
        finalMerged.push(potential);
      }
      fillerIndex++;
    }

    // Sort final selection to make the feed feel ultra-confident yet beautifully paced
    return finalMerged.sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));
  }

  // Raw helper to query iTunes Search API
  private static async fetchFromITunes(
    term: string,
    limit: number,
    offset: number = 0
  ): Promise<Track[]> {
    try {
      let response = await fetch(
        `/api/proxy/itunes/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}&offset=${offset}`
      );
      if (!response.ok) return [];
      let data = await response.json();
      
      // If we exhausted the results due to a high offset, loop back to 0
      if ((!data.results || data.results.length === 0) && offset > 0) {
        response = await fetch(
          `/api/proxy/itunes/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}&offset=0`
        );
        if (!response.ok) return [];
        data = await response.json();
      }

      if (data.results) {
        return data.results
          .map((item: any) => ({
            id: `itunes-${item.trackId}`,
            title: item.trackName || "Acoustic Vibe",
            artist: item.artistName || "Independent Talent",
            url: item.previewUrl,
            duration: 30, // Preview size
            coverUrl: item.artworkUrl100?.replace(/100x100bb(\.[a-z]+)?/i, "1200x1200bb.jpg"),
            isLocal: false,
            category: item.primaryGenreName || "Electronic",
            source: "spotify" as const,
          }))
          .filter((t: any) => t.url);
      }
      return [];
    } catch (e) {
      console.error("ITunes fetch error for term:", term, e);
      return [];
    }
  }

  // Raw helper to query YouTube Core API
  private static async fetchFromYouTube(
    term: string,
    limit: number = 8
  ): Promise<Track[]> {
    try {
      const response = await fetch(`/yt/api/search?q=${encodeURIComponent(term)}`);
      if (!response.ok) return [];
      const data = await response.json();
      if (data.songs && Array.isArray(data.songs)) {
        return data.songs.slice(0, limit).map((s: any) => ({
          id: `yt-${s.videoId}`,
          title: s.title || "Unknown Title",
          artist: s.artist || "YouTube",
          url: `/yt/play/${s.videoId}`,
          duration: s.duration || 210,
          coverUrl: s.thumbnail || "https://images.unsplash.com/photo-1614113489855-66422ad300a4?w=600&q=80",
          isLocal: false,
          category: "YouTube",
          source: "youtube" as const,
        }));
      }
      return [];
    } catch (e) {
      console.error("YouTube search error for term:", term, e);
      return [];
    }
  }
}
