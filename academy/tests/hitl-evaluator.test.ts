import { describe, expect, it } from "vitest";
import {
  computeCommandOverwrite,
  evaluateHitlCommand,
} from "@/lib/hitl-evaluator";

describe("evaluateHitlCommand (parity with hooks/hitl-gate.py)", () => {
  it("allows benign read-only and local test commands", () => {
    const benign = [
      "git status",
      "git diff --stat",
      "npm test",
      "npx tsc --noEmit",
      "pnpm run lint",
      "python3 -m unittest -v hooks/test_hitl_gate.py",
    ];

    for (const cmd of benign) {
      const res = evaluateHitlCommand(cmd, false);
      expect(res.decision).toBe("allow");
      expect(res.matchedRule).toBeNull();
      expect(res.dryRunExempt).toBe(false);
    }
  });

  it("forces confirmation on git push including flag variants", () => {
    const pushCmds = [
      "git push origin main",
      "git -C /tmp/repo push --force",
      "git --git-dir=.git --work-tree=. push",
    ];

    for (const cmd of pushCmds) {
      const res = evaluateHitlCommand(cmd);
      expect(res.decision).toBe("force_ask");
      expect(res.matchedRule).toBe("git push");
    }
  });

  it("forces confirmation on high-impact destructive, publish, deploy, and migration commands", () => {
    const cases: Array<[string, string]> = [
      ["npm publish --access public", "npm/yarn/pnpm publish"],
      ["rm -rf ./dist", "rm -rf"],
      ["rm --recursive --force /tmp/build", "rm -rf"],
      ["docker push ghcr.io/org/app:latest", "docker/podman push"],
      ["kubectl apply -f deploy.yaml", "kubectl apply/delete"],
      ["npx wrangler deploy", "cloudflare deploy/delete"],
      ["cf deploy", "cloudflare deploy/delete"],
      ["npx vercel --prod", "vercel production deploy/delete"],
      ["npx vercel env rm SECRET_KEY", "vercel production deploy/delete"],
      ["npx supabase db push", "supabase deploy/db mutation"],
      ["npx supabase functions deploy hello", "supabase deploy/db mutation"],
      ["terraform apply -auto-approve", "terraform apply/destroy"],
      ["gh repo delete org/repo", "github repo delete"],
      ["npx prisma migrate deploy", "database migration"],
      ["alembic upgrade head", "database migration"],
    ];

    for (const [cmd, expectedRule] of cases) {
      const res = evaluateHitlCommand(cmd);
      expect(res.decision, cmd).toBe("force_ask");
      expect(res.matchedRule, cmd).toBe(expectedRule);
    }
  });

  it("exempts --dry-run on cloudflare and supabase segments only", () => {
    const cfDry = evaluateHitlCommand("npx wrangler deploy --dry-run");
    expect(cfDry.decision).toBe("allow");
    expect(cfDry.dryRunExempt).toBe(true);

    const sbDry = evaluateHitlCommand("npx supabase db push --dry-run");
    expect(sbDry.decision).toBe("allow");
    expect(sbDry.dryRunExempt).toBe(true);

    // Non-exempt commands MUST NOT bypass HITL with --dry-run
    const rmDry = evaluateHitlCommand("rm -rf ./tmp --dry-run");
    expect(rmDry.decision).toBe("force_ask");
    expect(rmDry.matchedRule).toBe("rm -rf");
  });

  it("evaluates chained shell segments independently and triggers if any segment is high-impact", () => {
    const chained = evaluateHitlCommand(
      "npx wrangler deploy --dry-run && git push origin main",
    );
    expect(chained.decision).toBe("force_ask");
    expect(chained.matchedRule).toBe("git push");
    expect(chained.segments).toHaveLength(2);
    expect(chained.segments[0]?.decision).toBe("allow");
    expect(chained.segments[0]?.isDryRun).toBe(true);
    expect(chained.segments[1]?.decision).toBe("force_ask");
  });

  it("returns ask when bypassSandbox is true for benign commands", () => {
    const res = evaluateHitlCommand("npm test", true);
    expect(res.decision).toBe("ask");
    expect(res.matchedRule).toBeNull();
  });

  it("returns force_ask even when bypassSandbox is true if command is high-impact", () => {
    const res = evaluateHitlCommand("git push origin main", true);
    expect(res.decision).toBe("force_ask");
    expect(res.matchedRule).toBe("git push");
    expect(res.overwrite).toBeUndefined();
    expect("overwrite" in res).toBe(false);
  });
});

