"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Headphones,
  Pause,
  Play,
  Square,
  VolumeX,
} from "lucide-react";
import { isAllowedAudioUrl } from "@/lib/schemas";

export interface AudioExplainerBarProps {
  stepId: string;
  stepTitle: string;
  audioScript: string;
  audioUrl?: string;
  estimatedMinutes?: number;
}

type PlaybackStatus = "idle" | "playing" | "paused" | "error";

const PLAYBACK_SPEEDS = [0.9, 1.0, 1.25] as const;
type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

function formatSpeed(speed: PlaybackSpeed): string {
  return speed === 1 ? "1.0x" : `${speed}x`;
}

function estimateSpokenSeconds(script: string): number {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 30;
  const rawSeconds = Math.round((words / 150) * 60);
  return Math.max(15, Math.min(120, rawSeconds));
}

function hasSpeechSynthesisSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.speechSynthesis?.speak === "function" &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function AudioExplainerBar({
  stepId,
  stepTitle,
  audioScript,
  audioUrl,
}: AudioExplainerBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakingSessionRef = useRef(false);
  const intentionalCancelRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [mounted, setMounted] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [failedAudioUrl, setFailedAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [stoppedExplicitly, setStoppedExplicitly] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1.0);
  const [scriptOpen, setScriptOpen] = useState(false);

  const estimatedSeconds = useMemo(
    () => estimateSpokenSeconds(audioScript),
    [audioScript],
  );

  const hasValidAudioUrl = Boolean(audioUrl && isAllowedAudioUrl(audioUrl));
  const audioFailed = Boolean(audioUrl && failedAudioUrl === audioUrl);
  const useHtmlAudio = hasValidAudioUrl && !audioFailed;
  const canPlay = useHtmlAudio || (mounted && speechSupported);

  useEffect(() => {
    setMounted(true);
    setSpeechSupported(hasSpeechSynthesisSupport());
  }, []);

  const cancelActiveSpeech = useCallback(() => {
    if (
      speakingSessionRef.current &&
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.speechSynthesis?.cancel === "function"
    ) {
      intentionalCancelRef.current = true;
      window.speechSynthesis.cancel();
      speakingSessionRef.current = false;
      utteranceRef.current = null;
    }
  }, []);

  useEffect(() => {
    const audioEl = audioRef.current;
    return () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
      cancelActiveSpeech();
    };
  }, [stepId, audioScript, cancelActiveSpeech]);

  const startSpeechPlayback = useCallback(
    (playbackRate: PlaybackSpeed) => {
      if (!hasSpeechSynthesisSupport()) {
        setStatus("error");
        return;
      }

      if (typeof window.speechSynthesis.cancel === "function") {
        utteranceRef.current = null;
        intentionalCancelRef.current = true;
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(audioScript);
      utterance.rate = playbackRate;
      utterance.lang = "en-US";

      utterance.onstart = () => {
        if (utteranceRef.current !== utterance) return;
        intentionalCancelRef.current = false;
        setStatus("playing");
      };

      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return;
        speakingSessionRef.current = false;
        utteranceRef.current = null;
        setStoppedExplicitly(false);
        setStatus("idle");
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (utteranceRef.current !== utterance) return;
        const errorType = event?.error;
        speakingSessionRef.current = false;
        utteranceRef.current = null;
        if (
          errorType === "canceled" ||
          errorType === "interrupted" ||
          intentionalCancelRef.current
        ) {
          intentionalCancelRef.current = false;
          setStatus("idle");
          return;
        }
        setStatus("error");
      };

      utteranceRef.current = utterance;
      speakingSessionRef.current = true;
      intentionalCancelRef.current = false;
      setStoppedExplicitly(false);
      setStatus("playing");
      window.speechSynthesis.speak(utterance);
    },
    [audioScript],
  );

  const handlePlayPause = async () => {
    if (!canPlay) return;

    if (useHtmlAudio && audioRef.current) {
      const audioEl = audioRef.current;
      if (status === "playing") {
        audioEl.pause();
        setStatus("paused");
        return;
      }

      try {
        audioEl.playbackRate = speed;
        setStoppedExplicitly(false);
        await audioEl.play();
        setStatus("playing");
      } catch {
        if (audioUrl) {
          setFailedAudioUrl(audioUrl);
        }
        if (hasSpeechSynthesisSupport()) {
          startSpeechPlayback(speed);
        } else {
          setStatus("error");
        }
      }
      return;
    }

    if (!speechSupported) return;

    if (status === "playing") {
      if (typeof window.speechSynthesis.pause === "function") {
        window.speechSynthesis.pause();
        setStatus("paused");
      } else {
        cancelActiveSpeech();
        setStoppedExplicitly(true);
        setStatus("idle");
      }
      return;
    }

    if (status === "paused") {
      if (
        typeof window.speechSynthesis.resume === "function" &&
        window.speechSynthesis.paused
      ) {
        window.speechSynthesis.resume();
        setStatus("playing");
      } else {
        startSpeechPlayback(speed);
      }
      return;
    }

    startSpeechPlayback(speed);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    cancelActiveSpeech();
    setStoppedExplicitly(true);
    setStatus("idle");
  };

  const handleSelectSpeed = (nextSpeed: PlaybackSpeed) => {
    setSpeed(nextSpeed);

    if (useHtmlAudio && audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
      return;
    }

    if (status === "playing" && speechSupported) {
      startSpeechPlayback(nextSpeed);
    } else if (status === "paused" && speechSupported) {
      cancelActiveSpeech();
      setStoppedExplicitly(false);
      setStatus("idle");
    }
  };

  const handleAudioElementError = () => {
    if (audioUrl) {
      setFailedAudioUrl(audioUrl);
    }
    if (status === "playing") {
      if (hasSpeechSynthesisSupport()) {
        startSpeechPlayback(speed);
      } else {
        setStatus("error");
      }
    }
  };

  const statusText = useMemo(() => {
    if (status === "playing") {
      return `Playing at ${formatSpeed(speed)}`;
    }
    if (status === "paused") {
      return "Paused";
    }
    if (status === "error") {
      return "Playback unavailable — read the script below";
    }
    if (stoppedExplicitly) {
      return "Stopped";
    }
    return `Ready · ~${estimatedSeconds}s`;
  }, [estimatedSeconds, speed, status, stoppedExplicitly]);

  const scriptRegionId = `audio-script-${stepId}`;
  const isPlayDisabled = !mounted || !canPlay;
  const isStopDisabled = status !== "playing" && status !== "paused";

  return (
    <div className="rounded-xl border border-glass-border bg-void-950/75 p-3.5 sm:p-4">
      {useHtmlAudio && audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="none"
          onEnded={() => {
            setStoppedExplicitly(false);
            setStatus("idle");
          }}
          onError={handleAudioElementError}
          className="hidden"
        />
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPlayDisabled}
            onClick={() => void handlePlayPause()}
            aria-label={
              status === "playing"
                ? `Pause audio explainer for ${stepTitle}`
                : `Play audio explainer for ${stepTitle}`
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-deep px-3.5 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-cyan-glow hover:text-void-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "playing" ? (
              <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{status === "playing" ? "Pause Audio" : "Listen (ELI5)"}</span>
          </button>

          <button
            type="button"
            disabled={isStopDisabled}
            onClick={handleStop}
            aria-label={`Stop audio explainer for ${stepTitle}`}
            className="glass-pill inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink-primary transition-colors hover:border-glass-border-strong disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Square className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Stop</span>
          </button>

          <div
            role="group"
            aria-label="Playback speed"
            className="inline-flex items-center rounded-xl border border-glass-border bg-void-900/80 p-0.5"
          >
            {PLAYBACK_SPEEDS.map((option) => {
              const active = speed === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSelectSpeed(option)}
                  className={`rounded-lg px-2 py-1 font-mono text-xs font-semibold transition-colors ${
                    active
                      ? "bg-cyan-deep text-ink-primary"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  {formatSpeed(option)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
          <span
            aria-live="polite"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-secondary"
          >
            <Headphones
              className="h-3.5 w-3.5 shrink-0 text-cyan-glow"
              aria-hidden="true"
            />
            <span>{statusText}</span>
          </span>

          <button
            type="button"
            onClick={() => setScriptOpen((prev) => !prev)}
            aria-expanded={scriptOpen}
            aria-controls={scriptRegionId}
            className="glass-pill inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-cyan-glow transition-colors hover:border-cyan-glow/60"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{scriptOpen ? "Hide Script" : "Read Script"}</span>
            {scriptOpen ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      {mounted && !canPlay && (
        <p
          role="status"
          className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber-glow/30 bg-amber-glow/10 px-3 py-2 text-xs text-amber-glow"
        >
          <VolumeX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Voice playback unavailable on this browser — read the script below.
          </span>
        </p>
      )}

      {scriptOpen && (
        <div
          id={scriptRegionId}
          className="mt-3 rounded-xl border border-glass-border bg-void-900/80 p-3.5"
        >
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-glow">
            Spoken Explainer Script
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-primary sm:text-sm">
            {audioScript}
          </p>
        </div>
      )}
    </div>
  );
}
