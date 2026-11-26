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

const UNSAFE_OVERWRITE_TOKENS = [
  "$(",
  "`",
  "<<",
  "(",
  ")",
  "{",
  "}",
  "\n",
  "\r",
  "\0",
] as const;

const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const GIT_SKIP_EXACT_FLAGS: ReadonlySet<string> = new Set([
  "--no-pager",
  "-p",
  "--paginate",
  "--exec-path",
  "-h",
  "--help",
  "--version",
]);

const CURL_SKIP_EXACT_FLAGS: ReadonlySet<string> = new Set([
  "--max-time",
  "-m",
  "-h",
  "--help",
  "-V",
  "--version",
]);

interface SegmentSpan {
  readonly start: number;
  readonly end: number;
}

interface ShellToken {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly envVarName: string | null;
}

interface CommandSplice {
  readonly index: number;
  readonly insertion: string;
}

function splitTopLevelSegments(commandLine: string): SegmentSpan[] | null {
  const spans: SegmentSpan[] = [];
  let segStart = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < commandLine.length; i += 1) {
    const ch = commandLine[i]!;

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === "\\") {
        if (i + 1 >= commandLine.length) {
          return null;
        }
        i += 1;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (ch === "\\") {
      if (i + 1 >= commandLine.length) {
        return null;
      }
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    const next = commandLine[i + 1];
    if ((ch === "&" && next === "&") || (ch === "|" && next === "|")) {
      spans.push({ start: segStart, end: i });
      i += 1;
      segStart = i + 1;
      continue;
    }

    if (ch === ";" || ch === "|") {
      spans.push({ start: segStart, end: i });
      segStart = i + 1;
    }
  }

  if (inSingle || inDouble) {
    return null;
  }

  spans.push({ start: segStart, end: commandLine.length });
  return spans;
}

function tokenizeSegment(
  commandLine: string,
  segStart: number,
  segEnd: number,
): ShellToken[] | null {
  const tokens: ShellToken[] = [];
  let i = segStart;

  while (i < segEnd) {
    while (i < segEnd && (commandLine[i] === " " || commandLine[i] === "\t")) {
      i += 1;
    }
    if (i >= segEnd) {
      break;
    }

    const tokenStart = i;
    let text = "";
    let inSingle = false;
    let inDouble = false;
    let sawQuoteOrEscapeBeforeEq = false;
    let envVarName: string | null = null;
    let sawEq = false;

    while (i < segEnd) {
      const ch = commandLine[i]!;

      if (inSingle) {
        if (ch === "'") {
          inSingle = false;
        } else {
          text += ch;
        }
        i += 1;
        continue;
      }

      if (inDouble) {
        if (ch === "\\") {
          if (i + 1 >= segEnd) {
            return null;
          }
          const next = commandLine[i + 1]!;
          if (next === '"' || next === "\\" || next === "$" || next === "`") {
            text += next;
          } else {
            text += `\\${next}`;
          }
          i += 2;
          continue;
        }
        if (ch === '"') {
          inDouble = false;
        } else {
          text += ch;
        }
        i += 1;
        continue;
      }

      if (ch === " " || ch === "\t") {
        break;
      }

      if (ch === "'") {
        if (!sawEq) sawQuoteOrEscapeBeforeEq = true;
        inSingle = true;
        i += 1;
        continue;
      }

      if (ch === '"') {
        if (!sawEq) sawQuoteOrEscapeBeforeEq = true;
        inDouble = true;
        i += 1;
        continue;
      }

      if (ch === "\\") {
        if (i + 1 >= segEnd) {
          return null;
        }
        if (!sawEq) sawQuoteOrEscapeBeforeEq = true;
        text += commandLine[i + 1]!;
        i += 2;
        continue;
      }

      if (ch === "=" && !sawEq) {
        sawEq = true;
        if (!sawQuoteOrEscapeBeforeEq && ENV_NAME_RE.test(text)) {
          envVarName = text;
        }
      }

      text += ch;
      i += 1;
    }

    if (inSingle || inDouble) {
      return null;
    }

    tokens.push({
      text,
      start: tokenStart,
      end: i,
      envVarName,
    });
  }

  return tokens;
}

