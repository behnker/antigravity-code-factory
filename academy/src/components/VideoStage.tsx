"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Play,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { isAllowedVideoUrl, type VideoConfig } from "@/lib/schemas";
import { formatTimestamp } from "@/lib/prompt-engine";

export interface VideoStageProps {
  video: VideoConfig;
  accentTone?: "cyan" | "violet" | "emerald";
  className?: string;
}

const ACCENT_RING_MAP = {
  cyan: "border-cyan-glow/40 text-cyan-glow bg-cyan-glow/10",
  violet: "border-violet-glow/40 text-violet-glow bg-violet-glow/10",
  emerald: "border-emerald-glow/40 text-emerald-glow bg-emerald-glow/10",
} as const;

export function VideoStage({
  video,
  accentTone = "cyan",
  className = "",
}: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>(
    video.chapters[0]?.id ?? "",
  );
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [attachGuideOpen, setAttachGuideOpen] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);

  const activeChapter =
    video.chapters.find((chapter) => chapter.id === activeChapterId) ??
    video.chapters[0] ??
    null;

  const isComingSoon = video.provider === "coming_soon";
  const hasValidEmbedUrl =
    typeof video.embedUrl === "string" &&
    video.embedUrl.length > 0 &&
    isAllowedVideoUrl(video.embedUrl);
  const isInvalidUrl = !isComingSoon && !hasValidEmbedUrl;

  const handleSelectChapter = (chapterId: string, seconds: number) => {
    setActiveChapterId(chapterId);
    if (video.provider === "mp4" && videoRef.current) {
      videoRef.current.currentTime = seconds;
      void videoRef.current.play().catch(() => {
        // Ignore autoplay restriction when user clicks chapter before interacting with video
      });
    }
  };

  const handleRetry = () => {
    setMediaLoadError(false);
    setRetrySeed((value) => value + 1);
  };

  return (
    <div
      className={`glass-panel-elevated min-w-0 overflow-hidden rounded-2xl p-4 sm:p-6 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium ${ACCENT_RING_MAP[accentTone]}`}
            >
              <Film className="h-3.5 w-3.5" aria-hidden="true" />
              {isComingSoon ? "Studio Slate Ready" : `Video · ${video.provider.toUpperCase()}`}
            </span>
            <span className="glass-pill inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs text-ink-secondary">
              <Clock className="h-3 w-3 text-cyan-glow" aria-hidden="true" />
              {video.durationLabel}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-ink-primary sm:text-xl">
            {video.title}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-glass-border bg-void-950">
            {isInvalidUrl || mediaLoadError ? (
              <div
                role="alert"
                className="flex h-full w-full flex-col items-center justify-center gap-3 bg-rose-glow/10 p-6 text-center"
              >
                <AlertTriangle
                  className="h-8 w-8 text-rose-glow"
                  aria-hidden="true"
                />
                <div className="max-w-md space-y-1">
                  <p className="text-sm font-semibold text-ink-primary">
                    {isInvalidUrl
                      ? "Blocked or Invalid Video URL"
                      : "Video Stream Unavailable"}
                  </p>
                  <p className="text-xs text-ink-secondary">
                    {isInvalidUrl
                      ? "For security, VideoStage only allows local /media/*.mp4|webm files or privacy-safe YouTube, Vimeo, and Loom embed URLs."
                      : "The video asset failed to load. Check the file path or network connection and retry."}
                  </p>
                </div>
                {!isInvalidUrl && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-glow/50 bg-cyan-glow/15 px-3 py-1.5 text-xs font-semibold text-cyan-glow transition-colors hover:bg-cyan-glow/25"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry Media
                  </button>
                )}
              </div>
            ) : isComingSoon ? (
              <div className="cosmic-grid relative flex h-full w-full flex-col justify-between p-5 sm:p-7">
                <div className="flex items-center justify-between gap-2">
                  <span className="glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs text-cyan-glow">
                    <span
                      className="h-2 w-2 animate-pulse-glow rounded-full bg-cyan-glow"
                      aria-hidden="true"
                    />
                    BROADCAST STAGE · 4K READY
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    {video.chapters.length} Chapters Indexed
                  </span>
                </div>

                <div className="my-auto flex flex-col items-center text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-glow/50 bg-cyan-glow/15 shadow-lg sm:h-16 sm:w-16">
                    <Play
                      className="ml-0.5 h-6 w-6 text-cyan-glow sm:h-7 sm:w-7"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="max-w-lg text-sm font-semibold text-ink-primary sm:text-base">
                    {video.posterLabel ?? "Video Module Ready — Attach Your Course Recording"}
                  </p>
                  {activeChapter && (
                    <p className="mt-2 max-w-md text-xs text-ink-secondary sm:text-sm">
                      <span className="font-mono text-cyan-glow">
                        [{formatTimestamp(activeChapter.timestampSeconds)}]
                      </span>{" "}
                      {activeChapter.title}: {activeChapter.summary}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-glass-border pt-3">
                  <span className="text-xs text-ink-muted">
                    Supports local MP4/WebM, YouTube No-Cookie, Vimeo, and Loom
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachGuideOpen((prev) => !prev)}
                    aria-expanded={attachGuideOpen}
                    aria-controls="attach-recording-guide"
                    className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-cyan-glow transition-colors hover:border-cyan-glow/60"
                  >
                    <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                    Attach Your Recording
                  </button>
                </div>
              </div>
            ) : video.provider === "mp4" && hasValidEmbedUrl ? (
              <video
                key={retrySeed}
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                src={video.embedUrl}
                onError={() => setMediaLoadError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <iframe
                key={retrySeed}
                src={video.embedUrl}
                title={video.title}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                onError={() => setMediaLoadError(true)}
              />
            )}
          </div>

          {attachGuideOpen && isComingSoon && (
            <div
              id="attach-recording-guide"
              className="mt-3 rounded-xl border border-cyan-glow/30 bg-void-900/80 p-4 text-xs text-ink-secondary"
            >
              <p className="font-semibold text-ink-primary">
                How to attach a live recording to this course:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  Drop an MP4/WebM file into{" "}
                  <code className="font-mono text-cyan-glow">
                    academy/public/media/&lt;course-slug&gt;.mp4
                  </code>{" "}
                  (or copy a YouTube No-Cookie / Vimeo / Loom embed URL).
                </li>
                <li>
                  Update{" "}
                  <code className="font-mono text-cyan-glow">
                    video.provider
                  </code>{" "}
                  and{" "}
                  <code className="font-mono text-cyan-glow">
                    video.embedUrl
                  </code>{" "}
                  inside{" "}
                  <code className="font-mono text-cyan-glow">
                    academy/content/courses/&lt;slug&gt;/course.json
                  </code>
                  .
                </li>
                <li>
                  Run{" "}
                  <code className="font-mono text-emerald-glow">
                    pnpm run sync:resources
                  </code>{" "}
                  to Zod-validate the URL allowlist and refresh the stage.
                </li>
              </ol>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col rounded-xl border border-glass-border bg-void-900/60 p-3 sm:p-4 lg:col-span-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Chapter Timeline
            </h4>
            <span className="font-mono text-xs text-cyan-glow">
              {video.chapters.length} markers
            </span>
          </div>

          {video.chapters.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-muted">
              No chapters indexed for this recording yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5 overflow-y-auto">
              {video.chapters.map((chapter) => {
                const isActive = activeChapter?.id === chapter.id;
                return (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() =>
                        handleSelectChapter(chapter.id, chapter.timestampSeconds)
                      }
                      aria-current={isActive ? "true" : undefined}
                      className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                        isActive
                          ? "border-cyan-glow/60 bg-cyan-glow/12 text-ink-primary"
                          : "border-transparent bg-glass-subtle text-ink-secondary hover:border-glass-border hover:text-ink-primary"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {chapter.title}
                        </span>
                        <span className="shrink-0 rounded bg-void-950/80 px-1.5 py-0.5 font-mono text-xs text-cyan-glow">
                          {formatTimestamp(chapter.timestampSeconds)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                        {chapter.summary}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {video.transcriptSummary && (
        <div className="mt-4 border-t border-glass-border pt-3">
          <button
            type="button"
            onClick={() => setTranscriptOpen((prev) => !prev)}
            aria-expanded={transcriptOpen}
            aria-controls="video-transcript-drawer"
            className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs font-semibold text-ink-secondary transition-colors hover:bg-glass-subtle hover:text-ink-primary"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-glow" aria-hidden="true" />
              Transcript &amp; Key Session Notes
            </span>
            {transcriptOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {transcriptOpen && (
            <div
              id="video-transcript-drawer"
              className="mt-2 rounded-xl border border-glass-border bg-void-900/70 p-4 text-sm leading-relaxed text-ink-secondary"
            >
              {video.transcriptSummary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
