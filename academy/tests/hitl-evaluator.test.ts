import { describe, expect, it } from "vitest";
import { evaluateHitlCommand } from "@/lib/hitl-evaluator";

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
  });
});