describe("computeCommandOverwrite & HITL overwrite integration", () => {
  it("injects --no-pager on benign git and --max-time 5 on benign curl commands", () => {
    expect(computeCommandOverwrite("git status")).toEqual({
      CommandLine: "git --no-pager status",
    });
    expect(computeCommandOverwrite("/usr/bin/git diff --stat")).toEqual({
      CommandLine: "/usr/bin/git --no-pager diff --stat",
    });
    expect(computeCommandOverwrite("curl -s https://example.com")).toEqual({
      CommandLine: "curl --max-time 5 -s https://example.com",
    });
    expect(computeCommandOverwrite("/usr/bin/curl https://example.com")).toEqual({
      CommandLine: "/usr/bin/curl --max-time 5 https://example.com",
    });

    const gitEval = evaluateHitlCommand("git status", false);
    expect(gitEval.decision).toBe("allow");
    expect(gitEval.overwrite).toEqual({ CommandLine: "git --no-pager status" });

    const curlEval = evaluateHitlCommand("curl -s https://example.com", false);
    expect(curlEval.decision).toBe("allow");
    expect(curlEval.overwrite).toEqual({
      CommandLine: "curl --max-time 5 -s https://example.com",
    });
  });

  it("rewrites eligible segments across multi-segment pipelines while preserving quotes and env prefixes", () => {
    expect(
      computeCommandOverwrite("git diff && curl https://example.com"),
    ).toEqual({
      CommandLine: "git --no-pager diff && curl --max-time 5 https://example.com",
    });

    expect(
      computeCommandOverwrite(
        'FOO=1 git log --oneline | head -n 5; curl -H "Accept: application/json" https://example.com',
      ),
    ).toEqual({
      CommandLine:
        'FOO=1 git --no-pager log --oneline | head -n 5; curl --max-time 5 -H "Accept: application/json" https://example.com',
    });

    const pipeEval = evaluateHitlCommand("git diff && curl https://example.com", false);
    expect(pipeEval.decision).toBe("allow");
    expect(pipeEval.overwrite).toEqual({
      CommandLine: "git --no-pager diff && curl --max-time 5 https://example.com",
    });
  });

  it("respects git and curl skip flags, env overrides, and -- option delimiter semantics", () => {
    const skippedCommands = [
      "GIT_PAGER=cat git log",
      "git --no-pager status",
      "git -p log",
      "git --paginate log",
      "git --exec-path=/tmp status",
      "git --version",
      "git --help",
      "git -h",
      "curl --max-time 10 https://x",
      "curl --max-time=10 https://x",
      "curl -m 3 https://x",
      "curl -sSm 5 https://x",
      "curl --version",
      "curl -V",
      "curl --help",
      "curl -h",
      "git --no-pager log -- README.md",
      "curl --max-time 2 -- https://x",
    ];

    for (const cmd of skippedCommands) {
      expect(computeCommandOverwrite(cmd), cmd).toBeUndefined();
    }

    // Flags appearing AFTER `--` are positional args, not command options, so rewrite still applies
    expect(computeCommandOverwrite("git log -- --no-pager")).toEqual({
      CommandLine: "git --no-pager log -- --no-pager",
    });
    expect(computeCommandOverwrite("curl https://example.com -- --max-time")).toEqual({
      CommandLine: "curl --max-time 5 https://example.com -- --max-time",
    });
  });

  it("bails out safely on subshells, backticks, heredocs, grouping, multiline, unbalanced quotes, and quoted non-target executables", () => {
    const excludedCommands = [
      'git commit -m "$(date)"',
      "git commit -m `date`",
      "git commit -F - <<EOF",
      "(git status)",
      "{ git status; }",
      "git status\ncurl https://example.com",
      "git status\rcurl https://example.com",
      "git status\0",
      'git commit -m "unbalanced quote',
      "curl 'https://example.com",
      'echo "curl https://x"',
      `python3 -c "print('git status')"`,
      "",
      "   ",
    ];

    for (const cmd of excludedCommands) {
      expect(computeCommandOverwrite(cmd), cmd).toBeUndefined();
    }
  });

  it("never attaches overwrite on force_ask, ask (bypassSandbox), or non-git/curl benign commands", () => {
    const forceAskPush = evaluateHitlCommand("git push origin main", false);
    expect(forceAskPush.decision).toBe("force_ask");
    expect(forceAskPush.overwrite).toBeUndefined();
    expect("overwrite" in forceAskPush).toBe(false);

    const chainedForceAsk = evaluateHitlCommand(
      "git status && git push origin main",
      false,
    );
    expect(chainedForceAsk.decision).toBe("force_ask");
    expect(chainedForceAsk.overwrite).toBeUndefined();
    expect("overwrite" in chainedForceAsk).toBe(false);

    const askGit = evaluateHitlCommand("git status", true);
    expect(askGit.decision).toBe("ask");
    expect(askGit.overwrite).toBeUndefined();
    expect("overwrite" in askGit).toBe(false);

    const askCurl = evaluateHitlCommand("curl -s https://example.com", true);
    expect(askCurl.decision).toBe("ask");
    expect(askCurl.overwrite).toBeUndefined();
    expect("overwrite" in askCurl).toBe(false);

    const nonTargetBenign = evaluateHitlCommand("pnpm test", false);
    expect(nonTargetBenign.decision).toBe("allow");
    expect(nonTargetBenign.overwrite).toBeUndefined();
    expect("overwrite" in nonTargetBenign).toBe(false);
  });
});
