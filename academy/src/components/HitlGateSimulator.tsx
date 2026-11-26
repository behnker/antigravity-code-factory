"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import {
  HitlSimulateResponseSchema,
  type HitlDecision,
  type HitlSimulateResponse,
} from "@/lib/schemas";

const PRESET_COMMANDS = [
  "git push origin main",
  "git -C repo push",
  "rm -rf ./dist",
  "npx wrangler deploy --dry-run",
  "npx wrangler deploy",
  "npm test && npx tsc --noEmit",
  "npx supabase db push",
  "git status",
  "curl -s https://example.com",
] as const;

function VerdictBadge({ decision }: { decision: HitlDecision }) {
  if (decision === "allow") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-glow/50 bg-emerald-glow/15 px-3 py-1 font-mono text-xs font-bold uppercase text-emerald-glow">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        allow
      </span>
    );
  }
  if (decision === "ask") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-glow/50 bg-cyan-glow/15 px-3 py-1 font-mono text-xs font-bold uppercase text-cyan-glow">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        ask
      </span>
    );
  }
  if (decision === "force_ask") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-glow/50 bg-amber-glow/15 px-3 py-1 font-mono text-xs font-bold uppercase text-amber-glow">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        force_ask
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-glow/50 bg-rose-glow/15 px-3 py-1 font-mono text-xs font-bold uppercase text-rose-glow">
      <ShieldBan className="h-3.5 w-3.5" aria-hidden="true" />
      deny
    </span>
  );
}

function buildPreToolUseContract(result: HitlSimulateResponse): {
  decision: HitlDecision;
  reason?: string;
  overwrite?: { CommandLine: string };
} {
  if (result.decision === "allow") {
    return result.overwrite
      ? { decision: "allow", overwrite: result.overwrite }
      : { decision: "allow" };
  }
  return {
    decision: result.decision,
    reason: result.reason,
  };
}

