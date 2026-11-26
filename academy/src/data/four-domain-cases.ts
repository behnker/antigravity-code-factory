import { z } from "zod";
import { DomainCaseStudySchema, type DomainCaseStudy } from "@/lib/schemas";

const RAW_FOUR_DOMAIN_CASES: DomainCaseStudy[] = [
  {
    id: "website",
    order: 1,
    domainLabel: "Website",
    title: "The Herd of Ibiza: GT-Alpaca",
    eli5Title: "Interactive 3D Game Showcase Website",
    repoName: "gt-alpaca-website",
    status: "shipped",
    accentTone: "amber",
    summary:
      "Live Next.js 16 SSR flagship website built via the 6-stage cf-website-factory pipeline: W3C tokens -> Tailwind v4 (30/30 Light+Dark WCAG AA/AAA pairs), 81.57% GLB compression (4.52 MB -> 852 KB), R3F/Three.js showcase for 22 alpacas, 7 routes, and 23 tracks, 5 SSR GEO/AEO routes, 15/15 verify:map, Pass 2 cf-eval SHIP, and 12/12 live production smoke tests.",
    eli5Summary:
      "A live, magazine-grade 3D website showcasing 22 Ibiza alpacas, 7 island routes, and 23 tracks—shrinking the 3D hero by 81.57%, passing all 30 Light/Dark readability checks, 15/15 multi-screen tests, and 12/12 live production checks.",
    stack: [
      "Next.js 16 App Router",
      "Tailwind CSS v4",
      "Three.js / R3F",
      "W3C Design Tokens",
      "JSON-LD @graph",
      "Vercel",
    ],
    skillsApplied: [
      "cf-website-factory",
      "cf-design-tokens",
      "cf-threejs-craft",
      "cf-geo-seo",
      "cf-next-verify",
      "cf-verify-map",
      "cf-eval",
    ],
    verifiedMetrics: [
      {
        label: "GLB Compression",
        value: "81.57% (4.52 MB -> 852 KB)",
      },
      {
        label: "WCAG Light + Dark",
        value: "30/30 pairs >= 5.75:1 (0 token leaks)",
      },
      {
        label: "Multi-Viewport & GEO",
        value: "15/15 verify:map · 5 SSR routes · 0 GEO errors",
      },
      {
        label: "Live Launch & Eval",
        value: "Pass 2 SHIP · 29/29 Vitest · 12/12 live smoke",
      },
      {
        label: "Verified Catalog",
        value: "22 alpacas · 7 Ibiza routes · 23 tracks",
      },
    ],
    proofArtifactPath:
      "gt-alpaca-website/proof-pack/09-launch-and-walkthrough/phase-completion-matrix.md",
    liveUrl: "https://gt-alpaca-website.vercel.app",
    linkedCourseSlug: "vibe-website-factory",
    linkedCourseNumber: 8,
  },
  {
    id: "game",
    order: 2,
    domainLabel: "Mobile / Web 3D Game",
    title: "The Herd of Ibiza: GT-Alpaca Edition",
    eli5Title: "Playable 3D Racing Game for Mobile & Web",
    repoName: "herd_and_co",
    status: "shipped",
    accentTone: "emerald",
    summary:
      "Live 3D web and mobile arcade racer built with Vite 7, React 19, and Three.js (0.180.0), featuring 22 alpacas, 7 Ibiza routes, 23 local tracks, Vercel /api/race + Supabase leaderboard persistence, build:poki and build:crazygames HTML5 portal seams, and Playwright verify:all + verify:sponsors verification gates.",
    eli5Summary:
      "A full 3D racing game you can play right in a phone or desktop browser—complete with 22 racers, 7 scenic island routes, 23 local tracks, an online leaderboard, and automated browser checks verifying every game portal build.",
    stack: [
      "Vite 7",
      "React 19",
      "Three.js 0.180.0",
      "Vercel /api/race",
      "Supabase Leaderboard",
      "Playwright",
    ],
    skillsApplied: [
      "cf-research",
      "cf-plan",
      "cf-implement",
      "cf-threejs-craft",
      "cf-qa-review",
      "cf-deploy-staging",
    ],
    verifiedMetrics: [
      {
        label: "Playable Roster",
        value: "22 alpacas · 7 Ibiza routes",
      },
      {
        label: "Local Soundtrack",
        value: "23 local tracks",
      },
      {
        label: "HTML5 Portal Seam",
        value: "build:poki + build:crazygames",
      },
      {
        label: "Playwright Gates",
        value: "verify:all + verify:sponsors",
      },
    ],
    proofArtifactPath: "herd_and_co/package.json",
    liveUrl: "https://www.alpacas-ibiza.app",
  },
  {
    id: "video",
    order: 3,
    domainLabel: "Video Generation",
    title: "Enterprise Product Video Studio",
    eli5Title: "Broadcast-Grade 60fps Automated Video Studio",
    repoName: "product-video-studio",
    status: "shipped",
    accentTone: "rose",
    summary:
      "Code-driven product video pipeline powered by Remotion 4 (60 fps), Metal GPU Playwright canvas.captureStream(60), and FFmpeg mastering (-14 LUFS, +faststart), producing RMS beat-synced 16:9 (24 MB master / 12 MB live Course 06 embed) and 9:16 (22 MB master) teasers.",
    eli5Summary:
      "A repeatable code-powered video studio that records smooth 60-frames-per-second gameplay clips, cuts right on the music beat, balances loudness automatically, and delivers widescreen and phone-vertical trailers.",
    stack: [
      "Remotion 4 (60 fps)",
      "Playwright Metal GPU",
      "canvas.captureStream(60)",
      "FFmpeg (-14 LUFS)",
      "RMS Beat Sync",
      "TypeScript",
    ],
    skillsApplied: [
      "cf-research",
      "cf-plan",
      "cf-implement",
      "cf-qa-review",
      "cf-eval",
      "cf-handover",
    ],
    verifiedMetrics: [
      {
        label: "Mastering Spec",
        value: "60 fps · -14 LUFS · +faststart",
      },
      {
        label: "16:9 Teaser",
        value: "24 MB master · 12 MB Course 06 embed",
      },
      {
        label: "9:16 Vertical",
        value: "22 MB master (RMS beat-synced)",
      },
      {
        label: "GPU Capture",
        value: "Metal Playwright canvas.captureStream(60)",
      },
    ],
    proofArtifactPath:
      "academy/content/courses/enterprise-product-video-studio/course.json",
    linkedCourseSlug: "enterprise-product-video-studio",
    linkedCourseNumber: 6,
  },
  {
    id: "harness",
    order: 4,
    domainLabel: "App & Harness Engineering",
    title: "Antigravity Academy + Enterprise Code Factory v3.0.0",
    eli5Title: "Self-Governing AI Harness & Interactive Academy",
    repoName: "Project_Antigravity / academy",
    status: "shipped",
    accentTone: "cyan",
    summary:
      "Pure Python 3 stdlib 5-event lifecycle hooks (8 hook resources), 19 progressive skills (19/19 Prompt Vault coverage), and 5 least-privilege personas paired with the stateless Next.js App Router + Tailwind v4 + Zod + Mermaid + depcruise + cf-verify-map Academy (139+ verified checks, 0 High/Critical CVEs).",
    eli5Summary:
      "Both the safety-harness toolkit that keeps AI coding calm and reliable (5 automatic checkpoints and 19 step-by-step skills) and this interactive web Academy itself—backed by 139+ passing checks and zero high-severity vulnerabilities.",
    stack: [
      "Next.js App Router",
      "Tailwind CSS v4",
      "Zod v4",
      "Python 3 Stdlib Hooks",
      "Mermaid + depcruise",
      "Vercel",
    ],
    skillsApplied: [
      "cf-bootstrap",
      "cf-research",
      "cf-grill-me",
      "cf-plan",
      "cf-implement",
      "cf-next-verify",
      "cf-verify-map",
      "cf-qa-review",
      "cf-eval",
      "cf-deploy-staging",
      "cf-learn",
      "cf-handover",
    ],
    verifiedMetrics: [
      {
        label: "Core Hooks",
        value: "5 lifecycle events · 8 hook resources",
      },
      {
        label: "Skill & Agent Matrix",
        value: "19/19 skills · 5 least-privilege personas",
      },
      {
        label: "Verification Suite",
        value: "139+ verified automated checks",
      },
      {
        label: "Security Posture",
        value: "0 High/Critical CVEs · 0 depcruise leaks",
      },
    ],
    proofArtifactPath: "plans/code-factory-v3-phase1-spec.md",
    liveUrl: "https://antigravity-academy-ten.vercel.app",
    linkedCourseSlug: "code-factory-sdlc",
    linkedCourseNumber: 2,
  },
];

export const FOUR_DOMAIN_CASES: readonly DomainCaseStudy[] = z
  .array(DomainCaseStudySchema)
  .length(4)
  .parse(RAW_FOUR_DOMAIN_CASES);
