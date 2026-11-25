"use client";

export type CourseEmblemSize = "xs" | "sm" | "md" | "lg";

export interface CourseVisualTheme {
  borderClass: string;
  activeBorderClass: string;
  topBarClass: string;
  badgeClass: string;
  emblemContainerClass: string;
  iconColorClass: string;
  themeLabel: string;
}

export interface CourseEmblemProps {
  slug: string;
  courseNumber: number;
  size?: CourseEmblemSize;
  className?: string;
}

type CanonicalCourseKey =
  | "zero-to-one-foundations"
  | "harness-mastery"
  | "code-factory-sdlc"
  | "pro-setup-playbook"
  | "lit-software-factory"
  | "notebooklm-antigravity"
  | "enterprise-product-video-studio"
  | "orchestration-showcase";

const COURSE_KEYS_BY_NUMBER: readonly CanonicalCourseKey[] = [
  "zero-to-one-foundations",
  "harness-mastery",
  "code-factory-sdlc",
  "pro-setup-playbook",
  "lit-software-factory",
  "notebooklm-antigravity",
  "enterprise-product-video-studio",
  "orchestration-showcase",
];

const COURSE_THEMES: Record<CanonicalCourseKey, CourseVisualTheme> = {
  "zero-to-one-foundations": {
    borderClass: "border-emerald-glow/35 hover:border-emerald-glow/80",
    activeBorderClass: "border-2 border-emerald-glow",
    topBarClass: "bg-gradient-to-r from-emerald-glow via-cyan-glow/75 to-emerald-glow",
    badgeClass: "border-emerald-glow/45 bg-emerald-glow/15 text-emerald-glow",
    emblemContainerClass: "border-emerald-glow/45 bg-emerald-glow/12",
    iconColorClass: "text-emerald-glow",
    themeLabel: "Foundations · Emerald",
  },
  "harness-mastery": {
    borderClass: "border-cyan-glow/35 hover:border-cyan-glow/80",
    activeBorderClass: "border-2 border-cyan-glow",
    topBarClass: "bg-gradient-to-r from-cyan-glow via-cyan-deep to-cyan-glow",
    badgeClass: "border-cyan-glow/45 bg-cyan-glow/15 text-cyan-glow",
    emblemContainerClass: "border-cyan-glow/45 bg-cyan-glow/12",
    iconColorClass: "text-cyan-glow",
    themeLabel: "Harness Mastery · Cyan",
  },
  "code-factory-sdlc": {
    borderClass: "border-violet-glow/35 hover:border-violet-glow/80",
    activeBorderClass: "border-2 border-violet-glow",
    topBarClass: "bg-gradient-to-r from-violet-glow via-violet-deep to-violet-glow",
    badgeClass: "border-violet-glow/45 bg-violet-glow/15 text-violet-glow",
    emblemContainerClass: "border-violet-glow/45 bg-violet-glow/12",
    iconColorClass: "text-violet-glow",
    themeLabel: "Code Factory SDLC · Violet",
  },
  "pro-setup-playbook": {
    borderClass: "border-emerald-glow/40 hover:border-emerald-glow/85",
    activeBorderClass: "border-2 border-emerald-glow",
    topBarClass: "bg-gradient-to-r from-emerald-glow via-emerald-glow/80 to-cyan-glow/75",
    badgeClass: "border-emerald-glow/50 bg-emerald-glow/15 text-emerald-glow",
    emblemContainerClass: "border-emerald-glow/50 bg-emerald-glow/12",
    iconColorClass: "text-emerald-glow",
    themeLabel: "Pro Setup Playbook · Emerald",
  },
  "lit-software-factory": {
    borderClass: "border-amber-glow/35 hover:border-amber-glow/80",
    activeBorderClass: "border-2 border-amber-glow",
    topBarClass: "bg-gradient-to-r from-amber-glow via-amber-glow/80 to-emerald-glow/70",
    badgeClass: "border-amber-glow/45 bg-amber-glow/15 text-amber-glow",
    emblemContainerClass: "border-amber-glow/45 bg-amber-glow/12",
    iconColorClass: "text-amber-glow",
    themeLabel: "Lit Software Factory · Amber",
  },
  "notebooklm-antigravity": {
    borderClass: "border-violet-glow/40 hover:border-cyan-glow/80",
    activeBorderClass: "border-2 border-violet-glow",
    topBarClass: "bg-gradient-to-r from-violet-glow via-cyan-glow to-violet-glow",
    badgeClass: "border-violet-glow/45 bg-violet-glow/15 text-violet-glow",
    emblemContainerClass:
      "border-violet-glow/45 bg-gradient-to-br from-violet-glow/15 to-cyan-glow/15",
    iconColorClass: "text-violet-glow",
    themeLabel: "NotebookLM Bridge · Violet & Cyan",
  },
  "enterprise-product-video-studio": {
    borderClass: "border-rose-glow/40 hover:border-rose-glow/85",
    activeBorderClass: "border-2 border-rose-glow",
    topBarClass: "bg-gradient-to-r from-rose-glow via-violet-glow to-rose-glow",
    badgeClass: "border-rose-glow/45 bg-rose-glow/15 text-rose-glow",
    emblemContainerClass:
      "border-rose-glow/45 bg-gradient-to-br from-rose-glow/15 to-violet-glow/15",
    iconColorClass: "text-rose-glow",
    themeLabel: "Product Video Studio · Rose & Violet",
  },
  "orchestration-showcase": {
    borderClass: "border-cyan-glow/40 hover:border-amber-glow/85",
    activeBorderClass: "border-2 border-amber-glow",
    topBarClass: "bg-gradient-to-r from-cyan-glow via-amber-glow to-rose-glow",
    badgeClass: "border-amber-glow/45 bg-amber-glow/15 text-amber-glow",
    emblemContainerClass:
      "border-cyan-glow/45 bg-gradient-to-br from-cyan-glow/15 via-amber-glow/12 to-rose-glow/15",
    iconColorClass: "text-cyan-glow",
    themeLabel: "Orchestration Triad · Cyan · Amber · Rose",
  },
};

