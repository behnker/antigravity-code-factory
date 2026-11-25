import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCourses } from "@/app/api/courses/route";
import { GET as getResources } from "@/app/api/resources/route";
import { POST as postHitlSimulate } from "@/app/api/hitl/simulate/route";

describe("Next.js API Route Handlers", () => {
  describe("GET /api/courses", () => {
    it("returns paginated validated courses", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?limit=10&offset=0");
      const res = await getCourses(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.length).toBeGreaterThanOrEqual(5);
      expect(data.total).toBeGreaterThanOrEqual(5);
      expect(data.items.map((c: { slug: string }) => c.slug)).toEqual(
        expect.arrayContaining([
          "harness-mastery",
          "code-factory-sdlc",
          "pro-setup-playbook",
          "lit-software-factory",
          "notebooklm-antigravity",
        ]),
      );
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(0);
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