function getArgsBeforeDoubleDash(args: readonly string[]): string[] {
  const dashDashIdx = args.indexOf("--");
  return dashDashIdx === -1 ? [...args] : args.slice(0, dashDashIdx);
}

function shouldSkipGitRewrite(
  hasGitPagerEnv: boolean,
  argsBeforeDashDash: readonly string[],
): boolean {
  if (hasGitPagerEnv) {
    return true;
  }
  return argsBeforeDashDash.some(
    (arg) => GIT_SKIP_EXACT_FLAGS.has(arg) || arg.startsWith("--exec-path="),
  );
}

function shouldSkipCurlRewrite(argsBeforeDashDash: readonly string[]): boolean {
  return argsBeforeDashDash.some((arg) => {
    if (CURL_SKIP_EXACT_FLAGS.has(arg) || arg.startsWith("--max-time=")) {
      return true;
    }
    if (
      arg.startsWith("-") &&
      !arg.startsWith("--") &&
      arg.length > 1 &&
      arg.slice(1).includes("m")
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Conservative transparent command rewriter with parity to `hooks/hitl-gate.py`.
 * Injects `--no-pager` on `git` and `--max-time 5` on `curl` for safe `allow`
 * commands, bailing out cleanly on subshells, heredocs, multiline scripts, or
 * unbalanced quotes.
 */
export function computeCommandOverwrite(
  commandLine: string,
): { CommandLine: string } | undefined {
  if (!commandLine || !commandLine.trim()) {
    return undefined;
  }

  for (const unsafe of UNSAFE_OVERWRITE_TOKENS) {
    if (commandLine.includes(unsafe)) {
      return undefined;
    }
  }

  const segmentSpans = splitTopLevelSegments(commandLine);
  if (!segmentSpans) {
    return undefined;
  }

  const splices: CommandSplice[] = [];

  for (const span of segmentSpans) {
    const tokens = tokenizeSegment(commandLine, span.start, span.end);
    if (!tokens) {
      return undefined;
    }
    if (tokens.length === 0) {
      continue;
    }

    let cmdIndex = 0;
    let hasGitPagerEnv = false;
    while (cmdIndex < tokens.length && tokens[cmdIndex]!.envVarName !== null) {
      if (tokens[cmdIndex]!.envVarName === "GIT_PAGER") {
        hasGitPagerEnv = true;
      }
      cmdIndex += 1;
    }

    if (cmdIndex >= tokens.length) {
      continue;
    }

    const cmdToken = tokens[cmdIndex]!;
    const cmdText = cmdToken.text;
    const trailingArgs = tokens.slice(cmdIndex + 1).map((t) => t.text);
    const argsBeforeDashDash = getArgsBeforeDoubleDash(trailingArgs);

    if (cmdText === "git" || cmdText.endsWith("/git")) {
      if (!shouldSkipGitRewrite(hasGitPagerEnv, argsBeforeDashDash)) {
        splices.push({ index: cmdToken.end, insertion: " --no-pager" });
      }
    } else if (cmdText === "curl" || cmdText.endsWith("/curl")) {
      if (!shouldSkipCurlRewrite(argsBeforeDashDash)) {
        splices.push({ index: cmdToken.end, insertion: " --max-time 5" });
      }
    }
  }

  if (splices.length === 0) {
    return undefined;
  }

  let rewritten = "";
  let cursor = 0;
  for (const splice of splices) {
    rewritten += commandLine.slice(cursor, splice.index) + splice.insertion;
    cursor = splice.index;
  }
  rewritten += commandLine.slice(cursor);

  if (rewritten === commandLine) {
    return undefined;
  }

  return { CommandLine: rewritten };
}

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

  const overwrite = computeCommandOverwrite(commandLine);

  return {
    decision: "allow",
    reason: anyDryRunExempt
      ? "Command matched a dry-run-exempt deployment rule with --dry-run and is treated as read-only (allowed)."
      : "No high-impact pattern matched; command is allowed under standard Antigravity sandbox policies.",
    matchedRule: null,
    dryRunExempt: anyDryRunExempt,
    segments,
    ...(overwrite ? { overwrite } : {}),
  };
}
