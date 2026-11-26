import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCourses } from "@/app/api/courses/route";
import { GET as getResources } from "@/app/api/resources/route";
import { POST as postHitlSimulate } from "@/app/api/hitl/simulate/route";
import {
  CourseSchema,
  isAllowedImageUrl,
  isAllowedLiveUrl,
  isAllowedProofImageUrl,
  type Course,
} from "@/lib/schemas";

const EXPECTED_COURSE_SLUGS = [
  "zero-to-one-foundations",
  "harness-mastery",
  "code-factory-sdlc",
  "pro-setup-playbook",
  "lit-software-factory",
  "notebooklm-antigravity",
  "enterprise-product-video-studio",
  "orchestration-showcase",
  "vibe-website-factory",
] as const;

const ACADEMY_PUBLIC_DIR = path.resolve(__dirname, "..", "public");

describe("Next.js API Route Handlers", () => {
  describe("GET /api/courses", () => {
    it("returns all 9 validated courses sorted strictly in ascending order 0..8", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?limit=10&offset=0");
      const res = await getCourses(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toHaveLength(9);
      expect(data.total).toBe(9);
      expect(data.items.map((c: Course) => c.number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      expect(data.items.map((c: Course) => c.slug)).toEqual([...EXPECTED_COURSE_SLUGS]);
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(0);
    });

    it("enforces 100% ELI5, allowlisted illustration on disk, mermaidDiagram, proofGallery safety, and prompt metadata coverage across courses 0..8", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?limit=20&offset=0");
      const res = await getCourses(req);
      expect(res.status).toBe(200);
      const data: { items: Course[]; total: number } = await res.json();
      expect(data.total).toBe(9);
      expect(data.items).toHaveLength(9);

      for (const course of data.items) {
        const parsed = CourseSchema.safeParse(course);
        expect(parsed.success, `CourseSchema validation failed for ${course.slug}`).toBe(true);

        expect(
          course.eli5Title?.trim().length ?? 0,
          `Course ${course.slug} missing eli5Title`,
        ).toBeGreaterThan(0);
        expect(
          course.eli5Tagline?.trim().length ?? 0,
          `Course ${course.slug} missing eli5Tagline`,
        ).toBeGreaterThan(0);

        expect(
          course.illustration,
          `Course ${course.slug} missing illustration`,
        ).toBeDefined();
        const illustrationSrc = course.illustration!.src;
        expect(
          isAllowedImageUrl(illustrationSrc),
          `Course ${course.slug} illustration.src is not allowlisted: ${illustrationSrc}`,
        ).toBe(true);

        const assetRelativePath = illustrationSrc.replace(/^\/+/, "");
        const assetFullPath = path.resolve(ACADEMY_PUBLIC_DIR, assetRelativePath);
        expect(
          assetFullPath.startsWith(`${ACADEMY_PUBLIC_DIR}${path.sep}`),
          `Course ${course.slug} illustration path escapes academy/public: ${assetFullPath}`,
        ).toBe(true);
        expect(
          fs.existsSync(assetFullPath) && fs.statSync(assetFullPath).isFile(),
          `Course ${course.slug} illustration file missing on disk: ${assetFullPath}`,
        ).toBe(true);

        expect(course.steps.length, `Course ${course.slug} has no steps`).toBeGreaterThan(0);
        for (const step of course.steps) {
          const stepCtx = `${course.slug}/${step.id}`;
          expect(
            step.mermaidDiagram?.trim().length ?? 0,
            `Step ${stepCtx} missing mermaidDiagram`,
          ).toBeGreaterThan(0);

          expect(step.eli5, `Step ${stepCtx} missing eli5 block`).toBeDefined();
          const eli5 = step.eli5!;
          expect(eli5.plainTitle?.trim().length ?? 0, `Step ${stepCtx} missing eli5.plainTitle`).toBeGreaterThan(0);
          expect(eli5.oneLineHook?.trim().length ?? 0, `Step ${stepCtx} missing eli5.oneLineHook`).toBeGreaterThan(0);
          expect(eli5.whenToUse?.trim().length ?? 0, `Step ${stepCtx} missing eli5.whenToUse`).toBeGreaterThan(0);
          expect(eli5.audioScript.trim().length, `Step ${stepCtx} missing eli5.audioScript`).toBeGreaterThan(0);
          expect(eli5.everydayAnalogy.trim().length, `Step ${stepCtx} missing eli5.everydayAnalogy`).toBeGreaterThan(0);
          expect(eli5.simpleExplanation.trim().length, `Step ${stepCtx} missing eli5.simpleExplanation`).toBeGreaterThan(0);
          expect(eli5.whyItMatters.trim().length, `Step ${stepCtx} missing eli5.whyItMatters`).toBeGreaterThan(0);
          expect(eli5.roleInProtocol.trim().length, `Step ${stepCtx} missing eli5.roleInProtocol`).toBeGreaterThan(0);
          expect(eli5.howToUseGoingForward.trim().length, `Step ${stepCtx} missing eli5.howToUseGoingForward`).toBeGreaterThan(0);
          expect(eli5.realWorldExample.trim().length, `Step ${stepCtx} missing eli5.realWorldExample`).toBeGreaterThan(0);

          if (step.proofGallery) {
            if (step.proofGallery.liveUrl) {
              expect(
                isAllowedLiveUrl(step.proofGallery.liveUrl),
                `Step ${stepCtx} proofGallery.liveUrl is not allowlisted`,
              ).toBe(true);
            }
            for (const artifact of step.proofGallery.artifacts) {
              if (artifact.imageSrc) {
                expect(
                  isAllowedProofImageUrl(artifact.imageSrc),
                  `Step ${stepCtx} proof artifact ${artifact.id} imageSrc not allowlisted`,
                ).toBe(true);
                const proofRelative = artifact.imageSrc.replace(/^\/+/, "");
                const proofFullPath = path.resolve(ACADEMY_PUBLIC_DIR, proofRelative);
                expect(
                  proofFullPath.startsWith(`${ACADEMY_PUBLIC_DIR}${path.sep}`),
                  `Step ${stepCtx} proof image escapes public dir`,
                ).toBe(true);
                expect(
                  fs.existsSync(proofFullPath) && fs.statSync(proofFullPath).isFile(),
                  `Step ${stepCtx} proof image missing on disk: ${proofFullPath}`,
                ).toBe(true);
              }
            }
          }
        }

        for (const prompt of course.prompts) {
          const promptCtx = `${course.slug}/${prompt.id}`;
          expect(
            prompt.eli5Title?.trim().length ?? 0,
            `Prompt ${promptCtx} missing eli5Title`,
          ).toBeGreaterThan(0);
          expect(
            prompt.whenToUse?.trim().length ?? 0,
            `Prompt ${promptCtx} missing whenToUse`,
          ).toBeGreaterThan(0);
        }
      }
    });

    it("rejects out-of-bounds pagination limit > 100 with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?limit=500");
      const res = await getCourses(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe("INVALID_QUERY");
    });

    it("reflects v3.0.0 & v3.1.0 curriculum updates in code-factory-sdlc Step 10/11 (cf-prompt-rewind) and harness-mastery real hook snippets", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?limit=20&offset=0");
      const res = await getCourses(req);
      expect(res.status).toBe(200);
      const data: { items: Course[] } = await res.json();

      const sdlcCourse = data.items.find((c) => c.slug === "code-factory-sdlc");
      expect(sdlcCourse).toBeDefined();
      const step10 = sdlcCourse!.steps.find((s) => s.id === "cf-stage-10-core-hooks");
      expect(step10).toBeDefined();
      expect(step10!.order).toBe(10);
      expect(step10!.repoArtifactPath).toBe("hooks.json");
      expect(step10!.promptId).toBe("cf-prompt-v3-core-hooks");
      const v3Prompt = sdlcCourse!.prompts.find((p) => p.id === "cf-prompt-v3-core-hooks");
      expect(v3Prompt).toBeDefined();

      const step11 = sdlcCourse!.steps.find((s) => s.id === "cf-stage-11-phase2-automation");
      expect(step11).toBeDefined();
      expect(step11!.order).toBe(11);
      expect(step11!.repoArtifactPath).toBe("skills/cf-rewind/SKILL.md");
      expect(step11!.promptId).toBe("cf-prompt-rewind");
      const rewindPrompt = sdlcCourse!.prompts.find((p) => p.id === "cf-prompt-rewind");
      expect(rewindPrompt).toBeDefined();
      expect(rewindPrompt!.skillRef).toBe("cf-rewind");

      const harnessCourse = data.items.find((c) => c.slug === "harness-mastery");
      expect(harnessCourse).toBeDefined();
      const hooksJsonStep = harnessCourse!.steps.find(
        (s) => s.codeSnippet?.filename.includes("hooks.json"),
      );
      expect(hooksJsonStep).toBeDefined();
      expect(hooksJsonStep!.codeSnippet!.code).toContain("code-factory-session-start");
      expect(hooksJsonStep!.codeSnippet!.code).toContain("code-factory-checkpoint");
      expect(hooksJsonStep!.codeSnippet!.code).toContain("code-factory-post-tool-feedback");
      expect(hooksJsonStep!.codeSnippet!.code).toContain("code-factory-pre-invocation");
      expect(hooksJsonStep!.codeSnippet!.code).toContain("code-factory-stop-gate");

      const preInvStep = harnessCourse!.steps.find(
        (s) => s.codeSnippet?.filename.includes("hooks/pre-invocation.py"),
      );
      expect(preInvStep).toBeDefined();
      expect(preInvStep!.codeSnippet!.code).toContain("hook_state.update_state");
      expect(preInvStep!.codeSnippet!.code).toContain('"systemMessage": {"systemMessage"');
    });

    it("serves Course 08 (vibe-website-factory) with 7 proofGallery steps & 5 prompts and Course 02 cf-prompt-learn-distill (skillRef: cf-learn)", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?limit=20&offset=0");
      const res = await getCourses(req);
      expect(res.status).toBe(200);
      const data: { items: Course[]; total: number } = await res.json();
      expect(data.total).toBe(9);

      const course08 = data.items.find((c) => c.slug === "vibe-website-factory");
      expect(course08).toBeDefined();
      expect(course08!.number).toBe(8);
      expect(course08!.steps).toHaveLength(7);
      expect(course08!.prompts).toHaveLength(5);
      for (const step of course08!.steps) {
        expect(
          step.proofGallery,
          `Course 08 step ${step.id} is missing proofGallery`,
        ).toBeDefined();
        expect(step.proofGallery!.artifacts.length).toBeGreaterThanOrEqual(1);
      }

      const course08PromptRefs = course08!.prompts.map((p) => p.skillRef);
      expect(course08PromptRefs).toEqual(
        expect.arrayContaining([
          "cf-website-factory",
          "cf-design-tokens",
          "cf-threejs-craft",
          "cf-geo-seo",
        ]),
      );

      const sdlcCourse = data.items.find((c) => c.slug === "code-factory-sdlc");
      expect(sdlcCourse).toBeDefined();
      const learnPrompt = sdlcCourse!.prompts.find((p) => p.id === "cf-prompt-learn-distill");
      expect(learnPrompt).toBeDefined();
      expect(learnPrompt!.skillRef).toBe("cf-learn");
      expect(learnPrompt!.eli5Title?.trim().length ?? 0).toBeGreaterThan(0);
      expect(learnPrompt!.whenToUse?.trim().length ?? 0).toBeGreaterThan(0);
    });
  });

  describe("GET /api/resources", () => {
    it("filters live repo resources by category and query", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/resources?category=agent&limit=20&offset=0",
      );
      const res = await getResources(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.length).toBe(5);
      expect(data.syncedAt).toBeTruthy();

      const skillReq = new NextRequest(
        "http://localhost:3000/api/resources?category=skill&q=cf-loop-engineer",
      );
      const skillRes = await getResources(skillReq);
      expect(skillRes.status).toBe(200);
      const skillData = await skillRes.json();
      expect(skillData.items.length).toBeGreaterThanOrEqual(1);
    });

    it("reflects v3.1.0 plugin manifest, all 9 hook resources, 2 sidecar resources, 4 workflow resources, and all 20 mapped skills", async () => {
      const manifestReq = new NextRequest(
        "http://localhost:3000/api/resources?category=manifest&limit=10&offset=0",
      );
      const manifestRes = await getResources(manifestReq);
      expect(manifestRes.status).toBe(200);
      const manifestData = await manifestRes.json();
      const pluginJson = manifestData.items.find(
        (item: { relativePath: string }) => item.relativePath === "plugin.json",
      );
      expect(pluginJson).toBeDefined();
      expect(JSON.parse(pluginJson.content).version).toMatch(/^3\.1\.\d+$/);
      expect(JSON.parse(pluginJson.content).version).toBe("3.1.0");

      const hookReq = new NextRequest(
        "http://localhost:3000/api/resources?category=hook&limit=20&offset=0",
      );
      const hookRes = await getResources(hookReq);
      expect(hookRes.status).toBe(200);
      const hookData = await hookRes.json();
      expect(hookData.total).toBe(9);
      expect(hookData.items).toHaveLength(9);
      const hookPaths = hookData.items.map(
        (item: { relativePath: string }) => item.relativePath,
      );
      expect(hookPaths).toEqual(
        expect.arrayContaining([
          "hooks.json",
          "hooks/hook_state.py",
          "hooks/session-start.py",
          "hooks/hitl-gate.py",
          "hooks/secret-guard.py",
          "hooks/checkpoint-hook.py",
          "hooks/post-tool-feedback.py",
          "hooks/pre-invocation.py",
          "hooks/stop-gate.py",
        ]),
      );

      const sidecarReq = new NextRequest(
        "http://localhost:3000/api/resources?category=sidecar&limit=10&offset=0",
      );
      const sidecarRes = await getResources(sidecarReq);
      expect(sidecarRes.status).toBe(200);
      const sidecarData = await sidecarRes.json();
      expect(sidecarData.total).toBe(2);
      expect(sidecarData.items).toHaveLength(2);
      expect(
        sidecarData.items.map((item: { relativePath: string }) => item.relativePath),
      ).toEqual(
        expect.arrayContaining([
          "sidecars/telemetry-memory/sidecar.json",
          "sidecars/telemetry-memory/sidecar.py",
        ]),
      );

      const workflowReq = new NextRequest(
        "http://localhost:3000/api/resources?category=workflow&limit=10&offset=0",
      );
      const workflowRes = await getResources(workflowReq);
      expect(workflowRes.status).toBe(200);
      const workflowData = await workflowRes.json();
      expect(workflowData.total).toBe(4);
      expect(workflowData.items).toHaveLength(4);
      expect(
        workflowData.items.map((item: { relativePath: string }) => item.relativePath),
      ).toEqual(
        expect.arrayContaining([
          "workflows/cf-qa-gate/workflow.json",
          "workflows/cf-qa-gate/workflow.py",
          "workflows/cf-implement-spec/workflow.json",
          "workflows/cf-implement-spec/workflow.py",
        ]),
      );

      const skillsReq = new NextRequest(
        "http://localhost:3000/api/resources?category=skill&limit=50&offset=0",
      );
      const skillsRes = await getResources(skillsReq);
      expect(skillsRes.status).toBe(200);
      const skillsData = await skillsRes.json();
      const skillEntries = (
        skillsData.items as Array<{
          name: string;
          relativePath: string;
          stageRef?: string;
        }>
      ).filter((item) => item.relativePath.endsWith("/SKILL.md"));
      expect(skillEntries).toHaveLength(20);
      const skillNames = skillEntries.map((item) => item.name);
      expect(skillNames).toEqual(
        expect.arrayContaining([
          "cf-rewind",
          "cf-website-factory",
          "cf-design-tokens",
          "cf-threejs-craft",
          "cf-geo-seo",
        ]),
      );
      for (const skill of skillEntries) {
        expect(skill.stageRef?.trim().length ?? 0, `${skill.name} missing stageRef`).toBeGreaterThan(0);
      }
    });

    it("returns empty array when search has no match", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/resources?q=nonexistent_xyz_token_999",
      );
      const res = await getResources(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toEqual([]);
      expect(data.total).toBe(0);
    });

    it("returns 400 for invalid category enum", async () => {
      const req = new NextRequest("http://localhost:3000/api/resources?category=secrets");
      const res = await getResources(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe("INVALID_QUERY");
    });
  });

  describe("POST /api/hitl/simulate", () => {
    it("evaluates high-impact commands cleanly and omits overwrite", async () => {
      const req = new NextRequest("http://localhost:3000/api/hitl/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commandLine: "git push origin main", bypassSandbox: false }),
      });
      const res = await postHitlSimulate(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.decision).toBe("force_ask");
      expect(data.matchedRule).toBe("git push");
      expect(data.overwrite).toBeUndefined();
      expect("overwrite" in data).toBe(false);
    });

    it("returns transparent overwrite for benign git and curl commands", async () => {
      const gitReq = new NextRequest("http://localhost:3000/api/hitl/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commandLine: "git status", bypassSandbox: false }),
      });
      const gitRes = await postHitlSimulate(gitReq);
      expect(gitRes.status).toBe(200);
      const gitData = await gitRes.json();
      expect(gitData.decision).toBe("allow");
      expect(gitData.overwrite).toEqual({ CommandLine: "git --no-pager status" });

      const curlReq = new NextRequest("http://localhost:3000/api/hitl/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commandLine: "curl -s https://example.com",
          bypassSandbox: false,
        }),
      });
      const curlRes = await postHitlSimulate(curlReq);
      expect(curlRes.status).toBe(200);
      const curlData = await curlRes.json();
      expect(curlData.decision).toBe("allow");
      expect(curlData.overwrite).toEqual({
        CommandLine: "curl --max-time 5 -s https://example.com",
      });
    });

    it("omits overwrite for ask (bypassSandbox) and benign non-git/curl commands", async () => {
      const askReq = new NextRequest("http://localhost:3000/api/hitl/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commandLine: "git status", bypassSandbox: true }),
      });
      const askRes = await postHitlSimulate(askReq);
      expect(askRes.status).toBe(200);
      const askData = await askRes.json();
      expect(askData.decision).toBe("ask");
      expect(askData.overwrite).toBeUndefined();
      expect("overwrite" in askData).toBe(false);

      const benignReq = new NextRequest("http://localhost:3000/api/hitl/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commandLine: "pnpm test", bypassSandbox: false }),
      });
      const benignRes = await postHitlSimulate(benignReq);
      expect(benignRes.status).toBe(200);
      const benignData = await benignRes.json();
      expect(benignData.decision).toBe("allow");
      expect(benignData.overwrite).toBeUndefined();
      expect("overwrite" in benignData).toBe(false);
    });

    it("returns 415 when content-type is not application/json", async () => {
      const req = new NextRequest("http://localhost:3000/api/hitl/simulate", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "git status",
      });
      const res = await postHitlSimulate(req);
      expect(res.status).toBe(415);
      const data = await res.json();
      expect(data.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    });

    it("returns 400 on empty commandLine validation failure", async () => {
      const req = new NextRequest("http://localhost:3000/api/hitl/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commandLine: "   " }),
      });
      const res = await postHitlSimulate(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe("INVALID_INPUT");
    });
  });
});
