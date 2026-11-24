import type {
  HitlDecision,
  HitlSegmentResult,
  HitlSimulateResponse,
} from "./schemas";

interface HighImpactRule {
  readonly label: string;
  readonly pattern: RegExp;
}

/**
 * Pure TypeScript port of `hooks/hitl-gate.py` HIGH_IMPACT_PATTERNS.
 * Evaluates shell command strings deterministically with zero shell execution.
 */
export const HIGH_IMPACT_PATTERNS: readonly HighImpactRule[] = [
  {
    label: "git push",
    pattern:
      /(?:^|[\s;&|()])git\s+(?:(?:-[cC]\s+\S+|--git-dir(?:=|\s+)\S+|--work-tree(?:=|\s+)\S+|-[^\s]+)\s+)*push(?:\s|$)/i,
  },
  {
    label: "npm/yarn/pnpm publish",
    pattern: /(?:^|[\s;&|()])(?:npm|yarn|pnpm)\s+publish(?:\s|$)/i,
  },
  {
    label: "rm -rf",
    pattern:
      /(?:^|[\s;&|()])rm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive\s+--force|--force\s+--recursive)(?:\s|$)/,
  },
  {
    label: "docker/podman push",
    pattern: /(?:^|[\s;&|()])(?:docker|podman)\s+push(?:\s|$)/i,
  },
  {
    label: "kubectl apply/delete",
    pattern: /(?:^|[\s;&|()])kubectl\s+(?:apply|delete|replace|patch)(?:\s|$)/i,
  },
  {
    label: "cloudflare deploy/delete",
    pattern:
      /(?:^|[\s;&|()])(?:(?:npx\s+)?wrangler\s+(?:deploy|publish|delete|d1\s+migrations\s+apply)|cf\s+deploy)(?:\s|$)/i,
  },
  {
    label: "vercel production deploy/delete",
    pattern:
      /(?:^|[\s;&|()])(?:npx\s+)?vercel\s+(?:(?:deploy\s+)?(?:[^\n;&|]*\s)?--prod\b|(?:rm|remove)\b|env\s+rm\b)/i,
  },
  {
    label: "supabase deploy/db mutation",
    pattern:
      /(?:^|[\s;&|()])(?:npx\s+)?supabase\s+(?:db\s+(?:push|reset)|functions\s+deploy|migration\s+up)(?:\s|$)/i,
  },
  {
    label: "terraform apply/destroy",
    pattern: /(?:^|[\s;&|()])terraform\s+(?:apply|destroy)(?:\s|$)/i,
  },
  {
    label: "github repo delete",
    pattern: /(?:^|[\s;&|()])gh\s+repo\s+delete(?:\s|$)/i,
  },
  {
    label: "database migration",
    pattern:
      /(?:^|[\s;&|()])(?:db\s+migration\s+execute|(?:npx\s+)?prisma\s+migrate\s+(?:deploy|reset)|alembic\s+(?:upgrade|downgrade)|drizzle-kit\s+(?:push|migrate)|knex\s+migrate:(?:latest|up|down|rollback)|typeorm\s+migration:(?:run|revert)|rails\s+db:migrate|flyway\s+migrate|liquibase\s+update)(?:\s|$)/i,
  },
];

/**
 * Patterns where `--dry-run` on the same command segment renders execution read-only.
 */
export const DRY_RUN_EXEMPT_LABELS: ReadonlySet<string> = new Set<string>([
  "cloudflare deploy/delete",
  "supabase deploy/db mutation",
]);

const SEGMENT_SPLITTER = /(?:&&|\|\||[;\n|])/;
const DRY_RUN_FLAG = /(?:^|\s)--dry-run(?:\s|$)/i;

/**
 * Deterministic TypeScript port of `evaluate_command()` from `hooks/hitl-gate.py`.
 * Splits chained shell commands into segments, evaluates every segment against
 * all 11 high-impact rules with `--dry-run` exemptions, and computes the final verdict.
 */
export function evaluateHitlCommand(
  commandLine: string,
  bypassSandbox = false,
): HitlSimulateResponse {
  const segments: HitlSegmentResult[] = [];
  let firstBlockingRule: string | null = null;
  let anyDryRunExempt = false;

  if (commandLine && commandLine.trim().length > 0) {
    const rawSegments = commandLine.split(SEGMENT_SPLITTER);

    for (const rawSegment of rawSegments) {
      const seg = rawSegment.trim();
      if (!seg) {
        continue;
      }

      const isDryRun = DRY_RUN_FLAG.test(seg);
      let segMatchedRule: string | null = null;
      let segDecision: HitlDecision = "allow";
      let segExemptRule: string | null = null;

      for (const { label, pattern } of HIGH_IMPACT_PATTERNS) {
        if (pattern.test(seg)) {
          if (isDryRun && DRY_RUN_EXEMPT_LABELS.has(label)) {
            anyDryRunExempt = true;
            if (segExemptRule === null) {
              segExemptRule = label;
            }
            continue;
          }
          segMatchedRule = label;
          segDecision = "force_ask";
          break;
        }
      }

      if (segDecision === "force_ask" && firstBlockingRule === null) {
        firstBlockingRule = segMatchedRule;
      }

      segments.push({
        segment: seg,
        isDryRun,
        matchedRule: segMatchedRule ?? segExemptRule,
        decision: segDecision,
      });
    }
  }

  if (firstBlockingRule !== null) {
    return {
      decision: "force_ask",
      reason: `Enterprise Code Factory HITL Safety Gate: command matches '${firstBlockingRule}', which always requires explicit human confirmation.`,
      matchedRule: firstBlockingRule,
      dryRunExempt: false,
      segments,
    };
  }

  if (bypassSandbox) {
    return {
      decision: "ask",
      reason: "Command requested execution outside the sandbox.",
      matchedRule: null,
      dryRunExempt: anyDryRunExempt,
      segments,
    };
  }

  return {
    decision: "allow",
    reason: anyDryRunExempt
      ? "Command matched a dry-run-exempt deployment rule with --dry-run and is treated as read-only (allowed)."
      : "No high-impact pattern matched; command is allowed under standard Antigravity sandbox policies.",
    matchedRule: null,
    dryRunExempt: anyDryRunExempt,
    segments,
  };
}
