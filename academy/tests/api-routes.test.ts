import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCourses } from "@/app/api/courses/route";
import { GET as getResources } from "@/app/api/resources/route";
import { POST as postHitlSimulate } from "@/app/api/hitl/simulate/route";
import { CourseSchema, isAllowedImageUrl, type Course } from "@/lib/schemas";

const EXPECTED_COURSE_SLUGS = [
  "zero-to-one-foundations",
  "harness-mastery",
  "code-factory-sdlc",
  "pro-setup-playbook",
  "lit-software-factory",
  "notebooklm-antigravity",
  "enterprise-product-video-studio",
  "orchestration-showcase",
] as const;

const ACADEMY_PUBLIC_DIR = path.resolve(__dirname, "..", "public");

describe("Next.js API Route Handlers", () => {
  describe("GET /api/courses", () => {
    it("returns all 8 validated courses sorted strictly in ascending order 0..7", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?limit=10&offset=0");
      const res = await getCourses(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toHaveLength(8);
      expect(data.total).toBe(8);
      expect(data.items.map((c: Course) => c.number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(data.items.map((c: Course) => c.slug)).toEqual([...EXPECTED_COURSE_SLUGS]);
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(0);
    });

    it("enforces 100% ELI5, allowlisted illustration on disk, mermaidDiagram, and prompt metadata coverage across courses 0..7", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?limit=20&offset=0");
      const res = await getCourses(req);
      expect(res.status).toBe(200);
      const data: { items: Course[]; total: number } = await res.json();
      expect(data.total).toBe(8);
      expect(data.items).toHaveLength(8);

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
    it("evaluates high-impact commands cleanly", async () => {
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
