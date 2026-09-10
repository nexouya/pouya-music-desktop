import React from "react";

interface IconProps {
  className?: string;
  isActive?: boolean;
}

/**
 * Liked Songs Icon - Hand-drawn contour signature
 */
export const LikedSongsIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]", isActive }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill={isActive ? "currentColor" : "none"}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      strokeWidth={1.55}
      d="M12 19.2c-1.2-.8-7.7-4.65-7.7-9.55 0-2.55 1.85-4.55 4.25-4.55 1.55 0 2.8.82 3.45 2.03.65-1.21 1.9-2.03 3.45-2.03 2.4 0 4.25 2 4.25 4.55 0 4.9-6.5 8.75-7.7 9.55Z"
    />
    <path
      strokeWidth={1.55}
      d="M8.05 8.95c.35-.75.95-1.15 1.68-1.27"
    />
  </svg>
);

/**
 * Downloads Icon - Folded card + downward glyph
 */
export const DownloadsIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      strokeWidth={1.55}
      d="M5.1 4.55h8.2L18.8 10v8.75a1.75 1.75 0 0 1-1.75 1.75H5.1a1.75 1.75 0 0 1-1.75-1.75V6.3A1.75 1.75 0 0 1 5.1 4.55Z"
    />
    <path strokeWidth={1.55} d="M13.25 4.8v5.15h4.95" />
    <path strokeWidth={1.55} d="M10 11.35v6" />
    <path strokeWidth={1.55} d="m7.55 15 2.45 2.45L12.45 15" />
  </svg>
);

/**
 * Smart Assistant Icon - Waveform + headphones signature
 */
export const SmartAssistantIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path strokeWidth={1.55} d="M4.35 13.1v-1.05a7.65 7.65 0 0 1 15.3 0v1.05" />
    <path strokeWidth={1.55} d="M5.05 12.2a1.55 1.55 0 0 0 0 3.1h1.2v-4.05h-1.2a1.55 1.55 0 0 0 0 .95Z" />
    <path strokeWidth={1.55} d="M18.95 12.2a1.55 1.55 0 0 1 0 3.1h-1.2v-4.05h1.2a1.55 1.55 0 0 1 0 .95Z" />
    <path strokeWidth={1.25} className="animate-pulse" d="M8.8 9.65v4.7m2.05-6.05v7.4m2.05-4.95v2.5m2.05-4.1v5.7" />
    <circle cx="9" cy="16.65" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Daily Mixes Icon - Record grooves + crossing mix lanes
 */
export const DailyMixesIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle strokeWidth={1.35} cx="12" cy="12" r="7.4" />
    <circle strokeWidth={1.35} cx="12" cy="12" r="4.45" />
    <circle strokeWidth={1.35} cx="12" cy="12" r="1.35" />
    <path strokeWidth={1.45} d="M4.55 7.1h5.25M14.25 7.1h5.2" />
    <path strokeWidth={1.45} d="M4.55 16.9h7.05M16.1 16.9h3.35" />
    <path strokeWidth={1.45} d="m10.15 7.1 3.7 9.8" />
  </svg>
);

/**
 * Equalizer & Mix Icon - Physical hardware console
 */
export const EqualizerMixIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path strokeWidth={1.2} d="M4.2 7h15.6M4.2 12h15.6M4.2 17h15.6" />
    <path strokeWidth={1.25} d="M8 5.25v3.5M15.5 10.25v3.5M11.35 15.25v3.5" />
    <circle cx="8" cy="7" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="11.35" cy="17" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Audio Quality Icon - Speaker acoustic + stereo field
 */
export const AudioQualityIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path strokeWidth={1.55} d="M4.25 10.05h3.25l3.65-3.1v10.1l-3.65-3.1H4.25Z" />
    <path strokeWidth={1.45} d="M14.15 9.15c.95.9.95 4.8 0 5.7" />
    <path strokeWidth={1.45} d="M16.8 7.05c1.9 1.9 1.9 8 0 9.9" />
    <path strokeWidth={1.2} opacity={0.68} d="M19.35 5.15c1.55 2 1.55 11.7 0 13.7" />
  </svg>
);

/**
 * Home Icon - Clean architectural console
 */
export const HomeIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path strokeWidth={1.55} d="m3.75 10.5 8.25-6.75 8.25 6.75v8.7a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path strokeWidth={1.45} d="M9.75 20.7v-6h4.5v6" />
  </svg>
);

/**
 * Search Icon - Optical circular lens with 45° handle
 */
export const SearchIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle strokeWidth={1.55} cx="11" cy="11" r="6.75" />
    <path strokeWidth={1.6} d="m16 16 4.5 4.5" />
  </svg>
);

/**
 * Explore Icon - Compass needle & geometric dial
 */
export const ExploreIcon: React.FC<IconProps> = ({ className = "w-[21px] h-[21px]" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} overflow-visible`}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle strokeWidth={1.45} cx="12" cy="12" r="8.75" />
    <polygon strokeWidth={1.35} points="15.75,8.25 13.5,13.5 8.25,15.75 10.5,10.5" />
  </svg>
);
