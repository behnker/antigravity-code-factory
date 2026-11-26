import { AcademyShell } from "@/components/AcademyShell";
import { FOUR_DOMAIN_CASES } from "@/data/four-domain-cases";
import { HARNESS_DIMENSIONS } from "@/data/harness-comparison";
import { getRepoManifest } from "@/lib/repository";

export default function AcademyHomePage() {
  const manifest = getRepoManifest();

  return (
    <AcademyShell
      manifest={manifest}
      harnessDimensions={HARNESS_DIMENSIONS}
      domainCases={[...FOUR_DOMAIN_CASES]}
    />
  );
}
