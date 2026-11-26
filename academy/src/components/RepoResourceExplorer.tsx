"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  FileCode2,
  FilterX,
  FolderGit2,
  Search,
} from "lucide-react";
import type { RepoResource, RepoResourceCategory } from "@/lib/schemas";

export interface RepoResourceExplorerProps {
  resources: RepoResource[];
  syncedAt: string;
  selectedResourcePath?: string | null;
  onSelectResourcePath?: (path: string) => void;
}

type CategoryTab = "all" | RepoResourceCategory;

const CATEGORY_TABS: readonly { id: CategoryTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rule", label: "Rules" },
  { id: "skill", label: "Skills" },
  { id: "agent", label: "Agents" },
  { id: "hook", label: "Hooks" },
  { id: "sidecar", label: "Sidecars" },
  { id: "workflow", label: "Workflows" },
  { id: "memory", label: "Memory" },
  { id: "plan", label: "Plans" },
  { id: "manifest", label: "Manifest" },
];

async function copyRawText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function RepoResourceExplorer({
  resources,
  syncedAt,
  selectedResourcePath = null,
  onSelectResourcePath,
}: RepoResourceExplorerProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(resources[0]?.id ?? "");
  const [copiedFile, setCopiedFile] = useState(false);

  useEffect(() => {
    if (!selectedResourcePath) return;
    const normalized = selectedResourcePath.replace(/^\.\//, "");
    const match = resources.find(
      (res) =>
        res.relativePath === normalized ||
        res.relativePath.endsWith(normalized),
    );
    if (match) {
      setActiveCategory("all");
      setSearchQuery("");
      setSelectedId(match.id);
    }
  }, [selectedResourcePath, resources]);

  const countsByCategory = useMemo(() => {
    const counts: Record<CategoryTab, number> = {
      all: resources.length,
      rule: 0,
      skill: 0,
      agent: 0,
      hook: 0,
      sidecar: 0,
      workflow: 0,
      memory: 0,
      plan: 0,
      manifest: 0,
    };
    for (const res of resources) {
      counts[res.category] += 1;
    }
    return counts;
  }, [resources]);

  const filteredResources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return resources.filter((res) => {
      if (activeCategory !== "all" && res.category !== activeCategory) {
        return false;
      }
      if (!query) return true;
      return (
        res.name.toLowerCase().includes(query) ||
        res.relativePath.toLowerCase().includes(query) ||
        res.summary.toLowerCase().includes(query)
      );
    });
  }, [activeCategory, resources, searchQuery]);

  const activeResource =
    filteredResources.find((res) => res.id === selectedId) ??
    filteredResources[0] ??
    null;

  const handleClearFilters = () => {
    setActiveCategory("all");
    setSearchQuery("");
  };

  const handleCopyFile = async (content: string) => {
    const ok = await copyRawText(content);
    if (ok) {
      setCopiedFile(true);
      window.setTimeout(() => setCopiedFile(false), 2000);
    }
  };

  return (
    <div id="repo-explorer" className="glass-panel-elevated min-w-0 rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-glow">
            <FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />
            Auto-Ingested Repository Artifacts
          </span>
          <h3 className="mt-1 text-xl font-bold text-ink-primary">
            Live Repo Resource Explorer
          </h3>
          <p className="mt-1 text-xs text-ink-secondary">
            Browse every rule, skill, agent persona, Python hook, sidecar,
            workflow pipeline, ADR, and spec file synced directly from this
            repository.
          </p>
        </div>
        <span className="font-mono text-xs text-ink-muted">
          Synced {syncedAt.slice(0, 10)}
        </span>
      </div>

      <div className="mb-4 space-y-3">
        <div>
          <label
            htmlFor="repo-explorer-search"
            className="mb-1.5 block text-xs font-semibold text-ink-secondary"
          >
            Filter Repository Files
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              id="repo-explorer-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search AGENTS.md, hitl-gate.py, cf-plan, ADR..."
              className="w-full rounded-xl border border-glass-border bg-void-950/80 py-2 pr-3 pl-9 text-sm text-ink-primary placeholder:text-ink-muted focus:border-cyan-glow"
            />
          </div>
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter repository resources by category"
        >
          {CATEGORY_TABS.map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCategory(tab.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-cyan-glow bg-cyan-glow/20 text-ink-primary"
                    : "border-glass-border bg-void-900/60 text-ink-secondary hover:border-glass-border-strong hover:text-ink-primary"
                }`}
              >
                {tab.label}{" "}
                <span className="font-mono text-ink-muted">
                  ({countsByCategory[tab.id]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-glass-border bg-void-900/50 p-10 text-center">
          <FilterX className="h-7 w-7 text-ink-muted" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink-primary">
            No matching repository resources
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded-lg border border-cyan-glow/50 bg-cyan-glow/15 px-3.5 py-1.5 text-xs font-semibold text-cyan-glow"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="max-h-96 space-y-1.5 overflow-y-auto rounded-xl border border-glass-border bg-void-900/50 p-2 lg:col-span-5">
            {filteredResources.map((res) => {
              const isSelected = activeResource?.id === res.id;
              return (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(res.id);
                    onSelectResourcePath?.(res.relativePath);
                  }}
                  aria-pressed={isSelected}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-cyan-glow/60 bg-cyan-glow/12 text-ink-primary"
                      : "border-transparent bg-glass-subtle text-ink-secondary hover:border-glass-border hover:text-ink-primary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">
                      {res.name}
                    </span>
                    <span className="shrink-0 rounded bg-void-950/80 px-1.5 py-0.5 font-mono text-xs uppercase text-violet-glow">
                      {res.category}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-ink-muted">
                    {res.relativePath}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-col rounded-xl border border-glass-border bg-void-950/75 p-4 lg:col-span-7">
            {activeResource && (
              <>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-glass-border pb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileCode2
                        className="h-4 w-4 shrink-0 text-cyan-glow"
                        aria-hidden="true"
                      />
                      <h4 className="truncate font-mono text-xs font-semibold text-ink-primary sm:text-sm">
                        {activeResource.relativePath}
                      </h4>
                    </div>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {activeResource.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-void-800 px-2 py-1 font-mono text-xs text-ink-muted">
                      {formatBytes(activeResource.sizeBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyFile(activeResource.content)}
                      className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-cyan-glow hover:border-cyan-glow/60"
                    >
                      {copiedFile ? (
                        <Check
                          className="h-3.5 w-3.5 text-emerald-glow"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {copiedFile ? "Copied File" : "Copy Raw File"}
                    </button>
                  </div>
                </div>

                <pre className="max-h-80 max-w-full flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-glass-border bg-void-950 p-3.5 font-mono text-xs leading-relaxed text-ink-secondary">
                  <code>{activeResource.content}</code>
                </pre>

                <div className="sr-only" role="status" aria-live="polite">
                  {copiedFile
                    ? `Copied ${activeResource.relativePath} to clipboard.`
                    : ""}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
