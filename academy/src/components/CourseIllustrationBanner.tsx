"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, ImageOff, Sparkles } from "lucide-react";
import { isAllowedImageUrl, type CourseIllustration } from "@/lib/schemas";

export interface CourseIllustrationBannerProps {
  courseTitle: string;
  accentTone?: "cyan" | "violet" | "emerald";
  illustration?: CourseIllustration;
  className?: string;
}

const ACCENT_RING_CLASSES: Record<"cyan" | "violet" | "emerald", string> = {
  cyan: "border-cyan-glow/40 text-cyan-glow",
  violet: "border-violet-glow/40 text-violet-glow",
  emerald: "border-emerald-glow/40 text-emerald-glow",
};

const ACCENT_ICON_CLASSES: Record<"cyan" | "violet" | "emerald", string> = {
  cyan: "text-cyan-glow",
  violet: "text-violet-glow",
  emerald: "text-emerald-glow",
};

export function CourseIllustrationBanner({
  courseTitle,
  accentTone = "cyan",
  illustration,
  className = "",
}: CourseIllustrationBannerProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const accentBadgeClass = ACCENT_RING_CLASSES[accentTone];
  const accentIconClass = ACCENT_ICON_CLASSES[accentTone];

  if (!illustration) {
    return (
      <figure
        className={`glass-panel min-w-0 overflow-hidden rounded-2xl p-3 ${className}`}
      >
        <div
          role="status"
          className="cosmic-grid relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-glass-border bg-void-950 p-5 text-center"
        >
          <span
            className={`glass-pill absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold ${accentBadgeClass}`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Visual Analogy
          </span>
          <Sparkles
            className={`h-7 w-7 ${accentIconClass}`}
            aria-hidden="true"
          />
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-semibold text-ink-primary">
              Editorial Illustration Ready for Phase 2
            </p>
            <p className="text-xs leading-relaxed text-ink-secondary">
              Bespoke 16:9 visual metaphor for {courseTitle} will appear here
              once Phase 2 artwork lands.
            </p>
          </div>
        </div>
        <figcaption className="mt-2.5 text-xs text-ink-secondary">
          Editorial Illustration Pending — {courseTitle}
        </figcaption>
      </figure>
    );
  }

  const isUrlAllowed = isAllowedImageUrl(illustration.src);
  const imageFailed = failedSrc === illustration.src;

  if (!isUrlAllowed) {
    return (
      <figure
        className={`glass-panel min-w-0 overflow-hidden rounded-2xl p-3 ${className}`}
      >
        <div
          role="alert"
          className="relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-xl border border-rose-glow/40 bg-void-900/80 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`glass-pill inline-flex max-w-full items-start gap-1.5 rounded-xl border px-2.5 py-1 text-xs leading-snug font-semibold ${accentBadgeClass}`}
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{illustration.visualAnalogy}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-glow/40 bg-rose-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-rose-glow">
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              Blocked Image URL
            </span>
          </div>

          <div className="my-auto space-y-1.5 py-2">
            <p className="text-sm font-semibold text-ink-primary">
              Illustration blocked by local media allowlist
            </p>
            <p className="text-xs leading-relaxed text-ink-secondary">
              {illustration.alt}
            </p>
          </div>
        </div>
        <figcaption className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
          {illustration.caption}
        </figcaption>
      </figure>
    );
  }

  if (imageFailed) {
    return (
      <figure
        className={`glass-panel min-w-0 overflow-hidden rounded-2xl p-3 ${className}`}
      >
        <div
          role="status"
          className="relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-xl border border-glass-border bg-void-900/80 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`glass-pill inline-flex max-w-full items-start gap-1.5 rounded-xl border px-2.5 py-1 text-xs leading-snug font-semibold ${accentBadgeClass}`}
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{illustration.visualAnalogy}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-glow/40 bg-amber-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-glow">
              <ImageOff className="h-3 w-3 shrink-0" aria-hidden="true" />
              Visual Fallback
            </span>
          </div>

          <div className="my-auto space-y-1.5 py-2">
            <p className="text-sm font-semibold text-ink-primary">
              {courseTitle}
            </p>
            <p className="text-xs leading-relaxed text-ink-secondary">
              {illustration.alt}
            </p>
          </div>
        </div>
        <figcaption className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
          {illustration.caption}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure
      className={`glass-panel min-w-0 overflow-hidden rounded-2xl p-3 ${className}`}
    >
      <div className="relative">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-glass-border bg-void-950">
          <Image
            src={illustration.src}
            alt={illustration.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 520px"
            unoptimized={illustration.src.endsWith(".svg")}
            className="object-cover"
            onError={() => setFailedSrc(illustration.src)}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-void-950/90 via-void-950/30 to-transparent"
            aria-hidden="true"
          />
        </div>
        <div className="mt-2.5 flex items-start sm:absolute sm:top-3 sm:right-3 sm:left-3 sm:mt-0">
          <span
            className={`glass-pill inline-flex max-w-full items-start gap-1.5 rounded-xl border px-3 py-1.5 text-xs leading-snug font-semibold ${accentBadgeClass}`}
          >
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="text-ink-primary">
              Visual Analogy: {illustration.visualAnalogy}
            </span>
          </span>
        </div>
      </div>
      <figcaption className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
        {illustration.caption}
      </figcaption>
    </figure>
  );
}