async function copyJsonText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function HitlGateSimulator() {
  const [commandLine, setCommandLine] = useState<string>("git push origin main");
  const [evaluatedCommand, setEvaluatedCommand] = useState<string>("");
  const [bypassSandbox, setBypassSandbox] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<HitlSimulateResponse | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  const runSimulation = async (cmd: string, bypass: boolean) => {
    const trimmed = cmd.trim();
    if (!trimmed) {
      setErrorMessage("Please enter a shell command to evaluate.");
      setResult(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch("/api/hitl/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          commandLine: trimmed,
          bypassSandbox: bypass,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const apiError =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          payload.error &&
          typeof payload.error === "object" &&
          "message" in payload.error &&
          typeof payload.error.message === "string"
            ? payload.error.message
            : `Evaluator returned HTTP ${response.status}.`;
        setErrorMessage(apiError);
        setResult(null);
        return;
      }

      const parsed = HitlSimulateResponseSchema.safeParse(payload);
      if (!parsed.success) {
        setErrorMessage("Unexpected response contract from HITL evaluator.");
        setResult(null);
        return;
      }

      setEvaluatedCommand(trimmed);
      setResult(parsed.data);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMessage("Evaluation request timed out after 5 seconds. Please retry.");
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Network error reaching /api/hitl/simulate.",
        );
      }
      setResult(null);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runSimulation(commandLine, bypassSandbox);
  };

  const handlePresetClick = (preset: string) => {
    setCommandLine(preset);
    void runSimulation(preset, bypassSandbox);
  };

  const hookJsonString = result
    ? JSON.stringify(buildPreToolUseContract(result), null, 2)
    : "";

  return (
    <div
      id="hitl-simulator"
      className="glass-panel-elevated min-w-0 rounded-2xl p-5 sm:p-6"
    >
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-amber-glow">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Deterministic PreToolUse Safety Hook Lab
        </span>
        <h3 className="mt-1 text-xl font-bold text-ink-primary">
          Interactive HITL Gate Simulator
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
          Test any shell command against the live{" "}
          <code className="font-mono text-cyan-glow">POST /api/hitl/simulate</code>{" "}
          evaluator (pure regex port of{" "}
          <code className="font-mono text-cyan-glow">hooks/hitl-gate.py</code> —
          zero shell execution).
        </p>
      </div>

      <div className="mb-4">
        <p className="mb-2 font-mono text-xs text-ink-muted">
          Quick-Test Presets
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COMMANDS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className="glass-pill rounded-lg px-2.5 py-1.5 font-mono text-xs text-ink-secondary transition-colors hover:border-cyan-glow/60 hover:text-cyan-glow"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
          <label
            htmlFor="hitl-cmd"
            className="mb-1.5 block text-xs font-semibold text-ink-secondary"
          >
            Shell Command Line
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Terminal
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-cyan-glow"
                aria-hidden="true"
              />
              <input
                id="hitl-cmd"
                type="text"
                value={commandLine}
                onChange={(e) => {
                  setCommandLine(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. git push origin main"
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? "hitl-cmd-error" : undefined}
                className="w-full rounded-xl border border-glass-border bg-void-950/90 py-2.5 pr-3 pl-9 font-mono text-xs text-ink-primary placeholder:text-ink-muted focus:border-cyan-glow sm:text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-deep px-5 py-2.5 text-xs font-semibold text-ink-primary transition-colors hover:bg-cyan-glow hover:text-void-950 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {loading ? "Evaluating..." : "Evaluate Command"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="hitl-bypass"
            type="checkbox"
            checked={bypassSandbox}
            onChange={(e) => setBypassSandbox(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-glass-border bg-void-950 accent-amber-glow"
          />
          <label
            htmlFor="hitl-bypass"
            className="cursor-pointer text-xs text-ink-secondary"
          >
            Simulate <code className="font-mono text-amber-glow">BypassSandbox: true</code>{" "}
            (forces approval gate even on benign commands)
          </label>
        </div>

        {errorMessage && (
          <div
            id="hitl-cmd-error"
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-glow/40 bg-rose-glow/10 p-3 text-xs text-rose-glow"
          >
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMessage}
            </span>
            <button
              type="button"
              onClick={() => void runSimulation(commandLine, bypassSandbox)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-glow/40 px-2.5 py-1 font-semibold text-ink-primary hover:bg-rose-glow/20"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}
      </form>

      {result && (
        <div
          className="mt-5 space-y-4 border-t border-glass-border pt-5"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-glass-border bg-void-900/70 p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <VerdictBadge decision={result.decision} />
                {result.matchedRule && (
                  <span className="rounded-full border border-glass-border bg-void-950 px-2.5 py-0.5 font-mono text-xs text-ink-secondary">
                    Rule: {result.matchedRule}
                  </span>
                )}
                {result.dryRunExempt && (
                  <span className="rounded-full border border-emerald-glow/40 bg-emerald-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-glow">
                    --dry-run Exempt
                  </span>
                )}
                {result.overwrite && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-glow/40 bg-emerald-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-glow">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    overwrite applied
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-ink-primary sm:text-sm">
                {result.reason}
              </p>
            </div>
          </div>

          {result.overwrite && (
            <div
              role="status"
              aria-label="PreToolUse command overwrite diff"
              className="rounded-xl border border-emerald-glow/40 bg-void-950/90 p-3.5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-emerald-glow">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Transparent PreToolUse Overwrite
                </span>
                <span className="font-mono text-xs text-cyan-glow">
                  overwrite.CommandLine
                </span>
              </div>
              <div className="space-y-1.5 font-mono text-xs">
                {evaluatedCommand && (
                  <div className="flex items-start gap-2 text-ink-secondary">
                    <span
                      className="shrink-0 select-none font-bold text-ink-muted"
                      aria-label="Original command"
                    >
                      -
                    </span>
                    <code className="break-all">{evaluatedCommand}</code>
                  </div>
                )}
                <div className="flex items-start gap-2 text-ink-primary">
                  <span
                    className="shrink-0 select-none font-bold text-emerald-glow"
                    aria-label="Rewritten command"
                  >
                    +
                  </span>
                  <code className="break-all text-emerald-glow">
                    {result.overwrite.CommandLine}
                  </code>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="min-w-0 rounded-xl border border-glass-border bg-void-900/50 p-4 lg:col-span-7">
              <h4 className="mb-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Segment-by-Segment Audit ({result.segments.length})
              </h4>
              <ul className="space-y-2">
                {result.segments.map((seg, idx) => (
                  <li
                    key={`${seg.segment}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-glass-border bg-void-950/80 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <code className="block truncate font-mono text-xs text-ink-primary">
                        {seg.segment}
                      </code>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-xs text-ink-muted">
                        <span>
                          {seg.matchedRule
                            ? `Matched: ${seg.matchedRule}`
                            : "No destructive pattern matched"}
                        </span>
                        {seg.isDryRun && (
                          <span className="text-emerald-glow">· dry-run</span>
                        )}
                      </div>
                    </div>
                    <VerdictBadge decision={seg.decision} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0 rounded-xl border border-glass-border bg-void-950/90 p-4 lg:col-span-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-glow">
                  PreToolUse Hook JSON
                </h4>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyJsonText(hookJsonString);
                    if (ok) {
                      setCopiedJson(true);
                      window.setTimeout(() => setCopiedJson(false), 1800);
                    }
                  }}
                  className="glass-pill inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-secondary hover:text-ink-primary"
                >
                  {copiedJson ? (
                    <Check
                      className="h-3 w-3 text-emerald-glow"
                      aria-hidden="true"
                    />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  {copiedJson ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="max-w-full overflow-x-auto font-mono text-xs leading-relaxed text-ink-secondary">
                <code>{hookJsonString}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
