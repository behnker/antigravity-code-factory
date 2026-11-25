"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Code2, RefreshCw } from "lucide-react";

export interface MermaidDiagramProps {
  chart: string;
  title?: string;
  caption?: string;
  className?: string;
}

type RenderState = "loading" | "ready" | "error";

function readCssToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function sanitizeSvgTree(svgElement: Element): void {
  const disallowed = svgElement.querySelectorAll("script, iframe, object, embed");
  disallowed.forEach((node) => node.remove());

  const allNodes = [svgElement, ...Array.from(svgElement.querySelectorAll("*"))];
  for (const node of allNodes) {
    const attrs = Array.from(node.attributes);
    for (const attr of attrs) {
      const lower = attr.name.toLowerCase();
      if (lower.startsWith("on") || attr.value.trim().toLowerCase().startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    }
  }
}

export function MermaidDiagram({
  chart,
  title = "Architecture Diagram",
  caption,
  className = "",
}: MermaidDiagramProps) {
  const reactId = useId();
  const safeDomId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<RenderState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRawSource, setShowRawSource] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const renderDiagram = useCallback(async (isCancelled: () => boolean) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const mermaidModule = await import("mermaid");
      if (isCancelled()) return;
      const mermaid = mermaidModule.default;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        htmlLabels: false,
        flowchart: {
          htmlLabels: false,
        },
        theme: "dark",
        fontFamily: "var(--font-sans)",
        themeVariables: {
          darkMode: true,
          background: readCssToken("--color-void-900", "transparent"),
          primaryColor: readCssToken("--color-void-800", "transparent"),
          primaryTextColor: readCssToken("--color-ink-primary", "currentColor"),
          primaryBorderColor: readCssToken("--color-cyan-glow", "currentColor"),
          lineColor: readCssToken("--color-violet-glow", "currentColor"),
          secondaryColor: readCssToken("--color-void-850", "transparent"),
          tertiaryColor: readCssToken("--color-void-900", "transparent"),
        },
      });

      const { svg } = await mermaid.render(`${safeDomId}-${retryCount}`, chart);
      if (isCancelled()) return;
      const parser = new DOMParser();
      const parsed = parser.parseFromString(svg, "image/svg+xml");
      const svgEl = parsed.querySelector("svg");

      if (!svgEl || parsed.querySelector("parsererror")) {
        throw new Error("Rendered diagram could not be parsed as valid SVG.");
      }

      sanitizeSvgTree(svgEl);
      svgEl.setAttribute("class", "mx-auto h-auto max-w-full");
      svgEl.setAttribute("role", "img");
      svgEl.setAttribute("aria-label", title);

      if (containerRef.current) {
        containerRef.current.replaceChildren(document.importNode(svgEl, true));
      }

      setStatus("ready");
    } catch (err: unknown) {
      if (isCancelled()) return;
      const message =
        err instanceof Error ? err.message : "Failed to render Mermaid diagram.";
      setErrorMessage(message);
      setStatus("error");
    }
  }, [chart, retryCount, safeDomId, title]);

  useEffect(() => {
    let active = true;
    void renderDiagram(() => !active);
    return () => {
      active = false;
    };
  }, [renderDiagram]);

  return (
    <figure
      className={`glass-panel min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-glass-border pb-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-ink-primary">
            {title}
          </h4>
          <p className="font-mono text-xs text-ink-muted">
            Mermaid Strict Renderer
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRawSource((prev) => !prev)}
          aria-expanded={showRawSource}
          className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-glass-border-strong hover:text-ink-primary"
        >
          <Code2 className="h-3.5 w-3.5 text-cyan-glow" aria-hidden="true" />
          {showRawSource ? "Hide Source" : "Show Raw Source"}
        </button>
      </div>

      {status === "loading" && (
        <div
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-glass-border bg-void-900/60 p-6"
          role="status"
          aria-live="polite"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-glow border-t-transparent" />
          <p className="font-mono text-xs text-ink-muted">
            Synthesizing architecture graph...
          </p>
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-rose-glow/40 bg-rose-glow/10 p-6 text-center"
        >
          <AlertTriangle
            className="h-6 w-6 text-rose-glow"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-primary">
              Diagram failed to render
            </p>
            <p className="text-xs text-ink-secondary">
              {errorMessage ?? "An unexpected Mermaid rendering error occurred."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-glow/50 bg-cyan-glow/15 px-3 py-1.5 text-xs font-semibold text-cyan-glow transition-colors hover:bg-cyan-glow/25"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry Render
            </button>
            <button
              type="button"
              onClick={() => setShowRawSource(true)}
              className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-primary"
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              View Raw Source
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`min-h-64 w-full overflow-x-auto rounded-xl border border-glass-border bg-void-900/50 p-4 ${
          status === "ready" ? "block" : "hidden"
        }`}
      />

      {showRawSource && (
        <pre className="mt-3 max-w-full overflow-x-auto rounded-xl border border-glass-border bg-void-950/80 p-3 font-mono text-xs leading-relaxed text-ink-secondary">
          <code>{chart}</code>
        </pre>
      )}

      {caption && (
        <figcaption className="mt-3 text-xs text-ink-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