const SIZE_STYLES: Record<
  CourseEmblemSize,
  { container: string; svg: string }
> = {
  xs: { container: "h-5 w-5 rounded-md p-0.5", svg: "h-4 w-4" },
  sm: { container: "h-8 w-8 rounded-lg p-1", svg: "h-5 w-5" },
  md: { container: "h-11 w-11 rounded-xl p-1.5", svg: "h-7 w-7" },
  lg: { container: "h-14 w-14 rounded-2xl p-2", svg: "h-9 w-9" },
};

function resolveCourseKey(
  slug: string,
  courseNumber: number,
): CanonicalCourseKey {
  if (slug in COURSE_THEMES) {
    return slug as CanonicalCourseKey;
  }
  const normalizedIndex =
    ((Math.floor(courseNumber) % COURSE_KEYS_BY_NUMBER.length) +
      COURSE_KEYS_BY_NUMBER.length) %
    COURSE_KEYS_BY_NUMBER.length;
  return COURSE_KEYS_BY_NUMBER[normalizedIndex];
}

export function getCourseVisualTheme(
  slug: string,
  courseNumber: number,
): CourseVisualTheme {
  return COURSE_THEMES[resolveCourseKey(slug, courseNumber)];
}

function EmblemArtwork({
  courseKey,
  svgClass,
}: {
  courseKey: CanonicalCourseKey;
  svgClass: string;
}) {
  switch (courseKey) {
    case "zero-to-one-foundations":
      // Course 00 (Emerald): Rising 3-step staircase + checkmark spark
      return (
        <svg
          viewBox="0 0 32 32"
          className={svgClass}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 26V21H11V16H18V11H26V26H4Z"
            fill="var(--color-emerald-glow)"
            fillOpacity="0.22"
          />
          <path
            d="M4 26V21H11V16H18V11H26"
            stroke="var(--color-emerald-glow)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="4"
            y1="26"
            x2="27"
            y2="26"
            stroke="var(--color-emerald-glow)"
            strokeOpacity="0.6"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M17.5 6.5L20 9L25.5 3.5"
            stroke="var(--color-ink-primary)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="9" r="1.5" fill="var(--color-emerald-glow)" />
        </svg>
      );

    case "harness-mastery":
      // Course 01 (Cyan): Structured workbench inside a protective 4-corner frame
      return (
        <svg
          viewBox="0 0 32 32"
          className={svgClass}
          fill="none"
          aria-hidden="true"
        >
          {/* 4-corner protective frame */}
          <path
            d="M3.5 9V5.5C3.5 4.4 4.4 3.5 5.5 3.5H9M23 3.5H26.5C27.6 3.5 28.5 4.4 28.5 5.5V9M28.5 23V26.5C28.5 27.6 27.6 28.5 26.5 28.5H23M9 28.5H5.5C4.4 28.5 3.5 27.6 3.5 26.5V23"
            stroke="var(--color-cyan-glow)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Workbench top slab */}
          <rect
            x="7"
            y="14"
            width="18"
            height="4.5"
            rx="1.5"
            fill="var(--color-cyan-glow)"
            fillOpacity="0.28"
            stroke="var(--color-cyan-glow)"
            strokeWidth="1.8"
          />
          {/* Workbench legs + cross brace */}
          <path
            d="M9.5 18.5V24.5M22.5 18.5V24.5M9.5 22H22.5"
            stroke="var(--color-cyan-glow)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Precision gauge/tool modules on top */}
          <rect
            x="9.5"
            y="8.5"
            width="5"
            height="3.5"
            rx="1"
            fill="var(--color-ink-primary)"
            fillOpacity="0.9"
          />
          <path
            d="M17.5 10.25H22.5"
            stroke="var(--color-ink-primary)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "code-factory-sdlc":
      // Course 02 (Violet): Connected modular pipeline track with 4 station nodes + flow arrow
      return (
        <svg
          viewBox="0 0 32 32"
          className={svgClass}
          fill="none"
          aria-hidden="true"
        >
          {/* Pipeline rails */}
          <path
            d="M7 10H23C25.2 10 27 11.8 27 14C27 16.2 25.2 18 23 18H9C6.8 18 5 19.8 5 22C5 24.2 6.8 26 9 26H25"
            stroke="var(--color-violet-glow)"
            strokeOpacity="0.55"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* 4 station nodes */}
          <circle
            cx="8"
            cy="10"
            r="3"
            fill="var(--color-violet-glow)"
            fillOpacity="0.3"
            stroke="var(--color-violet-glow)"
            strokeWidth="1.9"
          />
          <circle
            cx="19"
            cy="10"
            r="3"
            fill="var(--color-violet-glow)"
            fillOpacity="0.3"
            stroke="var(--color-violet-glow)"
            strokeWidth="1.9"
          />
          <circle
            cx="11"
            cy="18"
            r="3"
            fill="var(--color-violet-glow)"
            fillOpacity="0.3"
            stroke="var(--color-violet-glow)"
            strokeWidth="1.9"
          />
          <circle
            cx="18"
            cy="26"
            r="3"
            fill="var(--color-ink-primary)"
            fillOpacity="0.22"
            stroke="var(--color-ink-primary)"
            strokeWidth="1.9"
          />
          {/* Flow arrow at end */}
          <path
            d="M23.5 23L27 26L23.5 29"
            stroke="var(--color-violet-glow)"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "pro-setup-playbook":
      // Course 03 (Emerald): Dual safety toggle switch + crisp shield padlock
      return (
        <svg
          viewBox="0 0 32 32"
          className={svgClass}
          fill="none"
          aria-hidden="true"
        >
          {/* Safety toggle switch bar at top */}
          <rect
            x="4"
            y="4"
            width="13"
            height="6.5"
            rx="3.25"
            fill="var(--color-emerald-glow)"
            fillOpacity="0.22"
            stroke="var(--color-emerald-glow)"
            strokeWidth="1.75"
          />
          <circle cx="13.5" cy="7.25" r="2" fill="var(--color-ink-primary)" />
          {/* Secondary guard pill */}
          <rect
            x="4"
            y="13"
            width="10"
            height="5.5"
            rx="2.75"
            fill="var(--color-cyan-glow)"
            fillOpacity="0.18"
            stroke="var(--color-cyan-glow)"
            strokeWidth="1.5"
          />
          <circle cx="7" cy="15.75" r="1.5" fill="var(--color-cyan-glow)" />
          {/* Crisp shield */}
          <path
            d="M21.5 10L28 12.6V18.4C28 23.1 25.2 26.6 21.5 28.5C17.8 26.6 15 23.1 15 18.4V12.6L21.5 10Z"
            fill="var(--color-emerald-glow)"
            fillOpacity="0.22"
            stroke="var(--color-emerald-glow)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Padlock inside shield */}
          <path
            d="M19.5 18.5V17C19.5 15.9 20.4 15 21.5 15C22.6 15 23.5 15.9 23.5 17V18.5"
            stroke="var(--color-ink-primary)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect
            x="18.5"
            y="18.5"
            width="6"
            height="4.5"
            rx="1.2"
            fill="var(--color-ink-primary)"
          />
        </svg>
      );

    case "lit-software-factory":
      // Course 04 (Amber): Bright verified circular loop enclosing a control gauge dial
      return (
        <svg
          viewBox="0 0 32 32"
          className={svgClass}
          fill="none"
          aria-hidden="true"
        >
          {/* Outer verified circular loop */}
          <path
            d="M27 16C27 22.075 22.075 27 16 27C9.925 27 5 22.075 5 16C5 9.925 9.925 5 16 5C19.6 5 22.8 6.75 24.8 9.4"
            stroke="var(--color-amber-glow)"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M21.5 9.5H25.5V5.5"
            stroke="var(--color-amber-glow)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner control gauge dial */}
          <path
            d="M10.5 19.5C10.5 16.46 12.96 14 16 14C19.04 14 21.5 16.46 21.5 19.5"
            fill="var(--color-amber-glow)"
            fillOpacity="0.22"
            stroke="var(--color-amber-glow)"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          {/* Gauge needle + pivot */}
          <path
            d="M16 19.5L19.6 15.4"
            stroke="var(--color-ink-primary)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="16" cy="19.5" r="2" fill="var(--color-ink-primary)" />
        </svg>
      );

    case "notebooklm-antigravity":
      // Course 05 (Violet/Cyan): Open book bridging via clean arrow beam to builder terminal
      return (
        <svg
          viewBox="0 0 32 32"
          className={svgClass}
          fill="none"
          aria-hidden="true"
        >
          {/* Open book (Violet) */}
          <path
            d="M3.5 10.5C3.5 9.5 4.3 8.8 5.3 9L9 9.8V21.8L4.7 20.9C4 20.7 3.5 20.1 3.5 19.4V10.5Z"
            fill="var(--color-violet-glow)"
            fillOpacity="0.25"
            stroke="var(--color-violet-glow)"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M14.5 10.5C14.5 9.5 13.7 8.8 12.7 9L9 9.8V21.8L13.3 20.9C14 20.7 14.5 20.1 14.5 19.4V10.5Z"
            fill="var(--color-violet-glow)"
            fillOpacity="0.16"
            stroke="var(--color-violet-glow)"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          {/* Arrow beam bridge */}
          <path
            d="M14.5 16H19.5M17.5 13.5L20 16L17.5 18.5"
            stroke="var(--color-ink-primary)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Builder terminal screen (Cyan) */}
          <rect
            x="20"
            y="8.5"
            width="9"
            height="15"
            rx="2"
            fill="var(--color-cyan-glow)"
            fillOpacity="0.2"
            stroke="var(--color-cyan-glow)"
            strokeWidth="1.8"
          />
          <path
            d="M22.5 13.5L24.5 15.5L22.5 17.5"
            stroke="var(--color-cyan-glow)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="25"
            y1="18.5"
            x2="27"
            y2="18.5"
            stroke="var(--color-ink-primary)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );

    case "enterprise-product-video-studio":
      // Course 06 (Rose/Violet): Studio film clapperboard above crisp beat waveform bar
      return (
        <svg
          viewBox="0 0 32 32"
          className={svgClass}
          fill="none"
          aria-hidden="true"
        >
          {/* Clapperboard top slate */}
          <path
            d="M5 9.5L25.5 5.5L26.5 9.8L6 13.8L5 9.5Z"
            fill="var(--color-rose-glow)"
            fillOpacity="0.28"
            stroke="var(--color-rose-glow)"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M10.5 8.5L12.5 12.2M17.5 7.2L19.5 10.9"
            stroke="var(--color-ink-primary)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Clapperboard body */}
          <rect
            x="5.5"
            y="13"
            width="21"
            height="7.5"
            rx="1.5"
            fill="var(--color-rose-glow)"
            fillOpacity="0.16"
            stroke="var(--color-rose-glow)"
            strokeWidth="1.75"
          />
          {/* Crisp beat waveform bars */}
          <path
            d="M6.5 26.5V24.5M11 27.5V23.5M16 28.5V22.5M21 27.5V23.5M25.5 26.5V24.5"
            stroke="var(--color-violet-glow)"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </svg>
      );

    case "orchestration-showcase":
      // Course 07 (Multi-Accent Cyan / Amber / Rose):
      // Parallel formation chevrons (Cyan /swarm) + shared blueprint diamond (Amber /teamwork) + speed burst bolt (Rose /boost)
      return (
        <svg
          viewBox="0 0 32 32"
          className={svgClass}
          fill="none"
          aria-hidden="true"
        >
          {/* Cyan /swarm parallel formation chevrons (top-left) */}
          <path
            d="M4 11L7.5 7.5L11 11M4 15.5L7.5 12L11 15.5"
            stroke="var(--color-cyan-glow)"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Amber /teamwork shared blueprint diamond (center-bottom) */}
          <path
            d="M16 14L22 20L16 26L10 20L16 14Z"
            fill="var(--color-amber-glow)"
            fillOpacity="0.26"
            stroke="var(--color-amber-glow)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="20" r="1.6" fill="var(--color-ink-primary)" />
          {/* Rose /boost speed burst bolt (top-right) */}
          <path
            d="M25.5 4.5L21 11.5H25L22.5 17.5L28 10H24L25.5 4.5Z"
            fill="var(--color-rose-glow)"
            fillOpacity="0.28"
            stroke="var(--color-rose-glow)"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function CourseEmblem({
  slug,
  courseNumber,
  size = "md",
  className = "",
}: CourseEmblemProps) {
  const courseKey = resolveCourseKey(slug, courseNumber);
  const theme = COURSE_THEMES[courseKey];
  const sizeTokens = SIZE_STYLES[size];

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center border ${sizeTokens.container} ${theme.emblemContainerClass} ${theme.iconColorClass} ${className}`}
    >
      <EmblemArtwork courseKey={courseKey} svgClass={sizeTokens.svg} />
    </span>
  );
}
